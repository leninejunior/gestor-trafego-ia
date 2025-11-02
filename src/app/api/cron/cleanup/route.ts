/**
 * Data Cleanup Cron Job
 * 
 * Executes daily to:
 * - Delete expired data based on plan retention policies
 * - Create future monthly partitions
 * - Log cleanup operations
 * 
 * Requirements: 2.3
 * 
 * Schedule: Daily at 2 AM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupService } from '@/lib/services/cleanup-service';
import { createClient } from '@/lib/supabase/server';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

interface CleanupLog {
  job_type: string;
  status: 'success' | 'failed';
  records_affected: number;
  details: any;
  error_message?: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

/**
 * Log cleanup operation to database
 */
async function logCleanupOperation(log: CleanupLog): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase.from('cleanup_logs').insert({
      job_type: log.job_type,
      status: log.status,
      records_affected: log.records_affected,
      details: log.details,
      error_message: log.error_message,
      started_at: log.started_at,
      completed_at: log.completed_at,
      duration_ms: log.duration_ms
    });
  } catch (error) {
    console.error('Failed to log cleanup operation:', error);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Starting daily cleanup job...');

    // Step 1: Create future partitions
    console.log('Creating monthly partitions...');
    const partitionStartTime = Date.now();
    const partitions = await cleanupService.createMonthlyPartitions(3);
    const partitionDuration = Date.now() - partitionStartTime;

    const newPartitions = partitions.filter(p => p.created);
    console.log(`Created ${newPartitions.length} new partitions`);

    await logCleanupOperation({
      job_type: 'create_partitions',
      status: 'success',
      records_affected: newPartitions.length,
      details: {
        total_checked: partitions.length,
        created: newPartitions.map(p => p.partition_name),
        existing: partitions.filter(p => !p.created).map(p => p.partition_name)
      },
      started_at: new Date(partitionStartTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: partitionDuration
    });

    // Step 2: Delete expired data for all clients
    console.log('Deleting expired data...');
    const cleanupStartTime = Date.now();
    const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
    const cleanupDuration = Date.now() - cleanupStartTime;

    const totalDeleted = cleanupResults.reduce((sum, r) => sum + r.records_deleted, 0);
    console.log(`Deleted ${totalDeleted} expired records across ${cleanupResults.length} clients`);

    await logCleanupOperation({
      job_type: 'delete_expired_data',
      status: 'success',
      records_affected: totalDeleted,
      details: {
        clients_processed: cleanupResults.length,
        clients_with_deletions: cleanupResults.filter(r => r.records_deleted > 0).length,
        per_client: cleanupResults.map(r => ({
          client_id: r.client_id,
          records_deleted: r.records_deleted,
          retention_days: r.retention_days,
          cutoff_date: r.cutoff_date
        }))
      },
      started_at: new Date(cleanupStartTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: cleanupDuration
    });

    // Step 3: Get cleanup statistics
    const stats = await cleanupService.getCleanupStats();

    const totalDuration = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    console.log('Daily cleanup job completed successfully');

    return NextResponse.json({
      success: true,
      summary: {
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: totalDuration
      },
      partitions: {
        total_checked: partitions.length,
        new_created: newPartitions.length,
        partition_names: newPartitions.map(p => p.partition_name)
      },
      cleanup: {
        clients_processed: cleanupResults.length,
        total_records_deleted: totalDeleted,
        clients_with_deletions: cleanupResults.filter(r => r.records_deleted > 0).length
      },
      statistics: stats
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const completedAt = new Date().toISOString();
    const duration = Date.now() - startTime;

    console.error('Daily cleanup job failed:', error);

    // Log failure
    await logCleanupOperation({
      job_type: 'daily_cleanup',
      status: 'failed',
      records_affected: 0,
      details: {},
      error_message: errorMessage,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: duration
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: duration
      },
      { status: 500 }
    );
  }
}

// Prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

