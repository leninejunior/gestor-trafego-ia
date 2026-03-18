/**
 * Google Ads System Health API
 * 
 * Provides system health status and diagnostics
 * Requirements: 10.3, 10.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { googleAdsMonitoring } from '@/lib/google/monitoring';
import { googleAdsPerformanceMonitor } from '@/lib/google/performance-monitor';
import { googleAdsLogger } from '@/lib/google/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    googleAdsLogger.info('Health check request started', {
      userId: user.id,
      operation: 'health_api',
      metadata: { detailed }
    });

    // Get basic health status
    const healthStatus = await googleAdsMonitoring.getHealthStatus();

    let response: any = {
      status: healthStatus.status,
      checks: healthStatus.checks,
      timestamp: new Date().toISOString()
    };

    if (detailed) {
      // Get additional detailed information
      const [
        recentMetrics,
        activeAlerts,
        activeOperations,
        performanceStats
      ] = await Promise.all([
        googleAdsMonitoring.collectMetrics('1h'),
        getActiveAlerts(supabase),
        getActiveOperations(),
        googleAdsPerformanceMonitor.getPerformanceStats(undefined, 1)
      ]);

      response.detailed = {
        metrics: recentMetrics,
        activeAlerts,
        activeOperations: Array.from(activeOperations.entries()).map(([id, metrics]) => ({
          id,
          operation: metrics.operation,
          duration: Date.now() - metrics.startTime,
          recordsProcessed: metrics.recordsProcessed,
          apiCalls: metrics.apiCalls
        })),
        performanceStats,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      };
    }

    googleAdsLogger.info('Health check request completed', {
      userId: user.id,
      operation: 'health_api',
      metadata: { 
        status: healthStatus.status,
        checksCount: healthStatus.checks.length,
        detailed
      }
    });

    return NextResponse.json(response);

  } catch (error) {
    googleAdsLogger.error('Health check failed', error as Error, {
      operation: 'health_api'
    });

    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Health check system failure',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Get active alerts from database
 */
async function getActiveAlerts(supabase: any) {
  try {
    const { data: alerts } = await supabase
      .from('google_ads_alerts')
      .select('id, alert_type, severity, title, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    return alerts || [];
  } catch (error) {
    googleAdsLogger.error('Failed to get active alerts for health check', error as Error);
    return [];
  }
}

/**
 * Get active operations from performance monitor
 */
function getActiveOperations() {
  return googleAdsPerformanceMonitor.getActiveOperations();
}