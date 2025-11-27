import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log('='.repeat(100));
  console.log(`[Google OAuth Initiate] 🚀 INICIANDO FLUXO OAUTH - ${timestamp}`);
  
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    console.log('[Google OAuth Initiate] PARÂMETROS RECEBIDOS:');
    console.log('[Google OAuth Initiate] - Client ID:', clientId);

    if (!clientId) {
      console.error('[Google OAuth Initiate] ❌ CLIENT ID AUSENTE');
      return new Response('Client ID is required', { status: 400 });
    }

    // Obter usuário autenticado
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[Google OAuth Initiate] ❌ USUÁRIO NÃO AUTENTICADO:', userError);
      return new Response('User not authenticated', { status: 401 });
    }

    console.log('[Google OAuth Initiate] ✅ USUÁRIO AUTENTICADO:', user.id);

    // Validar que o cliente pertence à organização do usuário
    console.log('[Google OAuth Initiate] 🔐 VALIDANDO ACESSO AO CLIENT...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('[Google OAuth Initiate] ❌ CLIENT NÃO ENCONTRADO:', clientError);
      return new Response('Client not found', { status: 404 });
    }

    // Validar que o usuário tem acesso a este cliente
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', client.org_id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      console.error('[Google OAuth Initiate] ❌ USUÁRIO NÃO TEM ACESSO A ESTE CLIENT:', membershipError);
      return new Response('Unauthorized', { status: 403 });
    }

    console.log('[Google OAuth Initiate] ✅ ACESSO VALIDADO');

    // Gerar state único
    const state = crypto.randomUUID();
    console.log('[Google OAuth Initiate] 🔐 STATE GERADO:', state);

    // Salvar state no banco de dados
    console.log('[Google OAuth Initiate] 💾 SALVANDO STATE NO BANCO...');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    
    const { data: savedState, error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: user.id,
        provider: 'google',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (stateError) {
      console.error('[Google OAuth Initiate] ❌ ERRO AO SALVAR STATE:', stateError);
      return new Response('Error saving OAuth state', { status: 500 });
    }

    console.log('[Google OAuth Initiate] ✅ STATE SALVO NO BANCO:', savedState.id);

    // Configurar OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
    );

    const scopes = [
      'https://www.googleapis.com/auth/adwords',
    ];

    console.log('[Google OAuth Initiate] 🔗 GERANDO URL DE AUTORIZAÇÃO...');
    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent',
    });

    console.log('[Google OAuth Initiate] ✅ URL GERADA');
    console.log('[Google OAuth Initiate] 🎯 REDIRECIONANDO PARA GOOGLE...');
    console.log('='.repeat(100));

    return NextResponse.redirect(authorizationUrl);

  } catch (error: any) {
    console.error('[Google OAuth Initiate] ❌ ERRO CRÍTICO:', error);
    console.error('[Google OAuth Initiate] - Mensagem:', error.message);
    console.error('[Google OAuth Initiate] - Stack:', error.stack);
    return new Response('Internal server error', { status: 500 });
  }
}