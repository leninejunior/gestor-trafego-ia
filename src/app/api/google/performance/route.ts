/**
 * Google Ads Performance Monitoring API Route
 * 
 * Provides cache statistics, batch queue status, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { googleAdsCache } from '@/lib/google/cache-service';
import { getGoogleSyncService } from '@/lib/google/sync-service';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';

// ============================================================================
// GET /api/google/performance
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verify user has access to the client if specified
    if (clientId) {
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
    }

    // Get cache statistics
    const cacheStats = await googleAdsCache.getStats();

    // Get batch queue status
    const syncService = getGoogleSyncService();
    const batchQueueStatus = syncService.getBatchQueueStatus();

    // Get database performance stats
    const repository = new GoogleAdsRepository();
    const queryStats = await repository.getQueryStats();

    // Get recent sync performance
    const recentSyncs = await supabase
      .from('google_ads_sync_logs')
      .select(`
        sync_type,
        status,
        campaigns_synced,
        metrics_updated,
        started_at,
        completed_at,
        error_message
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate sync performance metrics
    const syncMetrics = calculateSyncMetrics(recentSyncs.data || []);

    return NextResponse.json({
      cache: {
        statistics: cacheStats,
        performance: {
          hit_rate_percentage: (cacheStats.hit_rate * 100).toFixed(2),
          memory_usage_status: cacheStats.memory_usage_mb > 100 ? 'high' : 'normal',
          entries_status: cacheStats.total_entries > 1000 ? 'high' : 'normal'
        }
      },
      batch_queue: {
        status: batchQueueStatus,
        performance: {
          utilization_percentage: ((batchQueueStatus.processing / batchQueueStatus.maxConcurrent) * 100).toFixed(2),
          queue_status: batchQueueStatus.queueLength > 10 ? 'congested' : 'normal'
        }
      },
      database: {
        query_stats: queryStats,
        performance: {
          total_size_mb: queryStats.reduce((sum, table) => {
            const sizeStr = table.total_size.replace(/[^\d.]/g, '');
            const size = parseFloat(sizeStr);
            const unit = table.total_size.includes('GB') ? 1024 : 1;
            return sum + (size * unit);
          }, 0).toFixed(2)
        }
      },
      sync_performance: syncMetrics,
      recommendations: generatePerformanceRecommendations(cacheStats, batchQueueStatus, syncMetrics),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Google Performance] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/google/performance (cache operations)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, clientId } = body;

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'clear_cache':
        if (clientId) {
          const deletedEntries = await googleAdsCache.invalidateClient(clientId);
          return NextResponse.json({
            success: true,
            message: `Cache limpo para cliente ${clientId}`,
            deleted_entries: deletedEntries
          });
        } else {
          await googleAdsCache.clear();
          return NextResponse.json({
            success: true,
            message: 'Cache completamente limpo'
          });
        }

      case 'cleanup_cache':
        const cleanedEntries = await googleAdsCache.cleanup();
        return NextResponse.json({
          success: true,
          message: 'Entradas expiradas removidas do cache',
          cleaned_entries: cleanedEntries
        });

      case 'refresh_materialized_views':
        const repository = new GoogleAdsRepository();
        await repository.refreshMaterializedViews();
        return NextResponse.json({
          success: true,
          message: 'Views materializadas atualizadas'
        });

      case 'cleanup_old_data':
        const { metricsRetentionDays = 365, logsRetentionDays = 30 } = body;
        const repository2 = new GoogleAdsRepository();
        const cleanupResult = await repository2.cleanupOldData(metricsRetentionDays, logsRetentionDays);
        return NextResponse.json({
          success: true,
          message: 'Dados antigos removidos',
          ...cleanupResult
        });

      default:
        return NextResponse.json(
          { error: 'Ação não suportada' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Google Performance POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateSyncMetrics(syncs: any[]) {
  if (syncs.length === 0) {
    return {
      total_syncs: 0,
      success_rate: 0,
      average_duration: 0,
      average_campaigns_per_sync: 0,
      average_metrics_per_sync: 0
    };
  }

  const successfulSyncs = syncs.filter(s => s.status === 'success');
  const syncDurations = syncs
    .filter(s => s.started_at && s.completed_at)
    .map(s => {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.completed_at).getTime();
      return (end - start) / 1000; // Duration in seconds
    });

  return {
    total_syncs: syncs.length,
    success_rate: (successfulSyncs.length / syncs.length * 100).toFixed(2),
    average_duration: syncDurations.length > 0 
      ? (syncDurations.reduce((sum, d) => sum + d, 0) / syncDurations.length).toFixed(2)
      : 0,
    average_campaigns_per_sync: (syncs.reduce((sum, s) => sum + (s.campaigns_synced || 0), 0) / syncs.length).toFixed(2),
    average_metrics_per_sync: (syncs.reduce((sum, s) => sum + (s.metrics_updated || 0), 0) / syncs.length).toFixed(2),
    recent_errors: syncs
      .filter(s => s.status === 'failed' && s.error_message)
      .slice(0, 3)
      .map(s => ({
        sync_type: s.sync_type,
        error: s.error_message,
        timestamp: s.started_at
      }))
  };
}

function generatePerformanceRecommendations(cacheStats: any, batchQueueStatus: any, syncMetrics: any) {
  const recommendations = [];

  // Cache recommendations
  if (cacheStats.hit_rate < 0.7) {
    recommendations.push({
      type: 'cache',
      priority: 'high',
      message: 'Taxa de acerto do cache está baixa. Considere aumentar os TTLs ou revisar os padrões de acesso.',
      action: 'review_cache_strategy'
    });
  }

  if (cacheStats.memory_usage_mb > 100) {
    recommendations.push({
      type: 'cache',
      priority: 'medium',
      message: 'Uso de memória do cache está alto. Considere limpar entradas antigas.',
      action: 'cleanup_cache'
    });
  }

  // Batch queue recommendations
  if (batchQueueStatus.queueLength > 10) {
    recommendations.push({
      type: 'batch',
      priority: 'high',
      message: 'Fila de batch operations está congestionada. Considere aumentar a concorrência.',
      action: 'increase_concurrency'
    });
  }

  // Sync performance recommendations
  if (parseFloat(syncMetrics.success_rate) < 90) {
    recommendations.push({
      type: 'sync',
      priority: 'high',
      message: 'Taxa de sucesso de sincronização está baixa. Verifique logs de erro.',
      action: 'investigate_sync_errors'
    });
  }

  if (parseFloat(syncMetrics.average_duration) > 300) { // 5 minutes
    recommendations.push({
      type: 'sync',
      priority: 'medium',
      message: 'Duração média de sincronização está alta. Considere otimizar batch sizes.',
      action: 'optimize_batch_sizes'
    });
  }

  return recommendations;
}