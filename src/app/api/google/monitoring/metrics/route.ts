/**
 * Google Ads Monitoring Metrics API
 * 
 * Provides access to performance metrics and system health data
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
    const period = searchParams.get('period') as '1h' | '24h' | '7d' | '30d' || '24h';
    const operation = searchParams.get('operation') || undefined;
    const includePerformance = searchParams.get('includePerformance') === 'true';

    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    googleAdsLogger.info('Metrics request started', {
      userId: user.id,
      operation: 'monitoring_api',
      metadata: { period, operation, includePerformance }
    });

    // Collect current metrics
    const metrics = await googleAdsMonitoring.collectMetrics(period);

    // Get performance statistics if requested
    let performanceStats = null;
    if (includePerformance) {
      const hours = period === '1h' ? 1 : period === '24h' ? 24 : period === '7d' ? 168 : 720;
      performanceStats = await googleAdsPerformanceMonitor.getPerformanceStats(operation, hours);
    }

    // Get health status
    const healthStatus = await googleAdsMonitoring.getHealthStatus();

    const response = {
      metrics,
      performanceStats,
      healthStatus,
      timestamp: new Date().toISOString()
    };

    googleAdsLogger.info('Metrics request completed', {
      userId: user.id,
      operation: 'monitoring_api',
      metadata: { 
        period, 
        metricsCollected: true,
        performanceIncluded: includePerformance,
        healthStatus: healthStatus.status
      }
    });

    return NextResponse.json(response);

  } catch (error) {
    googleAdsLogger.error('Failed to get monitoring metrics', error as Error, {
      operation: 'monitoring_api'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { period = '1h' } = body;

    googleAdsLogger.info('Manual metrics collection started', {
      userId: user.id,
      operation: 'monitoring_api',
      metadata: { period, trigger: 'manual' }
    });

    // Collect and store metrics
    const metrics = await googleAdsMonitoring.collectMetrics(period as '1h' | '24h' | '7d' | '30d');
    await googleAdsMonitoring.storeMetrics(metrics);

    // Check for alerts
    const alerts = await googleAdsMonitoring.checkAlerts();

    googleAdsLogger.info('Manual metrics collection completed', {
      userId: user.id,
      operation: 'monitoring_api',
      metadata: { 
        period,
        metricsStored: true,
        alertsGenerated: alerts.length
      }
    });

    return NextResponse.json({
      success: true,
      metrics,
      alerts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    googleAdsLogger.error('Failed to collect metrics manually', error as Error, {
      operation: 'monitoring_api'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}