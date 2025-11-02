/**
 * Observability Service
 * 
 * Coleta e gerencia métricas de observabilidade do sistema de cache histórico.
 * Requirement 9.1: Registrar métricas de tempo de execução e volume de dados
 */

import { createClient } from '@/lib/supabase/server';

export interface SyncMetrics {
  platform: 'meta' | 'google';
  success_rate: number;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  avg_duration_ms: number;
  total_records_synced: number;
  last_sync_at: Date | null;
}

export interface StorageMetrics {
  client_id: string;
  client_name: string;
  total_records: number;
  storage_mb: number;
  oldest_record_date: Date | null;
  newest_record_date: Date | null;
  platforms: string[];
}

export interface ApiCallMetrics {
  platform: 'meta' | 'google';
  total_calls: number;
  calls_last_24h: number;
  calls_last_7d: number;
  avg_calls_per_sync: number;
}

export interface SystemHealthMetrics {
  total_clients: number;
  active_sync_configs: number;
  pending_syncs: number;
  failed_syncs_last_24h: number;
  storage_usage_mb: number;
  avg_sync_duration_ms: number;
}

export class ObservabilityService {
  /**
   * Obtém taxa de sucesso de sync por plataforma
   */
  async getSyncSuccessRateByPlatform(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<SyncMetrics[]> {
    const supabase = await createClient();
    
    const fromDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 dias
    const toDate = dateTo || new Date();

    const { data: syncLogs, error } = await supabase
      .from('sync_logs')
      .select(`
        sync_config_id,
        status,
        duration_ms,
        records_synced,
        started_at,
        sync_configurations!inner(platform)
      `)
      .gte('started_at', fromDate.toISOString())
      .lte('started_at', toDate.toISOString());

    if (error) {
      console.error('Error fetching sync metrics:', error);
      return [];
    }

    // Agrupar por plataforma
    const metricsByPlatform = new Map<string, {
      total: number;
      successful: number;
      failed: number;
      totalDuration: number;
      totalRecords: number;
      lastSync: Date | null;
    }>();

    for (const log of syncLogs || []) {
      const platform = (log as any).sync_configurations?.platform;
      if (!platform) continue;

      const current = metricsByPlatform.get(platform) || {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        totalRecords: 0,
        lastSync: null,
      };

      current.total++;
      if (log.status === 'completed') {
        current.successful++;
      } else if (log.status === 'failed') {
        current.failed++;
      }
      
      current.totalDuration += log.duration_ms || 0;
      current.totalRecords += log.records_synced || 0;
      
      const syncDate = new Date(log.started_at);
      if (!current.lastSync || syncDate > current.lastSync) {
        current.lastSync = syncDate;
      }

      metricsByPlatform.set(platform, current);
    }

    // Converter para array de métricas
    const metrics: SyncMetrics[] = [];
    for (const [platform, data] of metricsByPlatform) {
      metrics.push({
        platform: platform as 'meta' | 'google',
        success_rate: data.total > 0 ? (data.successful / data.total) * 100 : 0,
        total_syncs: data.total,
        successful_syncs: data.successful,
        failed_syncs: data.failed,
        avg_duration_ms: data.total > 0 ? data.totalDuration / data.total : 0,
        total_records_synced: data.totalRecords,
        last_sync_at: data.lastSync,
      });
    }

    return metrics;
  }

  /**
   * Obtém tempo médio de sync por plataforma
   */
  async getAverageSyncDuration(
    platform?: 'meta' | 'google',
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{ platform: string; avg_duration_ms: number; sample_size: number }[]> {
    const supabase = await createClient();
    
    const fromDate = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias
    const toDate = dateTo || new Date();

    let query = supabase
      .from('sync_logs')
      .select(`
        duration_ms,
        sync_configurations!inner(platform)
      `)
      .eq('status', 'completed')
      .not('duration_ms', 'is', null)
      .gte('started_at', fromDate.toISOString())
      .lte('started_at', toDate.toISOString());

    if (platform) {
      query = query.eq('sync_configurations.platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sync duration:', error);
      return [];
    }

    // Agrupar por plataforma
    const durationByPlatform = new Map<string, number[]>();
    
    for (const log of data || []) {
      const plat = (log as any).sync_configurations?.platform;
      if (!plat) continue;

      const durations = durationByPlatform.get(plat) || [];
      durations.push(log.duration_ms!);
      durationByPlatform.set(plat, durations);
    }

    // Calcular médias
    const results = [];
    for (const [plat, durations] of durationByPlatform) {
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      results.push({
        platform: plat,
        avg_duration_ms: Math.round(avg),
        sample_size: durations.length,
      });
    }

    return results;
  }

  /**
   * Obtém uso de storage por cliente
   */
  async getStorageUsageByClient(): Promise<StorageMetrics[]> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_storage_metrics_by_client');

    if (error) {
      console.error('Error fetching storage metrics:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      client_id: row.client_id,
      client_name: row.client_name,
      total_records: row.total_records,
      storage_mb: parseFloat(row.storage_mb),
      oldest_record_date: row.oldest_record_date ? new Date(row.oldest_record_date) : null,
      newest_record_date: row.newest_record_date ? new Date(row.newest_record_date) : null,
      platforms: row.platforms || [],
    }));
  }

