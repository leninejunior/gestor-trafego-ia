/**
 * Google Ads Sync Service
 * 
 * Handles synchronization of campaigns and metrics from Google Ads API
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1
 */

import { GoogleAdsClient, GoogleAdsCampaign, GoogleAdsMetrics, DateRange } from './client';
import { getGoogleTokenManager } from './token-manager';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';
import { GoogleAdsErrorHandler } from './error-handler';
import { googleAdsNotificationService } from './notification-service';
import { googleAdsLogger } from './logger';
import { googleAdsPerformanceMonitor } from './performance-monitor';
import { googleAdsCache } from './cache-service';
import { GoogleAdsBatchOperations, BatchProgress, globalBatchQueue } from './batch-operations';
import { validateCustomerIdWithLogging, formatCustomerId } from './customer-id-validator';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SyncOptions {
  clientId: string;
  customerId?: string;
  connectionId?: string;
  fullSync?: boolean;
  dateRange?: DateRange;
  syncMetrics?: boolean;
}

export interface SyncResult {
  success: boolean;
  campaignsSynced: number;
  metricsUpdated: number;
  errors: SyncError[];
  timestamp: Date;
  syncLogId?: string;
}

export interface SyncError {
  code: string;
  message: string;
  campaignId?: string;
  retryable: boolean;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync: Date | null;
  lastSyncStatus: 'success' | 'partial' | 'failed' | null;
  nextScheduledSync: Date | null;
  campaignsSynced: number;
  metricsUpdated: number;
  errors: string[];
}

export interface CampaignSyncResult {
  campaignId: string;
  success: boolean;
  error?: string;
}

export interface MetricsSyncResult {
  campaignId: string;
  metricsCount: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// Google Sync Service Class
// ============================================================================

export class GoogleSyncService {
  private tokenManager = getGoogleTokenManager();
  private repository = new GoogleAdsRepository();
  private errorHandler = new GoogleAdsErrorHandler();
  private batchOperations = new GoogleAdsBatchOperations();
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 60000; // 60 seconds
  
  // Batch configuration
  private readonly CAMPAIGN_BATCH_SIZE = 50;
  private readonly METRICS_BATCH_SIZE = 100;

  // ==========================================================================
  // Main Sync Methods
  // ==========================================================================

