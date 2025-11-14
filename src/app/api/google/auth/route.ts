/**
 * Google Ads Authentication API Route - Production Fixed
 * 
 * Initiates OAuth 2.0 flow for Google Ads API
 * Fixed for production deployment issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleOAuthService } from '@/lib/google/oauth';
import { z } from 'zod';

// ============================================================================
// Request Validation Schema
// ============================================================================

const AuthRequestSchema = z.object({
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
  redirectUri: z.string().url('Redirect URI deve ser uma URL válida').optional(),
});

// ============================================================================
// Environment Variables Check (More Robust)
// ============================================================================

function checkGoogleConfiguration() {
  const requiredVars = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_DEVELOPER_TOKEN: process.env.GOOGLE_DEVELOPER_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  };

  const missing = [];
  const invalid = [];

  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      missing.push(key);
    } else if (value.includes('your_') && !value.includes('localhost')) {
      // Só considera inválido se tiver placeholder, mas permite localhost para dev
      invalid.push(key);
    }
  }

  return {
    isValid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    config: requiredVars
  };
}

// ============================================================================
// POST /api/google/auth
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('='.repeat(80));
    console.log('[Google Auth POST] 🚀 INICIANDO FLUXO DE AUTENTICAÇÃO GOOGLE');
    console.log('[Google Auth POST] Timestamp:', new Date().toISOString());
    console.log('[Google Auth POST] Request URL:', request.url);
    console.log('[Google Auth POST] Request method:', request.method);

    // Check configuration with detailed logging
    const configCheck = checkGoogleConfiguration();
    console.log('[Google Auth POST] 🔧 VERIFICAÇÃO DE CONFIGURAÇÃO:');
    console.log('[Google Auth POST] - Configuração válida:', configCheck.isValid);
    console.log('[Google Auth POST] - Variáveis faltando:', configCheck.missing);
    console.log('[Google Auth POST] - Variáveis inválidas:', configCheck.invalid);
    console.log('[Google Auth POST] - GOOGLE_CLIENT_ID presente:', !!configCheck.config.GOOGLE_CLIENT_ID);
    console.log('[Google Auth POST] - GOOGLE_CLIENT_SECRET presente:', !!configCheck.config.GOOGLE_CLIENT_SECRET);
    console.log('[Google Auth POST] - GOOGLE_DEVELOPER_TOKEN presente:', !!configCheck.config.GOOGLE_DEVELOPER_TOKEN);
    console.log('[Google Auth POST] - NEXT_PUBLIC_APP_URL:', configCheck.config.NEXT_PUBLIC_APP_URL);
    
    if (!configCheck.isValid) {
      console.error('[Google Auth POST] ❌ CONFIGURAÇÃO INVÁLIDA:', {
        missing: configCheck.missing,
        invalid: configCheck.invalid
      });
      
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'Credenciais do Google Ads não configuradas corretamente',
          details: {
            missing: configCheck.missing,
            invalid: configCheck.invalid
          },
          configured: false
        },
        { status: 503 }
      );
    }

    console.log('[Google Auth POST] ✅ CONFIGURAÇÃO VÁLIDA');

    // Parse and validate request body
    const body = await request.json();
    console.log('[Google Auth POST] 📝 DADOS DA REQUISIÇÃO:');
    console.log('[Google Auth POST] - Body recebido:', JSON.stringify(body, null, 2));
    
    const { clientId, redirectUri } = AuthRequestSchema.parse(body);
    console.log('[Google Auth POST] ✅ VALIDAÇÃO CONCLUÍDA:');
    console.log('[Google Auth POST] - Client ID:', clientId);
    console.log('[Google Auth POST] - Redirect URI:', redirectUri || 'não fornecido');

    // Get authenticated user
    console.log('[Google Auth POST] 🔐 VERIFICANDO AUTENTICAÇÃO DO USUÁRIO...');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('[Google Auth POST] 📊 RESULTADO DA AUTENTICAÇÃO:');
    console.log('[Google Auth POST] - Usuário encontrado:', !!user);
    console.log('[Google Auth POST] - User ID:', user?.id || 'não encontrado');
    console.log('[Google Auth POST] - Email:', user?.email || 'não encontrado');
    console.log('[Google Auth POST] - Erro de auth:', authError?.message || 'nenhum');

    if (authError || !user) {
      console.error('[Google Auth POST] ❌ ERRO DE AUTENTICAÇÃO:', authError);
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('[Google Auth POST] ✅ USUÁRIO AUTENTICADO COM SUCESSO');

    // Generate OAuth authorization URL
    console.log('[Google Auth POST] 🔗 GERANDO URL DE AUTORIZAÇÃO OAUTH...');
    const oauthService = getGoogleOAuthService();
    const { url, state } = oauthService.getAuthorizationUrl({
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: true,
    });

    console.log('[Google Auth POST] ✅ URL OAUTH GERADA:');
    console.log('[Google Auth POST] - URL:', url);
    console.log('[Google Auth POST] - State:', state);
    console.log('[Google Auth POST] - URL length:', url.length);

    // Store state in database for validation (30 minutos de validade)
    console.log('[Google Auth POST] 💾 SALVANDO ESTADO OAUTH NO BANCO...');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    console.log('[Google Auth POST] - State a ser salvo:', state);
    console.log('[Google Auth POST] - Client ID:', clientId);
    console.log('[Google Auth POST] - User ID:', user.id);
    console.log('[Google Auth POST] - Expira em:', expiresAt);
    console.log('[Google Auth POST] - Agora:', new Date().toISOString());
    
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: user.id,
        provider: 'google',
        expires_at: expiresAt,
      });

    if (stateError) {
      console.error('[Google Auth POST] ❌ ERRO AO SALVAR ESTADO OAUTH:', stateError);
      console.error('[Google Auth POST] - Código do erro:', stateError.code);
      console.error('[Google Auth POST] - Mensagem:', stateError.message);
      console.error('[Google Auth POST] - Detalhes:', stateError.details);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    console.log('[Google Auth POST] ✅ ESTADO OAUTH SALVO COM SUCESSO');
    
    // Verificar imediatamente se o state foi salvo
    const { data: verifyState, error: verifyError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .single();
    
    if (verifyError || !verifyState) {
      console.error('[Google Auth POST] ⚠️ VERIFICAÇÃO FALHOU - State não encontrado após salvar!');
      console.error('[Google Auth POST] - Erro de verificação:', verifyError);
    } else {
      console.log('[Google Auth POST] ✅ VERIFICAÇÃO OK - State confirmado no banco');
      console.log('[Google Auth POST] - ID:', verifyState.id);
      console.log('[Google Auth POST] - Expira em:', verifyState.expires_at);
    }
    
    console.log('[Google Auth POST] 🎉 FLUXO DE AUTENTICAÇÃO CONCLUÍDO');
    console.log('='.repeat(80));

    return NextResponse.json({
      authUrl: url,
      state,
    });

  } catch (error: any) {
    console.error('[Google Auth POST] Unexpected error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors.map(e => e.message),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Falha ao iniciar autenticação',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/google/auth (for debugging/info)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    console.log('[Google Auth GET] Starting request');

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      console.log('[Google Auth GET] Missing clientId parameter');
      return NextResponse.json(
        { error: 'Client ID é obrigatório' },
        { status: 400 }
      );
    }

    console.log('[Google Auth GET] ClientId provided:', clientId);

    // Check configuration with detailed logging
    const configCheck = checkGoogleConfiguration();
    
    console.log('[Google Auth GET] Configuration check:', {
      isValid: configCheck.isValid,
      missing: configCheck.missing,
      invalid: configCheck.invalid,
      hasClientId: !!configCheck.config.GOOGLE_CLIENT_ID,
      hasAppUrl: !!configCheck.config.NEXT_PUBLIC_APP_URL,
      appUrl: configCheck.config.NEXT_PUBLIC_APP_URL
    });

    if (!configCheck.isValid) {
      console.error('[Google Auth GET] Configuration invalid');
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'Credenciais do Google Ads não configuradas corretamente',
          details: {
            missing: configCheck.missing,
            invalid: configCheck.invalid,
            appUrl: configCheck.config.NEXT_PUBLIC_APP_URL
          },
          configured: false
        },
        { status: 503 }
      );
    }

    console.log('[Google Auth GET] Configuration valid');

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Google Auth GET] Authentication error:', authError);
      return NextResponse.json(
        { error: 'Não autorizado - faça login primeiro' },
        { status: 401 }
      );
    }

    console.log('[Google Auth GET] User authenticated:', user.id);

    // Generate OAuth authorization URL
    const oauthService = getGoogleOAuthService();
    const { url, state } = oauthService.getAuthorizationUrl({
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: true,
    });

    console.log('[Google Auth GET] OAuth URL generated');

    // Store state in database for validation (30 minutos de validade)
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: user.id,
        provider: 'google',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      console.error('[Google Auth GET] Error storing OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Erro ao salvar estado OAuth' },
        { status: 500 }
      );
    }

    console.log('[Google Auth GET] OAuth state stored successfully');

    return NextResponse.json({
      authUrl: url,
      state,
      configured: true,
      debug: {
        appUrl: configCheck.config.NEXT_PUBLIC_APP_URL,
        hasAllVars: configCheck.isValid
      }
    });

  } catch (error) {
    console.error('[Google Auth GET] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao gerar URL de autenticação',
        details: error.message 
      },
      { status: 500 }
    );
  }
}