  /**
   * Obtém métricas de chamadas de API por plataforma
   */
  async getApiCallMetrics(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<ApiCallMetrics[]> {
    const supabase = await createClient();
    
    const fromDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 dias
    const toDate = dateTo || new Date();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: allLogs, error: allError } = await supabase
      .from('sync_logs')
      .select(`
        api_calls_made,
        started_at,
        sync_configurations!inner(platform)
      `)
      .not('api_calls_made', 'is', null)
      .gte('started_at', fromDate.toISOString())
      .lte('started_at', toDate.toISOString());

    if (allError) {
      console.error('Error fetching API call metrics:', allError);
      return [];
    }

    // Agrupar por plataforma
    const metricsByPlatform = new Map<string, {
      totalCalls: number;
      calls24h: number;
      calls7d: number;
      syncCount: number;
    }>();

    for (const log of allLogs || []) {
      const platform = (log as any).sync_configurations?.platform;
      if (!platform) continue;

      const current = metricsByPlatform.get(platform) || {
        totalCalls: 0,
        calls24h: 0,
        calls7d: 0,
        syncCount: 0,
      };

      const calls = log.api_calls_made || 0;
      const logDate = new Date(log.started_at);

      current.totalCalls += calls;
      current.syncCount++;

      if (logDate >= last24h) {
        current.calls24h += calls;
      }
      if (logDate >= last7d) {
        current.calls7d += calls;
      }

      metricsByPlatform.set(platform, current);
    }

    // Converter para array
    const metrics: ApiCallMetrics[] = [];
    for (const [platform, data] of metricsByPlatform) {
      metrics.push({
        platform: platform as 'meta' | 'google',
        total_calls: data.totalCalls,
        calls_last_24h: data.calls24h,
        calls_last_7d: data.calls7d,
        avg_calls_per_sync: data.syncCount > 0 ? data.totalCalls / data.syncCount : 0,
      });
    }

    return metrics;
  }

  /**
   * Obtém métricas gerais de saúde do sistema
   */
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    const supabase = await createClient();

    // Total de clientes
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    // Configurações de sync ativas
    const { count: activeSyncConfigs } = await supabase
      .from('sync_configurations')
      .select('*', { count: 'exact', head: true })
      .eq('sync_status', 'active');

    // Syncs pendentes
    const { count: pendingSyncs } = await supabase
      .from('sync_configurations')
      .select('*', { count: 'exact', head: true })
      .lte('next_sync_at', new Date().toISOString())
      .eq('sync_status', 'active');

