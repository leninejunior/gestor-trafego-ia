/**
 * Multi-Platform Sync Types
 * Base types and interfaces for syncing data from multiple ad platforms
 */

/**
 * Supported advertising platforms
 */
export enum AdPlatform {
  META = 'meta',
  GOOGLE = 'google'
}

/**
 * Sync configuration for a client's ad platform connection
 */
export interface SyncConfig {
  id: string;
  platform: AdPlatform;
  client_id: string;
  account_id: string;
  
  // OAuth tokens
  access_token: string;
  refresh_token?: string;
  token_expires_at?: Date;
  
  // Sync scheduling
  last_sync_at?: Date;
  next_sync_at?: Date;
  sync_status: 'pending' | 'active' | 'paused' | 'error';
  last_error?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}

/**
 * Universal campaign insight data structure
 * Normalized across all platforms
 */
export interface CampaignInsight {
  id: string;
  platform: AdPlatform;
  client_id: string;
  campaign_id: string;
  campaign_name: string;
  date: Date;
  
  // Universal metrics
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  
  // Calculated metrics
  ctr: number;          // Click-through rate
  cpc: number;          // Cost per click
  cpm: number;          // Cost per mille (thousand impressions)
  conversion_rate: number;
  
  // Metadata
  is_deleted: boolean;
  synced_at: Date;
}

/**
 * Query parameters for retrieving historical data
 */
export interface DataQuery {
  client_id: string;
  platform?: AdPlatform;
  campaign_ids?: string[];
  date_from: Date;
  date_to: Date;
  metrics?: string[];
  
  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Date range for data queries
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Campaign basic information
 */
export interface Campaign {
  id: string;
  name: string;
  status: string;
  platform: AdPlatform;
  account_id: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  platform: AdPlatform;
  client_id: string;
  records_synced: number;
  records_failed: number;
  started_at: Date;
  completed_at: Date;
  duration_ms: number;
  error?: string;
}

/**
 * Storage statistics for a client
 */
export interface StorageStats {
  client_id: string;
  total_records: number;
  total_size_bytes: number;
  oldest_record_date?: Date;
  newest_record_date?: Date;
  platforms: {
    platform: AdPlatform;
    record_count: number;
  }[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
