/**
 * Google Ads Auth API - Versão Simplificada
 * Corrige erros 500 na autenticação
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCanonicalGoogleRedirectUri } from '@/lib/google/redirect-uri';

export async function GET(request: NextRequest) {
  try {
    console.log('[Google Auth Simple] Starting request');

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    // Verificar se clientId foi fornecido
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se clientId é um UUID válido (opcional, mas recomendado)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (clientId !== 'test' && !uuidRegex.test(clientId)) {
      console.warn('[Google Auth Simple] ⚠️ Client ID inválido:', clientId);
      // Não vamos rejeitar, mas vamos registrar o aviso
    }

    // Verificar configuração do Google
    const isConfigured = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET && 
      process.env.GOOGLE_DEVELOPER_TOKEN &&
      process.env.NEXT_PUBLIC_APP_URL &&
      !process.env.GOOGLE_CLIENT_ID.includes('your_') &&
      !process.env.GOOGLE_CLIENT_SECRET.includes('your_')
    );

    if (!isConfigured) {
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'Configure as variáveis de ambiente do Google Ads',
          configured: false
        },
        { status: 503 }
      );
    }

    // Verificar se o usuário está autenticado (OBRIGATÓRIO)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
      console.error('[Google Auth Simple] ❌ Usuário não autenticado');
      return NextResponse.json(
        { 
          error: 'Usuário não autenticado',
          message: 'Você precisa estar logado para conectar o Google Ads'
        },
        { status: 401 }
      );
    }

    console.log('[Google Auth Simple] ✅ Usuário autenticado:', user.id);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = getCanonicalGoogleRedirectUri();
    
    // Gerar URL de autorização do Google
    const scopes = [
      'https://www.googleapis.com/auth/adwords'
    ].join(' ');

    // Gerar state seguro
    const state = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    console.log('[Google Auth Simple] 💾 Salvando state no banco...');
    console.log('[Google Auth Simple] - State:', state);
    console.log('[Google Auth Simple] - Client ID:', clientId);
    console.log('[Google Auth Simple] - User ID:', user.id);

    // SALVAR O STATE NO BANCO ANTES DE REDIRECIONAR (OBRIGATÓRIO)
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: user.id,
        provider: 'google',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      console.error('[Google Auth Simple] ❌ Erro ao salvar state:', stateError);
      return NextResponse.json(
        { 
          error: 'Erro ao iniciar autenticação',
          message: 'Não foi possível salvar o estado da autenticação',
          details: stateError.message
        },
        { status: 500 }
      );
    }

    console.log('[Google Auth Simple] ✅ State salvo com sucesso');
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    console.log('[Google Auth Simple] 🚀 Gerando URL de autenticação');
    console.log('[Google Auth Simple] - Redirect URI:', redirectUri);

    return NextResponse.json({
      authUrl: authUrl.toString(),
      state,
      configured: true,
      userAuthenticated: !!user,
      debug: {
        clientId,
        redirectUri,
        baseUrl
      }
    });

  } catch (error) {
    console.error('[Google Auth Simple] Error:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao gerar URL de autenticação',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID é obrigatório' },
        { status: 400 }
      );
    }

    // Redirecionar para GET com os mesmos parâmetros
    const url = new URL(request.url);
    url.searchParams.set('clientId', clientId);
    
    return GET(new NextRequest(url.toString()));

  } catch (error) {
    console.error('[Google Auth Simple POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
