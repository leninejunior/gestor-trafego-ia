/**
 * Google OAuth Callback - VERSÃO VERBOSE PARA DEBUG
 * Com logs extremamente detalhados para diagnosticar o problema
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleOAuthService } from '@/lib/google/oauth';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const logs: string[] = [];
  
  function log(message: string, data?: any) {
    const logEntry = `[${new Date().toISOString()}] ${message}`;
    console.log(logEntry, data || '');
    logs.push(logEntry + (data ? ` ${JSON.stringify(data)}` : ''));
  }
  
  log('🚀 CALLBACK INICIADO');
  log('URL COMPLETA', request.url);
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    log('📋 PARÂMETROS RECEBIDOS', {
      hasCode: !!code,
      codeLength: code?.length,
      hasError: !!error,
      error,
      hasState: !!state,
      stateLength: state?.length,
      allParams: Object.fromEntries(searchParams.entries())
    });
    
    // Se houve erro no OAuth
    if (error) {
      log('❌ ERRO OAUTH RECEBIDO', error);
      return createDebugResponse('oauth_error', error, logs);
    }
    
    // Verificar se temos code e state
    if (!code || !state) {
      log('❌ PARÂMETROS FALTANDO', { code: !!code, state: !!state });
      return createDebugResponse('missing_params', 'Código ou state não fornecido', logs);
    }
    
    log('🔍 INICIANDO VALIDAÇÃO DO STATE NO BANCO');
    
    // Criar cliente Supabase
    log('📦 CRIANDO CLIENTE SUPABASE');
    const supabase = await createClient();
    log('✅ CLIENTE SUPABASE CRIADO');
    
    // Buscar state no banco
    log('🔎 BUSCANDO STATE NO BANCO', { state: state.substring(0, 20) + '...' });
    
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'google')
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (stateError) {
      log('❌ ERRO AO BUSCAR STATE', {
        code: stateError.code,
        message: stateError.message,
        details: stateError.details
      });
      
      // Tentar buscar sem filtro de expiração para debug
      const { data: allStates } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('provider', 'google');
      
      log('🔍 STATES ENCONTRADOS (SEM FILTRO)', {
        count: allStates?.length || 0,
        states: allStates
      });
      
      return createDebugResponse('invalid_state', 'State inválido ou expirado', logs);
    }
    
    if (!oauthState) {
      log('❌ STATE NÃO ENCONTRADO');
      return createDebugResponse('state_not_found', 'State não encontrado no banco', logs);
    }
    
    log('✅ STATE VÁLIDO ENCONTRADO', {
      clientId: oauthState.client_id,
      userId: oauthState.user_id,
      createdAt: oauthState.created_at,
      expiresAt: oauthState.expires_at
    });
    
    // Trocar código por tokens
    log('🔄 INICIANDO TROCA DE CÓDIGO POR TOKENS');
    const oauthService = getGoogleOAuthService();
    log('✅ OAUTH SERVICE CRIADO');
    
    try {
      log('📞 CHAMANDO exchangeCodeForTokens');
      const tokens = await oauthService.exchangeCodeForTokens(code);
      log('✅ TOKENS OBTIDOS COM SUCESSO', {
        hasAccessToken: !!tokens.access_token,
        accessTokenLength: tokens.access_token?.length,
        hasRefreshToken: !!tokens.refresh_token,
        refreshTokenLength: tokens.refresh_token?.length,
        expiresIn: tokens.expires_in
      });
      
      // Criar conexão no banco
      log('💾 CRIANDO CONEXÃO NO BANCO');
      const connectionData = {
        client_id: oauthState.client_id,
        user_id: oauthState.user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        customer_id: 'pending',
        status: 'active'
      };
      
      log('📝 DADOS DA CONEXÃO', {
        client_id: connectionData.client_id,
        user_id: connectionData.user_id,
        hasAccessToken: !!connectionData.access_token,
        hasRefreshToken: !!connectionData.refresh_token,
        token_expires_at: connectionData.token_expires_at,
        customer_id: connectionData.customer_id,
        status: connectionData.status
      });
      
      const { data: connection, error: connectionError } = await supabase
        .from('google_ads_connections')
        .insert(connectionData)
        .select()
        .single();
      
      if (connectionError) {
        log('❌ ERRO AO CRIAR CONEXÃO', {
          code: connectionError.code,
          message: connectionError.message,
          details: connectionError.details,
          hint: connectionError.hint
        });
        return createDebugResponse('connection_error', 'Erro ao salvar conexão no banco', logs);
      }
      
      if (!connection) {
        log('❌ CONEXÃO NÃO RETORNADA');
        return createDebugResponse('connection_not_returned', 'Conexão não foi retornada após insert', logs);
      }
      
      log('✅ CONEXÃO CRIADA COM SUCESSO', {
        id: connection.id,
        client_id: connection.client_id,
        status: connection.status
      });
      
      // Marcar state como usado
      log('🗑️ MARCANDO STATE COMO USADO');
      const { error: updateError } = await supabase
        .from('oauth_states')
        .update({ used: true })
        .eq('state', state);
      
      if (updateError) {
        log('⚠️ ERRO AO MARCAR STATE COMO USADO', updateError);
      } else {
        log('✅ STATE MARCADO COMO USADO');
      }
      
      // Redirecionar para seleção de contas
      const redirectUrl = `/google/select-accounts?connectionId=${connection.id}&clientId=${oauthState.client_id}`;
      log('🎯 REDIRECIONANDO PARA', redirectUrl);
      
      return createDebugResponse('success', 'OAuth concluído com sucesso!', logs, redirectUrl);
      
    } catch (tokenError: any) {
      log('❌ ERRO AO TROCAR TOKENS', {
        name: tokenError.name,
        message: tokenError.message,
        stack: tokenError.stack
      });
      return createDebugResponse('token_error', tokenError.message, logs);
    }
    
  } catch (error: any) {
    log('❌ ERRO CRÍTICO', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return createDebugResponse('critical_error', error.message, logs);
  }
}

function createDebugResponse(
  status: string,
  message: string,
  logs: string[],
  redirectUrl?: string
) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Google OAuth Debug - ${status}</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            padding: 20px; 
            background: #1e1e1e; 
            color: #d4d4d4;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
        }
        h1 { 
            color: ${status === 'success' ? '#4ec9b0' : '#f48771'}; 
            border-bottom: 2px solid ${status === 'success' ? '#4ec9b0' : '#f48771'};
            padding-bottom: 10px;
        }
        .status { 
            background: ${status === 'success' ? '#1e3a32' : '#3a1e1e'}; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
            border-left: 4px solid ${status === 'success' ? '#4ec9b0' : '#f48771'};
        }
        .logs { 
            background: #252526; 
            padding: 15px; 
            border-radius: 5px; 
            max-height: 600px; 
            overflow-y: auto;
            font-size: 12px;
            line-height: 1.6;
        }
        .log-entry { 
            margin: 5px 0; 
            padding: 5px;
            border-left: 2px solid #007acc;
        }
        .log-entry:hover {
            background: #2d2d30;
        }
        .success { color: #4ec9b0; }
        .error { color: #f48771; }
        .warning { color: #dcdcaa; }
        .info { color: #9cdcfe; }
        .redirect-btn {
            display: inline-block;
            background: #0e639c;
            color: white;
            padding: 12px 24px;
            border-radius: 5px;
            text-decoration: none;
            margin-top: 20px;
            font-weight: bold;
        }
        .redirect-btn:hover {
            background: #1177bb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Google OAuth Callback Debug</h1>
        
        <div class="status">
            <h2>${status === 'success' ? '✅' : '❌'} Status: ${status}</h2>
            <p><strong>Mensagem:</strong> ${message}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
        
        ${redirectUrl ? `
            <a href="${redirectUrl}" class="redirect-btn">
                ➡️ Continuar para Seleção de Contas
            </a>
        ` : ''}
        
        <h2>📋 Logs Detalhados</h2>
        <div class="logs">
            ${logs.map(log => {
              const className = log.includes('✅') ? 'success' : 
                               log.includes('❌') ? 'error' :
                               log.includes('⚠️') ? 'warning' : 'info';
              return `<div class="log-entry ${className}">${log}</div>`;
            }).join('')}
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background: #252526; border-radius: 5px;">
            <h3>💡 Próximos Passos</h3>
            ${status === 'success' ? `
                <p>✅ OAuth concluído com sucesso!</p>
                <p>Clique no botão acima para continuar.</p>
            ` : `
                <p>❌ Houve um erro no processo de OAuth.</p>
                <p>Revise os logs acima para identificar o problema.</p>
                <p>Tente iniciar o fluxo OAuth novamente.</p>
            `}
        </div>
    </div>
    
    ${redirectUrl ? `
    <script>
        console.log('🎯 Redirecionamento automático em 3 segundos...');
        setTimeout(() => {
            window.location.href = '${redirectUrl}';
        }, 3000);
    </script>
    ` : ''}
</body>
</html>`;
  
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
