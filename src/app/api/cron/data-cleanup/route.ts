/**
 * Data Cleanup Cron Job
 * Removes expired historical data based on plan retention limits
 * Requirement: 2.3 - Automatic data cleanup based on retention period
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { PlanConfigurationService } from '@/lib/services/plan-configuration-service';

/**
 * Cron job to clean up expired historical data
 * Should be called daily
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

    console.log('[Data Cleanup] Starting data cleanup job...');

    const supabase = await createClient();
    const repository = new HistoricalDataRepository();
    const planService = new PlanConfigurationService();

    // Get all unique clients with historical data
    const { data: clients, error: clientsError } = await supabase
      .from('campaign_insights_history')
      .select('client_id')
      .order('client_id');

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      console.log('[Data Cleanup] No clients with historical data found');
      return NextResponse.json({
        success: true,
        message: 'No data to clean up',
        clients_processed: 0,
        records_deleted: 0
      });
    }

    // Get unique client IDs
    const uniqueClientIds = Array.from(
      new Set(clients.map(c => c.client_id))
    );

    console.log(
      `[Data Cleanup] Processing ${uniqueClientIds.length} clients...`
    );

    let totalRecordsDeleted = 0;
    let clientsProcessed = 0;
    const errors: string[] = [];

    // Process each client
    for (const clientId of uniqueClientIds) {
      try {
        // Get client's user ID
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('user_id')
          .eq('id', clientId)
          .single();

        if (clientError || !client) {
          console.warn(
            `[Data Cleanup] Client ${clientId} not found, skipping...`
          );
          continue;
        }

        // Get user's plan limits
        const planLimits = await planService.getUserPlanLimits(client.user_id);

        if (!planLimits) {
          console.warn(
            `[Data Cleanup] No plan limits for client ${clientId}, using default 90 days`
          );
          // Use default retention of 90 days
          const deleted = await repository.deleteExpiredData(clientId, 90);
          totalRecordsDeleted += deleted;
          clientsProcessed++;
          continue;
        }

        // Delete expired data based on plan retention
        const deleted = await repository.deleteExpiredData(
          clientId,
          planLimits.data_retention_days
        );

        if (deleted > 0) {
          console.log(
            `[Data Cleanup] Deleted ${deleted} expired records for client ${clientId} ` +
              `(retention: ${planLimits.data_retention_days} days)`
          );
        }

        totalRecordsDeleted += deleted;
        clientsProcessed++;
      } catch (error) {
        const errorMsg = `Client ${clientId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        console.error(`[Data Cleanup] Error processing client:`, errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(
      `[Data Cleanup] Completed. Processed ${clientsProcessed} clients, ` +
        `deleted ${totalRecordsDeleted} records`
    );

    return NextResponse.json({
      success: true,
      message: 'Data cleanup completed',
      clients_processed: clientsProcessed,
      records_deleted: totalRecordsDeleted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Data Cleanup] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to clean up data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Manual cleanup trigger (POST)
 * Allows manual triggering with specific client ID
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
    const { client_id, retention_days } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: 'client_id is required' },
        { status: 400 }
      );
    }

    console.log(
      `[Data Cleanup] Manual cleanup for client ${client_id}...`
    );

    const supabase = await createClient();
    const repository = new HistoricalDataRepository();
    const planService = new PlanConfigurationService();

    // Get client's user ID
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Determine retention days
    let retentionDays = retention_days;

    if (!retentionDays) {
      // Get from plan limits
      const planLimits = await planService.getUserPlanLimits(client.user_id);
      retentionDays = planLimits?.data_retention_days || 90;
    }

    // Delete expired data
    const deleted = await repository.deleteExpiredData(
      client_id,
      retentionDays
    );

    console.log(
      `[Data Cleanup] Deleted ${deleted} records for client ${client_id}`
    );

    return NextResponse.json({
      success: true,
      message: 'Manual cleanup completed',
      client_id,
      retention_days: retentionDays,
      records_deleted: deleted
    });
  } catch (error) {
    console.error('[Data Cleanup] Manual cleanup error:', error);

    return NextResponse.json(
      {
        error: 'Failed to clean up data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
