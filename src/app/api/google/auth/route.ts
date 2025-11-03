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
    console.log('[Google Auth POST] Starting authentication flow');

    // Check configuration with detailed logging
    const configCheck = checkGoogleConfiguration();
    
    if (!configCheck.isValid) {
      console.error('[Google Auth POST] Configuration invalid:', {
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

    console.log('[Google Auth POST] Configuration valid');

    // Parse and validate request body
    const body = await request.json();
    console.log('[Google Auth POST] Request body parsed');
    
    const { clientId, redirectUri } = AuthRequestSchema.parse(body);
    console.log('[Google Auth POST] Request validated, clientId:', clientId);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Google Auth POST] Authentication error:', authError);
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('[Google Auth POST] User authenticated:', user.id);

    // Generate OAuth authorization URL
    const oauthService = getGoogleOAuthService();
    const { url, state } = oauthService.getAuthorizationUrl({
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: true,
    });

    console.log('[Google Auth POST] OAuth URL generated');

    // Store state in database for validation
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
      console.error('[Google Auth POST] Error storing OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    console.log('[Google Auth POST] OAuth state stored successfully');

    return NextResponse.json({
      authUrl: url,
      state,
    });

  } catch (error) {
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
      { error: 'Falha ao iniciar autenticação' },
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

    // Store state in database for validation
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