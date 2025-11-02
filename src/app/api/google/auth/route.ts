/**
 * Google Ads Authentication API Route
 * 
 * Initiates OAuth 2.0 flow for Google Ads API
 * Requirements: 1.1, 1.2, 1.4, 1.5
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
// POST /api/google/auth
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check if Google Ads is configured
    const isConfigured = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET && 
      process.env.GOOGLE_DEVELOPER_TOKEN &&
      !process.env.GOOGLE_CLIENT_ID.includes('your_') &&
      !process.env.GOOGLE_CLIENT_SECRET.includes('your_') &&
      !process.env.GOOGLE_DEVELOPER_TOKEN.includes('your_')
    );

    if (!isConfigured) {
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'As credenciais do Google Ads não foram configuradas. Configure as variáveis GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_DEVELOPER_TOKEN no arquivo .env',
          configured: false
        },
        { status: 503 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { clientId, redirectUri } = AuthRequestSchema.parse(body);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verify user has access to the client through organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Usuário não possui organização' },
        { status: 403 }
      );
    }

    // Verify client belongs to user's organization
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('org_id', membership.organization_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    // Check if client already has an active Google Ads connection
    const { data: existingConnection } = await supabase
      .from('google_ads_connections')
      .select('id, status, customer_id')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single();

    // Generate OAuth authorization URL
    const oauthService = getGoogleOAuthService();
    const { url, state } = oauthService.getAuthorizationUrl({
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: true,
    });

    // Store state in session/database for validation
    // Using a temporary table or session storage
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: user.id,
        provider: 'google',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });

    if (stateError) {
      console.error('[Google Auth] Error storing OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authUrl: url,
      state,
      hasExistingConnection: !!existingConnection,
      existingConnection: existingConnection ? {
        id: existingConnection.id,
        customerId: existingConnection.customer_id,
        status: existingConnection.status,
      } : null,
    });

  } catch (error) {
    console.error('[Google Auth] Error initiating OAuth flow:', error);

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
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID é obrigatório' },
        { status: 400 }
      );
    }

    // Check if Google Ads is configured
    const isConfigured = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET && 
      process.env.GOOGLE_DEVELOPER_TOKEN &&
      !process.env.GOOGLE_CLIENT_ID.includes('your_') &&
      !process.env.GOOGLE_CLIENT_SECRET.includes('your_') &&
      !process.env.GOOGLE_DEVELOPER_TOKEN.includes('your_')
    );

    if (!isConfigured) {
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'As credenciais do Google Ads não foram configuradas',
          configured: false
        },
        { status: 503 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado - faça login primeiro' },
        { status: 401 }
      );
    }

    // Generate OAuth authorization URL
    const oauthService = getGoogleOAuthService();
    const { url, state } = oauthService.getAuthorizationUrl({
      accessType: 'offline',
      prompt: 'consent',
      includeGrantedScopes: true,
    });

    // Store state in database for validation (IMPORTANTE!)
    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state,
        client_id: clientId,
        user_id: user.id,
        provider: 'google',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });

    if (stateError) {
      console.error('[Google Auth GET] Error storing OAuth state:', stateError);
      return NextResponse.json(
        { error: 'Erro ao salvar estado OAuth' },
        { status: 500 }
      );
    }

    // Return auth URL
    return NextResponse.json({
      authUrl: url,
      state,
      configured: true
    });

  } catch (error) {
    console.error('[Google Auth GET] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar URL de autenticação' },
      { status: 500 }
    );
  }
}