/**
 * Google OAuth Callback - Versão Completa com Processamento Real
 * Processa o código OAuth e cria conexão real no banco
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleOAuthService } from '@/lib/google/oauth';

export async function GET(request: NextRequest) {
  console.log('[Google Callback] 🚀 PROCESSANDO CALLBACK OAUTH REAL');
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    console.log('[Google Callback] - Code:', !!code);
    console.log('[Google Callback] - Error:', error);
    console.log('[Google Callback] - State:', state);
    
    // Se houve erro no OAuth
    if (error) {
      console.error('[Google Callback] ❌ ERRO OAUTH:', error);
      const redirectUrl = `/google/select-accounts?error=oauth_error&message=${encodeURIComponent(error)}`;
      return createRedirectResponse(redirectUrl);
    }
    
    // Verificar se temos code e state
    if (!code || !state) {
      console.error('[Google Callback] ❌ PARÂMETROS FALTANDO');
      const redirectUrl = `/google/select-accounts?error=missing_params&message=Código ou state não fornecido`;
      return createRedirectResponse(redirectUrl);
    }
    
    // Buscar state no banco para validar e obter dados
    console.log('[Google Callback] 🔍 VALIDANDO STATE NO BANCO...');
    console.log('[Google Callback] - State recebido:', state);
    console.log('[Google Callback] - Timestamp atual:', new Date().toISOString());
    
    const supabase = await createClient();
    
    // Primeiro, buscar sem filtro de expiração para debug
    const { data: allStates, error: allError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'google');
    
    console.log('[Google Callback] - States encontrados (sem filtro):', allStates?.length || 0);
    if (allStates && allStates.length > 0) {
      console.log('[Google Callback] - State encontrado:', {
        id: allStates[0].id,
        created: allStates[0].created_at,
        expires: allStates[0].expires_at,
        isExpired: new Date(allStates[0].expires_at) <= new Date()
      });
    }
    
    // Agora buscar com filtro de expiração
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'google')
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (stateError || !oauthState) {
      console.error('[Google Callback] ❌ STATE INVÁLIDO OU EXPIRADO');
      console.error('[Google Callback] - Erro:', stateError?.message);
      console.error('[Google Callback] - Código:', stateError?.code);
      console.error('[Google Callback] - Detalhes:', stateError?.details);
      
      // Se encontrou o state mas está expirado, informar isso
      if (allStates && allStates.length > 0) {
        const expiredState = allStates[0];
        const expiresAt = new Date(expiredState.expires_at);
        const now = new Date();
        const diffMinutes = Math.round((now.getTime() - expiresAt.getTime()) / 60000);
        
        console.error('[Google Callback] - State EXPIRADO há', diffMinutes, 'minutos');
        const redirectUrl = `/google/select-accounts?error=expired_state&message=State expirou há ${diffMinutes} minutos. Tente novamente.`;
        return createRedirectResponse(redirectUrl);
      }
      
      const redirectUrl = `/google/select-accounts?error=invalid_state&message=State OAuth inválido ou expirado`;
      return createRedirectResponse(redirectUrl);
    }
    
    console.log('[Google Callback] ✅ STATE VÁLIDO:', {
      clientId: oauthState.client_id,
      userId: oauthState.user_id
    });
    
    // Trocar código por tokens
    console.log('[Google Callback] 🔄 TROCANDO CÓDIGO POR TOKENS...');
    const oauthService = getGoogleOAuthService();
    
    try {
      const tokens = await oauthService.exchangeCodeForTokens(code);
      console.log('[Google Callback] ✅ TOKENS OBTIDOS:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in
      });
      
      // Criar conexão no banco
      console.log('[Google Callback] 💾 CRIANDO CONEXÃO NO BANCO...');
      const { data: connection, error: connectionError } = await supabase
        .from('google_ads_connections')
        .insert({
          client_id: oauthState.client_id,
          user_id: oauthState.user_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
          customer_id: 'pending', // Será atualizado quando selecionar contas
          status: 'active'
        })
        .select()
        .single();
      
      if (connectionError) {
        console.error('[Google Callback] ❌ ERRO AO CRIAR CONEXÃO:', connectionError);
        const redirectUrl = `/google/select-accounts?error=connection_error&message=Erro ao salvar conexão`;
        return createRedirectResponse(redirectUrl);
      }
      
      console.log('[Google Callback] ✅ CONEXÃO CRIADA:', connection.id);
      
      // Limpar state usado
      await supabase
        .from('oauth_states')
        .delete()
        .eq('state', state);
      
      // Redirecionar para seleção de contas com IDs reais
      const redirectUrl = `/google/select-accounts?connectionId=${connection.id}&clientId=${oauthState.client_id}&success=oauth_complete`;
      console.log('[Google Callback] 🎯 REDIRECIONANDO PARA SELEÇÃO DE CONTAS:', redirectUrl);
      return createRedirectResponse(redirectUrl);
      
    } catch (tokenError) {
      console.error('[Google Callback] ❌ ERRO AO TROCAR TOKENS:', tokenError);
      const redirectUrl = `/google/select-accounts?error=token_error&message=Erro ao obter tokens de acesso`;
      return createRedirectResponse(redirectUrl);
    }
    
  } catch (error: any) {
    console.error('[Google Callback] ❌ ERRO CRÍTICO:', error);
    const redirectUrl = `/google/select-accounts?error=callback_error&message=${encodeURIComponent(error.message)}`;
    return createRedirectResponse(redirectUrl);
  }
}

function createRedirectResponse(redirectUrl: string) {
  console.log('[Google Callback] 🔄 CRIANDO RESPOSTA DE REDIRECIONAMENTO PARA:', redirectUrl);
  
  // Retornar HTML que força redirecionamento via JavaScript
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Processando OAuth Google...</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f5f5f5; 
        }
        .container { 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            max-width: 400px; 
            margin: 0 auto; 
        }
        .spinner { 
            border: 4px solid #f3f3f3; 
            border-top: 4px solid #3498db; 
            border-radius: 50%; 
            width: 40px; 
            height: 40px; 
            animation: spin 1s linear infinite; 
            margin: 20px auto; 
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>🔄 Processando OAuth...</h2>
        <p>Redirecionando automaticamente...</p>
        <p><small>Se não redirecionar, <a href="${redirectUrl}">clique aqui</a></small></p>
    </div>
    
    <script>
        console.log('🔄 CALLBACK PROCESSADO - Redirecionando para: ${redirectUrl}');
        
        // Tentar múltiplas formas de redirecionamento
        setTimeout(function() {
            try {
                window.location.href = '${redirectUrl}';
            } catch (e) {
                console.error('Erro no redirecionamento:', e);
                window.location.replace('${redirectUrl}');
            }
        }, 1000);
        
        // Backup - redirecionar imediatamente também
        window.location.href = '${redirectUrl}';
    </script>
</body>
</html>`;
  
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}