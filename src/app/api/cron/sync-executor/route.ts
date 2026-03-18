/**
 * Sync Executor Cron Job
 * Executes pending sync jobs from the queue
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { multiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { SyncQueue } from '@/lib/sync/sync-queue';

// Global sync queue instance
let syncQueue: SyncQueue | null = null;

function getSyncQueue(): SyncQueue {
  if (!syncQueue) {
    syncQueue = new SyncQueue(multiPlatformSyncEngine, {
      maxConcurrency: 3,
      maxRetries: 3,
      initialBackoffMs: 1000,
      maxBackoffMs: 300000,
      backoffMultiplier: 2
    });
  }
  return syncQueue;
}

/**
 * Cron job to execute pending sync jobs
 * Should be called periodically (e.g., every minute)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Sync Executor] Checking sync queue...');

    const queue = getSyncQueue();

    // Check if queue is already processing
    if (queue.isRunning()) {
      const stats = queue.getStats();
      console.log('[Sync Executor] Queue already processing', stats);
      
      return NextResponse.json({
        success: true,
        message: 'Queue already processing',
        queue_stats: stats
      });
    }

    // Check if queue has jobs
    if (queue.isEmpty()) {
      console.log('[Sync Executor] Queue is empty');
      
      return NextResponse.json({
        success: true,
        message: 'No pending sync jobs',
        queue_stats: queue.getStats()
      });
    }

    // Start processing queue
    console.log('[Sync Executor] Starting queue processing...');
    
    // Process in background (don't await)
    queue.start().catch(error => {
      console.error('[Sync Executor] Queue processing error:', error);
    });

    const stats = queue.getStats();

    return NextResponse.json({
      success: true,
      message: 'Started processing sync queue',
      queue_stats: stats
    });
  } catch (error) {
    console.error('[Sync Executor] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to execute sync jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get queue status (GET with query param)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    const queue = getSyncQueue();

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          is_running: queue.isRunning(),
          is_empty: queue.isEmpty(),
          stats: queue.getStats(),
          failed_jobs: queue.getFailedJobs().map(job => ({
            client_id: job.client_id,
            platform: job.platform,
            attempts: job.attempts,
            last_error: job.last_error,
            last_attempt_at: job.last_attempt_at
          }))
        });

      case 'retry_failed':
        const retried = queue.retryAllFailedJobs();
        
        // Start processing if not running
        if (!queue.isRunning() && !queue.isEmpty()) {
          queue.start().catch(error => {
            console.error('[Sync Executor] Queue processing error:', error);
          });
        }

        return NextResponse.json({
          success: true,
          message: `Retried ${retried} failed jobs`,
          jobs_retried: retried,
          stats: queue.getStats()
        });

      case 'clear':
        queue.clear();
        return NextResponse.json({
          success: true,
          message: 'Queue cleared'
        });

      case 'stop':
        queue.stop();
        return NextResponse.json({
          success: true,
          message: 'Queue processing stopped'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Sync Executor] Action error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to execute action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
