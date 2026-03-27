/**
 * Historical Data Repository
 * Manages storage and retrieval of campaign insights from cache
 */

import { createClient } from '@/lib/supabase/server';
import { redisCacheService } from '@/lib/cache/redis-cache-service';
import {
  CampaignInsight,
  DataQuery,
  StorageStats,
  AdPlatform
} from '@/lib/types/sync';

const CACHE_TTL_SECONDS = {
  queryInsights: 300,
  storageStats: 120,
  rangeExists: 180,
  campaignIds: 300
} as const;

/**
 * Repository for managing historical campaign data
 */
export class HistoricalDataRepository {
  /**
   * Store campaign insights in batch
   * Uses upsert to handle duplicates (same platform, client, campaign, date)
   * @param insights Array of campaign insights to store
   * @returns Number of records stored
   */
  async storeInsights(insights: CampaignInsight[]): Promise<number> {
    if (insights.length === 0) {
      return 0;
    }

    const supabase = await createClient();

    // Prepare data for insertion
    const records = insights.map(insight => ({
      platform: insight.platform,
      client_id: insight.client_id,
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      date: this.toDateOnly(insight.date),
      impressions: insight.impressions,
      clicks: insight.clicks,
      spend: insight.spend,
      conversions: insight.conversions,
      ctr: insight.ctr,
      cpc: insight.cpc,
      cpm: insight.cpm,
      conversion_rate: insight.conversion_rate,
      is_deleted: insight.is_deleted,
      synced_at: insight.synced_at.toISOString()
    }));

    // Batch insert with upsert on conflict.
    // Splitting large payloads improves reliability on high-volume syncs.
    const batchSize = 1000;
    let storedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from('campaign_insights_history')
        .upsert(batch, {
          onConflict: 'platform,client_id,campaign_id,date',
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        throw new Error(`Failed to store insights: ${error.message}`);
      }

      storedCount += data?.length || 0;
    }

    const affectedClientIds = new Set(records.map(record => record.client_id));
    await Promise.all(
      Array.from(affectedClientIds).map(clientId =>
        this.invalidateClientCache(clientId)
      )
    );

    return storedCount;
  }

  /**
   * Query campaign insights with filters
   * @param query Query parameters
   * @returns Array of campaign insights
   */
  async queryInsights(query: DataQuery): Promise<CampaignInsight[]> {
    const cacheKey = this.buildQueryCacheKey(query);
    const cachedInsights = await redisCacheService.getJson<CampaignInsight[]>(
      cacheKey
    );

    if (cachedInsights && cachedInsights.length > 0) {
      return this.deserializeInsights(cachedInsights);
    }

    const supabase = await createClient();

    // Build query
    let dbQuery = supabase
      .from('campaign_insights_history')
      .select(
        'id,platform,client_id,campaign_id,campaign_name,date,impressions,clicks,spend,conversions,ctr,cpc,cpm,conversion_rate,is_deleted,synced_at'
      )
      .eq('client_id', query.client_id)
      .gte('date', this.toDateOnly(query.date_from))
      .lte('date', this.toDateOnly(query.date_to))
      .order('date', { ascending: false });

    // Apply optional filters
    if (query.platform) {
      dbQuery = dbQuery.eq('platform', query.platform);
    }

    if (query.campaign_ids && query.campaign_ids.length > 0) {
      dbQuery = dbQuery.in('campaign_id', query.campaign_ids);
    }

    // Apply pagination
    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    if (query.offset) {
      dbQuery = dbQuery.range(
        query.offset,
        query.offset + (query.limit || 100) - 1
      );
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new Error(`Failed to query insights: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    const insights = data.map(record => this.mapInsightRecord(record));

    await redisCacheService.setJson(
      cacheKey,
      insights,
      CACHE_TTL_SECONDS.queryInsights
    );

    return insights;
  }

  /**
   * Delete expired data based on retention period
   * @param clientId Client ID
   * @param retentionDays Number of days to retain data
   * @returns Number of records deleted
   */
  async deleteExpiredData(
    clientId: string,
    retentionDays: number
  ): Promise<number> {
    const supabase = await createClient();

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = this.toDateOnly(cutoffDate);

    const { data, error } = await supabase
      .from('campaign_insights_history')
      .delete()
      .eq('client_id', clientId)
      .lt('date', cutoffDateStr)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete expired data: ${error.message}`);
    }

    await this.invalidateClientCache(clientId);

    return data?.length || 0;
  }

