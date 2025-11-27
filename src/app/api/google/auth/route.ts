/**
 * Google Ads Authentication API Route - Refatorado
 * 
 * Inicia o fluxo OAuth 2.0 para Google Ads API
 * Usa GoogleOAuthFlowManager para lógica centralizada
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleOAuthFlowManager } from '@/lib/google/oauth-flow-manager';
import { z } from 'zod';

// ============================================================================
// Request Validation Schema
// ============================================================================

const AuthRequestSchema = z.object({
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
});

// ============================================================================
// Environment Variables Check
// ============================================================================

function checkGoogleConfiguration() {
  const requiredVars = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  return {
    isValid: missing.length === 0,
    missing,
  };
}

// ============================================================================
// POST /api/google/auth
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('[Google Auth] 🚀 Iniciando fluxo OAuth');

    // Verificar configuração
    const configCheck = checkGoogleConfiguration();
    if (!configCheck.isValid) {
      console.error('[Google Auth] ❌ Configuração inválida:', configCheck.missing);
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'Credenciais do Google Ads não configuradas',
          missing: configCheck.missing,
          configured: false
        },
        { status: 503 }
      );
    }

    // Validar request body
    const body = await request.json();
    const { clientId } = AuthRequestSchema.parse(body);

    // Verificar autenticação
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Google Auth] ❌ Não autorizado');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Usar flow manager para iniciar OAuth
    const flowManager = getGoogleOAuthFlowManager();
    const result = await flowManager.initiateOAuthFlow(user.id, clientId);

    console.log('[Google Auth] ✅ Fluxo iniciado com sucesso');

    return NextResponse.json({
      authUrl: result.authUrl,
      state: result.state,
    });

  } catch (error: any) {
    console.error('[Google Auth] ❌ Erro:', error);

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

