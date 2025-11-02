/**
 * Google Ads Disconnect API Route
 * 
 * Revokes Google Ads connection and cleans up data
 * Requirements: 1.1, 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleTokenManager } from '@/lib/google/token-manager';
import { z } from 'zod';

// ============================================================================
// Request Validation Schema
// ============================================================================

const DisconnectRequestSchema = z.object({
  connectionId: z.string().uuid('Connection ID deve ser um UUID válido').optional(),
  clientId: z.string().uuid('Client ID deve ser um UUID válido').optional(),
  customerId: z.string().optional(),
  revokeTokens: z.boolean().default(true),
  deleteData: z.boolean().default(false),
}).refine(
  (data) => data.connectionId || (data.clientId && data.customerId),
  {
    message: "Deve fornecer connectionId ou (clientId + customerId)",
  }
);

// ============================================================================
// POST /api/google/disconnect
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { connectionId, clientId, customerId, revokeTokens, deleteData } = 
      DisconnectRequestSchema.parse(body);

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Find the connection to disconnect
    let connection;
    
    if (connectionId) {
      // Find by connection ID
      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, client_id, customer_id, status')
        .eq('id', connectionId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Conexão não encontrada' },
          { status: 404 }
        );
      }

      connection = data;
    } else {
      // Find by client ID and customer ID
      const { data, error } = await supabase
        .from('google_ads_connections')
        .select('id, client_id, customer_id, status')
        .eq('client_id', clientId!)
        .eq('customer_id', customerId!)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Conexão não encontrada' },
          { status: 404 }
        );
      }

      connection = data;
    }

    // Verify user has access to this connection's client
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', connection.client_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Acesso negado à conexão especificada' },
        { status: 403 }
      );
    }

    // Revoke tokens if requested
    if (revokeTokens && connection.status !== 'revoked') {
      try {
        const tokenManager = getGoogleTokenManager();
        await tokenManager.revokeTokens(connection.id);
        console.log('[Google Disconnect] Tokens revoked for connection:', connection.id);
      } catch (revokeError) {
        console.error('[Google Disconnect] Error revoking tokens:', revokeError);
        // Continue with disconnection even if token revocation fails
      }
    }

    // Delete associated data if requested
    if (deleteData) {
      // Delete metrics first (foreign key constraint)
      const { error: metricsError } = await supabase
        .from('google_ads_metrics')
        .delete()
        .in('campaign_id', 
          supabase
            .from('google_ads_campaigns')
            .select('id')
            .eq('connection_id', connection.id)
        );

      if (metricsError) {
        console.error('[Google Disconnect] Error deleting metrics:', metricsError);
      }

      // Delete campaigns
      const { error: campaignsError } = await supabase
        .from('google_ads_campaigns')
        .delete()
        .eq('connection_id', connection.id);

      if (campaignsError) {
        console.error('[Google Disconnect] Error deleting campaigns:', campaignsError);
      }

      // Delete sync logs
      const { error: syncLogsError } = await supabase
        .from('google_ads_sync_logs')
        .delete()
        .eq('connection_id', connection.id);

      if (syncLogsError) {
        console.error('[Google Disconnect] Error deleting sync logs:', syncLogsError);
      }

      console.log('[Google Disconnect] Associated data deleted for connection:', connection.id);
    }

    // Update connection status or delete connection
    if (deleteData) {
      // Delete the connection entirely
      const { error: deleteError } = await supabase
        .from('google_ads_connections')
        .delete()
        .eq('id', connection.id);

      if (deleteError) {
        console.error('[Google Disconnect] Error deleting connection:', deleteError);
        return NextResponse.json(
          { error: 'Erro ao deletar conexão' },
          { status: 500 }
        );
      }

      console.log('[Google Disconnect] Connection deleted:', connection.id);
    } else {
      // Just mark as revoked
      const { error: updateError } = await supabase
        .from('google_ads_connections')
        .update({
          status: 'revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      if (updateError) {
        console.error('[Google Disconnect] Error updating connection status:', updateError);
        return NextResponse.json(
          { error: 'Erro ao atualizar status da conexão' },
          { status: 500 }
        );
      }

      console.log('[Google Disconnect] Connection marked as revoked:', connection.id);
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      clientId: connection.client_id,
      customerId: connection.customer_id,
      action: deleteData ? 'deleted' : 'revoked',
      tokensRevoked: revokeTokens,
      dataDeleted: deleteData,
      message: deleteData 
        ? 'Conexão e dados deletados com sucesso'
        : 'Conexão desconectada com sucesso',
    });

  } catch (error) {
    console.error('[Google Disconnect] Error:', error);

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
// GET /api/google/disconnect (get disconnection options)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');

    if (!connectionId && !clientId) {
      return NextResponse.json(
        { error: 'Connection ID ou Client ID é obrigatório' },
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

    // Get connection details
    let query = supabase
      .from('google_ads_connections')
      .select(`
        id,
        client_id,
        customer_id,
        status,
        last_sync_at,
        created_at,
        google_ads_campaigns!inner(count),
        google_ads_sync_logs!inner(count)
      `);

    if (connectionId) {
      query = query.eq('id', connectionId);
    } else {
      query = query.eq('client_id', clientId);
    }

    const { data: connections, error: connectionsError } = await query;

    if (connectionsError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    // Verify user has access to these connections
    const clientIds = connections.map(conn => conn.client_id);
    const { data: memberships, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id')
      .eq('user_id', user.id)
      .in('client_id', clientIds);

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'Acesso negado às conexões especificadas' },
        { status: 403 }
      );
    }

    const accessibleClientIds = memberships.map(m => m.client_id);
    const accessibleConnections = connections.filter(conn => 
      accessibleClientIds.includes(conn.client_id)
    );

    // Get campaign and metrics counts for each connection
    const connectionsWithCounts = await Promise.all(
      accessibleConnections.map(async (conn) => {
        const { data: campaignCount } = await supabase
          .from('google_ads_campaigns')
          .select('id', { count: 'exact' })
          .eq('connection_id', conn.id);

        const { data: metricsCount } = await supabase
          .from('google_ads_metrics')
          .select('id', { count: 'exact' })
          .in('campaign_id',
            supabase
              .from('google_ads_campaigns')
              .select('id')
              .eq('connection_id', conn.id)
          );

        return {
          ...conn,
          campaignCount: campaignCount?.length || 0,
          metricsCount: metricsCount?.length || 0,
        };
      })
    );

    return NextResponse.json({
      connections: connectionsWithCounts,
      disconnectionOptions: {
        revokeTokens: {
          description: 'Revogar tokens de acesso no Google',
          recommended: true,
          reversible: false,
        },
        deleteData: {
          description: 'Deletar todos os dados de campanhas e métricas',
          recommended: false,
          reversible: false,
          warning: 'Esta ação não pode ser desfeita',
        },
      },
    });

  } catch (error) {
    console.error('[Google Disconnect GET] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}