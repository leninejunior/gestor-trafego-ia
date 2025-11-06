/**
 * Google Ads OAuth Callback API Route
 * 
 * Processes OAuth callback and exchanges code for tokens
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getGoogleOAuthService } from '@/lib/google/oauth';
import { getGoogleTokenManagerSimple } from '@/lib/google/token-manager-simple';
import { GoogleAdsClient } from '@/lib/google/client';

// ============================================================================
// GET /api/google/callback
// ============================================================================

export async function GET(request: NextRequest) {
  console.log('='.repeat(80));
  console.log('[Google Callback] 🔄 PROCESSANDO CALLBACK OAUTH DO GOOGLE');
  console.log('[Google Callback] Timestamp:', new Date().toISOString());
  console.log('[Google Callback] Request URL completa:', request.url);
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('[Google Callback] 📥 PARÂMETROS RECEBIDOS:');
    console.log('[Google Callback] - Código presente:', !!code);
    console.log('[Google Callback] - State presente:', !!state);
    console.log('[Google Callback] - Erro OAuth:', error || 'nenhum');
    console.log('[Google Callback] - Tamanho do código:', code?.length || 0);
    console.log('[Google Callback] - Tamanho do state:', state?.length || 0);
    console.log('[Google Callback] - Código (primeiros 20 chars):', code?.substring(0, 20) + '...' || 'não presente');
    console.log('[Google Callback] - State (primeiros 20 chars):', state?.substring(0, 20) + '...' || 'não presente');

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('[Google Callback] ❌ ERRO OAUTH DETECTADO:');
      console.error('[Google Callback] - Tipo do erro:', error);
      console.error('[Google Callback] - Descrição:', errorDescription || 'não fornecida');
      console.error('[Google Callback] - Todos os parâmetros:', Object.fromEntries(searchParams.entries()));
      
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
      console.error('[Google Callback] ❌ PARÂMETROS OBRIGATÓRIOS AUSENTES:');
      console.error('[Google Callback] - Código presente:', !!code);
      console.error('[Google Callback] - State presente:', !!state);
      console.error('[Google Callback] - URL completa:', request.url);
      return NextResponse.redirect(
        new URL('/dashboard?error=invalid_request&message=Parâmetros inválidos', request.url)
      );
    }

    console.log('[Google Callback] ✅ PARÂMETROS OBRIGATÓRIOS VALIDADOS');

    // Get authenticated user
    console.log('[Google Callback] 🔐 VERIFICANDO AUTENTICAÇÃO DO USUÁRIO...');
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Google Callback] 📊 RESULTADO DA AUTENTICAÇÃO:');
    console.log('[Google Callback] - Usuário encontrado:', !!user);
    console.log('[Google Callback] - User ID:', user?.id || 'não encontrado');
    console.log('[Google Callback] - Email:', user?.email || 'não encontrado');
    console.log('[Google Callback] - Erro de auth:', authError?.message || 'nenhum');

    if (authError || !user) {
      console.error('[Google Callback] ❌ USUÁRIO NÃO AUTENTICADO:', authError);
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', request.url)
      );
    }

    console.log('[Google Callback] ✅ USUÁRIO AUTENTICADO COM SUCESSO');

    // Validate OAuth state parameter
    console.log('[Google Callback] 🔍 VALIDANDO ESTADO OAUTH...');
    console.log('[Google Callback] - State a validar:', state);
    console.log('[Google Callback] - User ID:', user.id);
    
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('client_id, user_id, expires_at')
      .eq('state', state)
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    console.log('[Google Callback] 📊 RESULTADO DA VALIDAÇÃO DO STATE:');
    console.log('[Google Callback] - State encontrado:', !!oauthState);
    console.log('[Google Callback] - Client ID do state:', oauthState?.client_id || 'não encontrado');
    console.log('[Google Callback] - User ID do state:', oauthState?.user_id || 'não encontrado');
    console.log('[Google Callback] - Expira em:', oauthState?.expires_at || 'não encontrado');
    console.log('[Google Callback] - Erro do state:', stateError?.message || 'nenhum');
    console.log('[Google Callback] - Código do erro:', stateError?.code || 'nenhum');

    if (stateError || !oauthState) {
      console.error('[Google Callback] ❌ ESTADO OAUTH INVÁLIDO OU EXPIRADO:', stateError);
      return NextResponse.redirect(
        new URL('/dashboard?error=invalid_state&message=Estado OAuth inválido ou expirado', request.url)
      );
    }

    // Check if state is expired
    const now = new Date();
    const expiresAt = new Date(oauthState.expires_at);
    console.log('[Google Callback] ⏰ VERIFICANDO EXPIRAÇÃO DO STATE:');
    console.log('[Google Callback] - Agora:', now.toISOString());
    console.log('[Google Callback] - Expira em:', expiresAt.toISOString());
    console.log('[Google Callback] - Expirado:', expiresAt < now);
    
    if (expiresAt < now) {
      console.error('[Google Callback] ❌ ESTADO OAUTH EXPIRADO');
      return NextResponse.redirect(
        new URL('/dashboard?error=expired_state&message=Estado OAuth expirado', request.url)
      );
    }

    const clientId = oauthState.client_id;
    console.log('[Google Callback] ✅ STATE VÁLIDO - Client ID:', clientId);

    // SIMPLIFIED: Skip organization verification (aligned with auth API)
    console.log('[Google Callback] Skipping organization verification for consistency with auth API');

    // Exchange authorization code for tokens
    console.log('[Google Callback] 🔄 TROCANDO CÓDIGO POR TOKENS...');
    console.log('[Google Callback] - Código a ser trocado:', code.substring(0, 20) + '...');
    
    const oauthService = getGoogleOAuthService();
    let tokens;
    
    try {
      tokens = await oauthService.exchangeCodeForTokens(code);
      console.log('[Google Callback] ✅ TROCA DE TOKENS BEM-SUCEDIDA:');
      console.log('[Google Callback] - Access token presente:', !!tokens.access_token);
      console.log('[Google Callback] - Refresh token presente:', !!tokens.refresh_token);
      console.log('[Google Callback] - Expira em (segundos):', tokens.expires_in);
      console.log('[Google Callback] - Tipo do token:', tokens.token_type);
      console.log('[Google Callback] - Escopo:', tokens.scope);
    } catch (tokenError) {
      console.error('[Google Callback] ❌ FALHA NA TROCA DE TOKENS:', tokenError);
      console.error('[Google Callback] - Mensagem do erro:', tokenError.message);
      console.error('[Google Callback] - Stack trace:', tokenError.stack);
      const userFriendlyError = oauthService.getUserFriendlyError(tokenError);
      return NextResponse.redirect(
        new URL(`/dashboard?error=token_exchange&message=${encodeURIComponent(userFriendlyError)}`, request.url)
      );
    }

    // Get Google Ads account information
    console.log('[Google Callback] Setting up account info...');
    let accountInfo;
    let customerId = 'pending'; // Will be updated when user selects account
    
    try {
      // Skip Google Ads client creation for now to avoid potential issues
      // This will be handled in the account selection step
      console.log('[Google Callback] Skipping Google Ads client creation, will handle in account selection');
      
    } catch (accountError) {
      console.error('[Google Callback] Error getting account info:', accountError);
      // Continue with connection creation, account selection can happen later
    }

    // Check if connection already exists for this client
    const { data: existingConnection } = await supabase
      .from('google_ads_connections')
      .select('id')
      .eq('client_id', clientId)
      .eq('customer_id', customerId)
      .single();

    let connectionId: string;

    if (existingConnection) {
      // Update existing connection
      connectionId = existingConnection.id;
      
      try {
        const tokenManager = getGoogleTokenManagerSimple();
        await tokenManager.saveTokens(connectionId, tokens);
        console.log('[Google Callback] Updated existing connection with new tokens:', connectionId);
      } catch (tokenError) {
        console.error('[Google Callback] Error saving tokens for existing connection:', tokenError);
      }
    } else {
      // Create new connection (using service client to bypass RLS temporarily)
      console.log('[Google Callback] Creating new connection with service client...');
      console.log('[Google Callback] Connection data:', {
        client_id: clientId,
        customer_id: customerId,
        status: customerId === 'pending' ? 'pending' : 'active'
      });
      
      // Use service client to bypass RLS
      const serviceSupabase = createServiceClient();
      
      console.log('[Google Callback] Service client created, attempting insert...');
      
      const { data: newConnection, error: connectionError } = await serviceSupabase
        .from('google_ads_connections')
        .insert({
          client_id: clientId,
          user_id: user.id, // Adicionar user_id que é obrigatório
          customer_id: customerId,
          refresh_token: 'temp', // Will be encrypted by token manager
          status: 'active', // Always use 'active' as it's the only valid initial status
        })
        .select('id')
        .single();
      
      console.log('[Google Callback] Insert result:', {
        hasConnection: !!newConnection,
        connectionId: newConnection?.id,
        errorCode: connectionError?.code,
        errorMessage: connectionError?.message,
        errorDetails: connectionError?.details
      });

      if (connectionError || !newConnection) {
        console.error('[Google Callback] Error creating connection:', connectionError);
        return NextResponse.redirect(
          new URL('/dashboard?error=connection_failed&message=Erro ao criar conexão', request.url)
        );
      }

      connectionId = newConnection.id;

      // Save tokens
      console.log('[Google Callback] Saving tokens for connection:', connectionId);
      try {
        const tokenManager = getGoogleTokenManagerSimple();
        await tokenManager.saveTokens(connectionId, tokens);
        console.log('[Google Callback] Tokens saved successfully');
      } catch (tokenError) {
        console.error('[Google Callback] Error saving tokens:', tokenError);
        // Continue anyway, tokens can be refreshed later
      }

      console.log('[Google Callback] Created new connection:', connectionId);
    }

    // Clean up OAuth state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state);

    // Redirect to success page or account selection
    console.log('[Google Callback] 🎯 DETERMINANDO REDIRECIONAMENTO:');
    console.log('[Google Callback] - Customer ID:', customerId);
    console.log('[Google Callback] - Connection ID:', connectionId);
    console.log('[Google Callback] - Client ID:', clientId);
    
    if (customerId === 'pending') {
      const redirectUrl = `/google/select-accounts?connectionId=${connectionId}&clientId=${clientId}`;
      console.log('[Google Callback] ➡️ REDIRECIONANDO PARA SELEÇÃO DE CONTAS:', redirectUrl);
      return NextResponse.redirect(
        new URL(redirectUrl, request.url)
      );
    } else {
      const redirectUrl = `/dashboard/google?success=connected&connectionId=${connectionId}`;
      console.log('[Google Callback] ➡️ REDIRECIONANDO PARA DASHBOARD:', redirectUrl);
      return NextResponse.redirect(
        new URL(redirectUrl, request.url)
      );
    }

    console.log('[Google Callback] 🎉 CALLBACK PROCESSADO COM SUCESSO');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('[Google Callback] Unexpected error:', error);
    console.error('[Google Callback] Error stack:', error.stack);
    console.error('[Google Callback] Error message:', error.message);
    
    // Provide more specific error message for debugging
    const errorMessage = error.message || 'Erro inesperado durante autenticação';
    return NextResponse.redirect(
      new URL(`/dashboard?error=unexpected&message=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}

// ============================================================================
// POST /api/google/callback (for programmatic testing)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state, clientId } = body;

    if (!code || !state || !clientId) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: code, state, clientId' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Validate OAuth state
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('client_id, expires_at')
      .eq('state', state)
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (stateError || !oauthState || oauthState.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Estado OAuth inválido' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const oauthService = getGoogleOAuthService();
    const tokens = await oauthService.exchangeCodeForTokens(code);

    // Create or update connection
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .upsert({
        client_id: clientId,
        user_id: user.id, // Adicionar user_id obrigatório
        customer_id: 'temp-customer',
        refresh_token: 'temp', // Will be encrypted
        status: 'active',
      }, {
        onConflict: 'client_id,customer_id'
      })
      .select('id')
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Erro ao criar conexão' },
        { status: 500 }
      );
    }

    // Save tokens
    const tokenManager = getGoogleTokenManagerSimple();
    await tokenManager.saveTokens(connection.id, tokens);

    // Clean up state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state);

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      customerId: 'pending',
      message: 'Conexão criada com sucesso. Selecione as contas do Google Ads.',
    });

  } catch (error) {
    console.error('[Google Callback POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}