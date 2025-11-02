/**
 * Google Ads Sync Cron Job
 * 
 * Automatically syncs Google Ads data for all active clients
 * Runs every 6 hours via Vercel Cron
 * Requirements: 3.2, 10.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSyncQueueManager } from '@/lib/google/sync-queue-manager';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

interface CronResult {
  success: boolean;
  message: string;
  stats: {
    totalClients: number;
    jobsQueued: number;
    errors: number;
  };
  timestamp: string;
}

// ============================================================================
// Cron Job Handler
// ============================================================================

/**
 * GET /api/cron/google-sync
 * 
 * Triggered by Vercel Cron every 6 hours
 * Queues sync jobs for all active Google Ads connections
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('[Google Sync Cron] Starting scheduled sync...');

    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Google Sync Cron] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all active Google Ads connections
    const supabase = createServiceClient();
    
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('client_id, customer_id, last_sync_at')
      .eq('status', 'active')
      .order('last_sync_at', { ascending: true, nullsFirst: true });

    if (error) {
      throw new Error(`Failed to fetch connections: ${error.message}`);
    }

    if (!connections || connections.length === 0) {
      console.log('[Google Sync Cron] No active connections found');
      
      return NextResponse.json({
        success: true,
        message: 'No active connections to sync',
        stats: {
          totalClients: 0,
          jobsQueued: 0,
          errors: 0,
        },
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[Google Sync Cron] Found ${connections.length} active connections`);

    // Filter connections that need syncing
    const connectionsToSync = filterConnectionsNeedingSync(connections);

    console.log(`[Google Sync Cron] ${connectionsToSync.length} connections need syncing`);

    // Queue sync jobs
    const queueManager = getSyncQueueManager();
    const clientIds = connectionsToSync.map(c => c.client_id);
    
    const jobIds = await queueManager.addBatchJobs(
      clientIds,
      {
        fullSync: false, // Incremental sync
        syncMetrics: true,
      },
      'normal' // Normal priority for scheduled syncs
    );

    const errors = connections.length - jobIds.length;

    // Log results
    const duration = Date.now() - startTime;
    console.log(`[Google Sync Cron] Completed in ${duration}ms`);
    console.log(`[Google Sync Cron] Jobs queued: ${jobIds.length}`);
    console.log(`[Google Sync Cron] Errors: ${errors}`);

    // Check for persistent failures and send notifications
    if (errors > 0) {
      await notifyAdminsOfFailures(errors);
    }

    const result: CronResult = {
      success: true,
      message: `Queued ${jobIds.length} sync jobs`,
      stats: {
        totalClients: connections.length,
        jobsQueued: jobIds.length,
        errors,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Google Sync Cron] Error:', error);

    // Notify admins of critical failure
    await notifyAdminsOfCriticalFailure(error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        stats: {
          totalClients: 0,
          jobsQueued: 0,
          errors: 1,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter connections that need syncing based on last sync time
 */
function filterConnectionsNeedingSync(
  connections: Array<{
    client_id: string;
    customer_id: string;
    last_sync_at: string | null;
  }>
): Array<{
  client_id: string;
  customer_id: string;
  last_sync_at: string | null;
}> {
  const now = Date.now();
  const sixHoursInMs = 6 * 60 * 60 * 1000;

  return connections.filter(connection => {
    // If never synced, sync it
    if (!connection.last_sync_at) {
      return true;
    }

    // Check if last sync was more than 6 hours ago
    const lastSyncTime = new Date(connection.last_sync_at).getTime();
    const timeSinceLastSync = now - lastSyncTime;

    return timeSinceLastSync >= sixHoursInMs;
  });
}

/**
 * Notify administrators of sync failures
 */
async function notifyAdminsOfFailures(errorCount: number): Promise<void> {
  try {
    console.log(`[Google Sync Cron] Notifying admins of ${errorCount} failures`);

    // TODO: Implement notification service
    // This could send emails, Slack messages, or create in-app notifications
    
    // For now, just log
    console.warn(`[Google Sync Cron] ${errorCount} sync jobs failed to queue`);

  } catch (error) {
    console.error('[Google Sync Cron] Error sending failure notifications:', error);
  }
}

/**
 * Notify administrators of critical cron job failure
 */
async function notifyAdminsOfCriticalFailure(error: any): Promise<void> {
  try {
    console.error('[Google Sync Cron] Critical failure - notifying admins');

    // TODO: Implement critical notification service
    // This should send urgent notifications to administrators
    
    // For now, just log
    console.error('[Google Sync Cron] CRITICAL: Cron job failed completely', error);

  } catch (notifyError) {
    console.error('[Google Sync Cron] Error sending critical notifications:', notifyError);
  }
}

/**
 * Get sync statistics for monitoring
 */
async function getSyncStatistics(): Promise<{
  totalConnections: number;
  activeConnections: number;
  recentSyncs: number;
  failedSyncs: number;
}> {
  try {
    const supabase = createServiceClient();

    // Get total connections
    const { count: totalConnections } = await supabase
      .from('google_ads_connections')
      .select('id', { count: 'exact', head: true });

    // Get active connections
    const { count: activeConnections } = await supabase
      .from('google_ads_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get recent syncs (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { count: recentSyncs } = await supabase
      .from('google_ads_sync_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString());

    // Get failed syncs (last 24 hours)
    const { count: failedSyncs } = await supabase
      .from('google_ads_sync_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneDayAgo.toISOString());

    return {
      totalConnections: totalConnections || 0,
      activeConnections: activeConnections || 0,
      recentSyncs: recentSyncs || 0,
      failedSyncs: failedSyncs || 0,
    };

  } catch (error) {
    console.error('[Google Sync Cron] Error getting statistics:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      recentSyncs: 0,
      failedSyncs: 0,
    };
  }
}
