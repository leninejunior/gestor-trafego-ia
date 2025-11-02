/**
 * Google Ads Monitoring Service
 * 
 * Monitors performance metrics and system health for Google Ads integration
 * Requirements: 10.3, 10.5
 */

import { createClient } from '@/lib/supabase/server';
import { googleAdsLogger } from './logger';

export interface GoogleAdsMetrics {
  // API Performance
  apiRequestCount: number;
  apiRequestDuration: number;
  apiErrorRate: number;
  apiSuccessRate: number;
  
  // Sync Performance
  syncCount: number;
  syncDuration: number;
  syncSuccessRate: number;
  campaignsSyncedTotal: number;
  metricsSyncedTotal: number;
  
  // Error Metrics
  errorCount: number;
  criticalErrorCount: number;
  retryCount: number;
  
  // Connection Health
  activeConnections: number;
  expiredTokens: number;
  failedConnections: number;
  
  // Rate Limiting
  rateLimitHits: number;
  backoffEvents: number;
  
  // Timestamp
  timestamp: Date;
  period: '1h' | '24h' | '7d' | '30d';
}

export interface GoogleAdsAlert {
  id: string;
  type: 'error_rate' | 'sync_failure' | 'token_expiry' | 'rate_limit' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  threshold: number;
  currentValue: number;
  organizationId?: string;
  connectionId?: string;
  isActive: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export class GoogleAdsMonitoringService {
  private readonly ALERT_THRESHOLDS = {
    ERROR_RATE: 0.1, // 10%
    SYNC_FAILURE_RATE: 0.2, // 20%
    API_RESPONSE_TIME: 5000, // 5 seconds
    TOKEN_EXPIRY_HOURS: 24, // 24 hours
    RATE_LIMIT_HITS_PER_HOUR: 10
  };

  /**
   * Collect current metrics
   */
  async collectMetrics(period: '1h' | '24h' | '7d' | '30d' = '1h'): Promise<GoogleAdsMetrics> {
    try {
      const supabase = await createClient();
      const timeRange = this.getTimeRange(period);

      // Get sync metrics
      const { data: syncLogs } = await supabase
        .from('google_ads_sync_logs')
        .select('*')
        .gte('created_at', timeRange.start.toISOString())
        .lte('created_at', timeRange.end.toISOString());

      // Get connection metrics
      const { data: connections } = await supabase
        .from('google_ads_connections')
        .select('*');

      // Calculate metrics
      const metrics: GoogleAdsMetrics = {
        // Sync metrics
        syncCount: syncLogs?.length || 0,
        syncDuration: this.calculateAverageDuration(syncLogs || []),
        syncSuccessRate: this.calculateSuccessRate(syncLogs || []),
        campaignsSyncedTotal: this.sumField(syncLogs || [], 'campaigns_synced'),
        metricsSyncedTotal: this.sumField(syncLogs || [], 'metrics_updated'),
        
        // Connection metrics
        activeConnections: connections?.filter(c => c.status === 'active').length || 0,
        expiredTokens: connections?.filter(c => 
          new Date(c.token_expires_at) < new Date()
        ).length || 0,
        failedConnections: connections?.filter(c => c.status === 'expired' || c.status === 'revoked').length || 0,
        
        // Error metrics (would need additional tracking)
        errorCount: syncLogs?.filter(l => l.status === 'failed').length || 0,
        criticalErrorCount: syncLogs?.filter(l => 
          l.status === 'failed' && l.error_code?.includes('AUTH')
        ).length || 0,
        retryCount: 0, // Would need additional tracking
        
        // API metrics (would need additional tracking)
        apiRequestCount: 0,
        apiRequestDuration: 0,
        apiErrorRate: 0,
        apiSuccessRate: 0,
        
        // Rate limiting (would need additional tracking)
        rateLimitHits: 0,
        backoffEvents: 0,
        
        timestamp: new Date(),
        period
      };

      googleAdsLogger.performance('metrics_collection', {
        duration: Date.now() - timeRange.start.getTime(),
        recordsProcessed: (syncLogs?.length || 0) + (connections?.length || 0)
      });

      return metrics;

    } catch (error) {
      googleAdsLogger.error('Failed to collect metrics', error as Error);
      throw error;
    }
  }

  /**
   * Check for alerts based on current metrics
   */
  async checkAlerts(): Promise<GoogleAdsAlert[]> {
    try {
      const metrics = await this.collectMetrics('1h');
      const alerts: GoogleAdsAlert[] = [];

      // Check error rate
      if (metrics.syncCount > 0) {
        const errorRate = metrics.errorCount / metrics.syncCount;
        if (errorRate > this.ALERT_THRESHOLDS.ERROR_RATE) {
          alerts.push({
            id: `error_rate_${Date.now()}`,
            type: 'error_rate',
            severity: errorRate > 0.5 ? 'critical' : 'high',
            title: 'High Error Rate Detected',
            message: `Google Ads sync error rate is ${(errorRate * 100).toFixed(1)}%`,
            threshold: this.ALERT_THRESHOLDS.ERROR_RATE,
            currentValue: errorRate,
            isActive: true,
            createdAt: new Date()
          });
        }
      }

      // Check sync failure rate
      const syncFailureRate = 1 - metrics.syncSuccessRate;
      if (syncFailureRate > this.ALERT_THRESHOLDS.SYNC_FAILURE_RATE) {
        alerts.push({
          id: `sync_failure_${Date.now()}`,
          type: 'sync_failure',
          severity: syncFailureRate > 0.5 ? 'critical' : 'high',
          title: 'High Sync Failure Rate',
          message: `Google Ads sync failure rate is ${(syncFailureRate * 100).toFixed(1)}%`,
          threshold: this.ALERT_THRESHOLDS.SYNC_FAILURE_RATE,
          currentValue: syncFailureRate,
          isActive: true,
          createdAt: new Date()
        });
      }

      // Check token expiry
      if (metrics.expiredTokens > 0) {
        alerts.push({
          id: `token_expiry_${Date.now()}`,
          type: 'token_expiry',
          severity: 'medium',
          title: 'Expired Tokens Detected',
          message: `${metrics.expiredTokens} Google Ads tokens have expired`,
          threshold: 0,
          currentValue: metrics.expiredTokens,
          isActive: true,
          createdAt: new Date()
        });
      }

      // Check performance
      if (metrics.syncDuration > this.ALERT_THRESHOLDS.API_RESPONSE_TIME) {
        alerts.push({
          id: `performance_${Date.now()}`,
          type: 'performance',
          severity: 'medium',
          title: 'Slow Sync Performance',
          message: `Average sync duration is ${(metrics.syncDuration / 1000).toFixed(1)}s`,
          threshold: this.ALERT_THRESHOLDS.API_RESPONSE_TIME,
          currentValue: metrics.syncDuration,
          isActive: true,
          createdAt: new Date()
        });
      }

      // Log alerts
      if (alerts.length > 0) {
        googleAdsLogger.warn(`Generated ${alerts.length} alerts`, {
          metadata: { alertTypes: alerts.map(a => a.type) }
        });
      }

      return alerts;

    } catch (error) {
      googleAdsLogger.error('Failed to check alerts', error as Error);
      return [];
    }
  }

  /**
   * Store metrics in database for historical tracking
   */
  async storeMetrics(metrics: GoogleAdsMetrics): Promise<void> {
    try {
      const supabase = await createClient();
      
      await supabase
        .from('google_ads_metrics_history')
        .insert({
          timestamp: metrics.timestamp.toISOString(),
          period: metrics.period,
          sync_count: metrics.syncCount,
          sync_duration: metrics.syncDuration,
          sync_success_rate: metrics.syncSuccessRate,
          campaigns_synced_total: metrics.campaignsSyncedTotal,
          metrics_synced_total: metrics.metricsSyncedTotal,
          error_count: metrics.errorCount,
          critical_error_count: metrics.criticalErrorCount,
          active_connections: metrics.activeConnections,
          expired_tokens: metrics.expiredTokens,
          failed_connections: metrics.failedConnections,
          api_request_count: metrics.apiRequestCount,
          api_request_duration: metrics.apiRequestDuration,
          api_error_rate: metrics.apiErrorRate,
          rate_limit_hits: metrics.rateLimitHits,
          created_at: new Date().toISOString()
        });

      googleAdsLogger.debug('Metrics stored successfully', {
        metadata: { period: metrics.period, timestamp: metrics.timestamp }
      });

    } catch (error) {
      googleAdsLogger.error('Failed to store metrics', error as Error);
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message: string;
    }>;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check database connectivity
      const supabase = await createClient();
      const { error: dbError } = await supabase
        .from('google_ads_connections')
        .select('count')
        .limit(1);

      checks.push({
        name: 'database_connectivity',
        status: dbError ? 'fail' : 'pass',
        message: dbError ? 'Database connection failed' : 'Database accessible'
      });

      if (dbError) overallStatus = 'unhealthy';

      // Check recent sync performance
      const metrics = await this.collectMetrics('1h');
      const recentSyncSuccess = metrics.syncSuccessRate > 0.8;
      
      checks.push({
        name: 'sync_performance',
        status: recentSyncSuccess ? 'pass' : 'fail',
        message: recentSyncSuccess 
          ? `Sync success rate: ${(metrics.syncSuccessRate * 100).toFixed(1)}%`
          : `Low sync success rate: ${(metrics.syncSuccessRate * 100).toFixed(1)}%`
      });

      if (!recentSyncSuccess && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }

      // Check token health
      const tokenHealthy = metrics.expiredTokens === 0;
      
      checks.push({
        name: 'token_health',
        status: tokenHealthy ? 'pass' : 'fail',
        message: tokenHealthy 
          ? 'All tokens are valid'
          : `${metrics.expiredTokens} expired tokens detected`
      });

      if (!tokenHealthy && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }

      return { status: overallStatus, checks };

    } catch (error) {
      googleAdsLogger.error('Health check failed', error as Error);
      
      return {
        status: 'unhealthy',
        checks: [{
          name: 'health_check',
          status: 'fail',
          message: 'Health check system failure'
        }]
      };
    }
  }

  /**
   * Calculate time range for metrics collection
   */
  private getTimeRange(period: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
    }

    return { start, end };
  }

  /**
   * Calculate average duration from sync logs
   */
  private calculateAverageDuration(logs: any[]): number {
    if (logs.length === 0) return 0;

    const durations = logs
      .filter(log => log.started_at && log.completed_at)
      .map(log => 
        new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()
      );

    return durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;
  }

  /**
   * Calculate success rate from sync logs
   */
  private calculateSuccessRate(logs: any[]): number {
    if (logs.length === 0) return 1;

    const successCount = logs.filter(log => log.status === 'success').length;
    return successCount / logs.length;
  }

  /**
   * Sum a specific field from array of objects
   */
  private sumField(logs: any[], field: string): number {
    return logs.reduce((sum, log) => sum + (log[field] || 0), 0);
  }
}

// Singleton instance
export const googleAdsMonitoring = new GoogleAdsMonitoringService();