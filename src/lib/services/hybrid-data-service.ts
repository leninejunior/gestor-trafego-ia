/**
 * Hybrid Data Service
 * Combines cached historical data with real-time API data
 * 
 * Strategy:
 * - Last 7 days: Fetch from API in real-time
 * - 8+ days: Fetch from cache
 * - Fallback to cache if API fails
 * 
 * Date Boundary Rules:
 * - Historical data: [query.date_from, threshold) - exclusive end boundary
 * - Recent data: [threshold, query.date_to] - inclusive start and end boundaries
 * - No gaps or overlaps between historical and recent data ranges
 * - All date comparisons use normalized start-of-day timestamps
 */

import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { ObservabilityService } from '@/lib/monitoring/observability-service';
import {
  CampaignInsight,
  DataQuery,
  AdPlatform,
  DateRange
} from '@/lib/types/sync';
import { BaseSyncAdapter } from '@/lib/sync/base-sync-adapter';

/**
 * Data source indicator
 */
export enum DataSource {
  CACHE = 'cache',
  API = 'api',
  HYBRID = 'hybrid'
}

/**
 * Response with data source information
 */
export interface HybridDataResponse {
  source: DataSource;
  data: CampaignInsight[];
  cached_at?: Date;
  api_status?: 'success' | 'failed' | 'partial';
  cache_hit_rate?: number;
  fallback_used?: boolean;
  emergency_cache?: boolean;
  error_message?: string;
}

/**
 * Data freshness validation result
 */
export interface FreshnessValidation {
  is_fresh: boolean;
  last_sync?: Date;
  age_hours?: number;
  needs_refresh: boolean;
}

/**
 * Hybrid Data Service
 * Intelligently combines cache and API data
 */
export class HybridDataService {
  private repository: HistoricalDataRepository;
  private observabilityService: ObservabilityService;
  private readonly RECENT_DATA_THRESHOLD_DAYS = 7;
  
  // Concurrency and timeout controls
  private readonly MAX_CONCURRENT_CAMPAIGNS = 5;
  private readonly DEFAULT_CALL_TIMEOUT_MS = 30000; // 30 seconds per call
  private readonly MAX_CAMPAIGNS_LIMIT = 100;

  constructor() {
    this.repository = new HistoricalDataRepository();
    this.observabilityService = new ObservabilityService();
  }

  /**
   * Get campaign data using hybrid strategy
   * - Recent data (last 7 days): from API
   * - Historical data (8+ days): from cache
   * - Fallback to cache if API fails
   * 
   * @param query Data query parameters
   * @param adapter Sync adapter for API calls (optional)
   * @returns Hybrid data response
   */
  async getData(
    query: DataQuery,
    adapter?: BaseSyncAdapter
  ): Promise<HybridDataResponse> {
    // Normalize dates to Date instances at method start
    const dateFrom = new Date(query.date_from);
    const dateTo = new Date(query.date_to);
    
    // Set threshold to start of day for consistent comparison
    const recentThreshold = new Date();
    recentThreshold.setDate(recentThreshold.getDate() - this.RECENT_DATA_THRESHOLD_DAYS);
    recentThreshold.setHours(0, 0, 0, 0); // Start of day

    // Normalize query dates to start of day for consistent comparison
    const normalizedDateFrom = new Date(dateFrom);
    normalizedDateFrom.setHours(0, 0, 0, 0);
    
    const normalizedDateTo = new Date(dateTo);
    normalizedDateTo.setHours(23, 59, 59, 999); // End of day

    // Determine if query is entirely recent, entirely historical, or hybrid
    // Recent if date_from >= threshold (inclusive)
    const isEntirelyRecent = normalizedDateFrom >= recentThreshold;
    // Historical if date_to < threshold (exclusive)
    const isEntirelyHistorical = normalizedDateTo < recentThreshold;

    try {
      // Case 1: Entirely recent data - try API first with fallback
      if (isEntirelyRecent && adapter) {
        return await this.getRecentDataWithFallback(query, adapter);
      }

      // Case 2: Entirely historical - use cache only
      if (isEntirelyHistorical) {
        return await this.getCachedData(query);
      }

      // Case 3: Hybrid - split query with fallback
      if (adapter) {
        return await this.getHybridDataWithFallback(query, adapter, recentThreshold);
      }

      // No adapter provided, use cache only
      return await this.getCachedData(query);

    } catch (error) {
      // Emergency fallback to cache on any error
      console.error('Critical error fetching data, using emergency cache:', error);
      return await this.getEmergencyCache(query, error);
    }
  }

