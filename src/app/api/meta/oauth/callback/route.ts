import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface TokenData {
  access_token: string;
  expires_in: number;
  token_type: string;
  error?: { message: string };
}

interface AdAccount {
  id: string;
  name: string;
  currency: string;
  timezone?: string;
}

interface AdAccountsData {
  data: AdAccount[];
  error?: { message: string };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const storedStateCookie = cookies().get('meta_oauth_state');
  
  // Clear the cookie after reading it
  if (storedStateCookie) {
    cookies().delete('meta_oauth_state');
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
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/oauth/callback`;
  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const metaAppSecret = process.env.META_APP_SECRET;

  // 1. Exchange code for an access token
  const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', metaAppId!);
  tokenUrl.searchParams.set('redirect_uri', redirectUri);
  tokenUrl.searchParams.set('client_secret', metaAppSecret!);
  tokenUrl.searchParams.set('code', code);

  try {
    const tokenRes = await fetch(tokenUrl);
    const tokenData: TokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokenData.error?.message || 'Failed to fetch access token');
    }
    const accessToken = tokenData.access_token;

    // 2. Use the token to get the user's ad accounts
    const adAccountsUrl = new URL('https://graph.facebook.com/me/adaccounts');
    adAccountsUrl.searchParams.set('fields', 'id,name,currency,timezone');
    adAccountsUrl.searchParams.set('access_token', accessToken);

    const adAccountsRes = await fetch(adAccountsUrl);
    const adAccountsData: AdAccountsData = await adAccountsRes.json();

    if (!adAccountsRes.ok) {
      throw new Error(adAccountsData.error?.message || 'Failed to fetch ad accounts');
    }

    // For this example, we'll just use the first ad account.
    // A real app should let the user choose.
    const adAccount = adAccountsData.data?.[0];
    if (!adAccount) {
      throw new Error('No ad accounts found for this user.');
    }

    const supabase = createClient();
    
    // 3. Get org_id from the client
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('org_id')
      .eq('id', clientId)
      .single();

    if (clientError) throw clientError;

    // 4. Upsert ad account and token into the database
    const { data: adAccountRecord, error: adAccountError } = await supabase
      .from('ad_accounts')
      .upsert({
        client_id: clientId,
        org_id: clientData.org_id, // Usando org_id
        provider: 'meta',
        external_id: adAccount.id,
        name: adAccount.name,
        currency: adAccount.currency,
      }, { onConflict: 'client_id,external_id' })
      .select()
      .single();

    if (adAccountError) throw adAccountError;

    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        ad_account_id: adAccountRecord.id,
        org_id: clientData.org_id, // Usando org_id
        client_id: clientId,
        provider: 'meta',
        access_token: accessToken,
        // Note: Meta long-lived tokens last ~60 days. You'd need a cron job to refresh them.
      }, { onConflict: 'ad_account_id' });

    if (tokenError) throw tokenError;

    // 5. Redirect back to the client detail page
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients/${clientId}`);

  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    // Redirect to an error page or show an error message
    return new Response(`An error occurred: ${error.message}`, { status: 500 });
  }
}