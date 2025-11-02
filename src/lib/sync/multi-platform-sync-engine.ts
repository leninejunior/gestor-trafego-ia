/**
 * Multi-Platform Sync Engine
 * Orchestrates synchronization across multiple ad platforms (Meta, Google)
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import {
  AdPlatform,
  SyncConfig,
  SyncResult,
  DateRange,
  CampaignInsight
} from '@/lib/types/sync';
import { BaseSyncAdapter } from './base-sync-adapter';
import { GoogleAdsSyncAdapter } from './google-ads-sync-adapter';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { PlanConfigurationService } from '@/lib/services/plan-configuration-service';
import { createClient } from '@/lib/supabase/server';

/**
 * Sync job configuration
 */
export interface SyncJob {
  id: string;
  client_id: string;
  platform: AdPlatform;
  config_id: string;
  priority: number;
  scheduled_at: Date;
  retry_count: number;
}

/**
 * Adapter factory function type
 */
type AdapterFactory = (config: SyncConfig) => BaseSyncAdapter;

/**
 * Multi-Platform Sync Engine
 * Manages sync adapters and orchestrates data synchronization
 */
export class MultiPlatformSyncEngine {
  private adapters: Map<AdPlatform, AdapterFactory>;
  private repository: HistoricalDataRepository;
  private planService: PlanConfigurationService;

  constructor() {
    this.adapters = new Map();
    this.repository = new HistoricalDataRepository();
    this.planService = new PlanConfigurationService();
    
    // Register available adapters with factory functions
    this.registerAdapter(AdPlatform.GOOGLE, (config: SyncConfig) => {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (!developerToken) {
        throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
      }
      return new GoogleAdsSyncAdapter(config, developerToken);
    });
    // Meta adapter will be registered when implemented
  }

  /**
   * Register a sync adapter for a platform
   * @param platform Platform identifier
   * @param factory Factory function to create adapter instance
   */
  registerAdapter(
    platform: AdPlatform,
    factory: AdapterFactory
  ): void {
    this.adapters.set(platform, factory);
  }

  /**
   * Get adapter factory for a specific platform
   * @param platform Platform identifier
   * @returns Adapter factory or undefined
   */
  getAdapter(platform: AdPlatform): AdapterFactory | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Sync a client's data from their connected platform
   * Requirement 4.1: Sync client data from platform
   * Requirement 4.2: Handle authentication and token refresh
   * @param clientId Client ID
   * @param platform Platform to sync from
   * @returns Sync result
   */
  async syncClient(
    clientId: string,
    platform: AdPlatform
  ): Promise<SyncResult> {
    const startTime = new Date();
    let recordsSynced = 0;
    let recordsFailed = 0;
    let error: string | undefined;

    try {
      // Get sync configuration for this client and platform
      const config = await this.getSyncConfig(clientId, platform);
      
      if (!config) {
        throw new Error(
          `No sync configuration found for client ${clientId} on ${platform}`
        );
      }

      // Check if sync is due
      if (config.next_sync_at && new Date() < config.next_sync_at) {
        throw new Error(
          `Sync not due yet. Next sync at: ${config.next_sync_at.toISOString()}`
        );
      }

      // Get adapter factory for platform
      const adapterFactory = this.getAdapter(platform);
      if (!adapterFactory) {
        throw new Error(`No adapter registered for platform: ${platform}`);
      }

      // Create adapter instance
      const adapter = adapterFactory(config);

      // Authenticate
      await adapter.authenticate({
        access_token: config.access_token,
        refresh_token: config.refresh_token
      });

      // Fetch campaigns
      const campaigns = await adapter.fetchCampaigns(config.account_id);

      // Get user's plan limits to determine sync date range
      const supabase = await createClient();
      const { data: client } = await supabase
        .from('clients')
        .select('user_id')
        .eq('id', clientId)
        .single();

      if (!client) {
        throw new Error(`Client ${clientId} not found`);
      }

      const planLimits = await this.planService.getUserPlanLimits(
        client.user_id
      );

      // Determine date range based on plan limits
      const dateRange = this.calculateSyncDateRange(
        config.last_sync_at,
        planLimits?.data_retention_days || 90
      );

      // Fetch and store insights for each campaign
      const allInsights: CampaignInsight[] = [];

      for (const campaign of campaigns) {
        try {
          const insights = await adapter.fetchInsights(
            campaign.id,
            dateRange
          );
          allInsights.push(...insights);
        } catch (err) {
          console.error(
            `Failed to fetch insights for campaign ${campaign.id}:`,
            err
          );
          recordsFailed++;
        }
      }

      // Store insights in batch
      if (allInsights.length > 0) {
        recordsSynced = await this.repository.storeInsights(allInsights);
      }

      // Update sync configuration
      await this.updateSyncConfig(config.id, {
        last_sync_at: new Date(),
        next_sync_at: await this.getNextSyncTime(clientId, platform),
        sync_status: 'active',
        last_error: undefined
      });

      // Log sync completion
      await this.logSyncCompletion(config.id, {
        status: 'success',
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        started_at: startTime,
        completed_at: new Date()
      });

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      
      // Update sync config with error
      const config = await this.getSyncConfig(clientId, platform);
      if (config) {
        await this.updateSyncConfig(config.id, {
          sync_status: 'error',
          last_error: error
        });

        // Log sync failure
        await this.logSyncCompletion(config.id, {
          status: 'failed',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          started_at: startTime,
          completed_at: new Date(),
          error_message: error
        });
      }
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    return {
      success: !error,
      platform,
      client_id: clientId,
      records_synced: recordsSynced,
      records_failed: recordsFailed,
      started_at: startTime,
      completed_at: endTime,
      duration_ms: durationMs,
      error
    };
  }

  /**
   * Schedule sync jobs for all active configurations
   * Requirement 4.3: Schedule automatic syncs based on plan limits
   * @returns Array of scheduled sync jobs
   */
  async scheduleSyncJobs(): Promise<SyncJob[]> {
    const supabase = await createClient();

    // Get all active sync configurations that are due
    const { data: configs, error } = await supabase
      .from('sync_configurations')
      .select('*')
      .eq('sync_status', 'active')
      .or(`next_sync_at.is.null,next_sync_at.lte.${new Date().toISOString()}`);

    if (error) {
      throw new Error(`Failed to fetch sync configurations: ${error.message}`);
    }

    if (!configs || configs.length === 0) {
      return [];
    }

    // Create sync jobs
    const jobs: SyncJob[] = configs.map((config, index) => ({
      id: `${config.id}_${Date.now()}`,
      client_id: config.client_id,
      platform: config.platform as AdPlatform,
      config_id: config.id,
      priority: this.calculateJobPriority(config),
      scheduled_at: new Date(),
      retry_count: 0
    }));

    // Sort by priority (higher priority first)
    jobs.sort((a, b) => b.priority - a.priority);

    return jobs;
  }

  /**
   * Get next sync time for a client based on plan limits
   * Requirement 4.4: Calculate next sync based on plan sync interval
   * @param clientId Client ID
   * @param platform Platform
   * @returns Next sync timestamp
   */
  async getNextSyncTime(
    clientId: string,
    platform: AdPlatform
  ): Promise<Date> {
    const supabase = await createClient();

    // Get client's user ID
    const { data: client } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .single();

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Get user's plan limits
    const planLimits = await this.planService.getUserPlanLimits(
      client.user_id
    );

    // Default to 24 hours if no plan limits
    const syncIntervalHours = planLimits?.sync_interval_hours || 24;

    // Calculate next sync time
    const nextSync = new Date();
    nextSync.setHours(nextSync.getHours() + syncIntervalHours);

    return nextSync;
  }

  /**
   * Get sync configuration for a client and platform
   * @param clientId Client ID
   * @param platform Platform
   * @returns Sync configuration or null
   */
  private async getSyncConfig(
    clientId: string,
    platform: AdPlatform
  ): Promise<SyncConfig | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sync_configurations')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get sync config: ${error.message}`);
    }