  /**
   * Get recent data from API with automatic fallback to cache
   * @param query Data query
   * @param adapter Sync adapter
   * @returns Data from API or cache
   */
  private async getRecentDataWithFallback(
    query: DataQuery,
    adapter: BaseSyncAdapter
  ): Promise<HybridDataResponse> {
    const startTime = Date.now();
    
    try {
      const insights: CampaignInsight[] = [];

      // If specific campaigns requested, fetch those with concurrency control
      if (query.campaign_ids && query.campaign_ids.length > 0) {
        const limitedCampaignIds = query.campaign_ids.slice(0, this.MAX_CAMPAIGNS_LIMIT);
        const campaignInsights = await this.fetchCampaignsWithConcurrencyControl(
          adapter,
          limitedCampaignIds,
          { start: query.date_from, end: query.date_to }
        );
        insights.push(...campaignInsights);
      } else {
        // Fetch all campaigns for the account with timeout
        const campaigns = await this.withTimeout(
          adapter.fetchCampaigns(query.client_id),
          this.DEFAULT_CALL_TIMEOUT_MS,
          'fetchCampaigns'
        );

        // Apply campaign limit and sampling for large accounts
        const limitedCampaigns = this.applyCampaignLimits(campaigns);

        // Fetch insights for each campaign with concurrency control
        const campaignIds = limitedCampaigns.map(c => c.id);
        const campaignInsights = await this.fetchCampaignsWithConcurrencyControl(
          adapter,
          campaignIds,
          { start: query.date_from, end: query.date_to }
        );
        insights.push(...campaignInsights);
      }

      // Filter by platform if specified
      const filteredInsights = query.platform
        ? insights.filter(i => i.platform === query.platform)
        : insights;

      // Record successful API call metrics
      await this.observabilityService.recordEvent({
        type: 'hybrid_data_api_success',
        metadata: {
          client_id: query.client_id,
          platform: query.platform,
          duration_ms: Date.now() - startTime,
          records_fetched: filteredInsights.length,
          campaigns_processed: query.campaign_ids?.length || insights.length
        }
      });

      return {
        source: DataSource.API,
        data: filteredInsights,
        api_status: 'success',
        fallback_used: false
      };

    } catch (error) {
      // Record failure metrics
      await this.observabilityService.recordEvent({
        type: 'hybrid_data_api_failure',
        metadata: {
          client_id: query.client_id,
          platform: query.platform,
          duration_ms: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.error('API fetch failed, falling back to cache:', error);
      } else {
        console.error('API fetch failed, falling back to cache');
      }
      
      // Fallback to cache
      const cacheResponse = await this.getCachedData(query);
      return {
        ...cacheResponse,
        api_status: 'failed',
        fallback_used: true,
        error_message: error instanceof Error ? error.message : 'Unknown API error'
      };
    }
  }

  /**
   * Get cached data only
   * @param query Data query
   * @returns Data from cache
   */
  private async getCachedData(query: DataQuery): Promise<HybridDataResponse> {
    const insights = await this.repository.queryInsights(query);

    return {
      source: DataSource.CACHE,
      data: insights,
      cached_at: insights.length > 0 ? insights[0].synced_at : undefined,
      cache_hit_rate: 1.0
    };
  }

  /**
   * Get hybrid data (cache + API) with intelligent fallback
   * @param query Data query
   * @param adapter Sync adapter
   * @param threshold Date threshold for recent data
   * @returns Combined data with fallback handling
   */
  private async getHybridDataWithFallback(
    query: DataQuery,
    adapter: BaseSyncAdapter,
    threshold: Date
  ): Promise<HybridDataResponse> {
    // Split query into historical and recent with explicit inclusive/exclusive boundaries
    // Historical: [query.date_from, threshold) - exclusive end
    // Recent: [threshold, query.date_to] - inclusive start and end
    
    const dayBeforeThreshold = new Date(threshold);
    dayBeforeThreshold.setDate(dayBeforeThreshold.getDate() - 1);
    dayBeforeThreshold.setHours(23, 59, 59, 999); // End of day before threshold (inclusive)

    const historicalQuery: DataQuery = {
      ...query,
      date_to: dayBeforeThreshold // Inclusive end for historical data
    };

    const recentQuery: DataQuery = {
      ...query,
      date_from: threshold // Inclusive start for recent data (threshold day and after)
    };

    // Validate boundaries to ensure no gaps or overlaps
    const boundaryValidation = this.validateDateBoundaries(dayBeforeThreshold, threshold);
    if (!boundaryValidation.valid) {
      console.warn('Date boundary validation failed:', {
        hasGap: boundaryValidation.hasGap,
        hasOverlap: boundaryValidation.hasOverlap,
        gapDays: boundaryValidation.gapDays,
        overlapDays: boundaryValidation.overlapDays,
        historicalEnd: dayBeforeThreshold.toISOString(),
        recentStart: threshold.toISOString()
      });
    }

    // Fetch both in parallel
    const [historicalData, recentData] = await Promise.allSettled([
      this.getCachedData(historicalQuery),
      this.getRecentDataWithFallback(recentQuery, adapter)
    ]);

    // Combine results
    const historicalInsights = historicalData.status === 'fulfilled' 
      ? historicalData.value.data 
      : [];
    
    const recentResult = recentData.status === 'fulfilled'
      ? recentData.value
      : null;
    
    const recentInsights = recentResult?.data || [];
    const apiFailed = recentResult?.api_status === 'failed';
    const fallbackUsed = recentResult?.fallback_used || false;

    // If API failed, try to get recent data from cache as well
    let finalRecentInsights = recentInsights;
    if (apiFailed && recentInsights.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('API failed and no cache available for recent period, attempting emergency cache');
      }
      const emergencyCache = await this.getCachedData(recentQuery);
      finalRecentInsights = emergencyCache.data;
    }

    const allInsights = [...historicalInsights, ...finalRecentInsights];
    const totalRecords = allInsights.length;
    const cachedRecords = historicalInsights.length + (apiFailed ? finalRecentInsights.length : 0);

    return {
      source: DataSource.HYBRID,
      data: allInsights,
      api_status: apiFailed ? 'partial' : 'success',
      cache_hit_rate: totalRecords > 0 ? cachedRecords / totalRecords : 0,
      fallback_used: fallbackUsed,
      error_message: recentResult?.error_message
    };
  }

  /**
   * Get emergency cache data when all else fails
   * This is the last resort fallback that serves any available cache data
   * 
   * @param query Data query
   * @param error Original error that triggered emergency cache
   * @returns Cached data with emergency indicator
   */
  private async getEmergencyCache(
    query: DataQuery,
    error: unknown
  ): Promise<HybridDataResponse> {
    try {
      const insights = await this.repository.queryInsights(query);

      if (process.env.NODE_ENV === 'development') {
        console.warn('Using emergency cache due to critical error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          recordsFound: insights.length,
          query: {
            client_id: query.client_id,
            platform: query.platform,
            // Redact sensitive data in production
            date_from: query.date_from,
            date_to: query.date_to
          }
        });
      } else {
        console.warn('Using emergency cache due to critical error - records found:', insights.length);
      }

      return {
        source: DataSource.CACHE,
        data: insights,
        cached_at: insights.length > 0 ? insights[0].synced_at : undefined,
        api_status: 'failed',
        cache_hit_rate: 1.0,
        fallback_used: true,
        emergency_cache: true,
        error_message: error instanceof Error ? error.message : 'Critical system error'
      };
    } catch (cacheError) {
      // Even cache failed - return empty result with error
      console.error('Emergency cache also failed:', cacheError);
      
      return {
        source: DataSource.CACHE,
        data: [],
        api_status: 'failed',
        cache_hit_rate: 0,
        fallback_used: true,
        emergency_cache: true,
        error_message: `Critical failure: ${error instanceof Error ? error.message : 'Unknown error'}. Cache also unavailable.`
      };
    }
  }

