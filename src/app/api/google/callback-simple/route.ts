/**
 * Simplified Google OAuth Callback
 * 
 * Processes OAuth callback without complex dependencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('[Google Callback Simple] Starting OAuth callback processing');
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('[Google Callback Simple] Received parameters:', {
      hasCode: !!code,
      hasState: !!state,
      error,
      codeLength: code?.length || 0,
      stateLength: state?.length || 0
    });

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('[Google Callback Simple] OAuth error:', { error, errorDescription });
      
      return NextResponse.redirect(
        new URL(`/dashboard?error=oauth_error&message=${encodeURIComponent(
          error === 'access_denied' 
            ? 'Acesso negado. Você precisa autorizar o aplicativo para continuar.'
            : `Erro de autenticação: ${errorDescription || error}`
        )}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('[Google Callback Simple] Missing required parameters:', { code: !!code, state: !!state });
      return NextResponse.redirect(
        new URL('/dashboard?error=invalid_request&message=Parâmetros inválidos', request.url)
      );
    }

    // Get authenticated user
    console.log('[Google Callback Simple] Creating Supabase client...');
    const supabase = await createClient();
    
    console.log('[Google Callback Simple] Getting authenticated user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Google Callback Simple] Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message
    });

    if (authError || !user) {
      console.error('[Google Callback Simple] User not authenticated:', authError);
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', request.url)
      );
    }

    // Validate OAuth state parameter
    console.log('[Google Callback Simple] Validating OAuth state...');
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('client_id, user_id, expires_at')
      .eq('state', state)
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    console.log('[Google Callback Simple] State validation result:', {
      hasState: !!oauthState,
      stateError: stateError?.message,
      stateErrorCode: stateError?.code
    });

    if (stateError || !oauthState) {
      console.error('[Google Callback Simple] Invalid or expired state:', stateError);
      return NextResponse.redirect(
        new URL('/dashboard?error=invalid_state&message=Estado OAuth inválido ou expirado', request.url)
      );
    }

    // Check if state is expired
    if (new Date(oauthState.expires_at) < new Date()) {
      console.error('[Google Callback Simple] OAuth state expired');
      return NextResponse.redirect(
        new URL('/dashboard?error=expired_state&message=Estado OAuth expirado', request.url)
      );
    }

    const clientId = oauthState.client_id;

    // Exchange authorization code for tokens (simplified)
    console.log('[Google Callback Simple] Exchanging authorization code for tokens...');
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback-simple`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.json();
      console.error('[Google Callback Simple] Token exchange failed:', tokenError);
      return NextResponse.redirect(
        new URL(`/dashboard?error=token_exchange&message=${encodeURIComponent(
          tokenError.error_description || tokenError.error || 'Falha na troca de tokens'
        )}`, request.url)
      );
    }

    const tokens = await tokenResponse.json();
    console.log('[Google Callback Simple] Token exchange successful:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    // Create connection record (simplified)
    console.log('[Google Callback Simple] Creating connection record...');
    const { data: newConnection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .insert({
        client_id: clientId,
        customer_id: 'temp-customer',
        refresh_token: tokens.refresh_token || 'temp',
        status: 'active',
      })
      .select('id')
      .single();

    if (connectionError || !newConnection) {
      console.error('[Google Callback Simple] Error creating connection:', connectionError);
      return NextResponse.redirect(
        new URL('/dashboard?error=connection_failed&message=Erro ao criar conexão', request.url)
      );
    }

    const connectionId = newConnection.id;
    console.log('[Google Callback Simple] Created connection:', connectionId);

    // Clean up OAuth state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state);

    console.log('[Google Callback Simple] OAuth state cleaned up');

    // Redirect to success
    console.log('[Google Callback Simple] Redirecting to success page');
    return NextResponse.redirect(
      new URL(`/dashboard/google?success=connected&connectionId=${connectionId}`, request.url)
    );

  } catch (error) {
    console.error('[Google Callback Simple] Unexpected error:', error);
    return NextResponse.redirect(
      new URL('/dashboard?error=unexpected&message=Erro inesperado durante autenticação', request.url)
    );
  }
}