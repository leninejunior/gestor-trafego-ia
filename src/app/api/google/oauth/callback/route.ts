import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const storedStateCookie = cookies().get('google_oauth_state');
  if (storedStateCookie) {
    cookies().delete('google_oauth_state');
  }

  if (!storedStateCookie || !state || !code) {
    return new Response('Invalid request. State or code missing.', { status: 400 });
  }

  const storedState = JSON.parse(storedStateCookie.value);
  const receivedState = JSON.parse(state);

  if (storedState.csrf !== receivedState.csrf) {
    return new Response('Invalid CSRF token.', { status: 403 });
  }

  const clientId = storedState.clientId;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/oauth/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Listar contas de anúncios acessíveis
    const response = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN!,
      },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to list accessible customers: ${JSON.stringify(error)}`);
    }

    const customersData = await response.json();
    const customerResourceName = customersData.resourceNames?.[0];
    if (!customerResourceName) {
      throw new Error('No Google Ads accounts found for this user.');
    }
    
    const externalId = customerResourceName.replace('customers/', '');

    const supabase = createClient();
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('org_id')
      .eq('id', clientId)
      .single();

    if (clientError) throw clientError;

    const { data: adAccountRecord, error: adAccountError } = await supabase
      .from('ad_accounts')
      .upsert({
        client_id: clientId,
        org_id: clientData.org_id,
        provider: 'google',
        external_id: externalId,
        name: `Google Ads Account ${externalId}`, // O nome pode ser obtido com outra chamada de API
      }, { onConflict: 'client_id,external_id' })
      .select()
      .single();

    if (adAccountError) throw adAccountError;

    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        ad_account_id: adAccountRecord.id,
        org_id: clientData.org_id,
        client_id: clientId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      }, { onConflict: 'ad_account_id' });

    if (tokenError) throw tokenError;

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients/${clientId}`);

  } catch (error: any) {
    console.error('Google OAuth Callback Error:', error);
    return new Response(`An error occurred: ${error.message}`, { status: 500 });
  }
}