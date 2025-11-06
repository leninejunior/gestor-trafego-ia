/**
 * Debug version of Google Accounts API
 * Bypasses authentication for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('[Google Accounts Debug] Starting request');
  
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    console.log('[Google Accounts Debug] Connection ID:', connectionId);

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID é obrigatório' },
        { status: 400 }
      );
    }

    // Use service client to bypass RLS
    console.log('[Google Accounts Debug] Using service client...');
    const supabase = createServiceClient();

    // Get connection details
    console.log('[Google Accounts Debug] Getting connection details...');
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status, access_token, refresh_token, token_expires_at')
      .eq('id', connectionId)
      .single();

    console.log('[Google Accounts Debug] Connection query result:', {
      hasConnection: !!connection,
      connectionError: connectionError?.message,
      connectionId: connection?.id,
      clientId: connection?.client_id,
      customerId: connection?.customer_id,
      status: connection?.status,
      hasAccessToken: !!connection?.access_token,
      hasRefreshToken: !!connection?.refresh_token,
      tokenExpires: connection?.token_expires_at
    });

    if (connectionError || !connection) {
      console.log('[Google Accounts Debug] Connection not found');
      return NextResponse.json(
        { 
          error: 'Conexão não encontrada',
          connectionError: connectionError?.message,
          connectionId 
        },
        { status: 404 }
      );
    }

    // Check if connection is pending (no customer selected yet)
    if (connection.customer_id === 'pending') {
      return NextResponse.json({
        error: 'Conexão pendente',
        message: 'Complete o processo de autenticação OAuth primeiro.',
        accounts: [],
        totalAccounts: 0,
        isPending: true,
        requiresAuth: true,
        isDebug: true,
        connection: {
          id: connection.id,
          clientId: connection.client_id,
          customerId: connection.customer_id,
          status: connection.status,
          hasAccessToken: !!connection.access_token,
          hasRefreshToken: !!connection.refresh_token,
          tokenExpires: connection.token_expires_at
        },
        message: 'Conexão pendente - selecione uma conta para continuar'
      });
    }

    // If not pending, try to get real accounts (but for now return mock)
    console.log('[Google Accounts Debug] Connection not pending, would try to get real accounts');
    
    return NextResponse.json({
      connectionId,
      accounts: [],
      totalAccounts: 0,
      isPending: false,
      isDebug: true,
      connection: {
        id: connection.id,
        clientId: connection.client_id,
        customerId: connection.customer_id,
        status: connection.status,
        hasAccessToken: !!connection.access_token,
        hasRefreshToken: !!connection.refresh_token,
        tokenExpires: connection.token_expires_at
      },
      message: 'Conexão ativa - implementar busca de contas reais'
    });

  } catch (error) {
    console.error('[Google Accounts Debug] Error:', error);
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