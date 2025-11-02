/**
 * Cleanup Service
 * Manages automatic data cleanup based on plan retention policies
 * 
 * Requirements: 2.3, 10.1, 10.2
 */

import { createClient } from '@/lib/supabase/server';
import { PlanConfigurationService } from './plan-configuration-service';
import { AlertService } from '@/lib/monitoring/alert-service';
import { ObservabilityService } from '@/lib/monitoring/observability-service';

interface CleanupResult {
  client_id: string;
  records_deleted: number;
  retention_days: number;
  cutoff_date: Date;
}

interface PartitionInfo {
  partition_name: string;
  start_date: Date;
  end_date: Date;
  created: boolean;
}

interface ArchiveResult {
  partition_name: string;
  archived: boolean;
  error?: string;
}

/**
 * Service for managing data cleanup and partition management
 */
export class CleanupService {
  private planConfigService: PlanConfigurationService;
  private alertService: AlertService;
  private observabilityService: ObservabilityService;

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly BACKOFF_MULTIPLIER = 2;

  constructor() {
    this.planConfigService = new PlanConfigurationService();
    this.alertService = new AlertService();
    this.observabilityService = new ObservabilityService();
  }

  /**
   * Delete expired data for a specific client based on their plan's retention policy
   * Requirement 2.3: System removes data beyond retention limit automatically
   * Requirement 10.1: Aggregate metrics by day
   * 
   * @param clientId Client ID
   * @returns Cleanup result with number of records deleted
   */
  async deleteExpiredData(clientId: string): Promise<CleanupResult> {
    const supabase = await createClient();

    // Get client's user to determine plan limits
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('user_id, organization_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error(`Failed to find client: ${clientError?.message || 'Client not found'}`);
    }

    // Get user's plan limits
    const planLimits = await this.planConfigService.getUserPlanLimits(client.user_id);

    if (!planLimits) {
      throw new Error('No plan limits found for user');
    }

    const retentionDays = planLimits.data_retention_days;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Delete expired records
    const { data, error } = await supabase
      .from('campaign_insights_history')
      .delete()
      .eq('client_id', clientId)
      .lt('date', cutoffDateStr)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete expired data: ${error.message}`);
    }

    const recordsDeleted = data?.length || 0;

    return {
      client_id: clientId,
      records_deleted: recordsDeleted,
      retention_days: retentionDays,
      cutoff_date: cutoffDate
    };
  }

  /**
   * Delete expired data for all clients
   * Processes each client according to their plan's retention policy
   * 
   * @returns Array of cleanup results for each client
   */
  async deleteExpiredDataForAllClients(): Promise<CleanupResult[]> {
    const supabase = await createClient();

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id');

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      return [];
    }

    const results: CleanupResult[] = [];

    // Process each client
    for (const client of clients) {
      try {
        const result = await this.deleteExpiredData(client.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to cleanup data for client ${client.id}:`, error);
        // Continue with other clients even if one fails
      }
    }

    return results;
  }

  /**
   * Create monthly partitions for campaign_insights_history table
   * Requirement 10.2: Use monthly partitioning to optimize queries
   * 
   * Creates partitions for the next N months to ensure data can be inserted
   * 
   * @param monthsAhead Number of months ahead to create partitions (default: 3)
   * @returns Array of created partition information
   */
  async createMonthlyPartitions(monthsAhead: number = 3): Promise<PartitionInfo[]> {
    const supabase = await createClient();
    const partitions: PartitionInfo[] = [];

    const currentDate = new Date();

    for (let i = 0; i <= monthsAhead; i++) {
      const partitionDate = new Date(currentDate);
      partitionDate.setMonth(partitionDate.getMonth() + i);
      
      const year = partitionDate.getFullYear();
      const month = String(partitionDate.getMonth() + 1).padStart(2, '0');
      
      // Calculate partition boundaries
      const startDate = new Date(year, partitionDate.getMonth(), 1);
      const endDate = new Date(year, partitionDate.getMonth() + 1, 1);
      
      const partitionName = `campaign_insights_history_${year}_${month}`;
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Check if partition already exists with fallback
      const existingPartition = await this.checkPartitionExistsWithFallback(
        'campaign_insights_history',
        partitionName
      );

      if (existingPartition) {
        partitions.push({
          partition_name: partitionName,
          start_date: startDate,
          end_date: endDate,
          created: false
        });
        continue;
      }

      // Create partition using SQL with retry
      const createPartitionSQL = `
        CREATE TABLE IF NOT EXISTS ${partitionName} 
        PARTITION OF campaign_insights_history
        FOR VALUES FROM ('${startDateStr}') TO ('${endDateStr}');
      `;

      const created = await this.executeWithRetry(async () => {
        const { error } = await supabase.rpc('execute_sql', {
          sql_query: createPartitionSQL
        });

        if (error) {
          throw new Error(`RPC error: ${error.message}`);
        }

        return true;
      }, `create partition ${partitionName}`);

      partitions.push({
        partition_name: partitionName,
        start_date: startDate,
        end_date: endDate,
        created
      });
    }

    return partitions;
  }

  /**
   * Archive old partitions by detaching them from the parent table
   * This keeps the data but makes it inaccessible through normal queries
   * Requirement 10.2: Optimize storage and query performance
   * 
   * @param monthsToKeep Number of months of data to keep active (default: 12)
   * @returns Array of archive results
   */
  async archiveOldPartitions(monthsToKeep: number = 12): Promise<ArchiveResult[]> {
    const supabase = await createClient();
    const results: ArchiveResult[] = [];

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
    
    const cutoffYear = cutoffDate.getFullYear();
    const cutoffMonth = cutoffDate.getMonth() + 1;

    // Get list of all partitions with fallback
    const partitions = await this.listPartitionsWithFallback('campaign_insights_history');

    if (!partitions || partitions.length === 0) {
      return results;
    }

    // Process each partition
    for (const partition of partitions) {
      const partitionName = partition.partition_name;
      
      // Extract year and month from partition name
      // Format: campaign_insights_history_YYYY_MM
      const match = partitionName.match(/campaign_insights_history_(\d{4})_(\d{2})/);
      
      if (!match) {
        continue;
      }

      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);

      // Check if partition is older than cutoff
      if (year < cutoffYear || (year === cutoffYear && month < cutoffMonth)) {
        const detachSQL = `
          ALTER TABLE campaign_insights_history 
          DETACH PARTITION ${partitionName};
        `;

        const archived = await this.executeWithRetry(async () => {
          const { error } = await supabase.rpc('execute_sql', {
            sql_query: detachSQL
          });

          if (error) {
            throw new Error(`RPC error: ${error.message}`);
          }

          return true;
        }, `detach partition ${partitionName}`);

        results.push({
          partition_name: partitionName,
          archived,
          error: archived ? undefined : 'Failed after retries'
        });
      }
    }

    return results;
  }

  /**
   * Get cleanup statistics for monitoring
   * 
   * @returns Statistics about data cleanup and partitions
   */
  async getCleanupStats(): Promise<{
    total_clients: number;
    clients_with_expired_data: number;
    total_partitions: number;
    oldest_partition_date?: Date;
    newest_partition_date?: Date;
  }> {
    const supabase = await createClient();

    // Count total clients
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    // Get partition information with fallback
    const partitions = await this.listPartitionsWithFallback('campaign_insights_history');

    const partitionDates = (partitions || [])
      .map((p: any) => {
        const match = p.partition_name.match(/campaign_insights_history_(\d{4})_(\d{2})/);
        if (match) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1);
        }
        return null;
      })
      .filter((d: Date | null): d is Date => d !== null);

    return {
      total_clients: totalClients || 0,
      clients_with_expired_data: 0, // Would need complex query to determine
      total_partitions: partitions?.length || 0,
      oldest_partition_date: partitionDates.length > 0 
        ? new Date(Math.min(...partitionDates.map((d: Date) => d.getTime())))
        : undefined,
      newest_partition_date: partitionDates.length > 0
        ? new Date(Math.max(...partitionDates.map((d: Date) => d.getTime())))
        : undefined
    };
  }

  /**
   * Execute RPC with retry and fallback logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await operation();
        
        // Log successful retry if it wasn't the first attempt
        if (attempt > 0) {
          await this.observabilityService.recordEvent({
            type: 'cleanup_retry_success',
            metadata: {
              operation: operationName,
              attempt: attempt + 1,
              total_attempts: retries + 1
            }
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Log the attempt
        await this.observabilityService.recordEvent({
          type: 'cleanup_retry_attempt',
          metadata: {
            operation: operationName,
            attempt: attempt + 1,
            error: lastError.message,
            will_retry: attempt < retries
          }
        });

        if (attempt < retries) {
          // Wait before retrying with exponential backoff
          const delay = this.RETRY_DELAY_MS * Math.pow(this.BACKOFF_MULTIPLIER, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed, alert and throw
    await this.alertService.createAlert({
      type: 'cleanup_operation_failed',
      severity: 'warning',
      title: 'Cleanup Operation Failed',
      message: `Operation "${operationName}" failed after ${retries + 1} attempts`,
      metadata: {
        operation: operationName,
        attempts: retries + 1,
        final_error: lastError?.message || 'Unknown error'
      }
    });

    throw lastError || new Error(`Operation ${operationName} failed after ${retries + 1} attempts`);
  }

  /**
   * Check if partition exists with fallback to direct SQL query
   */
  private async checkPartitionExistsWithFallback(
    tableName: string,
    partitionName: string
  ): Promise<boolean> {
    const supabase = await createClient();

    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('check_partition_exists', {
        table_name: tableName,
        partition_name: partitionName
      });

      if (!error && data !== null) {
        return data;
      }

      // RPC failed, try direct query as fallback
      console.warn('RPC check_partition_exists failed, using fallback query');
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', partitionName)
        .eq('table_schema', 'public')
        .single();

      return !fallbackError && !!fallbackData;

    } catch (error) {
      console.error('Both RPC and fallback failed for partition check:', error);
      
      // Alert about RPC unavailability
      await this.alertService.createAlert({
        type: 'rpc_unavailable',
        severity: 'warning',
        title: 'RPC Function Unavailable',
        message: 'check_partition_exists RPC is not available, using fallback',
        metadata: {
          rpc_name: 'check_partition_exists',
          table_name: tableName,
          partition_name: partitionName,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      return false; // Conservative fallback
    }
  }

  /**
   * List partitions with fallback to direct SQL query
   */
  private async listPartitionsWithFallback(parentTable: string): Promise<any[]> {
    const supabase = await createClient();

    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('list_partitions', {
        parent_table: parentTable
      });

      if (!error && data) {
        return data;
      }

      // RPC failed, try direct query as fallback
      console.warn('RPC list_partitions failed, using fallback query');
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .like('table_name', `${parentTable}_%`)
        .eq('table_schema', 'public');

      if (fallbackError) {
        throw new Error(`Fallback query failed: ${fallbackError.message}`);
      }

      // Transform to expected format
      return (fallbackData || []).map(row => ({
        partition_name: row.table_name
      }));

    } catch (error) {
      console.error('Both RPC and fallback failed for partition listing:', error);
      
      // Alert about RPC unavailability
      await this.alertService.createAlert({
        type: 'rpc_unavailable',
        severity: 'warning',
        title: 'RPC Function Unavailable',
        message: 'list_partitions RPC is not available, using fallback',
        metadata: {
          rpc_name: 'list_partitions',
          parent_table: parentTable,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      return []; // Conservative fallback
    }
  }

  /**
   * Execute SQL with security definer function fallback
   */
  private async executeSQLWithFallback(sql: string): Promise<boolean> {
    const supabase = await createClient();

    try {
      // Try RPC first
      const { error } = await supabase.rpc('execute_sql', {
        sql_query: sql
      });

      if (!error) {
        return true;
      }

      // RPC failed, try alternative approach
      console.warn('RPC execute_sql failed, checking for alternative');
      
      // Alert about RPC unavailability
      await this.alertService.createAlert({
        type: 'rpc_unavailable',
        severity: 'critical',
        title: 'SQL Execution RPC Unavailable',
        message: 'execute_sql RPC is not available, manual intervention required',
        metadata: {
          rpc_name: 'execute_sql',
          sql_preview: sql.substring(0, 100) + '...',
          error: error.message
        }
      });

      return false;

    } catch (error) {
      console.error('SQL execution failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cleanupService = new CleanupService();

