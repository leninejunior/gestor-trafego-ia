/**
 * Google Ads Types
 * Shared types for Google Ads integration
 */

// Re-export types from client for consistency
export type {
  GoogleAdsCampaign,
  GoogleAdsMetrics,
  GoogleAdsAccountInfo,
  DateRange,
  TokenResponse,
  GoogleAdsApiResponse
} from '@/lib/google/client';

/**
 * Aggregated metrics across campaigns
 */
export interface AggregatedMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageConversionRate: number;
  averageCpc: number;
  averageCpa: number;
  averageRoas: number;
  campaignCount: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Sync status information
 */
export interface SyncStatus {
  lastSyncAt: Date;
  status: 'idle' | 'syncing' | 'error' | 'completed';
  progress?: number; // 0-100
  nextScheduledSync?: Date;
  campaignsSynced?: number;
  metricsUpdated?: number;
  errorMessage?: string;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  isConnected: boolean;
  customerId?: string;
  accountName?: string;
  lastSyncAt?: Date;
  tokenExpiresAt?: Date;
  status: 'active' | 'expired' | 'revoked' | 'error';
}

/**
 * Campaign filters for caching
 */
export interface CampaignFilters {
  status?: 'ENABLED' | 'PAUSED' | 'REMOVED';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'name' | 'status' | 'spend' | 'conversions';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Metrics query parameters
 */
export interface MetricsQuery {
  campaignId?: string;
  campaignIds?: string[];
  dateFrom: string;
  dateTo: string;
  metrics?: string[];
  groupBy?: 'day' | 'week' | 'month';
}

/**
 * Cache invalidation event
 */
export interface CacheInvalidationEvent {
  type: 'sync_completed' | 'campaign_updated' | 'manual_refresh';
  clientId: string;
  campaignIds?: string[];
  timestamp: Date;
}