  /**
   * Get storage statistics for a client
   * @param clientId Client ID
   * @returns Storage statistics
   */
  async getStorageStats(clientId: string): Promise<StorageStats> {
    const cacheKey = this.buildStorageStatsCacheKey(clientId);
    const cachedStats = await redisCacheService.getJson<StorageStats>(cacheKey);
    if (cachedStats) {
      return this.deserializeStorageStats(cachedStats);
    }

    const supabase = await createClient();

    const [
      totalCountResult,
      oldestResult,
      newestResult,
      metaCountResult,
      googleCountResult
    ] = await Promise.all([
      supabase
        .from('campaign_insights_history')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId),
      supabase
        .from('campaign_insights_history')
        .select('date')
        .eq('client_id', clientId)
        .order('date', { ascending: true })
        .limit(1),
      supabase
        .from('campaign_insights_history')
        .select('date')
        .eq('client_id', clientId)
        .order('date', { ascending: false })
        .limit(1),
      supabase
        .from('campaign_insights_history')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('platform', AdPlatform.META),
      supabase
        .from('campaign_insights_history')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('platform', AdPlatform.GOOGLE)
    ]);

    const errors = [
      totalCountResult.error,
      oldestResult.error,
      newestResult.error,
      metaCountResult.error,
      googleCountResult.error
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(
        'Failed to get storage stats: ' +
          errors.map(err => err?.message).join('; ')
      );
    }

    const totalRecords = totalCountResult.count || 0;
    const oldestDate =
      oldestResult.data && oldestResult.data.length > 0
        ? new Date(oldestResult.data[0].date)
        : undefined;
    const newestDate =
      newestResult.data && newestResult.data.length > 0
        ? new Date(newestResult.data[0].date)
        : undefined;

    const metaCount = metaCountResult.count || 0;
    const googleCount = googleCountResult.count || 0;

    const platforms = [
      { platform: AdPlatform.META, record_count: metaCount },
      { platform: AdPlatform.GOOGLE, record_count: googleCount }
    ].filter(item => item.record_count > 0);

    // Estimate size (rough calculation: ~500 bytes per record)
    const estimatedSizeBytes = totalRecords * 500;

    const stats: StorageStats = {
      client_id: clientId,
      total_records: totalRecords,
      total_size_bytes: estimatedSizeBytes,
      oldest_record_date: oldestDate,
      newest_record_date: newestDate,
      platforms
    };

    await redisCacheService.setJson(
      cacheKey,
      stats,
      CACHE_TTL_SECONDS.storageStats
    );

