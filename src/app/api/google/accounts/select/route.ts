/**
 * Google Ads Account Selection API Route
 * 
 * Saves selected Google Ads accounts for a connection
 * Requirements: 1.4, 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
    // Parse and validate request body
    const body = await request.json();
    const { connectionId, clientId, selectedAccounts } = SelectAccountsSchema.parse(body);

    // Get authenticated user
    const supabase = createClient();
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

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    // For simplicity, we'll use the first selected account as the primary customer ID
    // In a more complex implementation, you might create separate connections for each account
    const primaryCustomerId = selectedAccounts[0];

    // Update the connection with the selected customer ID
    const { error: updateError } = await supabase
      .from('google_ads_connections')
      .update({
        customer_id: primaryCustomerId,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('[Google Account Select] Error updating connection:', updateError);
      return NextResponse.json(
        { error: 'Erro ao salvar seleção de contas' },
        { status: 500 }
      );
    }

    // If multiple accounts were selected, create additional connections
    const additionalConnections = [];
    
    if (selectedAccounts.length > 1) {
      for (let i = 1; i < selectedAccounts.length; i++) {
        const customerId = selectedAccounts[i];
        
        try {
          const { data: newConnection, error: createError } = await supabase
            .from('google_ads_connections')
            .insert({
              client_id: clientId,
              customer_id: customerId,
              refresh_token: 'shared', // Will be copied from primary connection
              status: 'active',
            })
            .select('id')
            .single();

          if (createError) {
            console.error(`[Google Account Select] Error creating connection for ${customerId}:`, createError);
          } else {
            additionalConnections.push({
              id: newConnection.id,
              customerId,
            });
          }
        } catch (error) {
          console.error(`[Google Account Select] Error creating additional connection:`, error);
        }
      }
    }

    // Log the account selection
    console.log('[Google Account Select] Accounts selected:', {
      connectionId,
      clientId,
      primaryCustomerId,
      additionalAccounts: selectedAccounts.slice(1),
      totalConnections: 1 + additionalConnections.length,
    });

    return NextResponse.json({
      success: true,
      connectionId,
      primaryCustomerId,
      selectedAccounts,
      additionalConnections,
      totalConnections: 1 + additionalConnections.length,
      message: `${selectedAccounts.length} conta${selectedAccounts.length > 1 ? 's' : ''} conectada${selectedAccounts.length > 1 ? 's' : ''} com sucesso`,
    });

  } catch (error) {
    console.error('[Google Account Select] Error:', error);

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
    const supabase = createClient();
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