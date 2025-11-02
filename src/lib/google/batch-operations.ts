/**
 * Google Ads Batch Operations Service
 * 
 * Optimizes sync operations by processing data in batches
 * Implements parallel processing and efficient bulk operations
 * Requirements: 3.1, 3.2
 */

import { GoogleAdsClient, GoogleAdsCampaign, GoogleAdsMetrics } from './client';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';
import { googleAdsLogger } from './logger';
import { googleAdsPerformanceMonitor } from './performance-monitor';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface BatchConfig {
  campaignBatchSize: number;
  metricsBatchSize: number;
  maxConcurrentRequests: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface BatchResult<T> {
  success: boolean;
  processed: number;
  failed: number;
  errors: BatchError[];
  results: T[];
  duration: number;
}

export interface BatchError {
  index: number;
  item: any;
  error: string;
  retryable: boolean;
}

export interface SyncBatch {
  campaigns: GoogleAdsCampaign[];
  metrics: Map<string, GoogleAdsMetrics[]>;
}

export interface BatchProgress {
  total: number;
  processed: number;
  failed: number;
  percentage: number;
  estimatedTimeRemaining: number;
}

// ============================================================================
// Batch Operations Service
// ============================================================================

export class GoogleAdsBatchOperations {
  private repository: GoogleAdsRepository;
  private config: BatchConfig;

  constructor(config: Partial<BatchConfig> = {}) {
    this.repository = new GoogleAdsRepository();
    this.config = {
      campaignBatchSize: 50,
      metricsBatchSize: 1000,
      maxConcurrentRequests: 5,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...config
    };
  }

  /**
   * Process campaigns in batches with parallel execution
   */
  async processCampaignsBatch(
    client: GoogleAdsClient,
    customerId: string,
    onProgress?: (progress: BatchProgress) => void
  ): Promise<BatchResult<GoogleAdsCampaign>> {
    const startTime = Date.now();
    const monitorId = googleAdsPerformanceMonitor.startOperation('batch_campaigns_sync');

    try {
      // Fetch all campaigns first
      const allCampaigns = await client.getCampaigns(customerId);
      
      if (allCampaigns.length === 0) {
        return {
          success: true,
          processed: 0,
          failed: 0,
          errors: [],
          results: [],
          duration: Date.now() - startTime
        };
      }

      // Split into batches
      const batches = this.createBatches(allCampaigns, this.config.campaignBatchSize);
      const results: GoogleAdsCampaign[] = [];
      const errors: BatchError[] = [];
      let processed = 0;

      googleAdsLogger.info('Starting batch campaign processing', {
        totalCampaigns: allCampaigns.length,
        batchCount: batches.length,
        batchSize: this.config.campaignBatchSize
      });

      // Process batches with controlled concurrency
      await this.processWithConcurrency(
        batches,
        async (batch, batchIndex) => {
          try {
            const batchResult = await this.processCampaignBatch(batch, batchIndex);
            results.push(...batchResult.results);
            errors.push(...batchResult.errors);
            processed += batchResult.processed;

            // Report progress
            if (onProgress) {
              const progress: BatchProgress = {
                total: allCampaigns.length,
                processed,
                failed: errors.length,
                percentage: (processed / allCampaigns.length) * 100,
                estimatedTimeRemaining: this.estimateTimeRemaining(
                  startTime,
                  processed,
                  allCampaigns.length
                )
              };
              onProgress(progress);
            }

            return batchResult;
          } catch (error) {
            googleAdsLogger.error('Batch processing failed', error as Error, {
              batchIndex,
              batchSize: batch.length
            });
            throw error;
          }
        },
        this.config.maxConcurrentRequests
      );

      const duration = Date.now() - startTime;
      
      googleAdsPerformanceMonitor.endOperation(monitorId, {
        campaignsProcessed: processed,
        batchCount: batches.length,
        errorCount: errors.length
      });

      return {
        success: errors.length === 0,
        processed,
        failed: errors.length,
        errors,
        results,
        duration
      };

    } catch (error) {
      googleAdsPerformanceMonitor.endOperation(monitorId, { error: error as Error });
      throw error;
    }
  }

  /**
   * Process metrics in batches with optimized bulk inserts
   */
  async processMetricsBatch(
    client: GoogleAdsClient,
    campaigns: GoogleAdsCampaign[],
    dateRange: { startDate: string; endDate: string },
    onProgress?: (progress: BatchProgress) => void
  ): Promise<BatchResult<GoogleAdsMetrics>> {
    const startTime = Date.now();
    const monitorId = googleAdsPerformanceMonitor.startOperation('batch_metrics_sync');

    try {
      const allMetrics: GoogleAdsMetrics[] = [];
      const errors: BatchError[] = [];
      let processed = 0;

      googleAdsLogger.info('Starting batch metrics processing', {
        campaignCount: campaigns.length,
        dateRange,
        batchSize: this.config.metricsBatchSize
      });

      // Process campaigns in parallel for metrics fetching
      await this.processWithConcurrency(
        campaigns,
        async (campaign, index) => {
          try {
            const metrics = await this.fetchCampaignMetricsWithRetry(
              client,
              campaign.id,
              dateRange
            );
            
            allMetrics.push(...metrics);
            processed++;

            // Report progress
            if (onProgress) {
              const progress: BatchProgress = {
                total: campaigns.length,
                processed,
                failed: errors.length,
                percentage: (processed / campaigns.length) * 100,
                estimatedTimeRemaining: this.estimateTimeRemaining(
                  startTime,
                  processed,
                  campaigns.length
                )
              };
              onProgress(progress);
            }

            return metrics;
          } catch (error) {
            const batchError: BatchError = {
              index,
              item: campaign,
              error: error instanceof Error ? error.message : 'Unknown error',
              retryable: this.isRetryableError(error)
            };
            errors.push(batchError);
            
            googleAdsLogger.warn('Failed to fetch metrics for campaign', {
              campaignId: campaign.id,
              error: batchError.error
            });
          }
        },
        this.config.maxConcurrentRequests
      );

      // Bulk insert metrics if any were fetched
      if (allMetrics.length > 0) {
        await this.bulkInsertMetrics(allMetrics);
      }

      const duration = Date.now() - startTime;
      
      googleAdsPerformanceMonitor.endOperation(monitorId, {
        metricsProcessed: allMetrics.length,
        campaignsProcessed: processed,
        errorCount: errors.length
      });

      return {
        success: errors.length === 0,
        processed: allMetrics.length,
        failed: errors.length,
        errors,
        results: allMetrics,
        duration
      };

    } catch (error) {
      googleAdsPerformanceMonitor.endOperation(monitorId, { error: error as Error });
      throw error;
    }
  }

  /**
   * Process full sync batch (campaigns + metrics)
   */
  async processFullSyncBatch(
    client: GoogleAdsClient,
    customerId: string,
    dateRange: { startDate: string; endDate: string },
    onProgress?: (progress: BatchProgress) => void
  ): Promise<{
    campaigns: BatchResult<GoogleAdsCampaign>;
    metrics: BatchResult<GoogleAdsMetrics>;
  }> {
    const startTime = Date.now();

    // Step 1: Process campaigns
    const campaignsResult = await this.processCampaignsBatch(
      client,
      customerId,
      (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            percentage: progress.percentage * 0.3, // Campaigns are 30% of total work
            estimatedTimeRemaining: progress.estimatedTimeRemaining * 3.33
          });
        }
      }
    );

    // Step 2: Process metrics for successful campaigns
    const successfulCampaigns = campaignsResult.results;
    const metricsResult = await this.processMetricsBatch(
      client,
      successfulCampaigns,
      dateRange,
      (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            percentage: 30 + (progress.percentage * 0.7), // Metrics are 70% of remaining work
            estimatedTimeRemaining: progress.estimatedTimeRemaining
          });
        }
      }
    );

    googleAdsLogger.info('Full sync batch completed', {
      duration: Date.now() - startTime,
      campaignsProcessed: campaignsResult.processed,
      metricsProcessed: metricsResult.processed,
      totalErrors: campaignsResult.errors.length + metricsResult.errors.length
    });

    return {
      campaigns: campaignsResult,
      metrics: metricsResult
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process items with controlled concurrency
   */
  private async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    maxConcurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const promise = processor(items[i], i).then(result => {
        results[i] = result;
      });

      executing.push(promise);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Process single campaign batch
   */
  private async processCampaignBatch(
    campaigns: GoogleAdsCampaign[],
    batchIndex: number
  ): Promise<BatchResult<GoogleAdsCampaign>> {
    const startTime = Date.now();
    const errors: BatchError[] = [];

    try {
      // Convert to repository format and bulk insert
      const campaignRecords = campaigns.map(campaign => ({
        id: '', // Will be generated by database
        client_id: '', // Will be set by calling code
        connection_id: '', // Will be set by calling code
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        status: campaign.status,
        budget_amount: campaign.budget,
        budget_currency: 'USD',
        start_date: campaign.startDate || null,
        end_date: campaign.endDate || null,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await this.repository.bulkInsertCampaigns(campaignRecords);

      return {
        success: true,
        processed: campaigns.length,
        failed: 0,
        errors: [],
        results: campaigns,
        duration: Date.now() - startTime
      };

    } catch (error) {
      const batchError: BatchError = {
        index: batchIndex,
        item: campaigns,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error)
      };

      return {
        success: false,
        processed: 0,
        failed: campaigns.length,
        errors: [batchError],
        results: [],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch campaign metrics with retry logic
   */
  private async fetchCampaignMetricsWithRetry(
    client: GoogleAdsClient,
    campaignId: string,
    dateRange: { startDate: string; endDate: string }
  ): Promise<GoogleAdsMetrics[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await client.getCampaignMetrics(campaignId, {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts && this.isRetryableError(error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
          continue;
        }
        
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Bulk insert metrics with batching
   */
  private async bulkInsertMetrics(metrics: GoogleAdsMetrics[]): Promise<void> {
    const batches = this.createBatches(metrics, this.config.metricsBatchSize);

    for (const batch of batches) {
      const metricRecords = batch.map(metric => ({
        id: '', // Will be generated by database
        campaign_id: '', // Will be set by calling code
        date: new Date().toISOString().split('T')[0], // Current date as placeholder
        impressions: metric.impressions,
        clicks: metric.clicks,
        conversions: metric.conversions,
        cost: metric.cost,
        ctr: metric.ctr,
        conversion_rate: metric.conversionRate,
        cpc: metric.cpc || 0,
        cpa: metric.cpa || 0,
        roas: metric.roas || 0,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await this.repository.bulkInsertMetrics(metricRecords);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const retryableCodes = [
      'RATE_LIMIT_EXCEEDED',
      'INTERNAL_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR'
    ];

    return retryableCodes.some(code => 
      error.message?.includes(code) || error.code === code
    );
  }

  /**
   * Estimate time remaining based on current progress
   */
  private estimateTimeRemaining(
    startTime: number,
    processed: number,
    total: number
  ): number {
    if (processed === 0) return 0;
    
    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed;
    const remaining = total - processed;
    
    return remaining / rate;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get batch configuration
   */
  getConfig(): BatchConfig {
    return { ...this.config };
  }

  /**
   * Update batch configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ============================================================================
// Batch Queue Manager
// ============================================================================

export class BatchQueueManager {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private maxConcurrent: number;
  private currentlyProcessing = 0;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add batch operation to queue
   */
  async addBatch<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.currentlyProcessing >= this.maxConcurrent) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.currentlyProcessing < this.maxConcurrent) {
      const operation = this.queue.shift();
      if (operation) {
        this.currentlyProcessing++;
        
        operation()
          .finally(() => {
            this.currentlyProcessing--;
            this.processQueue();
          });
      }
    }

    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    processing: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.currentlyProcessing,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Global batch queue instance
export const globalBatchQueue = new BatchQueueManager();