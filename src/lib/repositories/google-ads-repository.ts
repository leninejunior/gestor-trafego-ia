/**
 * Google Ads Repository
 * 
 * Manages database operations for Google Ads connections, campaigns, and metrics
 * Requirements: 2.1, 2.2, 9.1, 9.2
 */

import { createClient } from '@/lib/supabase/server';
import { GoogleAdsCampaign, GoogleAdsMetrics, DateRange } from '@/lib/google/client';

// ============================================================================
// Optimized Query Interfaces
// ============================================================================

export interface CampaignFilters {
  status?: 'ENABLED' | 'PAUSED' | 'REMOVED' | 'all';
  search?: string;
  sortBy?: 'name' | 'status' | 'cost' | 'conversions' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MetricsAggregation {
  dateFrom: string;
  dateTo: string;
  granularity: 'daily' | 'weekly' | 'monthly';
  campaignIds?: string[];
}

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface GoogleAdsConnection {
  id: string;
  client_id: string;
  customer_id: string;
  refresh_token: string; // encrypted
  access_token: string | null; // encrypted
  token_expires_at: Date | null;
  last_sync_at: Date | null;
  status: 'active' | 'expired' | 'revoked';
  created_at: Date;
  updated_at: Date;
}

export interface GoogleAdsCampaignRecord {
  id: string;
  client_id: string;
  connection_id: string;
  campaign_id: string;
  campaign_name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budget_amount: number | null;
  budget_currency: string;
  start_date: string | null;
  end_date: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GoogleAdsMetricRecord {
  id: string;
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number | null;
  conversion_rate: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface GoogleAdsSyncLog {
  id: string;
  connection_id: string;
  sync_type: 'full' | 'incremental' | 'metrics';
  status: 'success' | 'partial' | 'failed';
  campaigns_synced: number;
  metrics_updated: number;
  error_message: string | null;
  error_code: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

export interface CampaignFilters {
  status?: 'ENABLED' | 'PAUSED' | 'REMOVED';
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  token_expires_at: Date;
}

export interface MetricsAggregation {
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_cost: number;
  avg_ctr: number;
  avg_conversion_rate: number;
  avg_cpc: number;
  avg_cpa: number;
  avg_roas: number;
}

// ============================================================================
// Google Ads Repository Class
// ============================================================================

export class GoogleAdsRepository {
  /**
   * Save a new Google Ads connection
   */
  async saveConnection(connection: Omit<GoogleAdsConnection, 'id' | 'created_at' | 'updated_at'>): Promise<GoogleAdsConnection> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_connections')
      .insert({
        client_id: connection.client_id,
        customer_id: connection.customer_id,
        refresh_token: connection.refresh_token,
        access_token: connection.access_token,
        token_expires_at: connection.token_expires_at?.toISOString(),
        last_sync_at: connection.last_sync_at?.toISOString(),
        status: connection.status,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save Google Ads connection: ${error.message}`);
    }

    return this.mapConnectionFromDb(data);
  }

  /**
   * Get connection by client ID
   */
  async getConnection(clientId: string): Promise<GoogleAdsConnection | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to get Google Ads connection: ${error.message}`);
    }

    return data ? this.mapConnectionFromDb(data) : null;
  }

  /**
   * Get connection by ID
   */
  async getConnectionById(connectionId: string): Promise<GoogleAdsConnection | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get Google Ads connection by ID: ${error.message}`);
    }

    return data ? this.mapConnectionFromDb(data) : null;
  }

  /**
   * Get all active connections for a client
   */
  async getActiveConnections(clientId: string): Promise<GoogleAdsConnection[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get active connections: ${error.message}`);
    }

    return (data || []).map(this.mapConnectionFromDb);
  }

