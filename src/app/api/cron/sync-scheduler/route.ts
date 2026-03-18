/**
 * Sync Scheduler Cron Job
 * Checks for sync configurations that are due and schedules them
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { multiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { SyncQueue } from '@/lib/sync/sync-queue';

// Create a global sync queue instance
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
 * Cron job to check and schedule sync jobs
 * Should be called periodically (e.g., every 5 minutes)
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

    console.log('[Sync Scheduler] Starting sync scheduler check...');

    // Get all sync jobs that are due
    const jobs = await multiPlatformSyncEngine.scheduleSyncJobs();

    if (jobs.length === 0) {
      console.log('[Sync Scheduler] No sync jobs due at this time');
      return NextResponse.json({
        success: true,
        message: 'No sync jobs due',
        jobs_scheduled: 0
      });
    }

    console.log(`[Sync Scheduler] Found ${jobs.length} sync jobs to schedule`);

    // Add jobs to queue
    const queue = getSyncQueue();
    queue.addJobs(jobs);

    // Start processing if not already running
    if (!queue.isRunning()) {
      // Start processing in background (don't await)
      queue.start().catch(error => {
        console.error('[Sync Scheduler] Queue processing error:', error);
      });
    }

    // Get queue stats
    const stats = queue.getStats();

    console.log('[Sync Scheduler] Queue stats:', stats);

    return NextResponse.json({
      success: true,
      message: `Scheduled ${jobs.length} sync jobs`,
      jobs_scheduled: jobs.length,
      queue_stats: stats
    });
  } catch (error) {
    console.error('[Sync Scheduler] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to schedule sync jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Manual trigger endpoint (POST)
 * Allows manual triggering of sync scheduler
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

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const { force = false } = body;

    console.log('[Sync Scheduler] Manual trigger initiated', { force });

    // Get sync jobs
    const jobs = await multiPlatformSyncEngine.scheduleSyncJobs();

    if (jobs.length === 0 && !force) {
      return NextResponse.json({
        success: true,
        message: 'No sync jobs due',
        jobs_scheduled: 0
      });
    }

    // Add jobs to queue
    const queue = getSyncQueue();
    queue.addJobs(jobs);

    // Start processing
    if (!queue.isRunning()) {
      queue.start().catch(error => {
        console.error('[Sync Scheduler] Queue processing error:', error);
      });
    }

    const stats = queue.getStats();

    return NextResponse.json({
      success: true,
      message: `Manually scheduled ${jobs.length} sync jobs`,
      jobs_scheduled: jobs.length,
      queue_stats: stats
    });
  } catch (error) {
    console.error('[Sync Scheduler] Manual trigger error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to trigger sync scheduler',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
