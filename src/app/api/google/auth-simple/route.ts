/**
 * Google Ads Auth API - Versão Simplificada
 * Corrige erros 500 na autenticação
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Verificar se o usuário está autenticado (opcional para esta versão)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Se não conseguir verificar o usuário, retorna URL de auth mesmo assim
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/google/callback`;
    
    // Gerar URL de autorização do Google
    const scopes = [
      'https://www.googleapis.com/auth/adwords'
    ].join(' ');

    const state = `${Date.now()}-${clientId}`;
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    // Tentar salvar o state no banco (se possível)
    if (user) {
      try {
        await supabase
          .from('oauth_states')
          .insert({
            state,
            client_id: clientId,
            user_id: user.id,
            provider: 'google',
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          });
      } catch (error) {
        console.warn('[Google Auth Simple] Could not save state:', error);
      }
    }

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