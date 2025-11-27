/**
 * Google Ads Account Selection API Route - Refatorado
 * 
 * Salva as contas Google Ads selecionadas
 * Usa GoogleOAuthFlowManager para lógica centralizada
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleOAuthFlowManager } from '@/lib/google/oauth-flow-manager';
import { z } from 'zod';

// ============================================================================
// Request Validation Schema
// ============================================================================

const SelectAccountsSchema = z.object({
  connectionId: z.string().uuid('Connection ID deve ser um UUID válido'),
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
  selectedAccounts: z.array(z.string()).min(1, 'Selecione pelo menos uma conta'),
});

// ============================================================================
// POST /api/google/accounts/select
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('[Google Account Select] 💾 Salvando seleção de contas');
    
    // Validar request body
    const body = await request.json();
    const { connectionId, clientId, selectedAccounts } = SelectAccountsSchema.parse(body);

    // Verificar autenticação
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Salvar contas usando flow manager
    const flowManager = getGoogleOAuthFlowManager();
    const result = await flowManager.saveSelectedAccounts(
      connectionId,
      clientId,
      selectedAccounts
    );

    if (!result.success) {
      console.error('[Google Account Select] ❌ Erro:', result.error);
      return NextResponse.json(
        { error: result.error || 'Erro ao salvar seleção' },
        { status: 500 }
      );
    }

    console.log('[Google Account Select] ✅ Contas salvas com sucesso');

    return NextResponse.json({
      success: true,
      connectionIds: result.connectionIds,
      primaryCustomerId: result.primaryCustomerId,
      selectedAccounts,
      totalConnections: result.connectionIds.length,
      message: `${selectedAccounts.length} conta${selectedAccounts.length > 1 ? 's' : ''} conectada${selectedAccounts.length > 1 ? 's' : ''} com sucesso`,
    });

  } catch (error: any) {
    console.error('[Google Account Select] ❌ Erro:', error);

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
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/google/accounts/select (get current selection)
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

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verify user has access to the client
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    // Get all active connections for this client
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('id, customer_id, status, last_sync_at, created_at')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (connectionsError) {
      console.error('[Google Account Select GET] Error fetching connections:', connectionsError);
      return NextResponse.json(
        { error: 'Erro ao buscar conexões' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientId,
      connections: connections || [],
      selectedAccounts: connections?.map(conn => conn.customer_id) || [],
      totalConnections: connections?.length || 0,
    });

  } catch (error) {
    console.error('[Google Account Select GET] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}