    return {
      id: data.id,
      platform: data.platform as AdPlatform,
      client_id: data.client_id,
      account_id: data.account_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: data.token_expires_at
        ? new Date(data.token_expires_at)
        : undefined,
      last_sync_at: data.last_sync_at ? new Date(data.last_sync_at) : undefined,
      next_sync_at: data.next_sync_at ? new Date(data.next_sync_at) : undefined,
      sync_status: data.sync_status,
      last_error: data.last_error,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at)
    };
  }

  /**
   * Update sync configuration
   * @param configId Configuration ID
   * @param updates Updates to apply
   */
  private async updateSyncConfig(
    configId: string,
    updates: Partial<SyncConfig>
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('sync_configurations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId);

    if (error) {
      throw new Error(`Failed to update sync config: ${error.message}`);
    }
  }

  /**
   * Log sync completion
   * @param configId Configuration ID
   * @param logData Log data
   */
  private async logSyncCompletion(
    configId: string,
    logData: {
      status: string;
      records_synced: number;
      records_failed: number;
      started_at: Date;
      completed_at: Date;
      error_message?: string;
    }
  ): Promise<void> {
    const supabase = await createClient();

    const durationMs =
      logData.completed_at.getTime() - logData.started_at.getTime();

    const { error } = await supabase.from('sync_logs').insert({
      sync_config_id: configId,
      started_at: logData.started_at.toISOString(),
      completed_at: logData.completed_at.toISOString(),
      status: logData.status,
      records_synced: logData.records_synced,
      records_failed: logData.records_failed,
      error_message: logData.error_message,
      duration_ms: durationMs
    });

    if (error) {
      console.error('Failed to log sync completion:', error);
    }
  }

  /**
   * Calculate sync date range based on last sync and retention period
   * @param lastSyncAt Last sync timestamp
   * @param retentionDays Data retention period in days
   * @returns Date range for sync
   */
  private calculateSyncDateRange(
    lastSyncAt: Date | undefined,
    retentionDays: number
  ): DateRange {
    const end = new Date();
    let start: Date;

    if (lastSyncAt) {
      // Sync from last sync date
      start = new Date(lastSyncAt);
    } else {
      // First sync - get data for retention period
      start = new Date();
      start.setDate(start.getDate() - retentionDays);
    }

    return { start, end };
  }

  /**
   * Calculate job priority based on configuration
   * Higher priority = more urgent
   * @param config Sync configuration
   * @returns Priority score
   */
  private calculateJobPriority(config: any): number {
    let priority = 0;

    // Higher priority if never synced
    if (!config.last_sync_at) {
      priority += 100;
    }

    // Higher priority if overdue
    if (config.next_sync_at) {
      const overdueDays = Math.floor(
        (Date.now() - new Date(config.next_sync_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      priority += overdueDays * 10;
    }

    // Higher priority if had errors
    if (config.last_error) {
      priority += 50;
    }

    return priority;
  }
}

// Export singleton instance
export const multiPlatformSyncEngine = new MultiPlatformSyncEngine();
