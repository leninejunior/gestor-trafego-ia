/**
 * Historical Data Repository
 * Manages storage and retrieval of campaign insights from cache
 */

import { createClient } from '@/lib/supabase/server';
import {
  CampaignInsight,
  DataQuery,
  StorageStats,
  AdPlatform
} from '@/lib/types/sync';

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
      date: insight.date.toISOString().split('T')[0], // Date only
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

    // Batch insert with upsert on conflict
    const { data, error } = await supabase
      .from('campaign_insights_history')
      .upsert(records, {
        onConflict: 'platform,client_id,campaign_id,date',
        ignoreDuplicates: false
      })
      .select('id');

    if (error) {
      throw new Error(`Failed to store insights: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Query campaign insights with filters
   * @param query Query parameters
   * @returns Array of campaign insights
   */
  async queryInsights(query: DataQuery): Promise<CampaignInsight[]> {
    const supabase = await createClient();

    // Build query
    let dbQuery = supabase
      .from('campaign_insights_history')
      .select('*')
      .eq('client_id', query.client_id)
      .gte('date', query.date_from.toISOString().split('T')[0])
      .lte('date', query.date_to.toISOString().split('T')[0])
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

    // Transform database records to CampaignInsight objects
    return data.map(record => ({
      id: record.id,
      platform: record.platform as AdPlatform,
      client_id: record.client_id,
      campaign_id: record.campaign_id,
      campaign_name: record.campaign_name,
      date: new Date(record.date),
      impressions: record.impressions,
      clicks: record.clicks,
      spend: parseFloat(record.spend),
      conversions: record.conversions,
      ctr: parseFloat(record.ctr),
      cpc: parseFloat(record.cpc),
      cpm: parseFloat(record.cpm),
      conversion_rate: parseFloat(record.conversion_rate),
      is_deleted: record.is_deleted,
      synced_at: new Date(record.synced_at)
    }));
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
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('campaign_insights_history')
      .delete()
      .eq('client_id', clientId)
      .lt('date', cutoffDateStr)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete expired data: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Get storage statistics for a client
   * @param clientId Client ID
   * @returns Storage statistics
   */
  async getStorageStats(clientId: string): Promise<StorageStats> {
    const supabase = await createClient();

    // Get total record count and date range
    const { data: summary, error: summaryError } = await supabase
      .from('campaign_insights_history')
      .select('date')
      .eq('client_id', clientId);

    if (summaryError) {
      throw new Error(`Failed to get storage stats: ${summaryError.message}`);
    }

    // Get platform breakdown
    const { data: platformData, error: platformError } = await supabase
      .from('campaign_insights_history')
      .select('platform')
      .eq('client_id', clientId);

    if (platformError) {
      throw new Error(
        `Failed to get platform stats: ${platformError.message}`
      );
    }

    // Calculate statistics
    const totalRecords = summary?.length || 0;
    const dates = summary?.map(r => new Date(r.date)) || [];
    const oldestDate = dates.length > 0 
      ? new Date(Math.min(...dates.map(d => d.getTime())))
      : undefined;
    const newestDate = dates.length > 0
      ? new Date(Math.max(...dates.map(d => d.getTime())))
      : undefined;

    // Count by platform
    const platformCounts = new Map<AdPlatform, number>();
    platformData?.forEach(record => {
      const platform = record.platform as AdPlatform;
      platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
    });

    const platforms = Array.from(platformCounts.entries()).map(
      ([platform, count]) => ({
        platform,
        record_count: count
      })
    );

    // Estimate size (rough calculation: ~500 bytes per record)
    const estimatedSizeBytes = totalRecords * 500;

    return {
      client_id: clientId,
      total_records: totalRecords,
      total_size_bytes: estimatedSizeBytes,
      oldest_record_date: oldestDate,
      newest_record_date: newestDate,
      platforms
    };
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
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('campaign_insights_history')
      .select('id')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .gte('date', dateFrom.toISOString().split('T')[0])
      .lte('date', dateTo.toISOString().split('T')[0])
      .limit(1);

    if (error) {
      throw new Error(`Failed to check data existence: ${error.message}`);
    }

    return (data?.length || 0) > 0;
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

    // Get unique campaign IDs
    const uniqueIds = new Set(data?.map(r => r.campaign_id) || []);
    return Array.from(uniqueIds);
  }
}
