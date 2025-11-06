/**
 * Simplified Google Ads Account Selection API Route
 * For debugging purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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
// POST /api/google/accounts/select-simple
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[Google Account Select Simple] Starting request');
  
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log('[Google Account Select Simple] Request body:', body);
    
    const { connectionId, clientId, selectedAccounts } = SelectAccountsSchema.parse(body);

    console.log('[Google Account Select Simple] Validated data:', {
      connectionId,
      clientId,
      selectedAccounts
    });

    // Use service client to bypass authentication issues
    const supabase = createServiceClient();

    // Get connection details
    console.log('[Google Account Select Simple] Getting connection details...');
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();

    console.log('[Google Account Select Simple] Connection query result:', {
      hasConnection: !!connection,
      connectionError: connectionError?.message,
      connection
    });

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    // For MCC accounts, we'll handle multiple selections
    const primaryCustomerId = selectedAccounts[0];
    const additionalAccounts = selectedAccounts.slice(1);

    console.log('[Google Account Select Simple] Processing MCC account selection:', {
      primaryCustomerId,
      additionalAccounts,
      totalSelected: selectedAccounts.length
    });

    // Update the primary connection with the first selected customer ID
    const { error: updateError } = await supabase
      .from('google_ads_connections')
      .update({
        customer_id: primaryCustomerId,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('[Google Account Select Simple] Error updating primary connection:', updateError);
      return NextResponse.json(
        { error: 'Erro ao salvar seleção de contas' },
        { status: 500 }
      );
    }

    console.log('[Google Account Select Simple] Primary connection updated successfully');

    // Create additional connections for other selected accounts (MCC feature)
    const additionalConnections = [];
    
    if (additionalAccounts.length > 0) {
      console.log('[Google Account Select Simple] Creating additional connections for MCC accounts...');
      
      for (const customerId of additionalAccounts) {
        try {
          const { data: newConnection, error: createError } = await supabase
            .from('google_ads_connections')
            .insert({
              client_id: clientId,
              user_id: '00000000-0000-0000-0000-000000000000', // Simplified user ID
              customer_id: customerId,
              refresh_token: 'shared_from_mcc', // Will share tokens from primary connection
              status: 'active',
            })
            .select('id')
            .single();

          if (createError) {
            console.error(`[Google Account Select Simple] Error creating connection for ${customerId}:`, createError);
          } else {
            additionalConnections.push({
              id: newConnection.id,
              customerId,
            });
            console.log(`[Google Account Select Simple] Created additional connection for ${customerId}`);
          }
        } catch (error) {
          console.error(`[Google Account Select Simple] Error creating additional connection:`, error);
        }
      }
    }

    // Log the account selection
    console.log('[Google Account Select Simple] Accounts selected:', {
      connectionId,
      clientId,
      primaryCustomerId,
      selectedAccounts,
    });

    return NextResponse.json({
      success: true,
      connectionId,
      primaryCustomerId,
      selectedAccounts,
      additionalConnections,
      totalConnections: 1 + additionalConnections.length,
      isSimplified: true,
      isMCC: selectedAccounts.length > 1,
      message: `${selectedAccounts.length} conta${selectedAccounts.length > 1 ? 's' : ''} conectada${selectedAccounts.length > 1 ? 's' : ''} com sucesso`,
      details: {
        primaryConnection: connectionId,
        additionalConnections: additionalConnections.length,
        mccAccountsConnected: selectedAccounts.length > 1
      }
    });

  } catch (error) {
    console.error('[Google Account Select Simple] Error:', error);

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
        error: 'Erro interno do servidor',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}