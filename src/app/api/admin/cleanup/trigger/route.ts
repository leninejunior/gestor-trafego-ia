/**
 * Manual Cleanup Trigger API
 * 
 * Allows admins to manually trigger cleanup operations
 * Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cleanupService } from '@/lib/services/cleanup-service';

/**
 * POST /api/admin/cleanup/trigger
 * 
 * Body:
 * - operation: 'delete_expired' | 'create_partitions' | 'archive_partitions' | 'all'
 * - client_id: (optional) Specific client ID for delete_expired operation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('is_super_admin, role')
      .eq('user_id', user.id)
      .single();

    if (!adminUser || (!adminUser.is_super_admin && adminUser.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { operation, client_id } = body;

    if (!operation) {
      return NextResponse.json(
        { error: 'Operation is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const results: any = {};

    // Execute requested operation(s)
    switch (operation) {
      case 'delete_expired':
        if (client_id) {
          // Delete for specific client
          const result = await cleanupService.deleteExpiredData(client_id);
          results.cleanup = [result];
        } else {
          // Delete for all clients
          const cleanupResults = await cleanupService.deleteExpiredDataForAllClients();
          results.cleanup = cleanupResults;
          results.total_deleted = cleanupResults.reduce((sum, r) => sum + r.records_deleted, 0);
        }
        break;

      case 'create_partitions':
        const partitions = await cleanupService.createMonthlyPartitions(3);
        results.partitions = partitions;
        results.new_partitions = partitions.filter(p => p.created).length;
        break;

      case 'archive_partitions':
        const archived = await cleanupService.archiveOldPartitions(12);
        results.archived = archived;
        results.archived_count = archived.filter(a => a.archived).length;
        break;

      case 'all':
        // Execute all operations
        const allPartitions = await cleanupService.createMonthlyPartitions(3);
        const allCleanup = await cleanupService.deleteExpiredDataForAllClients();
        const allArchived = await cleanupService.archiveOldPartitions(12);

        results.partitions = {
          total: allPartitions.length,
          new: allPartitions.filter(p => p.created).length,
          details: allPartitions
        };
        results.cleanup = {
          clients_processed: allCleanup.length,
          total_deleted: allCleanup.reduce((sum, r) => sum + r.records_deleted, 0),
          details: allCleanup
        };
        results.archived = {
          total: allArchived.length,
          archived: allArchived.filter(a => a.archived).length,
          details: allArchived
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid operation. Must be: delete_expired, create_partitions, archive_partitions, or all' },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;

    // Get updated statistics
    const stats = await cleanupService.getCleanupStats();

    return NextResponse.json({
      success: true,
      operation,
      results,
      statistics: stats,
      duration_ms: duration,
      triggered_by: user.id,
      triggered_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error triggering cleanup:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

