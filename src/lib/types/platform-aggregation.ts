/**
 * Types for Platform Aggregation Service
 * 
 * Defines interfaces for multi-platform data aggregation and comparison
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

// ============================================================================
// Base Platform Types
// ============================================================================

export type Platform = 'meta' | 'google';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// ============================================================================
// Platform-Specific Metrics
// ============================================================================

export interface PlatformMetrics {
  platform: Platform;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  reach?: number; // Meta specific
  frequency?: number; // Meta specific
  conversionRate: number;
}

export interface MetaPlatformMetrics extends PlatformMetrics {
  platform: 'meta';
  reach: number;
  frequency: number;
  cpm: number;
}

export interface GooglePlatformMetrics extends PlatformMetrics {
  platform: 'google';
  qualityScore?: number;
  searchImpressionShare?: number;
}

// ============================================================================
// Aggregated Metrics
// ============================================================================

export interface AggregatedMetrics {
  total: {
    spend: number;
    conversions: number;
    impressions: number;
    clicks: number;
    averageRoas: number;
    averageCtr: number;
    averageCpc: number;
    averageCpa: number;
    averageConversionRate: number;
  };
  byPlatform: PlatformMetrics[];
  dateRange: DateRange;
  lastUpdated: Date;
  dataQuality: {
    metaDataAvailable: boolean;
    googleDataAvailable: boolean;
    totalCampaigns: number;
    metaCampaigns: number;
    googleCampaigns: number;
  };
}

// ============================================================================
// Platform Comparison
// ============================================================================

export interface PlatformComparison {
  dateRange: DateRange;
  platforms: {
    meta?: PlatformMetrics;
    google?: PlatformMetrics;
  };
  comparison: {
    betterPerformingPlatform: Platform | null;
    metrics: {
      spend: PlatformComparisonMetric;
      conversions: PlatformComparisonMetric;
      roas: PlatformComparisonMetric;
      ctr: PlatformComparisonMetric;
      cpc: PlatformComparisonMetric;
      cpa: PlatformComparisonMetric;
    };
  };
  insights: string[];
}

export interface PlatformComparisonMetric {
  meta?: number;
  google?: number;
  difference?: number; // Percentage difference
  winner?: Platform | 'tie';
  significance: 'high' | 'medium' | 'low' | 'none';
}

// ============================================================================
// Campaign Data Structures
// ============================================================================

export interface NormalizedCampaign {
  id: string;
  name: string;
  platform: Platform;
  status: 'active' | 'paused' | 'removed';
  budget: number;
  metrics: PlatformMetrics;
  dateRange: DateRange;
}

export interface CampaignAggregation {
  campaigns: NormalizedCampaign[];
  totalCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  totalMetrics: PlatformMetrics;
}

// ============================================================================
// Service Options and Filters
// ============================================================================

export interface AggregationOptions {
  clientId: string;
  dateRange: DateRange;
  platforms?: Platform[];
  includeInactive?: boolean;
  groupBy?: 'day' | 'week' | 'month';
  currency?: string;
}

export interface ComparisonOptions {
  clientId: string;
  dateRange: DateRange;
  comparisonDateRange?: DateRange;
  metrics?: string[];
  includeInsights?: boolean;
}

// ============================================================================
// Time Series Data
// ============================================================================

export interface TimeSeriesDataPoint {
  date: string;
  meta?: PlatformMetrics;
  google?: PlatformMetrics;
  total?: PlatformMetrics;
}

export interface TimeSeriesData {
  dateRange: DateRange;
  granularity: 'day' | 'week' | 'month';
  dataPoints: TimeSeriesDataPoint[];
}

// ============================================================================
// Performance Insights
// ============================================================================

export interface PerformanceInsight {
  type: 'opportunity' | 'warning' | 'success' | 'info';
  platform?: Platform;
  metric: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  recommendation?: string;
}

export interface InsightsReport {
  clientId: string;
  dateRange: DateRange;
  insights: PerformanceInsight[];
  summary: {
    totalInsights: number;
    highImpactInsights: number;
    actionableInsights: number;
    platformSpecificInsights: {
      meta: number;
      google: number;
      unified: number;
    };
  };
}

// ============================================================================
// Error Handling
// ============================================================================

export interface PlatformDataError {
  platform: Platform;
  error: string;
  code?: string;
  retryable: boolean;
}

export interface AggregationResult<T> {
  success: boolean;
  data?: T;
  errors: PlatformDataError[];
  warnings: string[];
  partialData: boolean;
}

// ============================================================================
// Export Configuration
// ============================================================================

export interface ExportConfiguration {
  format: 'csv' | 'json' | 'xlsx';
  includeRawData: boolean;
  includePlatformBreakdown: boolean;
  includeTimeSeriesData: boolean;
  includeInsights: boolean;
  dateRange: DateRange;
  platforms: Platform[];
}

// ============================================================================
// Utility Types
// ============================================================================

export type MetricKey = keyof Omit<PlatformMetrics, 'platform'>;

export type AggregationFunction = 'sum' | 'average' | 'weighted_average' | 'max' | 'min';

export interface WeightedMetric {
  value: number;
  weight: number; // Usually spend or impressions
}

export interface NormalizationConfig {
  currency: string;
  timezone: string;
  excludeWeekends?: boolean;
  minimumSpend?: number;
}