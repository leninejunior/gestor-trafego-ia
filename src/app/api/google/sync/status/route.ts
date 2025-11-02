/**
 * Google Ads Sync Status API Route
 * 
 * Gets current synchronization status for Google Ads connections
 * Requirements: 3.1, 3.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================================================
// Request Validation Schema
// ============================================================================

const StatusQuerySchema = z.object({
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
  connectionId: z.string().uuid('Connection ID deve ser um UUID válido').optional(),
});

// ============================================================================
// GET /api/google/sync/status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const { clientId, connectionId } = StatusQuerySchema.parse(queryParams);

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

    // Get connections for the client
    let connectionsQuery = supabase
      .from('google_ads_connections')
      .select('id, customer_id, status, last_sync_at, created_at')
      .eq('client_id', clientId)
      .eq('status', 'active');

    if (connectionId) {
      connectionsQuery = connectionsQuery.eq('id', connectionId);
    }

    const { data: connections, error: connectionsError } = await connectionsQuery;

    if (connectionsError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma conexão ativa encontrada para este cliente' },
        { status: 404 }
      );
    }

    // Get sync status for each connection
    const connectionStatuses = await Promise.all(
      connections.map(async (connection) => {
        // Get latest sync log
        const { data: latestSync } = await supabase
          .from('google_ads_sync_logs')
          .select('*')
          .eq('connection_id', connection.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();

        // Get active sync (if any)
        const { data: activeSync } = await supabase
          .from('google_ads_sync_logs')
          .select('*')
          .eq('connection_id', connection.id)
          .is('completed_at', null)
          .gte('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
          .single();

        // Get campaign count
        const { data: campaignCount } = await supabase
          .from('google_ads_campaigns')
          .select('id', { count: 'exact' })
          .eq('connection_id', connection.id);

        // Get latest metrics date
        const { data: latestMetrics } = await supabase
          .from('google_ads_metrics')
          .select('date')
          .in('campaign_id',
            supabase
              .from('google_ads_campaigns')
              .select('id')
              .eq('connection_id', connection.id)
          )
          .order('date', { ascending: false })
          .limit(1)
          .single();

        // Determine current status
        let currentStatus: 'idle' | 'syncing' | 'error' | 'never_synced' = 'idle';
        let progress = 0;
        let statusMessage = '';

        if (activeSync) {
          currentStatus = 'syncing';
          // Calculate rough progress based on time elapsed
          const elapsed = Date.now() - new Date(activeSync.started_at).getTime();
          const estimatedDuration = 5 * 60 * 1000; // 5 minutes estimated
          progress = Math.min(Math.round((elapsed / estimatedDuration) * 100), 95);
          statusMessage = `Sincronizando ${activeSync.sync_type}...`;
        } else if (latestSync) {
          if (latestSync.status === 'failed') {
            currentStatus = 'error';
            statusMessage = latestSync.error_message || 'Erro na última sincronização';
          } else {
            currentStatus = 'idle';
            statusMessage = 'Sincronização concluída';
          }
        } else {
          currentStatus = 'never_synced';
          statusMessage = 'Nunca sincronizado';
        }

        // Calculate next scheduled sync (every 6 hours)
        let nextScheduledSync = null;
        if (connection.last_sync_at) {
          const lastSync = new Date(connection.last_sync_at);
          nextScheduledSync = new Date(lastSync.getTime() + 6 * 60 * 60 * 1000);
        }

        return {
          connectionId: connection.id,
          customerId: connection.customer_id,
          status: currentStatus,
          progress,
          statusMessage,
          lastSync: latestSync ? {
            id: latestSync.id,
            type: latestSync.sync_type,
            status: latestSync.status,
            startedAt: latestSync.started_at,
            completedAt: latestSync.completed_at,
            campaignsSynced: latestSync.campaigns_synced,
            metricsUpdated: latestSync.metrics_updated,
            errorMessage: latestSync.error_message,
            errorCode: latestSync.error_code,
          } : null,
          activeSync: activeSync ? {
            id: activeSync.id,
            type: activeSync.sync_type,
            startedAt: activeSync.started_at,
            elapsedMinutes: Math.round((Date.now() - new Date(activeSync.started_at).getTime()) / 1000 / 60),
          } : null,
          stats: {
            campaignCount: campaignCount?.length || 0,
            latestMetricsDate: latestMetrics?.date || null,
            connectionAge: Math.round((Date.now() - new Date(connection.created_at).getTime()) / 1000 / 60 / 60 / 24), // days
          },
          nextScheduledSync: nextScheduledSync?.toISOString() || null,
        };
      })
    );

    // Calculate overall status
    const hasActiveSyncs = connectionStatuses.some(s => s.status === 'syncing');
    const hasErrors = connectionStatuses.some(s => s.status === 'error');
    const neverSynced = connectionStatuses.some(s => s.status === 'never_synced');

    let overallStatus: 'idle' | 'syncing' | 'error' | 'partial_error' | 'never_synced' = 'idle';
    let overallMessage = '';

    if (hasActiveSyncs) {
      overallStatus = 'syncing';
      const syncingCount = connectionStatuses.filter(s => s.status === 'syncing').length;
      overallMessage = `${syncingCount} sincronização${syncingCount > 1 ? 'ões' : ''} em andamento`;
    } else if (hasErrors && connectionStatuses.every(s => s.status === 'error')) {
      overallStatus = 'error';
      overallMessage = 'Erro em todas as conexões';
    } else if (hasErrors) {
      overallStatus = 'partial_error';
      const errorCount = connectionStatuses.filter(s => s.status === 'error').length;
      overallMessage = `Erro em ${errorCount} de ${connectionStatuses.length} conexões`;
    } else if (neverSynced) {
      overallStatus = 'never_synced';
      overallMessage = 'Algumas conexões nunca foram sincronizadas';
    } else {
      overallStatus = 'idle';
      overallMessage = 'Todas as conexões estão atualizadas';
    }

    // Get next scheduled sync time
    const nextScheduledTimes = connectionStatuses
      .map(s => s.nextScheduledSync)
      .filter(Boolean)
      .sort();
    const nextScheduledSync = nextScheduledTimes[0] || null;

    return NextResponse.json({
      clientId,
      overallStatus,
      overallMessage,
      hasActiveSyncs,
      hasErrors,
      totalConnections: connectionStatuses.length,
      connections: connectionStatuses,
      nextScheduledSync,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Google Sync Status] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Parâmetros inválidos',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
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
// POST /api/google/sync/status (update sync status)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { syncId, status, progress, error } = body;

    if (!syncId || !status) {
      return NextResponse.json(
        { error: 'Sync ID e status são obrigatórios' },
        { status: 400 }
      );
    }

    // Get authenticated user (this might be called by internal services)
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // For internal service calls, you might want to use a service key
      // For now, we'll require authentication
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Update sync log
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.status = 'success';
    } else if (status === 'failed') {
      updateData.completed_at = new Date().toISOString();
      updateData.status = 'failed';
      if (error) {
        updateData.error_message = error;
      }
    }

    const { error: updateError } = await supabase
      .from('google_ads_sync_logs')
      .update(updateData)
      .eq('id', syncId);

    if (updateError) {
      console.error('[Google Sync Status POST] Error updating sync log:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar status da sincronização' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      syncId,
      status,
      updatedAt: updateData.updated_at,
    });

  } catch (error) {
    console.error('[Google Sync Status POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}