  /**
   * Refresh recent data for a client
   * Forces a sync of the last 7 days from API to cache
   * 
   * @param clientId Client ID
   * @param platform Platform
   * @param adapter Sync adapter
   * @returns Number of records refreshed
   */
  async refreshRecentData(
    clientId: string,
    platform: AdPlatform,
    adapter: BaseSyncAdapter
  ): Promise<number> {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.RECENT_DATA_THRESHOLD_DAYS);

    try {
      // Fetch campaigns
      const campaigns = await adapter.fetchCampaigns(clientId);

      const allInsights: CampaignInsight[] = [];

      // Fetch insights for each campaign
      for (const campaign of campaigns) {
        const insights = await adapter.fetchInsights(campaign.id, {
          start: startDate,
          end: now
        });
        allInsights.push(...insights);
      }

      // Store in cache
      const recordsStored = await this.repository.storeInsights(allInsights);

      return recordsStored;

    } catch (error) {
      console.error('Failed to refresh recent data:', error);
      throw error;
    }
  }

  /**
   * Validate data freshness
   * Checks if cached data is recent enough
   * 
   * @param data Campaign insights
   * @param maxAgeHours Maximum acceptable age in hours
   * @returns Freshness validation result
   */
  async validateDataFreshness(
    data: CampaignInsight[],
    maxAgeHours: number = 24
  ): Promise<FreshnessValidation> {
    if (data.length === 0) {
      return {
        is_fresh: false,
        needs_refresh: true
      };
    }

    // Find most recent sync time
    const syncTimes = data.map(d => d.synced_at.getTime());
    const mostRecentSync = new Date(Math.max(...syncTimes));
    
    const now = new Date();
    const ageMs = now.getTime() - mostRecentSync.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    const isFresh = ageHours <= maxAgeHours;

    return {
      is_fresh: isFresh,
      last_sync: mostRecentSync,
      age_hours: Number(ageHours.toFixed(2)),
      needs_refresh: !isFresh
    };
  }

  /**
   * Check if cache has data for a specific range
   * @param clientId Client ID
   * @param platform Platform
   * @param dateRange Date range
   * @returns True if cache has data
   */
  async hasCachedData(
    clientId: string,
    platform: AdPlatform,
    dateRange: DateRange
  ): Promise<boolean> {
    return await this.repository.hasDataForRange(
      clientId,
      platform,
      dateRange.start,
      dateRange.end
    );
  }

  /**
   * Get data source recommendation
   * Determines optimal data source based on query
   * 
   * @param query Data query
   * @returns Recommended data source
   */
  getDataSourceRecommendation(query: DataQuery): DataSource {
    const recentThreshold = new Date();
    recentThreshold.setDate(recentThreshold.getDate() - this.RECENT_DATA_THRESHOLD_DAYS);

    const isEntirelyRecent = query.date_from >= recentThreshold;
    const isEntirelyHistorical = query.date_to < recentThreshold;

    if (isEntirelyRecent) {
      return DataSource.API;
    }

    if (isEntirelyHistorical) {
      return DataSource.CACHE;
    }

    return DataSource.HYBRID;
  }

  /**
   * Validate date range boundaries to ensure no gaps or overlaps
   * @param historicalEnd End date for historical data (inclusive)
   * @param recentStart Start date for recent data (inclusive)
   * @returns Validation result
   */
  private validateDateBoundaries(historicalEnd: Date, recentStart: Date): {
    valid: boolean;
    hasGap: boolean;
    hasOverlap: boolean;
    gapDays?: number;
    overlapDays?: number;
  } {
    const historicalEndMs = historicalEnd.getTime();
    const recentStartMs = recentStart.getTime();
    
    // Calculate difference in days
    const diffMs = recentStartMs - historicalEndMs;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Expected: exactly 1 day difference (no gap, no overlap)
    // historicalEnd: 23:59:59.999 of day N
    // recentStart: 00:00:00.000 of day N+1
    const expectedDiffMs = 1; // 1 millisecond difference
    const actualDiffMs = diffMs;
    
    const hasGap = actualDiffMs > expectedDiffMs;
    const hasOverlap = actualDiffMs < 0;
    
    return {
      valid: !hasGap && !hasOverlap,
      hasGap,
      hasOverlap,
      gapDays: hasGap ? Math.ceil(actualDiffMs / (1000 * 60 * 60 * 24)) : undefined,
      overlapDays: hasOverlap ? Math.abs(Math.floor(actualDiffMs / (1000 * 60 * 60 * 24))) : undefined
    };
  }

  /**
   * Check if API is available and healthy
   * Used to determine if fallback should be used proactively
   * 
   * @param adapter Sync adapter to check
   * @returns True if API is healthy
   */
  async isApiHealthy(adapter: BaseSyncAdapter): Promise<boolean> {
    try {
      const result = await adapter.validateConnection();
      return result.valid;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }

  /**
   * Get data with proactive fallback check
   * Checks API health before attempting to fetch data
   * 
   * @param query Data query
   * @param adapter Sync adapter
   * @param forceCache If true, skip API and use cache only
   * @returns Hybrid data response
   */
  async getDataWithHealthCheck(
    query: DataQuery,
    adapter?: BaseSyncAdapter,
    forceCache: boolean = false
  ): Promise<HybridDataResponse> {
    // If forced to use cache or no adapter, use cache only
    if (forceCache || !adapter) {
      const cacheData = await this.getCachedData(query);
      return {
        ...cacheData,
        fallback_used: forceCache,
        error_message: forceCache ? 'Cache-only mode enabled' : undefined
      };
    }

    // Check API health before attempting fetch
    const isHealthy = await this.isApiHealthy(adapter);
    
    if (!isHealthy) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('API health check failed, using cache proactively');
      }
      const cacheData = await this.getCachedData(query);
      return {
        ...cacheData,
        api_status: 'failed',
        fallback_used: true,
        error_message: 'API unavailable - using cached data'
      };
    }

    // API is healthy, proceed with normal getData
    return await this.getData(query, adapter);
  }

  /**
   * Fetch campaigns with concurrency control and bounded parallelism
   */
  private async fetchCampaignsWithConcurrencyControl(
    adapter: BaseSyncAdapter,
    campaignIds: string[],
    dateRange: { start: Date | string, end: Date | string }
  ): Promise<CampaignInsight[]> {
    const allInsights: CampaignInsight[] = [];
    
    // Process campaigns in batches to control concurrency
    for (let i = 0; i < campaignIds.length; i += this.MAX_CONCURRENT_CAMPAIGNS) {
      const batch = campaignIds.slice(i, i + this.MAX_CONCURRENT_CAMPAIGNS);
      
      // Process batch with timeout and retry
      const batchPromises = batch.map(campaignId => 
        this.fetchCampaignWithRetry(adapter, campaignId, dateRange)
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect successful results and surface partial errors
        const partialErrors: string[] = [];
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allInsights.push(...result.value);
          } else {
            partialErrors.push(`Campaign ${batch[index]}: ${result.reason}`);
          }
        });

        // Log partial errors but continue processing
        if (partialErrors.length > 0) {
          await this.observabilityService.recordEvent({
            type: 'hybrid_data_partial_errors',
            metadata: {
              batch_index: Math.floor(i / this.MAX_CONCURRENT_CAMPAIGNS),
              errors: partialErrors,
              successful_campaigns: batchResults.filter(r => r.status === 'fulfilled').length,
              failed_campaigns: partialErrors.length
            }
          });
        }

      } catch (error) {
        // Batch failed completely, log and continue with next batch
        await this.observabilityService.recordEvent({
          type: 'hybrid_data_batch_failure',
          metadata: {
            batch_index: Math.floor(i / this.MAX_CONCURRENT_CAMPAIGNS),
            batch_size: batch.length,
            error: error instanceof Error ? error.message : 'Unknown batch error'
          }
        });
      }
    }

    return allInsights;
  }

  /**
   * Fetch single campaign with retry and exponential backoff
   */
  private async fetchCampaignWithRetry(
    adapter: BaseSyncAdapter,
    campaignId: string,
    dateRange: { start: Date | string, end: Date | string },
    maxRetries: number = 3
  ): Promise<CampaignInsight[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const insights = await this.withTimeout(
          adapter.fetchInsights(campaignId, dateRange),
          this.DEFAULT_CALL_TIMEOUT_MS,
          `fetchInsights-${campaignId}`
        );

        return insights;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on certain error types (e.g., authentication, not found)
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to fetch campaign ${campaignId} after ${maxRetries + 1} attempts`);
  }

  /**
   * Apply campaign limits and sampling for large accounts
   */
  private applyCampaignLimits(campaigns: any[]): any[] {
    if (campaigns.length <= this.MAX_CAMPAIGNS_LIMIT) {
      return campaigns;
    }

    // For large accounts, prioritize active campaigns and sample the rest
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'ENABLED');
    const inactiveCampaigns = campaigns.filter(c => c.status !== 'ACTIVE' && c.status !== 'ENABLED');

    let selectedCampaigns = [...activeCampaigns];

    // If we still have room, add some inactive campaigns
    const remainingSlots = this.MAX_CAMPAIGNS_LIMIT - activeCampaigns.length;
    if (remainingSlots > 0 && inactiveCampaigns.length > 0) {
      // Sample inactive campaigns (take every nth campaign)
      const sampleRate = Math.ceil(inactiveCampaigns.length / remainingSlots);
      const sampledInactive = inactiveCampaigns.filter((_, index) => index % sampleRate === 0);
      selectedCampaigns.push(...sampledInactive.slice(0, remainingSlots));
    }

    return selectedCampaigns.slice(0, this.MAX_CAMPAIGNS_LIMIT);
  }

  /**
   * Wrap operation with timeout using AbortController
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Note: This assumes the adapter supports AbortController
      // If not, we fall back to Promise.race
      const result = await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`));
          });
        })
      ]);

      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if error is non-retryable (authentication, not found, etc.)
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Common non-retryable error patterns
    const nonRetryablePatterns = [
      'unauthorized',
      'forbidden',
      'not found',
      'invalid token',
      'authentication failed',
      'access denied',
      'quota exceeded',
      'rate limit exceeded'
    ];

    return nonRetryablePatterns.some(pattern => message.includes(pattern));
  }
}