  /**
   * Update connection tokens
   */
  async updateTokens(connectionId: string, tokens: TokenData): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_ads_connections')
      .update({
        access_token: tokens.access_token,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        token_expires_at: tokens.token_expires_at.toISOString(),
        status: 'active',
      })
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to update connection tokens: ${error.message}`);
    }
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(
    connectionId: string,
    status: 'active' | 'expired' | 'revoked'
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_ads_connections')
      .update({ status })
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to update connection status: ${error.message}`);
    }
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(connectionId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_ads_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to update last sync: ${error.message}`);
    }
  }

  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_ads_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to delete connection: ${error.message}`);
    }
  }

  // ==========================================================================
  // Campaign Methods
  // ==========================================================================

  /**
   * Save campaigns in batch (upsert)
   */
  async saveCampaigns(campaigns: GoogleAdsCampaign[], connectionId: string, clientId: string): Promise<number> {
    if (campaigns.length === 0) {
      return 0;
    }

    const supabase = await createClient();

    const records = campaigns.map(campaign => ({
      client_id: clientId,
      connection_id: connectionId,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status,
      budget_amount: campaign.budget,
      budget_currency: 'USD', // Default, can be made configurable
      start_date: campaign.startDate || null,
      end_date: campaign.endDate || null,
    }));

    const { data, error } = await supabase
      .from('google_ads_campaigns')
      .upsert(records, {
        onConflict: 'connection_id,campaign_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      throw new Error(`Failed to save campaigns: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Get campaigns for a client with filters
   */
  async getCampaigns(clientId: string, filters?: CampaignFilters): Promise<GoogleAdsCampaignRecord[]> {
    const supabase = await createClient();

    let query = supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.searchTerm) {
      query = query.ilike('campaign_name', `%${filters.searchTerm}%`);
    }

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get campaigns: ${error.message}`);
    }

    return (data || []).map(this.mapCampaignFromDb);
  }

  /**
   * Get a single campaign by ID
   */
  async getCampaignById(campaignId: string): Promise<GoogleAdsCampaignRecord | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get campaign: ${error.message}`);
    }

    return data ? this.mapCampaignFromDb(data) : null;
  }

  /**
   * Get campaign by Google Ads campaign ID
   */
  async getCampaignByGoogleId(
    connectionId: string,
    googleCampaignId: string
  ): Promise<GoogleAdsCampaignRecord | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('campaign_id', googleCampaignId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get campaign by Google ID: ${error.message}`);
    }

    return data ? this.mapCampaignFromDb(data) : null;
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    campaignId: string,
    status: 'ENABLED' | 'PAUSED' | 'REMOVED'
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_ads_campaigns')
      .update({ status })
      .eq('id', campaignId);

    if (error) {
      throw new Error(`Failed to update campaign status: ${error.message}`);
    }
  }

  /**
   * Delete campaigns for a connection
   */
  async deleteCampaignsByConnection(connectionId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_ads_campaigns')
      .delete()
      .eq('connection_id', connectionId);

    if (error) {
      throw new Error(`Failed to delete campaigns: ${error.message}`);
    }
  }

  // ==========================================================================
  // Metrics Methods
  // ==========================================================================

  /**
   * Save metrics for a campaign (upsert by campaign_id and date)
   */
  async saveMetrics(
    campaignId: string,
    metrics: GoogleAdsMetrics,
    date: string
  ): Promise<void> {
    const supabase = await createClient();

    const record = {
      campaign_id: campaignId,
      date,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      cost: metrics.cost,
      ctr: metrics.ctr,
      conversion_rate: metrics.conversionRate,
      cpc: metrics.cpc || null,
      cpa: metrics.cpa || null,
      roas: metrics.roas || null,
    };

    const { error } = await supabase
      .from('google_ads_metrics')
      .upsert(record, {
        onConflict: 'campaign_id,date',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Failed to save metrics: ${error.message}`);
    }
  }

  /**
   * Save metrics in batch
   */
  async saveMetricsBatch(
    metrics: Array<{ campaignId: string; metrics: GoogleAdsMetrics; date: string }>
  ): Promise<number> {
    if (metrics.length === 0) {
      return 0;
    }

    const supabase = await createClient();

    const records = metrics.map(item => ({
      campaign_id: item.campaignId,
      date: item.date,
      impressions: item.metrics.impressions,
      clicks: item.metrics.clicks,
      conversions: item.metrics.conversions,
      cost: item.metrics.cost,
      ctr: item.metrics.ctr,
      conversion_rate: item.metrics.conversionRate,
      cpc: item.metrics.cpc || null,
      cpa: item.metrics.cpa || null,
      roas: item.metrics.roas || null,
    }));

    const { data, error } = await supabase
      .from('google_ads_metrics')
      .upsert(records, {
        onConflict: 'campaign_id,date',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      throw new Error(`Failed to save metrics batch: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Get historical metrics for a campaign
   */
  async getHistoricalMetrics(
    campaignId: string,
    dateRange: DateRange
  ): Promise<GoogleAdsMetricRecord[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_metrics')
      .select('*')
      .eq('campaign_id', campaignId)
      .gte('date', dateRange.startDate)
      .lte('date', dateRange.endDate)
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get historical metrics: ${error.message}`);
    }

    return (data || []).map(this.mapMetricFromDb);
  }

  /**
   * Get metrics for multiple campaigns
   */
  async getMetricsForCampaigns(
    campaignIds: string[],
    dateRange: DateRange
  ): Promise<Map<string, GoogleAdsMetricRecord[]>> {
    if (campaignIds.length === 0) {
      return new Map();
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_metrics')
      .select('*')
      .in('campaign_id', campaignIds)
      .gte('date', dateRange.startDate)
      .lte('date', dateRange.endDate)
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get metrics for campaigns: ${error.message}`);
    }

    // Group by campaign_id
    const metricsMap = new Map<string, GoogleAdsMetricRecord[]>();
    (data || []).forEach(record => {
      const mapped = this.mapMetricFromDb(record);
      const existing = metricsMap.get(record.campaign_id) || [];
      existing.push(mapped);
      metricsMap.set(record.campaign_id, existing);
    });

    return metricsMap;
  }

  /**
   * Get aggregated metrics for a campaign
   */
  async getAggregatedMetrics(
    campaignId: string,
    dateRange: DateRange
  ): Promise<MetricsAggregation> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc('get_google_campaign_metrics_summary', {
        p_campaign_id: campaignId,
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
      })
      .single();

    if (error) {
      throw new Error(`Failed to get aggregated metrics: ${error.message}`);
    }

    // Type assertion for RPC response
    const result = data as any;

    return {
      total_impressions: result?.total_impressions || 0,
      total_clicks: result?.total_clicks || 0,
      total_conversions: parseFloat(result?.total_conversions || '0'),
      total_cost: parseFloat(result?.total_cost || '0'),
      avg_ctr: parseFloat(result?.avg_ctr || '0'),
      avg_conversion_rate: parseFloat(result?.avg_conversion_rate || '0'),
      avg_cpc: parseFloat(result?.avg_cpc || '0'),
      avg_cpa: parseFloat(result?.avg_cpa || '0'),
      avg_roas: parseFloat(result?.avg_roas || '0'),
    };
  }

  /**
   * Delete old metrics (for cleanup)
   */
  async deleteOldMetrics(campaignId: string, beforeDate: string): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_metrics')
      .delete()
      .eq('campaign_id', campaignId)
      .lt('date', beforeDate)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old metrics: ${error.message}`);
    }

    return data?.length || 0;
  }

  // ==========================================================================
  // Sync Log Methods
  // ==========================================================================

  /**
   * Create a sync log entry
   */
  async createSyncLog(log: Omit<GoogleAdsSyncLog, 'id' | 'created_at'>): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_sync_logs')
      .insert({
        connection_id: log.connection_id,
        sync_type: log.sync_type,
        status: log.status,
        campaigns_synced: log.campaigns_synced,
        metrics_updated: log.metrics_updated,
        error_message: log.error_message,
        error_code: log.error_code,
        started_at: log.started_at.toISOString(),
        completed_at: log.completed_at?.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create sync log: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update sync log with completion data
   */
  async updateSyncLog(
    logId: string,
    updates: {
      status: 'success' | 'partial' | 'failed';
      campaigns_synced?: number;
      metrics_updated?: number;
      error_message?: string;
      error_code?: string;
      completed_at: Date;
    }
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('google_ads_sync_logs')
      .update({
        status: updates.status,
        ...(updates.campaigns_synced !== undefined && { campaigns_synced: updates.campaigns_synced }),
        ...(updates.metrics_updated !== undefined && { metrics_updated: updates.metrics_updated }),
        ...(updates.error_message && { error_message: updates.error_message }),
        ...(updates.error_code && { error_code: updates.error_code }),
        completed_at: updates.completed_at.toISOString(),
      })
      .eq('id', logId);

    if (error) {
      throw new Error(`Failed to update sync log: ${error.message}`);
    }
  }

  /**
   * Get recent sync logs for a connection
   */
  async getSyncLogs(connectionId: string, limit: number = 10): Promise<GoogleAdsSyncLog[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_sync_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get sync logs: ${error.message}`);
    }

    return (data || []).map(this.mapSyncLogFromDb);
  }

  /**
   * Get last successful sync for a connection
   */
  async getLastSuccessfulSync(connectionId: string): Promise<GoogleAdsSyncLog | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_sync_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get last successful sync: ${error.message}`);
    }

    return data ? this.mapSyncLogFromDb(data) : null;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if a connection exists for a client
   */
  async hasConnection(clientId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_ads_connections')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .limit(1);

    if (error) {
      throw new Error(`Failed to check connection existence: ${error.message}`);
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Get campaign count for a client
   */
  async getCampaignCount(clientId: string, status?: 'ENABLED' | 'PAUSED' | 'REMOVED'): Promise<number> {
    const supabase = await createClient();

    let query = supabase
      .from('google_ads_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);

    if (status) {
      query = query.eq('status', status);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to get campaign count: ${error.message}`);
    }

    return count || 0;
  }

  // ==========================================================================
  // Mapping Methods
  // ==========================================================================

  private mapConnectionFromDb(data: any): GoogleAdsConnection {
    return {
      id: data.id,
      client_id: data.client_id,
      customer_id: data.customer_id,
      refresh_token: data.refresh_token,
      access_token: data.access_token,
      token_expires_at: data.token_expires_at ? new Date(data.token_expires_at) : null,
      last_sync_at: data.last_sync_at ? new Date(data.last_sync_at) : null,
      status: data.status,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapCampaignFromDb(data: any): GoogleAdsCampaignRecord {
    return {
      id: data.id,
      client_id: data.client_id,
      connection_id: data.connection_id,
      campaign_id: data.campaign_id,
      campaign_name: data.campaign_name,
      status: data.status,
      budget_amount: data.budget_amount ? parseFloat(data.budget_amount) : null,
      budget_currency: data.budget_currency,
      start_date: data.start_date,
      end_date: data.end_date,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapMetricFromDb(data: any): GoogleAdsMetricRecord {
    return {
      id: data.id,
      campaign_id: data.campaign_id,
      date: data.date,
      impressions: parseInt(data.impressions || '0'),
      clicks: parseInt(data.clicks || '0'),
      conversions: parseFloat(data.conversions || '0'),
      cost: parseFloat(data.cost || '0'),
      ctr: data.ctr ? parseFloat(data.ctr) : null,
      conversion_rate: data.conversion_rate ? parseFloat(data.conversion_rate) : null,
      cpc: data.cpc ? parseFloat(data.cpc) : null,
      cpa: data.cpa ? parseFloat(data.cpa) : null,
      roas: data.roas ? parseFloat(data.roas) : null,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapSyncLogFromDb(data: any): GoogleAdsSyncLog {
    return {
      id: data.id,
      connection_id: data.connection_id,
      sync_type: data.sync_type,
      status: data.status,
      campaigns_synced: data.campaigns_synced,
      metrics_updated: data.metrics_updated,
      error_message: data.error_message,
      error_code: data.error_code,
      started_at: new Date(data.started_at),
      completed_at: data.completed_at ? new Date(data.completed_at) : null,
      created_at: new Date(data.created_at),
    };
  }

  // ============================================================================
  // Optimized Query Methods
  // ============================================================================

  /**
   * Get paginated campaigns with optimized query
   */
  async getCampaignsPaginated(
    clientId: string,
    filters: CampaignFilters = {}
  ): Promise<PaginatedResult<GoogleAdsCampaignRecord & { metrics?: any }>> {
    const supabase = await createClient();

    const {
      status = 'all',
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      limit = 20,
      offset = 0
    } = filters;

    // Use the optimized database function
    const { data, error } = await supabase.rpc('get_google_campaigns_paginated', {
      p_client_id: clientId,
      p_status: status,
      p_search: search,
      p_sort_by: sortBy,
      p_sort_order: sortOrder.toUpperCase(),
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      throw new Error(`Failed to get paginated campaigns: ${error.message}`);
    }

    const campaigns = data || [];
    const total = campaigns.length > 0 ? campaigns[0].total_count : 0;

    return {
      data: campaigns.map(campaign => ({
        id: campaign.id,
        client_id: clientId,
        connection_id: '', // Will be filled by join if needed
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        status: campaign.status,
        budget_amount: campaign.budget_amount,
        budget_currency: campaign.budget_currency,
        start_date: null,
        end_date: null,
        created_at: new Date(campaign.created_at),
        updated_at: new Date(campaign.updated_at),
        metrics: {
          impressions: campaign.total_impressions,
          clicks: campaign.total_clicks,
          conversions: campaign.total_conversions,
          cost: campaign.total_cost,
          ctr: campaign.avg_ctr,
          conversionRate: campaign.avg_conversion_rate
        }
      })),
      total: Number(total),
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(Number(total) / limit)
    };
  }

  /**
   * Get aggregated metrics with optimized query
   */
  async getMetricsAggregated(
    clientId: string,
    aggregation: MetricsAggregation
  ): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_google_metrics_aggregated', {
      p_client_id: clientId,
      p_campaign_ids: aggregation.campaignIds || null,
      p_start_date: aggregation.dateFrom,
      p_end_date: aggregation.dateTo,
      p_granularity: aggregation.granularity
    });

    if (error) {
      throw new Error(`Failed to get aggregated metrics: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get campaigns performance view (optimized)
   */
  async getCampaignsPerformance(clientId: string): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_campaigns_performance')
      .select('*')
      .eq('client_id', clientId)
      .order('total_cost', { ascending: false });

    if (error) {
      throw new Error(`Failed to get campaigns performance: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get sync status for all connections (optimized)
   */
  async getSyncStatus(clientId: string): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('google_sync_status')
      .select('*')
      .eq('client_id', clientId);

    if (error) {
      throw new Error(`Failed to get sync status: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Bulk insert metrics (optimized for large datasets)
   */
  async bulkInsertMetrics(metrics: GoogleAdsMetricRecord[]): Promise<void> {
    if (metrics.length === 0) return;

    const supabase = await createClient();
    const batchSize = 1000; // Process in batches to avoid memory issues

    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('google_ads_metrics')
        .upsert(batch, {
          onConflict: 'campaign_id,date',
          ignoreDuplicates: false
        });

      if (error) {
        throw new Error(`Failed to bulk insert metrics batch ${i}: ${error.message}`);
      }
    }
  }

  /**
   * Bulk insert campaigns (optimized for sync operations)
   */
  async bulkInsertCampaigns(campaigns: GoogleAdsCampaignRecord[]): Promise<void> {
    if (campaigns.length === 0) return;

    const supabase = await createClient();
    const batchSize = 500; // Smaller batch for campaigns due to more complex data

    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('google_ads_campaigns')
        .upsert(batch, {
          onConflict: 'connection_id,campaign_id',
          ignoreDuplicates: false
        });

      if (error) {
        throw new Error(`Failed to bulk insert campaigns batch ${i}: ${error.message}`);
      }
    }
  }

  /**
   * Get query performance statistics
   */
  async getQueryStats(): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_google_ads_query_stats');

    if (error) {
      throw new Error(`Failed to get query stats: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Refresh materialized views for better performance
   */
  async refreshMaterializedViews(): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.rpc('refresh_google_daily_summary');

    if (error) {
      throw new Error(`Failed to refresh materialized views: ${error.message}`);
    }
  }

  /**
   * Cleanup old data for maintenance
   */
  async cleanupOldData(metricsRetentionDays = 365, logsRetentionDays = 30): Promise<{
    metricsDeleted: number;
    logsDeleted: number;
  }> {
    const supabase = await createClient();

    // Cleanup old metrics
    const { data: metricsResult, error: metricsError } = await supabase
      .rpc('cleanup_old_google_metrics', { p_retention_days: metricsRetentionDays });

    if (metricsError) {
      throw new Error(`Failed to cleanup old metrics: ${metricsError.message}`);
    }

    // Cleanup old sync logs
    const { data: logsResult, error: logsError } = await supabase
      .rpc('cleanup_old_google_sync_logs', { p_retention_days: logsRetentionDays });

    if (logsError) {
      throw new Error(`Failed to cleanup old sync logs: ${logsError.message}`);
    }

    return {
      metricsDeleted: metricsResult || 0,
      logsDeleted: logsResult || 0
    };
  }
}