    // Falhas nas últimas 24h
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: failedSyncs } = await supabase
      .from('sync_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('started_at', last24h.toISOString());

    // Uso de storage total
    const { data: storageData } = await supabase.rpc('get_total_storage_usage');
    const storageUsageMb = storageData?.[0]?.total_storage_mb || 0;

    // Duração média de sync (últimos 7 dias)
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { data: avgDurationData } = await supabase
      .from('sync_logs')
      .select('duration_ms')
      .eq('status', 'completed')
      .not('duration_ms', 'is', null)
      .gte('started_at', last7d.toISOString());

    const avgSyncDuration = avgDurationData && avgDurationData.length > 0
      ? avgDurationData.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / avgDurationData.length
      : 0;

    return {
      total_clients: totalClients || 0,
      active_sync_configs: activeSyncConfigs || 0,
      pending_syncs: pendingSyncs || 0,
      failed_syncs_last_24h: failedSyncs || 0,
      storage_usage_mb: parseFloat(storageUsageMb.toFixed(2)),
      avg_sync_duration_ms: Math.round(avgSyncDuration),
    };
  }

  /**
   * Registra métricas de uma execução de sync
   * Requirement 9.1: Registrar métricas quando Sync Job é executado
   */
  async recordSyncMetrics(
    syncConfigId: string,
    metrics: {
      status: 'completed' | 'failed' | 'partial';
      durationMs: number;
      recordsSynced: number;
      recordsFailed: number;
      apiCallsMade: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('sync_logs')
      .insert({
        sync_config_id: syncConfigId,
        status: metrics.status,
        duration_ms: metrics.durationMs,
        records_synced: metrics.recordsSynced,
        records_failed: metrics.recordsFailed,
        api_calls_made: metrics.apiCallsMade,
        error_message: metrics.errorMessage,
        completed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error recording sync metrics:', error);
      throw error;
    }
  }

  /**
   * Record export metrics for monitoring and alerting
   */
  async recordExportMetrics(metrics: {
    user_id: string;
    client_id: string;
    platform: string;
    format: 'csv' | 'json';
    status: 'success' | 'failure';
    duration_ms: number;
    record_count: number;
    file_size_mb: number;
    error_message?: string;
  }): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('export_metrics')
      .insert({
        user_id: metrics.user_id,
        client_id: metrics.client_id,
        platform: metrics.platform,
        format: metrics.format,
        status: metrics.status,
        duration_ms: metrics.duration_ms,
        record_count: metrics.record_count,
        file_size_mb: metrics.file_size_mb,
        error_message: metrics.error_message,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error recording export metrics:', error);
      // Don't throw - metrics recording failure shouldn't break export
    }
  }

  /**
   * Record generic system event for monitoring
   */
  async recordEvent(event: {
    type: string;
    metadata: Record<string, any>;
    severity?: 'info' | 'warning' | 'error';
  }): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('system_events')
      .insert({
        event_type: event.type,
        metadata: event.metadata,
        severity: event.severity || 'info',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error recording system event:', error);
      // Don't throw - event recording failure shouldn't break operations
    }
  }

  /**
   * Get export failure rate for alerting
   */
  async getExportFailureRate(
    timeWindowHours: number = 24,
    platform?: string,
    format?: 'csv' | 'json'
  ): Promise<{
    total_exports: number;
    failed_exports: number;
    failure_rate: number;
  }> {
    const supabase = await createClient();

    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    let query = supabase
      .from('export_metrics')
      .select('status')
      .gte('created_at', since.toISOString());

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (format) {
      query = query.eq('format', format);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching export failure rate:', error);
      return { total_exports: 0, failed_exports: 0, failure_rate: 0 };
    }

    const totalExports = data?.length || 0;
    const failedExports = data?.filter(row => row.status === 'failure').length || 0;
    const failureRate = totalExports > 0 ? (failedExports / totalExports) * 100 : 0;

    return {
      total_exports: totalExports,
      failed_exports: failedExports,
      failure_rate: Number(failureRate.toFixed(2))
    };
  }
}
