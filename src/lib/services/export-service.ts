/**
 * Export Service
 * 
 * Handles data export functionality with plan-based permissions.
 * Supports CSV and JSON formats with streaming and size guards.
 * 
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */

import { createClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from './cache-feature-gate';
import { ExportNotificationService } from './export-notification-service';
import { PlatformAggregationService } from './platform-aggregation';
import { GoogleAdsRepository } from '@/lib/repositories/google-ads-repository';
import { ObservabilityService } from '@/lib/monitoring/observability-service';
import { AlertService } from '@/lib/monitoring/alert-service';
import type { CampaignInsight } from '@/lib/types/sync';
import type { Platform, DateRange, AggregatedMetrics } from '@/lib/types/platform-aggregation';

export interface ExportRequest {
  userId: string;
  clientId: string;
  format: 'csv' | 'json';
  dateFrom: string;
  dateTo: string;
  platform?: 'meta' | 'google' | 'unified';
  campaignIds?: string[];
  metrics?: string[];
  maxRows?: number;
  streaming?: boolean;
  timeoutMs?: number;
}

export interface GoogleAdsExportData {
  date: string;
  platform: 'google';
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  conversion_rate: number | null;
  status: string;
  synced_at: string;
}

export interface UnifiedExportData {
  date: string;
  platform: Platform;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  conversion_rate: number | null;
  status: string;
  synced_at: string;
}

export interface ExportResult {
  id: string;
  format: 'csv' | 'json';
  fileName: string;
  fileSize: number;
  recordCount: number;
  downloadUrl: string;
  expiresAt: Date;
  createdAt: Date;
  storagePath: string;
}

export interface ExportJob {
  id: string;
  user_id: string;
  client_id: string;
  format: 'csv' | 'json';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  record_count?: number;
  error_message?: string;
  expires_at?: string;
  created_at: string;
  completed_at?: string;
}

export class ExportService {
  private featureGate: CacheFeatureGate;
  private notificationService: ExportNotificationService;
  private platformAggregation: PlatformAggregationService;
  private googleAdsRepository: GoogleAdsRepository;
  private observabilityService: ObservabilityService;
  private alertService: AlertService;

  // Configuration constants
  private readonly MAX_ROWS_DEFAULT = 100000;
  private readonly MAX_FILE_SIZE_MB = 50;
  private readonly DEFAULT_TIMEOUT_MS = 300000; // 5 minutes
  private readonly CHUNK_SIZE = 1000;

  constructor() {
    this.featureGate = new CacheFeatureGate();
    this.notificationService = new ExportNotificationService();
    this.platformAggregation = new PlatformAggregationService();
    this.googleAdsRepository = new GoogleAdsRepository();
    this.observabilityService = new ObservabilityService();
    this.alertService = new AlertService();
  }

  /**
   * Export data to CSV format with streaming and size guards
   * Requirements: 8.1, 8.2, 8.4
   */
  async exportToCSV(request: ExportRequest): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      // Validate permissions
      const perm = await this.featureGate.checkExportPermission(
        request.userId,
        'csv'
      );

      if (!perm.allowed) {
        throw new Error(perm.reason || 'CSV export not allowed for current plan');
      }

      // Validate and apply size limits
      const validatedRequest = await this.validateAndApplySizeLimits(request);

      // Create export job
      const job = await this.createExportJob(validatedRequest);

      // Set timeout for the entire operation
      const timeoutMs = validatedRequest.timeoutMs || this.DEFAULT_TIMEOUT_MS;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Export timeout exceeded')), timeoutMs);
      });

      const exportPromise = this.performStreamingExport(validatedRequest, job, 'csv');

      const result = await Promise.race([exportPromise, timeoutPromise]) as ExportResult;

      // Record metrics
      await this.recordExportMetrics(request, 'success', Date.now() - startTime, result.recordCount);

      return result;
    } catch (error) {
      // Record failure metrics and alert
      await this.recordExportMetrics(request, 'failure', Date.now() - startTime, 0);
      await this.handleExportFailure(error, request);
      throw error;
    }
  }

  /**
   * Export data to JSON format with streaming and size guards
   * Requirements: 8.1, 8.2, 8.4
   */
  async exportToJSON(request: ExportRequest): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      // Validate permissions
      const perm = await this.featureGate.checkExportPermission(
        request.userId,
        'json'
      );

      if (!perm.allowed) {
        throw new Error(perm.reason || 'JSON export not allowed for current plan');
      }

      // Validate and apply size limits
      const validatedRequest = await this.validateAndApplySizeLimits(request);

      // Create export job
      const job = await this.createExportJob(validatedRequest);

      // Set timeout for the entire operation
      const timeoutMs = validatedRequest.timeoutMs || this.DEFAULT_TIMEOUT_MS;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Export timeout exceeded')), timeoutMs);
      });

      const exportPromise = this.performStreamingExport(validatedRequest, job, 'json');

      const result = await Promise.race([exportPromise, timeoutPromise]) as ExportResult;

      // Record metrics
      await this.recordExportMetrics(request, 'success', Date.now() - startTime, result.recordCount);

      return result;
    } catch (error) {
      // Record failure metrics and alert
      await this.recordExportMetrics(request, 'failure', Date.now() - startTime, 0);
      await this.handleExportFailure(error, request);
      throw error;
    }
  }

  /**
   * Export Google Ads data to CSV format
   * Requirements: 12.1, 12.2, 12.3, 12.5
   */
  async exportGoogleAdsToCSV(request: ExportRequest): Promise<ExportResult> {
    // Validate permissions
    const perm = await this.featureGate.checkExportPermission(
      request.userId,
      'csv'
    );

    if (!perm.allowed) {
      throw new Error(perm.reason || 'CSV export not allowed for current plan');
    }

    // Create export job
    const job = await this.createExportJob({ ...request, platform: 'google' });

    try {
      // Fetch Google Ads data
      const data = await this.fetchGoogleAdsData(request);

      // Generate CSV content
      const csvContent = this.generateGoogleAdsCSV(data);

      // Store temporary file
      const result = await this.storeTemporaryFile(
        job.id,
        csvContent,
        'csv',
        request.userId
      );

      // Update job status
      await this.completeExportJob(job.id, result);

      // Send notification
      await this.sendCompletionNotification(job.id, request.userId, request.clientId, result.downloadUrl);

      return result;
    } catch (error) {
      await this.failExportJob(job.id, error instanceof Error ? error.message : 'Unknown error');
      await this.sendFailureNotification(job.id, request.userId);
      throw error;
    }
  }

  /**
   * Export Google Ads data to JSON format
   * Requirements: 12.1, 12.2, 12.3, 12.5
   */
  async exportGoogleAdsToJSON(request: ExportRequest): Promise<ExportResult> {
    // Validate permissions
    const perm = await this.featureGate.checkExportPermission(
      request.userId,
      'json'
    );

    if (!perm.allowed) {
      throw new Error(perm.reason || 'JSON export not allowed for current plan');
    }

    // Create export job
    const job = await this.createExportJob({ ...request, platform: 'google' });

    try {
      // Fetch Google Ads data
      const data = await this.fetchGoogleAdsData(request);

      // Generate JSON content
      const jsonContent = this.generateGoogleAdsJSON(data);

      // Store temporary file
      const result = await this.storeTemporaryFile(
        job.id,
        jsonContent,
        'json',
        request.userId
      );

      // Update job status
      await this.completeExportJob(job.id, result);

      // Send notification
      await this.sendCompletionNotification(job.id, request.userId, request.clientId, result.downloadUrl);

      return result;
    } catch (error) {
      await this.failExportJob(job.id, error instanceof Error ? error.message : 'Unknown error');
      await this.sendFailureNotification(job.id, request.userId);
      throw error;
    }
  }

  /**
   * Export unified data (Meta + Google) to CSV format
   * Requirements: 12.1, 12.2, 12.3, 12.5
   */
  async exportUnifiedToCSV(request: ExportRequest): Promise<ExportResult> {
    // Validate permissions
    const perm = await this.featureGate.checkExportPermission(
      request.userId,
      'csv'
    );

    if (!perm.allowed) {
      throw new Error(perm.reason || 'CSV export not allowed for current plan');
    }

    // Create export job
    const job = await this.createExportJob({ ...request, platform: 'unified' });

    try {
      // Fetch unified data from both platforms
      const data = await this.fetchUnifiedData(request);

      // Generate CSV content
      const csvContent = this.generateUnifiedCSV(data);

      // Store temporary file
      const result = await this.storeTemporaryFile(
        job.id,
        csvContent,
        'csv',
        request.userId
      );

      // Update job status
      await this.completeExportJob(job.id, result);

      // Send notification
      await this.sendCompletionNotification(job.id, request.userId, request.clientId, result.downloadUrl);

      return result;
    } catch (error) {
      await this.failExportJob(job.id, error instanceof Error ? error.message : 'Unknown error');
      await this.sendFailureNotification(job.id, request.userId);
      throw error;
    }
  }

  /**
   * Export unified data (Meta + Google) to JSON format
   * Requirements: 12.1, 12.2, 12.3, 12.5
   */
  async exportUnifiedToJSON(request: ExportRequest): Promise<ExportResult> {
    // Validate permissions
    const perm = await this.featureGate.checkExportPermission(
      request.userId,
      'json'
    );

    if (!perm.allowed) {
      throw new Error(perm.reason || 'JSON export not allowed for current plan');
    }

    // Create export job
    const job = await this.createExportJob({ ...request, platform: 'unified' });

    try {
      // Fetch unified data from both platforms
      const data = await this.fetchUnifiedData(request);

      // Generate JSON content
      const jsonContent = this.generateUnifiedJSON(data);

      // Store temporary file
      const result = await this.storeTemporaryFile(
        job.id,
        jsonContent,
        'json',
        request.userId
      );

      // Update job status
      await this.completeExportJob(job.id, result);

      // Send notification
      await this.sendCompletionNotification(job.id, request.userId, request.clientId, result.downloadUrl);

      return result;
    } catch (error) {
      await this.failExportJob(job.id, error instanceof Error ? error.message : 'Unknown error');
      await this.sendFailureNotification(job.id, request.userId);
      throw error;
    }
  }

  /**
   * Validate export permissions by plan
   * Requirements: 8.1, 8.2
   */
  async validatePermissions(
    userId: string,
    format: 'csv' | 'json'
  ): Promise<boolean> {
    const result = await this.featureGate.checkExportPermission(userId, format);
    return result.allowed;
  }

  /**
   * Get export job status
   */
  async getExportJob(jobId: string, userId: string): Promise<ExportJob | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ExportJob;
  }

  /**
   * Generate download URL for completed export
   * Requirements: 8.5
   */
  async getDownloadUrl(jobId: string, userId: string): Promise<string | null> {
    const job = await this.getExportJob(jobId, userId);

    if (!job || job.status !== 'completed' || !job.file_path) {
      return null;
    }

    // Check if expired
    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      return null;
    }

    const supabase = await createClient();

    // Generate signed URL using the exact stored file_path (valid for 1 hour)
    const { data } = await supabase.storage
      .from('exports')
      .createSignedUrl(job.file_path, 3600);

    return data?.signedUrl || null;
  }

  /**
   * Create export job record
   */
  private async createExportJob(request: ExportRequest): Promise<ExportJob> {
    const supabase = await createClient();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    const { data, error } = await supabase
      .from('export_jobs')
      .insert({
        user_id: request.userId,
        client_id: request.clientId,
        format: request.format,
        status: 'processing',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('Failed to create export job');
    }

    return data as ExportJob;
  }

  /**
   * Fetch Google Ads data for export
   * Requirements: 12.1, 12.2, 12.5
   */
  private async fetchGoogleAdsData(request: ExportRequest): Promise<GoogleAdsExportData[]> {
    const supabase = await createClient();

    // Validate date range against plan retention
    const retentionDays = await this.featureGate.getMaxRetentionDays(request.userId);
    
    const oldestAllowedDate = new Date();
    oldestAllowedDate.setDate(oldestAllowedDate.getDate() - retentionDays);

    const requestedFromDate = new Date(request.dateFrom);
    if (requestedFromDate < oldestAllowedDate) {
      throw new Error(`Data retention limit exceeded. Maximum ${retentionDays} days allowed.`);
    }

    // Get Google Ads campaigns and metrics
    let query = supabase
      .from('google_ads_campaigns')
      .select(`
        id,
        campaign_id,
        campaign_name,
        status,
        google_ads_metrics (
          date,
          impressions,
          clicks,
          conversions,
          cost,
          ctr,
          conversion_rate,
          cpc,
          cpa,
          roas,
          created_at
        )
      `)
      .eq('client_id', request.clientId)
      .gte('google_ads_metrics.date', request.dateFrom)
      .lte('google_ads_metrics.date', request.dateTo)
      .order('google_ads_metrics.date', { ascending: false });

    if (request.campaignIds && request.campaignIds.length > 0) {
      query = query.in('campaign_id', request.campaignIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch Google Ads export data: ${error.message}`);
    }

    // Flatten the data structure
    const exportData: GoogleAdsExportData[] = [];
    
    (data || []).forEach(campaign => {
      if (campaign.google_ads_metrics) {
        campaign.google_ads_metrics.forEach((metric: any) => {
          exportData.push({
            date: metric.date,
            platform: 'google',
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            impressions: metric.impressions || 0,
            clicks: metric.clicks || 0,
            conversions: metric.conversions || 0,
            cost: metric.cost || 0,
            ctr: metric.ctr,
            cpc: metric.cpc,
            cpa: metric.cpa,
            roas: metric.roas,
            conversion_rate: metric.conversion_rate,
            status: campaign.status,
            synced_at: metric.created_at,
          });
        });
      }
    });

    return exportData;
  }

  /**
   * Fetch unified data from both Meta and Google platforms
   * Requirements: 12.1, 12.2, 12.5
   */
  private async fetchUnifiedData(request: ExportRequest): Promise<UnifiedExportData[]> {
    const supabase = await createClient();

    // Validate date range against plan retention
    const retentionDays = await this.featureGate.getMaxRetentionDays(request.userId);
    
    const oldestAllowedDate = new Date();
    oldestAllowedDate.setDate(oldestAllowedDate.getDate() - retentionDays);

    const requestedFromDate = new Date(request.dateFrom);
    if (requestedFromDate < oldestAllowedDate) {
      throw new Error(`Data retention limit exceeded. Maximum ${retentionDays} days allowed.`);
    }

    const unifiedData: UnifiedExportData[] = [];

    // Fetch Meta Ads data
    try {
      const metaQuery = supabase
        .from('meta_campaigns')
        .select(`
          campaign_id,
          campaign_name,
          status,
          meta_campaign_insights (
            date_start,
            impressions,
            clicks,
            spend,
            conversions,
            ctr,
            cpc,
            cpm,
            conversion_rate,
            created_at
          )
        `)
        .eq('client_id', request.clientId)
        .gte('meta_campaign_insights.date_start', request.dateFrom)
        .lte('meta_campaign_insights.date_start', request.dateTo);

      const { data: metaData } = await metaQuery;

      (metaData || []).forEach(campaign => {
        if (campaign.meta_campaign_insights) {
          campaign.meta_campaign_insights.forEach((insight: any) => {
            const spend = parseFloat(insight.spend || '0');
            const clicks = parseInt(insight.clicks || '0');
            const conversions = parseFloat(insight.conversions || '0');
            
            unifiedData.push({
              date: insight.date_start,
              platform: 'meta',
              campaign_id: campaign.campaign_id,
              campaign_name: campaign.campaign_name,
              impressions: parseInt(insight.impressions || '0'),
              clicks,
              conversions,
              spend,
              ctr: parseFloat(insight.ctr || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              cpa: conversions > 0 ? spend / conversions : null,
              roas: spend > 0 ? (conversions * 50) / spend : null, // Assuming $50 per conversion
              conversion_rate: parseFloat(insight.conversion_rate || '0'),
              status: campaign.status,
              synced_at: insight.created_at,
            });
          });
        }
      });
    } catch (error) {
      console.warn('Failed to fetch Meta data for unified export:', error);
    }

    // Fetch Google Ads data
    try {
      const googleData = await this.fetchGoogleAdsData(request);
      
      googleData.forEach(item => {
        unifiedData.push({
          date: item.date,
          platform: 'google',
          campaign_id: item.campaign_id,
          campaign_name: item.campaign_name,
          impressions: item.impressions,
          clicks: item.clicks,
          conversions: item.conversions,
          spend: item.cost, // Google uses 'cost', unified uses 'spend'
          ctr: item.ctr,
          cpc: item.cpc,
          cpa: item.cpa,
          roas: item.roas,
          conversion_rate: item.conversion_rate,
          status: item.status,
          synced_at: item.synced_at,
        });
      });
    } catch (error) {
      console.warn('Failed to fetch Google Ads data for unified export:', error);
    }

    // Sort by date descending
    unifiedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return unifiedData;
  }

  /**
   * Fetch data for export within retention period
   * Requirements: 8.4
   */
  private async fetchExportData(request: ExportRequest): Promise<CampaignInsight[]> {
    const supabase = await createClient();

    // Validate date range against plan retention
    const retentionDays = await this.featureGate.getMaxRetentionDays(request.userId);
    
    const oldestAllowedDate = new Date();
    oldestAllowedDate.setDate(oldestAllowedDate.getDate() - retentionDays);

    const requestedFromDate = new Date(request.dateFrom);
    if (requestedFromDate < oldestAllowedDate) {
      throw new Error(`Data retention limit exceeded. Maximum ${retentionDays} days allowed.`);
    }

    let query = supabase
      .from('campaign_insights_history')
      .select('*')
      .eq('client_id', request.clientId)
      .gte('date', request.dateFrom)
      .lte('date', request.dateTo)
      .order('date', { ascending: false });

    if (request.platform) {
      query = query.eq('platform', request.platform);
    }

    if (request.campaignIds && request.campaignIds.length > 0) {
      query = query.in('campaign_id', request.campaignIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch export data: ${error.message}`);
    }

    return (data || []) as CampaignInsight[];
  }

  /**
   * Generate CSV content for Google Ads data
   */
  private generateGoogleAdsCSV(data: GoogleAdsExportData[]): string {
    if (data.length === 0) {
      return 'No Google Ads data available';
    }

    // CSV headers for Google Ads
    const headers = [
      'Date',
      'Platform',
      'Campaign ID',
      'Campaign Name',
      'Impressions',
      'Clicks',
      'Conversions',
      'Cost',
      'CTR (%)',
      'CPC',
      'CPA',
      'ROAS',
      'Conversion Rate (%)',
      'Status',
      'Synced At',
    ];

    // CSV rows
    const rows = data.map((item) => [
      item.date,
      item.platform,
      item.campaign_id,
      `"${item.campaign_name.replace(/"/g, '""')}"`, // Escape quotes
      item.impressions,
      item.clicks,
      item.conversions,
      item.cost.toFixed(2),
      item.ctr ? item.ctr.toFixed(2) : '',
      item.cpc ? item.cpc.toFixed(2) : '',
      item.cpa ? item.cpa.toFixed(2) : '',
      item.roas ? item.roas.toFixed(2) : '',
      item.conversion_rate ? item.conversion_rate.toFixed(2) : '',
      item.status,
      item.synced_at,
    ]);

    // Combine headers and rows
    const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

    return csvLines.join('\n');
  }

  /**
   * Generate JSON content for Google Ads data
   */
  private generateGoogleAdsJSON(data: GoogleAdsExportData[]): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      platform: 'google',
      recordCount: data.length,
      data: data,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate CSV content for unified data
   */
  private generateUnifiedCSV(data: UnifiedExportData[]): string {
    if (data.length === 0) {
      return 'No unified data available';
    }

    // CSV headers for unified data
    const headers = [
      'Date',
      'Platform',
      'Campaign ID',
      'Campaign Name',
      'Impressions',
      'Clicks',
      'Conversions',
      'Spend',
      'CTR (%)',
      'CPC',
      'CPA',
      'ROAS',
      'Conversion Rate (%)',
      'Status',
      'Synced At',
    ];

    // CSV rows
    const rows = data.map((item) => [
      item.date,
      item.platform,
      item.campaign_id,
      `"${item.campaign_name.replace(/"/g, '""')}"`, // Escape quotes
      item.impressions,
      item.clicks,
      item.conversions,
      item.spend.toFixed(2),
      item.ctr ? item.ctr.toFixed(2) : '',
      item.cpc ? item.cpc.toFixed(2) : '',
      item.cpa ? item.cpa.toFixed(2) : '',
      item.roas ? item.roas.toFixed(2) : '',
      item.conversion_rate ? item.conversion_rate.toFixed(2) : '',
      item.status,
      item.synced_at,
    ]);

    // Combine headers and rows
    const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

    return csvLines.join('\n');
  }

  /**
   * Generate JSON content for unified data
   */
  private generateUnifiedJSON(data: UnifiedExportData[]): string {
    // Group data by platform for better organization
    const metaData = data.filter(item => item.platform === 'meta');
    const googleData = data.filter(item => item.platform === 'google');

    const exportData = {
      exportedAt: new Date().toISOString(),
      platform: 'unified',
      recordCount: data.length,
      summary: {
        totalRecords: data.length,
        metaRecords: metaData.length,
        googleRecords: googleData.length,
        dateRange: {
          earliest: data.length > 0 ? data[data.length - 1].date : null,
          latest: data.length > 0 ? data[0].date : null,
        },
      },
      data: {
        all: data,
        byPlatform: {
          meta: metaData,
          google: googleData,
        },
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate CSV content from data
   */
  private generateCSV(data: CampaignInsight[]): string {
    if (data.length === 0) {
      return 'No data available';
    }

    // CSV headers
    const headers = [
      'Date',
      'Platform',
      'Campaign ID',
      'Campaign Name',
      'Impressions',
      'Clicks',
      'Spend',
      'Conversions',
      'CTR',
      'CPC',
      'CPM',
      'Conversion Rate',
      'Is Deleted',
      'Synced At',
    ];

    // CSV rows
    const rows = data.map((insight) => [
      insight.date,
      insight.platform,
      insight.campaign_id,
      `"${insight.campaign_name.replace(/"/g, '""')}"`, // Escape quotes
      insight.impressions,
      insight.clicks,
      insight.spend,
      insight.conversions,
      insight.ctr || '',
      insight.cpc || '',
      insight.cpm || '',
      insight.conversion_rate || '',
      insight.is_deleted ? 'Yes' : 'No',
      insight.synced_at,
    ]);

    // Combine headers and rows
    const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

    return csvLines.join('\n');
  }

  /**
   * Generate JSON content from data
   */
  private generateJSON(data: CampaignInsight[]): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      recordCount: data.length,
      data: data,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Store temporary file in storage
   * Requirements: 8.5
   */
  private async storeTemporaryFile(
    jobId: string,
    content: string,
    format: 'csv' | 'json',
    userId: string
  ): Promise<ExportResult> {
    const supabase = await createClient();

    const fileName = `export-${jobId}.${format}`;
    const filePath = `${userId}/${fileName}`;
    const fileSize = Buffer.byteLength(content, 'utf8');

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(filePath, content, {
        contentType: format === 'csv' ? 'text/csv' : 'application/json',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload export file: ${uploadError.message}`);
    }

    // Generate signed URL
    const { data: urlData } = await supabase.storage
      .from('exports')
      .createSignedUrl(filePath, 86400); // 24 hours

    if (!urlData?.signedUrl) {
      throw new Error('Failed to generate download URL');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const recordCount = content.split('\n').length - 1; // Subtract header row

    return {
      id: jobId,
      format,
      fileName,
      fileSize,
      recordCount,
      downloadUrl: urlData.signedUrl,
      expiresAt,
      createdAt: new Date(),
      storagePath: filePath,
    };
  }

  /**
   * Complete export job
   */
  private async completeExportJob(
    jobId: string,
    result: ExportResult
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('export_jobs')
      .update({
        status: 'completed',
        file_path: result.storagePath,
        file_size: result.fileSize,
        record_count: result.recordCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  /**
   * Mark export job as failed
   */
  private async failExportJob(jobId: string, errorMessage: string): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('export_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<number> {
    const supabase = await createClient();

    // Get expired jobs
    const { data: expiredJobs } = await supabase
      .from('export_jobs')
      .select('id, file_path')
      .eq('status', 'completed')
      .lt('expires_at', new Date().toISOString());

    if (!expiredJobs || expiredJobs.length === 0) {
      return 0;
    }

    // Delete files from storage using exact file_path values
    for (const job of expiredJobs) {
      if (job.file_path) {
        await supabase.storage.from('exports').remove([job.file_path]);
      }
    }

    // Delete job records
    await supabase
      .from('export_jobs')
      .delete()
      .in('id', expiredJobs.map((j) => j.id));

    return expiredJobs.length;
  }

  /**
   * Send completion notification
   * Requirements: 8.5
   */
  private async sendCompletionNotification(
    jobId: string,
    userId: string,
    clientId: string,
    downloadUrl: string
  ): Promise<void> {
    try {
      const job = await this.getExportJob(jobId, userId);
      if (!job) return;

      const userData = await this.notificationService.getUserAndClientData(
        userId,
        clientId
      );

      if (!userData) return;

      await this.notificationService.sendExportCompletionNotification({
        exportJob: job,
        downloadUrl,
        user: userData.user,
        client: userData.client,
      });
    } catch (error) {
      console.error('Error sending completion notification:', error);
      // Don't throw - notification failure shouldn't break export
    }
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(
    jobId: string,
    userId: string
  ): Promise<void> {
    try {
      const job = await this.getExportJob(jobId, userId);
      if (!job) return;

      const supabase = await createClient();
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .single();

      if (!userData) return;

      await this.notificationService.sendExportFailureNotification(job, {
        id: userData.id,
        email: userData.email,
        name: userData.full_name,
      });
    } catch (error) {
      console.error('Error sending failure notification:', error);
      // Don't throw - notification failure shouldn't break export
    }
  }

  /**
   * Validate request and apply size limits
   */
  private async validateAndApplySizeLimits(request: ExportRequest): Promise<ExportRequest> {
    // Apply default max rows if not specified
    const maxRows = request.maxRows || this.MAX_ROWS_DEFAULT;
    
    // Estimate data size before fetching
    const estimatedSize = await this.estimateExportSize(request);
    
    if (estimatedSize.estimatedRows > maxRows) {
      throw new Error(`Export would exceed maximum rows limit (${maxRows}). Estimated: ${estimatedSize.estimatedRows} rows. Please narrow your date range or use filters.`);
    }
    
    if (estimatedSize.estimatedSizeMB > this.MAX_FILE_SIZE_MB) {
      throw new Error(`Export would exceed maximum file size (${this.MAX_FILE_SIZE_MB}MB). Estimated: ${estimatedSize.estimatedSizeMB.toFixed(2)}MB. Please narrow your date range or use filters.`);
    }

    return {
      ...request,
      maxRows,
      streaming: estimatedSize.estimatedRows > this.CHUNK_SIZE,
    };
  }

  /**
   * Estimate export size before processing
   */
  private async estimateExportSize(request: ExportRequest): Promise<{
    estimatedRows: number;
    estimatedSizeMB: number;
  }> {
    const supabase = await createClient();

    // Count rows that would be exported
    let countQuery = supabase
      .from('campaign_insights_history')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', request.clientId)
      .gte('date', request.dateFrom)
      .lte('date', request.dateTo);

    if (request.platform) {
      countQuery = countQuery.eq('platform', request.platform);
    }

    if (request.campaignIds && request.campaignIds.length > 0) {
      countQuery = countQuery.in('campaign_id', request.campaignIds);
    }

    const { count, error } = await countQuery;

    if (error) {
      console.warn('Failed to estimate export size:', error);
      // Return conservative estimate
      return { estimatedRows: 10000, estimatedSizeMB: 5 };
    }

    const estimatedRows = count || 0;
    // Estimate ~500 bytes per row for CSV (conservative)
    const estimatedSizeMB = (estimatedRows * 500) / (1024 * 1024);

    return { estimatedRows, estimatedSizeMB };
  }

  /**
   * Perform streaming export with chunked processing
   */
  private async performStreamingExport(
    request: ExportRequest,
    job: ExportJob,
    format: 'csv' | 'json'
  ): Promise<ExportResult> {
    if (request.streaming) {
      return await this.performChunkedExport(request, job, format);
    } else {
      return await this.performStandardExport(request, job, format);
    }
  }

  /**
   * Perform chunked export for large datasets
   */
  private async performChunkedExport(
    request: ExportRequest,
    job: ExportJob,
    format: 'csv' | 'json'
  ): Promise<ExportResult> {
    const supabase = await createClient();
    const fileName = `export-${job.id}.${format}`;
    const filePath = `${request.userId}/${fileName}`;

    let totalRecords = 0;
    let offset = 0;
    const chunks: string[] = [];

    // Add headers for CSV
    if (format === 'csv') {
      chunks.push(this.getCSVHeaders());
    }

    while (true) {
      // Fetch chunk with timeout
      const chunkPromise = this.fetchDataChunk(request, offset, this.CHUNK_SIZE);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Chunk fetch timeout')), 30000); // 30s per chunk
      });

      const chunk = await Promise.race([chunkPromise, timeoutPromise]) as CampaignInsight[];

      if (chunk.length === 0) break;

      // Process chunk
      const chunkContent = format === 'csv' 
        ? this.generateCSVChunk(chunk)
        : this.generateJSONChunk(chunk, offset === 0);

      chunks.push(chunkContent);
      totalRecords += chunk.length;
      offset += this.CHUNK_SIZE;

      // Check if we've hit the max rows limit
      if (request.maxRows && totalRecords >= request.maxRows) {
        break;
      }
    }

    // Combine chunks
    let finalContent: string;
    if (format === 'csv') {
      finalContent = chunks.join('\n');
    } else {
      // For JSON, wrap chunks in array
      const dataChunks = chunks.slice(1); // Remove opening bracket
      finalContent = `{"exportedAt":"${new Date().toISOString()}","recordCount":${totalRecords},"data":[${dataChunks.join(',')}]}`;
    }

    // Upload to storage
    const fileSize = Buffer.byteLength(finalContent, 'utf8');
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(filePath, finalContent, {
        contentType: format === 'csv' ? 'text/csv' : 'application/json',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload export file: ${uploadError.message}`);
    }

    // Generate signed URL
    const { data: urlData } = await supabase.storage
      .from('exports')
      .createSignedUrl(filePath, 86400); // 24 hours

    if (!urlData?.signedUrl) {
      throw new Error('Failed to generate download URL');
    }

    const result: ExportResult = {
      id: job.id,
      format,
      fileName,
      fileSize,
      recordCount: totalRecords,
      downloadUrl: urlData.signedUrl,
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      createdAt: new Date(),
      storagePath: filePath,
    };

    // Update job status
    await this.completeExportJob(job.id, result);

    // Send notification
    await this.sendCompletionNotification(job.id, request.userId, request.clientId, result.downloadUrl);

    return result;
  }

  /**
   * Perform standard export for smaller datasets
   */
  private async performStandardExport(
    request: ExportRequest,
    job: ExportJob,
    format: 'csv' | 'json'
  ): Promise<ExportResult> {
    // Fetch data within retention period
    const data = await this.fetchExportData(request);

    // Generate content
    const content = format === 'csv' 
      ? this.generateCSV(data)
      : this.generateJSON(data);

    // Store temporary file
    const result = await this.storeTemporaryFile(
      job.id,
      content,
      format,
      request.userId
    );

    // Update job status
    await this.completeExportJob(job.id, result);

    // Send notification
    await this.sendCompletionNotification(job.id, request.userId, request.clientId, result.downloadUrl);

    return result;
  }

  /**
   * Fetch data chunk with pagination
   */
  private async fetchDataChunk(
    request: ExportRequest,
    offset: number,
    limit: number
  ): Promise<CampaignInsight[]> {
    const supabase = await createClient();

    let query = supabase
      .from('campaign_insights_history')
      .select('*')
      .eq('client_id', request.clientId)
      .gte('date', request.dateFrom)
      .lte('date', request.dateTo)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (request.platform) {
      query = query.eq('platform', request.platform);
    }

    if (request.campaignIds && request.campaignIds.length > 0) {
      query = query.in('campaign_id', request.campaignIds);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch export data chunk: ${error.message}`);
    }

    return (data || []) as CampaignInsight[];
  }

  /**
   * Get CSV headers
   */
  private getCSVHeaders(): string {
    return [
      'Date',
      'Platform',
      'Campaign ID',
      'Campaign Name',
      'Impressions',
      'Clicks',
      'Spend',
      'Conversions',
      'CTR',
      'CPC',
      'CPM',
      'Conversion Rate',
      'Is Deleted',
      'Synced At',
    ].join(',');
  }

  /**
   * Generate CSV chunk
   */
  private generateCSVChunk(data: CampaignInsight[]): string {
    return data.map((insight) => [
      insight.date,
      insight.platform,
      insight.campaign_id,
      `"${insight.campaign_name.replace(/"/g, '""')}"`,
      insight.impressions,
      insight.clicks,
      insight.spend,
      insight.conversions,
      insight.ctr || '',
      insight.cpc || '',
      insight.cpm || '',
      insight.conversion_rate || '',
      insight.is_deleted ? 'Yes' : 'No',
      insight.synced_at,
    ].join(',')).join('\n');
  }

  /**
   * Generate JSON chunk
   */
  private generateJSONChunk(data: CampaignInsight[], isFirst: boolean): string {
    const jsonData = data.map(item => JSON.stringify(item)).join(',');
    return isFirst ? jsonData : ',' + jsonData;
  }

  /**
   * Record export metrics for monitoring
   */
  private async recordExportMetrics(
    request: ExportRequest,
    status: 'success' | 'failure',
    durationMs: number,
    recordCount: number
  ): Promise<void> {
    try {
      await this.observabilityService.recordExportMetrics({
        user_id: request.userId,
        client_id: request.clientId,
        platform: request.platform || 'all',
        format: request.format,
        status,
        duration_ms: durationMs,
        record_count: recordCount,
        file_size_mb: 0, // Would need to calculate actual size
      });
    } catch (error) {
      console.error('Failed to record export metrics:', error);
      // Don't throw - metrics failure shouldn't break export
    }
  }

  /**
   * Handle export failure with alerting
   */
  private async handleExportFailure(error: unknown, request: ExportRequest): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
    
    try {
      // Check if this is a recurring failure pattern
      const recentFailures = await this.getRecentExportFailures(request.userId, request.format);
      
      if (recentFailures >= 3) {
        // Alert on repeated failures
        await this.alertService.createAlert({
          type: 'export_failures',
          severity: 'warning',
          title: 'Repeated Export Failures',
          message: `User ${request.userId} has had ${recentFailures} export failures in the last hour`,
          metadata: {
            user_id: request.userId,
            client_id: request.clientId,
            format: request.format,
            platform: request.platform,
            error_message: errorMessage,
            failure_count: recentFailures,
          },
        });
      }
    } catch (alertError) {
      console.error('Failed to handle export failure alerting:', alertError);
    }
  }

  /**
   * Get recent export failures for a user
   */
  private async getRecentExportFailures(userId: string, format: string): Promise<number> {
    const supabase = await createClient();
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { count } = await supabase
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('format', format)
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo.toISOString());

    return count || 0;
  }
}