    return stats;
  }

  /**
   * Check if data exists for a specific date range
   * @param clientId Client ID
   * @param platform Platform
   * @param dateFrom Start date
   * @param dateTo End date
   * @returns True if data exists
   */
  async hasDataForRange(
    clientId: string,
    platform: AdPlatform,
    dateFrom: Date,
    dateTo: Date
  ): Promise<boolean> {
    const cacheKey = this.buildRangeExistsCacheKey(
      clientId,
      platform,
      dateFrom,
      dateTo
    );
    const cached = await redisCacheService.getJson<boolean>(cacheKey);
    if (typeof cached === 'boolean') {
      return cached;
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('campaign_insights_history')
      .select('id')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .gte('date', this.toDateOnly(dateFrom))
      .lte('date', this.toDateOnly(dateTo))
      .limit(1);

    if (error) {
      throw new Error(`Failed to check data existence: ${error.message}`);
    }

    const exists = (data?.length || 0) > 0;
    await redisCacheService.setJson(
      cacheKey,
      exists,
      CACHE_TTL_SECONDS.rangeExists
    );

    return exists;
  }

  /**
   * Get unique campaign IDs for a client
   * @param clientId Client ID
   * @param platform Optional platform filter
   * @returns Array of campaign IDs
   */
  async getCampaignIds(
    clientId: string,
    platform?: AdPlatform
  ): Promise<string[]> {
    const cacheKey = this.buildCampaignIdsCacheKey(clientId, platform);
    const cached = await redisCacheService.getJson<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const supabase = await createClient();

    let query = supabase
      .from('campaign_insights_history')
      .select('campaign_id')
      .eq('client_id', clientId);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get campaign IDs: ${error.message}`);
    }

    const uniqueIds = Array.from(new Set(data?.map(r => r.campaign_id) || []));

    await redisCacheService.setJson(
      cacheKey,
      uniqueIds,
      CACHE_TTL_SECONDS.campaignIds
    );

    return uniqueIds;
  }

  private async invalidateClientCache(clientId: string): Promise<void> {
    await redisCacheService.deleteByPrefix(this.getClientCachePrefix(clientId));
  }

  private getClientCachePrefix(clientId: string): string {
    return `historical:${clientId}:`;
  }

  private buildQueryCacheKey(query: DataQuery): string {
    const platform = query.platform || 'all';
    const campaignIds =
      query.campaign_ids && query.campaign_ids.length > 0
        ? query.campaign_ids.slice().sort().join(',')
        : 'all';
    const metrics =
      query.metrics && query.metrics.length > 0
        ? query.metrics.slice().sort().join(',')
        : 'all';

    return (
      this.getClientCachePrefix(query.client_id) +
      'query:' +
      platform +
      ':' +
      this.toDateOnly(query.date_from) +
      ':' +
      this.toDateOnly(query.date_to) +
      ':' +
      campaignIds +
      ':' +
      metrics +
      ':limit=' +
      (query.limit ?? 'none') +
      ':offset=' +
      (query.offset ?? 0)
    );
  }

  private buildStorageStatsCacheKey(clientId: string): string {
    return this.getClientCachePrefix(clientId) + 'storage-stats';
  }

  private buildRangeExistsCacheKey(
    clientId: string,
    platform: AdPlatform,
    dateFrom: Date,
    dateTo: Date
  ): string {
    return (
      this.getClientCachePrefix(clientId) +
      'range-exists:' +
      platform +
      ':' +
      this.toDateOnly(dateFrom) +
      ':' +
      this.toDateOnly(dateTo)
    );
  }

  private buildCampaignIdsCacheKey(
    clientId: string,
    platform?: AdPlatform
  ): string {
    return (
      this.getClientCachePrefix(clientId) +
      'campaign-ids:' +
      (platform || 'all')
    );
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private mapInsightRecord(record: {
    id: string;
    platform: string;
    client_id: string;
    campaign_id: string;
    campaign_name: string;
    date: string;
    impressions: number;
    clicks: number;
    spend: string | number;
    conversions: number;
    ctr: string | number;
    cpc: string | number;
    cpm: string | number;
    conversion_rate: string | number;
    is_deleted: boolean;
    synced_at: string;
  }): CampaignInsight {
    return {
      id: record.id,
      platform: record.platform as AdPlatform,
      client_id: record.client_id,
      campaign_id: record.campaign_id,
      campaign_name: record.campaign_name,
      date: new Date(record.date),
      impressions: record.impressions,
      clicks: record.clicks,
      spend: parseFloat(String(record.spend)),
      conversions: record.conversions,
      ctr: parseFloat(String(record.ctr)),
      cpc: parseFloat(String(record.cpc)),
      cpm: parseFloat(String(record.cpm)),
      conversion_rate: parseFloat(String(record.conversion_rate)),
      is_deleted: record.is_deleted,
      synced_at: new Date(record.synced_at)
    };
  }

  private deserializeInsights(insights: CampaignInsight[]): CampaignInsight[] {
    return insights.map(insight => ({
      ...insight,
      date: new Date(insight.date),
      synced_at: new Date(insight.synced_at)
    }));
  }

  private deserializeStorageStats(stats: StorageStats): StorageStats {
    return {
      ...stats,
      oldest_record_date: stats.oldest_record_date
        ? new Date(stats.oldest_record_date)
        : undefined,
      newest_record_date: stats.newest_record_date
        ? new Date(stats.newest_record_date)
        : undefined
    };
  }
}
