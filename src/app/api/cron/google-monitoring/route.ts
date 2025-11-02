/**
 * Google Ads Monitoring Cron Job
 * 
 * Automatically collects metrics and checks for alerts
 * Requirements: 10.3, 10.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { googleAdsMonitoring } from '@/lib/google/monitoring';
import { googleAdsLogger } from '@/lib/google/logger';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (Vercel sets this header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      googleAdsLogger.warn('Unauthorized cron request', {
        operation: 'monitoring_cron',
        metadata: { hasAuth: !!authHeader }
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    
    googleAdsLogger.info('Monitoring cron job started', {
      operation: 'monitoring_cron',
      metadata: { trigger: 'scheduled' }
    });

    // Collect metrics for different periods
    const periods: Array<'1h' | '24h' | '7d' | '30d'> = ['1h', '24h'];
    const results = [];

    for (const period of periods) {
      try {
        // Collect metrics
        const metrics = await googleAdsMonitoring.collectMetrics(period);
        
        // Store metrics in database
        await googleAdsMonitoring.storeMetrics(metrics);
        
        results.push({
          period,
          success: true,
          metrics: {
            syncCount: metrics.syncCount,
            syncSuccessRate: metrics.syncSuccessRate,
            activeConnections: metrics.activeConnections,
            errorCount: metrics.errorCount
          }
        });

        googleAdsLogger.info(`Metrics collected for period: ${period}`, {
          operation: 'monitoring_cron',
          metadata: {
            period,
            syncCount: metrics.syncCount,
            successRate: metrics.syncSuccessRate,
            activeConnections: metrics.activeConnections
          }
        });

      } catch (error) {
        googleAdsLogger.error(`Failed to collect metrics for period: ${period}`, error as Error, {
          operation: 'monitoring_cron',
          metadata: { period }
        });

        results.push({
          period,
          success: false,
          error: (error as Error).message
        });
      }
    }

    // Check for alerts
    let alerts = [];
    try {
      alerts = await googleAdsMonitoring.checkAlerts();
      
      googleAdsLogger.info('Alert check completed', {
        operation: 'monitoring_cron',
        metadata: { 
          alertsGenerated: alerts.length,
          alertTypes: alerts.map(a => a.type)
        }
      });

    } catch (error) {
      googleAdsLogger.error('Failed to check alerts', error as Error, {
        operation: 'monitoring_cron'
      });
    }

    // Clean up old data (run once per day)
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() < 15) { // Run at 2 AM
      try {
        await cleanupOldData();
        
        googleAdsLogger.info('Data cleanup completed', {
          operation: 'monitoring_cron',
          metadata: { trigger: 'scheduled_cleanup' }
        });

      } catch (error) {
        googleAdsLogger.error('Failed to cleanup old data', error as Error, {
          operation: 'monitoring_cron'
        });
      }
    }

    const duration = Date.now() - startTime;

    googleAdsLogger.info('Monitoring cron job completed', {
      operation: 'monitoring_cron',
      duration,
      metadata: {
        periodsProcessed: results.length,
        successfulPeriods: results.filter(r => r.success).length,
        alertsGenerated: alerts.length,
        totalDuration: duration
      }
    });

    return NextResponse.json({
      success: true,
      results,
      alerts: alerts.length,
      duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    googleAdsLogger.error('Monitoring cron job failed', error as Error, {
      operation: 'monitoring_cron'
    });

    return NextResponse.json(
      { 
        success: false,
        error: 'Monitoring cron job failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Clean up old monitoring data
 */
async function cleanupOldData(): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Use the cleanup function from the database
    const { error } = await supabase.rpc('cleanup_google_ads_monitoring_data');

    if (error) {
      throw error;
    }

    googleAdsLogger.info('Old monitoring data cleaned up successfully', {
      operation: 'monitoring_cron',
      metadata: { action: 'cleanup' }
    });

  } catch (error) {
    googleAdsLogger.error('Failed to cleanup old monitoring data', error as Error, {
      operation: 'monitoring_cron'
    });
    throw error;
  }
}