  /**
   * Sync campaigns for a client
   * Performs initial or incremental sync based on options
   */
  async syncCampaigns(options: SyncOptions): Promise<SyncResult> {
    const startTime = new Date();
    const errors: SyncError[] = [];
    let campaignsSynced = 0;
    let metricsUpdated = 0;
    let syncLogId: string | undefined;

    // Start performance monitoring
    const operationId = googleAdsPerformanceMonitor.startOperation(
      `sync_${Date.now()}`,
      'sync_campaigns',
      {
        clientId: options.clientId,
        customerId: options.customerId,
        fullSync: options.fullSync,
        syncMetrics: options.syncMetrics
      }
    );

    try {
      const syncRequestId = googleAdsLogger.syncStart(
        options.fullSync ? 'full' : (options.syncMetrics ? 'metrics' : 'campaigns'),
        {
          clientId: options.clientId,
          customerId: options.customerId,
          operation: 'sync_campaigns',
          requestId: operationId
        }
      );

      console.log('[Google Sync] Starting campaign sync:', options);

      // Get or validate connection
      const connection = await this.getValidatedConnection(options);
      
      // Validate customer ID format
      const customerIdValidation = validateCustomerIdWithLogging(
        connection.customer_id,
        {
          source: 'syncCampaigns',
          clientId: options.clientId,
          connectionId: connection.id,
        }
      );
      
      if (!customerIdValidation.isValid) {
        throw new Error(
          `Invalid customer ID format in connection: ${customerIdValidation.errors.join(', ')}. ` +
          `Customer ID: "${connection.customer_id}". ` +
          `Connection ID: ${connection.id}`
        );
      }
      
      // Use formatted customer ID
      const formattedCustomerId = customerIdValidation.formatted;
      
      console.log('[Google Sync] Using validated customer ID:', {
        original: connection.customer_id,
        formatted: formattedCustomerId,
        connectionId: connection.id,
        clientId: options.clientId,
        timestamp: new Date().toISOString(),
      });
      
      // Create sync log
      syncLogId = await this.repository.createSyncLog({
        connection_id: connection.id,
        sync_type: options.fullSync ? 'full' : 'incremental',
        status: 'success', // Will be updated
        campaigns_synced: 0,
        metrics_updated: 0,
        error_message: null,
        error_code: null,
        started_at: startTime,
        completed_at: null,
      });

      // Ensure valid access token
      const accessToken = await this.tokenManager.ensureValidToken(
        connection.id
      );

      // Create Google Ads client with validated customer ID
      const client = new GoogleAdsClient({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        developerToken: process.env.GOOGLE_DEVELOPER_TOKEN!,
        refreshToken: '', // Not needed, we have access token
        customerId: formattedCustomerId,
      });

      // Set access token directly
      (client as any).accessToken = accessToken;
      (client as any).tokenExpiresAt = new Date(Date.now() + 3600 * 1000);

      // Log sync parameters before fetching
      console.log('[Google Sync] Fetching campaigns with parameters:', {
        connectionId: connection.id,
        customerId: connection.customer_id,
        clientId: options.clientId,
        fullSync: options.fullSync,
        dateRange: options.dateRange,
        syncMetrics: options.syncMetrics,
        timestamp: new Date().toISOString(),
      });

      // Fetch campaigns from Google Ads
      console.log('[Google Sync] About to fetch campaigns from Google Ads API...', {
        connectionId: connection.id,
        customerId: connection.customer_id,
        clientId: options.clientId,
        timestamp: new Date().toISOString(),
      });
      
      const campaigns = await this.fetchCampaignsWithRetry(
        client,
        options.dateRange
      );

      // ========================================================================
      // BEFORE PROCESSING: Log campaign count from API
      // ========================================================================
      console.log(`[Google Sync] ✓ BEFORE PROCESSING - Fetched ${campaigns.length} campaigns from Google Ads API`, {
        campaignCount: campaigns.length,
        campaignIds: campaigns.map(c => c.id),
        campaignNames: campaigns.map(c => c.name),
        campaignStatuses: campaigns.map(c => c.status),
        customerId: connection.customer_id,
        connectionId: connection.id,
        clientId: options.clientId,
        timestamp: new Date().toISOString(),
      });
      
      // Log detailed campaign structure if we got campaigns
      if (campaigns.length > 0) {
        console.log('[Google Sync] First Campaign Structure:', {
          campaign: campaigns[0],
          campaignKeys: Object.keys(campaigns[0]),
          metricsKeys: campaigns[0].metrics ? Object.keys(campaigns[0].metrics) : [],
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn('[Google Sync] ⚠️ BEFORE PROCESSING - No campaigns returned from API', {
          connectionId: connection.id,
          customerId: connection.customer_id,
          clientId: options.clientId,
          dateRange: options.dateRange,
          fullSync: options.fullSync,
          timestamp: new Date().toISOString(),
        });
      }

      // Save campaigns to database
      if (campaigns.length > 0) {
        console.log(`[Google Sync] Processing ${campaigns.length} campaigns for database save...`, {
          connectionId: connection.id,
          clientId: options.clientId,
          campaignIds: campaigns.map(c => c.id),
          timestamp: new Date().toISOString(),
        });
        
        campaignsSynced = await this.repository.saveCampaigns(
          campaigns,
          connection.id,
          options.clientId
        );

        // ======================================================================
        // AFTER PROCESSING: Log campaign count saved to database
        // ======================================================================
        console.log(`[Google Sync] ✓ AFTER PROCESSING - Saved ${campaignsSynced} campaigns to database`, {
          beforeProcessing: campaigns.length,
          afterProcessing: campaignsSynced,
          difference: campaigns.length - campaignsSynced,
          successRate: `${((campaignsSynced / campaigns.length) * 100).toFixed(2)}%`,
          connectionId: connection.id,
          clientId: options.clientId,
          timestamp: new Date().toISOString(),
        });
        
        if (campaignsSynced !== campaigns.length) {
          console.warn('[Google Sync] ⚠️ Mismatch between fetched and saved campaigns', {
            fetched: campaigns.length,
            saved: campaignsSynced,
            missing: campaigns.length - campaignsSynced,
            missingPercentage: `${(((campaigns.length - campaignsSynced) / campaigns.length) * 100).toFixed(2)}%`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        console.log('[Google Sync] ✓ AFTER PROCESSING - No campaigns to save to database', {
          beforeProcessing: 0,
          afterProcessing: 0,
          connectionId: connection.id,
          clientId: options.clientId,
          timestamp: new Date().toISOString(),
        });
      }

      // Sync metrics if requested
      if (options.syncMetrics && campaigns.length > 0) {
        const metricsResult = await this.syncCampaignMetrics(
          client,
          campaigns,
          connection.id,
          options.dateRange
        );

        metricsUpdated = metricsResult.totalUpdated;
        errors.push(...metricsResult.errors);

        console.log(`[Google Sync] Updated ${metricsUpdated} metrics`);
      }

      // Update last sync timestamp
      await this.repository.updateLastSync(connection.id);

      // Update sync log with success
      await this.repository.updateSyncLog(syncLogId, {
        status: errors.length > 0 ? 'partial' : 'success',
        campaigns_synced: campaignsSynced,
        metrics_updated: metricsUpdated,
        error_message: errors.length > 0 
          ? `${errors.length} errors occurred during sync`
          : undefined,
        completed_at: new Date(),
      });

      // Log sync completion
      const duration = Date.now() - startTime.getTime();
      googleAdsLogger.syncComplete(
        syncRequestId,
        {
          success: true,
          campaignsSynced,
          metricsUpdated,
          errors: errors.length
        },
        duration,
        {
          connectionId: connection.id,
          clientId: options.clientId,
          customerId: connection.customer_id
        }
      );

      // Send notification about sync completion
      try {
        if (connection.userId && connection.organizationId) {
          await googleAdsNotificationService.notifySyncCompletion({
            connectionId: connection.id,
            clientId: options.clientId,
            userId: connection.userId,
            organizationId: connection.organizationId,
            syncType: options.fullSync ? 'full' : (options.syncMetrics ? 'metrics' : 'campaigns'),
            status: errors.length > 0 ? 'partial' : 'success',
            details: {
              campaignsSynced,
              metricsUpdated,
              duration,
              errorMessage: errors.length > 0 ? `${errors.length} errors occurred` : undefined
            }
          });
        }
      } catch (notificationError) {
        googleAdsLogger.error('Failed to send notification', notificationError as Error, {
          connectionId: connection.id,
          clientId: options.clientId,
          metadata: {
            errorName: notificationError instanceof Error ? notificationError.name : 'Unknown',
            errorStack: notificationError instanceof Error ? notificationError.stack : undefined,
            errorCode: (notificationError as any)?.code,
            syncStatus: errors.length > 0 ? 'partial' : 'success',
            campaignsSynced,
            metricsUpdated,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Update performance monitoring
      googleAdsPerformanceMonitor.updateOperation(operationId, {
        recordsProcessed: campaignsSynced + metricsUpdated,
        errors: errors.length
      });

      // Finish performance monitoring
      await googleAdsPerformanceMonitor.finishOperation(operationId, {
        connectionId: connection.id,
        clientId: options.clientId,
        userId: connection.userId
      });

      // Invalidate cache after successful sync
      await googleAdsCache.invalidateAfterSync(options.clientId);

      return {
        success: true,
        campaignsSynced,
        metricsUpdated,
        errors,
        timestamp: new Date(),
        syncLogId,
      };

    } catch (error) {
      googleAdsLogger.error('Sync failed', error as Error, {
        clientId: options.clientId,
        customerId: options.customerId,
        operation: 'sync_campaigns',
        duration: Date.now() - startTime.getTime(),
        metadata: {
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : undefined,
          errorCode: (error as any)?.code,
          errorStatus: (error as any)?.status,
          syncOptions: {
            fullSync: options.fullSync,
            syncMetrics: options.syncMetrics,
            dateRange: options.dateRange,
            connectionId: options.connectionId,
          },
          campaignsSyncedBeforeError: campaignsSynced,
          metricsUpdatedBeforeError: metricsUpdated,
          timestamp: new Date().toISOString(),
        },
      });

      const syncError: SyncError = {
        code: 'SYNC_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };

      errors.push(syncError);

      // Update sync log with failure
      if (syncLogId) {
        await this.repository.updateSyncLog(syncLogId, {
          status: 'failed',
          campaigns_synced: campaignsSynced,
          metrics_updated: metricsUpdated,
          error_message: syncError.message,
          error_code: syncError.code,
          completed_at: new Date(),
        });
      }

      // Send error notification (skip if user/org info not available)
      try {
        const connection = await this.getValidatedConnection(options);
        if (connection.userId && connection.organizationId) {
          await googleAdsNotificationService.notifySyncCompletion({
            connectionId: connection.id,
            clientId: options.clientId,
            userId: connection.userId,
            organizationId: connection.organizationId,
            syncType: options.fullSync ? 'full' : (options.syncMetrics ? 'metrics' : 'campaigns'),
            status: 'error',
            details: {
              campaignsSynced,
              metricsUpdated,
              errorMessage: syncError.message,
              duration: Date.now() - startTime.getTime()
            }
          });
        }
      } catch (notificationError) {
        console.error('[Google Sync] Failed to send error notification:', {
          error: notificationError instanceof Error ? notificationError.message : String(notificationError),
          errorName: notificationError instanceof Error ? notificationError.name : 'Unknown',
          errorStack: notificationError instanceof Error ? notificationError.stack : undefined,
          clientId: options.clientId,
          syncError: syncError.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Update performance monitoring with error
      googleAdsPerformanceMonitor.updateOperation(operationId, {
        recordsProcessed: campaignsSynced + metricsUpdated,
        errors: errors.length
      });

      // Finish performance monitoring
      try {
        const connection = await this.getValidatedConnection(options);
        await googleAdsPerformanceMonitor.finishOperation(operationId, {
          connectionId: connection.id,
          clientId: options.clientId,
          userId: connection.userId
        });
      } catch (perfError) {
        console.error('[Google Sync] Failed to finish performance monitoring:', {
          error: perfError instanceof Error ? perfError.message : String(perfError),
          errorName: perfError instanceof Error ? perfError.name : 'Unknown',
          errorStack: perfError instanceof Error ? perfError.stack : undefined,
          operationId,
          clientId: options.clientId,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: false,
        campaignsSynced,
        metricsUpdated,
        errors,
        timestamp: new Date(),
        syncLogId,
      };
    }
  }

  /**
   * Sync metrics for specific campaigns
   */
  async syncMetrics(
    campaignIds: string[],
    dateRange: DateRange,
    connectionId: string
  ): Promise<SyncResult> {
    const startTime = new Date();
    const errors: SyncError[] = [];
    let metricsUpdated = 0;

    try {
      console.log('[Google Sync] Starting metrics sync:', {
        campaignIds: campaignIds.length,
        dateRange,
      });

      // Ensure valid access token
      const accessToken = await this.tokenManager.ensureValidToken(connectionId);

      // Get connection details
      const connection = await this.repository.getConnectionById(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Create Google Ads client
      const client = new GoogleAdsClient({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        developerToken: process.env.GOOGLE_DEVELOPER_TOKEN!,
        refreshToken: '',
        customerId: connection.customer_id,
      });

      // Set access token
      (client as any).accessToken = accessToken;
      (client as any).tokenExpiresAt = new Date(Date.now() + 3600 * 1000);

      // Sync metrics for each campaign
      for (const campaignId of campaignIds) {
        try {
          const campaign = await this.repository.getCampaignById(campaignId);
          if (!campaign) {
            console.warn(`[Google Sync] Campaign not found: ${campaignId}`);
            continue;
          }

          // Fetch metrics from Google Ads
          const metrics = await this.fetchMetricsWithRetry(
            client,
            campaign.campaign_id,
            dateRange
          );

          // Save metrics to database
          await this.repository.saveMetrics(
            campaignId,
            metrics,
            dateRange.endDate
          );

          metricsUpdated++;

        } catch (error) {
          console.error(`[Google Sync] Error syncing metrics for campaign ${campaignId}:`, {
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorStack: error instanceof Error ? error.stack : undefined,
            errorCode: (error as any)?.code,
            errorStatus: (error as any)?.status,
            campaignId,
            connectionId,
            dateRange,
            isRetryable: this.isRetryableError(error),
            timestamp: new Date().toISOString(),
          });
          
          errors.push({
            code: 'METRICS_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            campaignId,
            retryable: this.isRetryableError(error),
          });
        }
      }

      return {
        success: errors.length === 0,
        campaignsSynced: 0,
        metricsUpdated,
        errors,
        timestamp: new Date(),
      };

    } catch (error) {
      console.error('[Google Sync] Metrics sync failed:', {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any)?.code,
        errorStatus: (error as any)?.status,
        campaignIds: campaignIds.length,
        dateRange,
        connectionId,
        metricsUpdatedBeforeError: metricsUpdated,
        errorsCount: errors.length,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        campaignsSynced: 0,
        metricsUpdated,
        errors: [{
          code: 'METRICS_SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: this.isRetryableError(error),
        }],
        timestamp: new Date(),
      };
    }
  }

  // ==========================================================================
  // Sync Status Methods
  // ==========================================================================

  /**
   * Get sync status for a client
   */
  async getLastSyncStatus(clientId: string): Promise<SyncStatus> {
    try {
      // Get connection
      const connection = await this.repository.getConnection(clientId);
      
      if (!connection) {
        return {
          isRunning: false,
          lastSync: null,
          lastSyncStatus: null,
          nextScheduledSync: null,
          campaignsSynced: 0,
          metricsUpdated: 0,
          errors: [],
        };
      }

      // Get last sync log
      const lastSync = await this.repository.getLastSuccessfulSync(
        connection.id
      );

      // Calculate next scheduled sync (6 hours from last sync)
      const nextScheduledSync = connection.last_sync_at
        ? new Date(connection.last_sync_at.getTime() + 6 * 60 * 60 * 1000)
        : null;

      return {
        isRunning: false, // TODO: Implement running status tracking
        lastSync: connection.last_sync_at,
        lastSyncStatus: lastSync?.status || null,
        nextScheduledSync,
        campaignsSynced: lastSync?.campaigns_synced || 0,
        metricsUpdated: lastSync?.metrics_updated || 0,
        errors: lastSync?.error_message ? [lastSync.error_message] : [],
      };

    } catch (error) {
      console.error('[Google Sync] Error getting sync status:', {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any)?.code,
        clientId,
        timestamp: new Date().toISOString(),
      });
      
      return {
        isRunning: false,
        lastSync: null,
        lastSyncStatus: null,
        nextScheduledSync: null,
        campaignsSynced: 0,
        metricsUpdated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Schedule a sync job for a client
   */
  async scheduleSyncJob(clientId: string): Promise<void> {
    // This will be implemented in the cron job
    // For now, just log the request
    console.log('[Google Sync] Sync job scheduled for client:', clientId);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Get or validate connection for sync
   */
  private async getConnection(options: SyncOptions): Promise<{
    connectionId: string;
    customerId: string;
  }> {
    if (options.connectionId) {
      const connection = await this.repository.getConnectionById(
        options.connectionId
      );
      
      if (!connection) {
        throw new Error('Connection not found');
      }

      return {
        connectionId: connection.id,
        customerId: connection.customer_id,
      };
    }

    // Find connection by client ID
    const connection = await this.repository.getConnection(options.clientId);
    
    if (!connection) {
      throw new Error('No active Google Ads connection found for client');
    }

    return {
      connectionId: connection.id,
      customerId: options.customerId || connection.customer_id,
    };
  }

  /**
   * Fetch campaigns with retry logic
   */
  private async fetchCampaignsWithRetry(
    client: GoogleAdsClient,
    dateRange?: DateRange
  ): Promise<GoogleAdsCampaign[]> {
    console.log('[Google Sync] Fetching campaigns with retry logic:', {
      dateRange,
      customerId: (client as any).config?.customerId,
      timestamp: new Date().toISOString(),
    });
    
    return this.retryWithExponentialBackoff(
      async () => {
        const campaigns = await client.getCampaigns(dateRange);
        console.log('[Google Sync] Campaign fetch successful:', {
          count: campaigns.length,
          dateRange,
          timestamp: new Date().toISOString(),
        });
        return campaigns;
      },
      'fetch_campaigns'
    );
  }

  /**
   * Fetch metrics with retry logic
   */
  private async fetchMetricsWithRetry(
    client: GoogleAdsClient,
    campaignId: string,
    dateRange: DateRange
  ): Promise<GoogleAdsMetrics> {
    return this.retryWithExponentialBackoff(
      async () => await client.getCampaignMetrics(campaignId, dateRange),
      'fetch_metrics'
    );
  }

  /**
   * Sync metrics for multiple campaigns
   */
  private async syncCampaignMetrics(
    client: GoogleAdsClient,
    campaigns: GoogleAdsCampaign[],
    connectionId: string,
    dateRange?: DateRange
  ): Promise<{
    totalUpdated: number;
    errors: SyncError[];
  }> {
    const errors: SyncError[] = [];
    let totalUpdated = 0;

    // Use default date range if not provided (last 30 days)
    const range = dateRange || this.getDefaultDateRange();

    // Process campaigns in batches
    for (let i = 0; i < campaigns.length; i += this.CAMPAIGN_BATCH_SIZE) {
      const batch = campaigns.slice(i, i + this.CAMPAIGN_BATCH_SIZE);

      for (const campaign of batch) {
        try {
          // Get campaign record from database
          const campaignRecord = await this.repository.getCampaignByGoogleId(
            connectionId,
            campaign.id
          );

          if (!campaignRecord) {
            console.warn(`[Google Sync] Campaign record not found: ${campaign.id}`);
            continue;
          }

          // Fetch metrics from Google Ads
          const metrics = await this.fetchMetricsWithRetry(
            client,
            campaign.id,
            range
          );

          // Save metrics to database
          await this.repository.saveMetrics(
            campaignRecord.id,
            metrics,
            range.endDate
          );

          totalUpdated++;

        } catch (error) {
          console.error(`[Google Sync] Error syncing metrics for campaign ${campaign.id}:`, {
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorStack: error instanceof Error ? error.stack : undefined,
            errorCode: (error as any)?.code,
            errorStatus: (error as any)?.status,
            campaignId: campaign.id,
            campaignName: campaign.name,
            connectionId,
            dateRange: range,
            isRetryable: this.isRetryableError(error),
            batchIndex: Math.floor(campaigns.indexOf(campaign) / this.CAMPAIGN_BATCH_SIZE),
            timestamp: new Date().toISOString(),
          });
          
          errors.push({
            code: 'METRICS_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            campaignId: campaign.id,
            retryable: this.isRetryableError(error),
          });
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + this.CAMPAIGN_BATCH_SIZE < campaigns.length) {
        await this.delay(500);
      }
    }

    return { totalUpdated, errors };
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    let delay = this.INITIAL_RETRY_DELAY;

    console.log(`[Google Sync] Starting ${operationName} with retry logic:`, {
      maxRetries: this.MAX_RETRIES,
      initialDelay: this.INITIAL_RETRY_DELAY,
      maxDelay: this.MAX_RETRY_DELAY,
      timestamp: new Date().toISOString(),
    });

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`[Google Sync] ${operationName} attempt ${attempt}/${this.MAX_RETRIES}`, {
          timestamp: new Date().toISOString(),
        });
        
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`[Google Sync] ${operationName} succeeded after ${attempt} attempts`, {
            timestamp: new Date().toISOString(),
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;

        // Log error details
        console.error(`[Google Sync] ${operationName} attempt ${attempt} failed:`, {
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as any)?.code,
          errorStatus: (error as any)?.status,
          isRetryable: this.isRetryableError(error),
          attempt,
          maxRetries: this.MAX_RETRIES,
          timestamp: new Date().toISOString(),
        });

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.error(`[Google Sync] ${operationName} error is not retryable, aborting`, {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.MAX_RETRIES) {
          console.error(`[Google Sync] ${operationName} failed after ${this.MAX_RETRIES} attempts`, {
            lastError: lastError instanceof Error ? lastError.message : String(lastError),
            timestamp: new Date().toISOString(),
          });
          break;
        }

        console.warn(
          `[Google Sync] ${operationName} failed (attempt ${attempt}/${this.MAX_RETRIES}), retrying in ${delay}ms...`,
          {
            error: error instanceof Error ? error.message : String(error),
            nextDelay: delay,
            timestamp: new Date().toISOString(),
          }
        );

        // Wait before retrying
        await this.delay(delay);

        // Exponential backoff with jitter
        delay = Math.min(
          delay * 2 + Math.random() * 1000,
          this.MAX_RETRY_DELAY
        );
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    // Rate limit errors
    if (
      errorCode.includes('rate_limit') ||
      errorCode.includes('quota_exceeded') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('quota exceeded')
    ) {
      return true;
    }

    // Temporary network errors
    if (
      errorCode.includes('econnreset') ||
      errorCode.includes('etimedout') ||
      errorCode.includes('enotfound') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout')
    ) {
      return true;
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }

  /**
   * Get default date range (last 30 days)
   */
  private getDefaultDateRange(): DateRange {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    return {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    };
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Batch Operations Methods
  // ==========================================================================

  /**
   * Sync campaigns using optimized batch operations
   */
  async syncCampaignsBatch(
    options: SyncOptions,
    onProgress?: (progress: BatchProgress) => void
  ): Promise<SyncResult> {
    const startTime = new Date();
    const errors: SyncError[] = [];

    try {
      // Get connection and validate
      const connection = await this.getValidatedConnection(options);
      const client = await this.createAuthenticatedClient(connection);

      googleAdsLogger.info('Starting batch sync', {
        clientId: options.clientId,
        customerId: connection.customer_id
      });

      // Use batch operations for campaigns
      const campaignsResult = await this.batchOperations.processCampaignsBatch(
        client,
        connection.customer_id,
        onProgress
      );

      // Process metrics if requested
      let metricsResult = null;
      if (options.syncMetrics !== false && campaignsResult.success) {
        const dateRange = options.dateRange || this.getDefaultDateRange();
        
        metricsResult = await this.batchOperations.processMetricsBatch(
          client,
          campaignsResult.results,
          {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          },
          onProgress
        );
      }

      // Log sync completion
      const syncLogId = await this.logSyncCompletion(
        connection.id,
        'full',
        'success',
        campaignsResult.processed,
        metricsResult?.processed || 0,
        startTime
      );

      // Update connection sync time
      await this.repository.updateLastSync(connection.id);

      // Invalidate cache after successful sync
      await googleAdsCache.invalidateAfterSync(options.clientId);

      const totalErrors = [
        ...campaignsResult.errors.map(e => ({
          code: 'CAMPAIGN_SYNC_ERROR',
          message: e.error,
          campaignId: e.item?.id,
          retryable: e.retryable
        })),
        ...(metricsResult?.errors.map(e => ({
          code: 'METRICS_SYNC_ERROR',
          message: e.error,
          campaignId: e.item?.id,
          retryable: e.retryable
        })) || [])
      ];

      return {
        success: campaignsResult.success && (metricsResult?.success !== false),
        campaignsSynced: campaignsResult.processed,
        metricsUpdated: metricsResult?.processed || 0,
        errors: totalErrors,
        timestamp: new Date(),
        syncLogId,
      };

    } catch (error) {
      googleAdsLogger.error('Batch sync failed', error as Error, {
        clientId: options.clientId,
        operation: 'sync_campaigns_batch',
        duration: Date.now() - startTime.getTime(),
        metadata: {
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : undefined,
          errorCode: (error as any)?.code,
          errorStatus: (error as any)?.status,
          syncOptions: {
            fullSync: options.fullSync,
            syncMetrics: options.syncMetrics,
            dateRange: options.dateRange,
            connectionId: options.connectionId,
            customerId: options.customerId,
          },
          timestamp: new Date().toISOString(),
        },
      });

      const syncError: SyncError = {
        code: 'BATCH_SYNC_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      };

      return {
        success: false,
        campaignsSynced: 0,
        metricsUpdated: 0,
        errors: [syncError],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Queue batch sync operation
   */
  async queueBatchSync(
    options: SyncOptions,
    onProgress?: (progress: BatchProgress) => void
  ): Promise<SyncResult> {
    return globalBatchQueue.addBatch(() => 
      this.syncCampaignsBatch(options, onProgress)
    );
  }

  /**
   * Get batch queue status
   */
  getBatchQueueStatus(): {
    queueLength: number;
    processing: number;
    maxConcurrent: number;
  } {
    return globalBatchQueue.getStatus();
  }

  /**
   * Configure batch operations
   */
  configureBatchOperations(config: Partial<{
    campaignBatchSize: number;
    metricsBatchSize: number;
    maxConcurrentRequests: number;
    retryAttempts: number;
    retryDelayMs: number;
  }>): void {
    this.batchOperations.updateConfig(config);
  }

  /**
   * Start a sync operation (used by API routes)
   * Returns immediately with sync ID for tracking
   */
  async startSync(options: {
    clientId: string;
    connectionId: string;
    customerId: string;
    fullSync?: boolean;
    syncType?: 'campaigns' | 'metrics' | 'full';
    dateRange?: DateRange;
  }): Promise<{
    syncId: string;
    status: 'started' | 'queued' | 'failed';
    estimatedTime?: number;
    error?: string;
  }> {
    try {
      // Create sync log entry
      const syncLogId = await this.repository.createSyncLog({
        connection_id: options.connectionId,
        sync_type: options.syncType === 'campaigns' ? 'incremental' : 'full',
        status: 'success', // Will be updated
        campaigns_synced: 0,
        metrics_updated: 0,
        error_message: null,
        error_code: null,
        started_at: new Date(),
        completed_at: null,
      });

      // Start sync in background (don't await)
      this.executeSyncInBackground(options, syncLogId).catch(error => {
        console.error('[GoogleSyncService] Background sync error:', error);
      });

      return {
        syncId: syncLogId,
        status: 'started',
        estimatedTime: this.estimateSyncTime(options.syncType || 'full'),
      };
    } catch (error) {
      console.error('[GoogleSyncService] Error starting sync:', {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any)?.code,
        clientId: options.clientId,
        connectionId: options.connectionId,
        customerId: options.customerId,
        syncType: options.syncType,
        fullSync: options.fullSync,
        timestamp: new Date().toISOString(),
      });
      return {
        syncId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute sync in background
   */
  private async executeSyncInBackground(
    options: {
      clientId: string;
      connectionId: string;
      customerId: string;
      fullSync?: boolean;
      syncType?: 'campaigns' | 'metrics' | 'full';
      dateRange?: DateRange;
    },
    syncLogId: string
  ): Promise<void> {
    try {
      const syncOptions: SyncOptions = {
        clientId: options.clientId,
        customerId: options.customerId,
        connectionId: options.connectionId,
        fullSync: options.fullSync,
        dateRange: options.dateRange,
        syncMetrics: options.syncType !== 'campaigns',
      };

      let result: SyncResult;

      switch (options.syncType) {
        case 'campaigns':
          result = await this.syncCampaigns(syncOptions);
          break;
        case 'metrics':
          // For metrics-only sync, we need campaign IDs
          // For now, just do a full sync
          result = await this.syncCampaigns(syncOptions);
          break;
        case 'full':
        default:
          result = await this.syncClient(options.clientId);
          break;
      }

      // Update sync log with results
      await this.repository.updateSyncLog(syncLogId, {
        status: result.success ? 'success' : 'failed',
        campaigns_synced: result.campaignsSynced,
        metrics_updated: result.metricsUpdated,
        error_message: result.errors.length > 0 ? result.errors[0].message : undefined,
        completed_at: new Date(),
      });

    } catch (error) {
      console.error('[GoogleSyncService] Background sync execution error:', {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any)?.code,
        errorStatus: (error as any)?.status,
        syncLogId,
        clientId: options.clientId,
        connectionId: options.connectionId,
        customerId: options.customerId,
        syncType: options.syncType,
        fullSync: options.fullSync,
        dateRange: options.dateRange,
        timestamp: new Date().toISOString(),
      });
      
      // Update sync log with error
      await this.repository.updateSyncLog(syncLogId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date(),
      });
    }
  }

  /**
   * Estimate sync time based on sync type
   */
  private estimateSyncTime(syncType: 'campaigns' | 'metrics' | 'full'): number {
    switch (syncType) {
      case 'campaigns':
        return 30; // 30 seconds
      case 'metrics':
        return 60; // 1 minute
      case 'full':
      default:
        return 120; // 2 minutes
    }
  }

  /**
   * Sync all data for a client (campaigns + metrics)
   */
  async syncClient(clientId: string): Promise<SyncResult> {
    const syncOptions: SyncOptions = {
      clientId,
      fullSync: true,
      syncMetrics: true,
    };

    return this.syncCampaigns(syncOptions);
  }

  /**
   * Get validated connection with additional metadata
   */
  private async getValidatedConnection(options: SyncOptions): Promise<{
    id: string;
    customer_id: string;
    userId?: string;
    organizationId?: string;
  }> {
    const connection = await this.getConnection(options);
    const fullConnection = await this.repository.getConnectionById(connection.connectionId);
    
    if (!fullConnection) {
      throw new Error('Connection not found');
    }

    return {
      id: fullConnection.id,
      customer_id: fullConnection.customer_id,
      userId: (fullConnection as any).user_id,
      organizationId: undefined, // Not available in connection table
    };
  }

  /**
   * Create authenticated Google Ads client
   */
  private async createAuthenticatedClient(connection: {
    id: string;
    customer_id: string;
  }): Promise<GoogleAdsClient> {
    const accessToken = await this.tokenManager.ensureValidToken(connection.id);

    const client = new GoogleAdsClient({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      developerToken: process.env.GOOGLE_DEVELOPER_TOKEN!,
      refreshToken: '',
      customerId: connection.customer_id,
    });

    (client as any).accessToken = accessToken;
    (client as any).tokenExpiresAt = new Date(Date.now() + 3600 * 1000);

    return client;
  }

  /**
   * Log sync completion to database
   */
  private async logSyncCompletion(
    connectionId: string,
    syncType: 'full' | 'incremental' | 'metrics',
    status: 'success' | 'partial' | 'failed',
    campaignsSynced: number,
    metricsUpdated: number,
    startTime: Date
  ): Promise<string> {
    return this.repository.createSyncLog({
      connection_id: connectionId,
      sync_type: syncType,
      status,
      campaigns_synced: campaignsSynced,
      metrics_updated: metricsUpdated,
      error_message: null,
      error_code: null,
      started_at: startTime,
      completed_at: new Date(),
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let syncServiceInstance: GoogleSyncService | null = null;

/**
 * Get singleton instance of GoogleSyncService
 */
export function getGoogleSyncService(): GoogleSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new GoogleSyncService();
  }
  return syncServiceInstance;
}
