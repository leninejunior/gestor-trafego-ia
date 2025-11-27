/**
 * Google OAuth Callback - Refatorado
 * 
 * Processa o callback do Google OAuth
 * Usa GoogleOAuthFlowManager para lógica centralizada
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthFlowManager } from '@/lib/google/oauth-flow-manager';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function redirectWithError(error: string, message: string) {
  const redirectUrl = new URL('/dashboard/google', APP_URL);
  redirectUrl.searchParams.set('error', error);
  redirectUrl.searchParams.set('message', message);
  return NextResponse.redirect(redirectUrl, { status: 302 });
}

export async function GET(request: NextRequest) {
  console.log('[Google Callback] 🚀 Processando callback OAuth');
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    // Se houve erro no OAuth
    if (error) {
      console.error('[Google Callback] ❌ Erro OAuth:', error);
      return redirectWithError('oauth_error', error);
    }
    
    // Verificar parâmetros
    if (!code || !state) {
      console.error('[Google Callback] ❌ Parâmetros faltando');
      return redirectWithError('missing_params', 'Código ou state não fornecido');
    }
    
    // Processar callback usando flow manager
    const flowManager = getGoogleOAuthFlowManager();
    const result = await flowManager.processOAuthCallback(code, state);
    
    if (!result.success) {
      console.error('[Google Callback] ❌ Erro ao processar:', result.error);
      return redirectWithError(
        result.errorCode || 'callback_error',
        result.error || 'Erro ao processar callback'
      );
    }
    
    console.log('[Google Callback] ✅ Callback processado com sucesso');
    
    // Redirecionar para seleção de contas
    const redirectUrl = new URL('/google/select-accounts', APP_URL);
    redirectUrl.searchParams.set('connectionId', result.connectionId!);
    redirectUrl.searchParams.set('clientId', result.clientId!);
    
    return NextResponse.redirect(redirectUrl, { status: 302 });
    
  } catch (error: any) {
    console.error('[Google Callback] ❌ Erro crítico:', error);
    return redirectWithError('callback_error', error.message || 'Erro desconhecido');
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}