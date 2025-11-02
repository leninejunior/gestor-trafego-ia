/**
 * Platform Aggregation Service
 * 
 * Combines and normalizes data from Meta Ads and Google Ads platforms
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { createClient } from '@/lib/supabase/server';
import {
  Platform,
  PlatformMetrics,
  AggregatedMetrics,
  PlatformComparison,
  DateRange,
  AggregationOptions,
  ComparisonOptions,
  NormalizedCampaign,
  TimeSeriesData,
  TimeSeriesDataPoint,
  PerformanceInsight,
  InsightsReport,
  AggregationResult,
  PlatformDataError,
  MetricKey,
  WeightedMetric,
} from '@/lib/types/platform-aggregation';

// ============================================================================
// Platform Aggregation Service Class
// ============================================================================

export class PlatformAggregationService {
  
  // ==========================================================================
  // Main Aggregation Methods
  // ==========================================================================

  /**
   * Get aggregated metrics from both Meta and Google platforms
   */
  async getAggregatedMetrics(options: AggregationOptions): Promise<AggregationResult<AggregatedMetrics>> {
    const errors: PlatformDataError[] = [];
    const warnings: string[] = [];
    let partialData = false;

    try {
      // Fetch data from both platforms in parallel
      const [metaResult, googleResult] = await Promise.allSettled([
        this.getMetaPlatformMetrics(options),
        this.getGooglePlatformMetrics(options),
      ]);

      // Process Meta results
      let metaMetrics: PlatformMetrics | null = null;
      if (metaResult.status === 'fulfilled' && metaResult.value) {
        metaMetrics = metaResult.value;
      } else if (metaResult.status === 'rejected') {
        errors.push({
          platform: 'meta',
          error: metaResult.reason?.message || 'Failed to fetch Meta data',
          retryable: true,
        });
        partialData = true;
      }

      // Process Google results
      let googleMetrics: PlatformMetrics | null = null;
      if (googleResult.status === 'fulfilled' && googleResult.value) {
        googleMetrics = googleResult.value;
      } else if (googleResult.status === 'rejected') {
        errors.push({
          platform: 'google',
          error: googleResult.reason?.message || 'Failed to fetch Google data',
          retryable: true,
        });
        partialData = true;
      }

      // If no data from either platform, return error
      if (!metaMetrics && !googleMetrics) {
        return {
          success: false,
          errors,
          warnings,
          partialData: true,
        };
      }

      // Aggregate the metrics
      const platformMetrics = [metaMetrics, googleMetrics].filter(Boolean) as PlatformMetrics[];
      const aggregated = this.aggregateMetrics(platformMetrics, options.dateRange);

      // Get campaign counts
      const [metaCampaignCount, googleCampaignCount] = await Promise.all([
        this.getCampaignCount(options.clientId, 'meta'),
        this.getCampaignCount(options.clientId, 'google'),
      ]);

      const result: AggregatedMetrics = {
        ...aggregated,
        dataQuality: {
          metaDataAvailable: !!metaMetrics,
          googleDataAvailable: !!googleMetrics,
          totalCampaigns: metaCampaignCount + googleCampaignCount,
          metaCampaigns: metaCampaignCount,
          googleCampaigns: googleCampaignCount,
        },
      };

      return {
        success: true,
        data: result,
        errors,
        warnings,
        partialData,
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          platform: 'meta' as Platform,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          retryable: true,
        }],
        warnings,
        partialData: true,
      };
    }
  }

  /**
   * Compare performance between Meta and Google platforms
   */
  async comparePlatforms(options: ComparisonOptions): Promise<AggregationResult<PlatformComparison>> {
    const errors: PlatformDataError[] = [];
    const warnings: string[] = [];

    try {
      const aggregationOptions: AggregationOptions = {
        clientId: options.clientId,
        dateRange: options.dateRange,
        platforms: ['meta', 'google'],
      };

      const aggregatedResult = await this.getAggregatedMetrics(aggregationOptions);
      
      if (!aggregatedResult.success || !aggregatedResult.data) {
        return {
          success: false,
          errors: aggregatedResult.errors,
          warnings: aggregatedResult.warnings,
          partialData: true,
        };
      }

      const { byPlatform } = aggregatedResult.data;
      const metaMetrics = byPlatform.find(p => p.platform === 'meta');
      const googleMetrics = byPlatform.find(p => p.platform === 'google');

      const comparison = this.buildPlatformComparison(
        metaMetrics,
        googleMetrics,
        options.dateRange
      );

      // Add insights if requested
      if (options.includeInsights) {
        comparison.insights = this.generateComparisonInsights(metaMetrics, googleMetrics);
      }

      return {
        success: true,
        data: comparison,
        errors: aggregatedResult.errors,
        warnings: aggregatedResult.warnings,
        partialData: aggregatedResult.partialData,
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          platform: 'meta' as Platform,
          error: error instanceof Error ? error.message : 'Comparison failed',
          retryable: true,
        }],
        warnings,
        partialData: true,
      };
    }
  }

  /**
   * Get time series data for trend analysis
   */
  async getTimeSeriesData(
    clientId: string,
    dateRange: DateRange,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<AggregationResult<TimeSeriesData>> {
    const errors: PlatformDataError[] = [];
    const warnings: string[] = [];

    try {
      const datePoints = this.generateDatePoints(dateRange, granularity);
      const dataPoints: TimeSeriesDataPoint[] = [];

      for (const date of datePoints) {
        const dayRange: DateRange = {
          startDate: date,
          endDate: date,
        };

        const options: AggregationOptions = {
          clientId,
          dateRange: dayRange,
          platforms: ['meta', 'google'],
        };

        const dayResult = await this.getAggregatedMetrics(options);
        
        if (dayResult.success && dayResult.data) {
          const { byPlatform, total } = dayResult.data;
          
          dataPoints.push({
            date,
            meta: byPlatform.find(p => p.platform === 'meta'),
            google: byPlatform.find(p => p.platform === 'google'),
            total: {
              platform: 'meta' as Platform, // Placeholder
              ...total,
            },
          });
        }

        // Collect any errors
        if (dayResult.errors.length > 0) {
          errors.push(...dayResult.errors);
        }
      }

      return {
        success: true,
        data: {
          dateRange,
          granularity,
          dataPoints,
        },
        errors,
        warnings,
        partialData: errors.length > 0,
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          platform: 'meta' as Platform,
          error: error instanceof Error ? error.message : 'Time series generation failed',
          retryable: true,
        }],
        warnings,
        partialData: true,
      };
    }
  }

  // ==========================================================================
  // Platform-Specific Data Fetchers
  // ==========================================================================

  /**
   * Fetch and normalize Meta platform metrics
   */
  private async getMetaPlatformMetrics(options: AggregationOptions): Promise<PlatformMetrics | null> {
    const supabase = await createClient();

    // Check if client has Meta connection
    const { data: connection } = await supabase
      .from('client_meta_connections')
      .select('*')
      .eq('client_id', options.clientId)
      .eq('is_active', true)
      .single();

    if (!connection) {
      return null;
    }

    // For now, return mock data since we don't have insights table yet
    // This will be replaced with real Meta API calls later
    return {
      platform: 'meta',
      spend: 1250.50,
      conversions: 45,
      impressions: 45000,
      clicks: 890,
      roas: 2.5,
      ctr: 1.98,
      cpc: 1.40,
      cpa: 27.79,
      conversionRate: 5.06,
      campaigns: [
        {
          id: 'meta_campaign_1',
          name: 'Campanha Meta - Vendas Q4',
          platform: 'meta',
          status: 'ACTIVE',
          spend: 1250.50,
          conversions: 45,
          impressions: 45000,
          clicks: 890,
          roas: 2.5,
          ctr: 1.98,
          cpc: 1.40,
          cpa: 27.79,
          conversionRate: 5.06,
          startDate: options.dateRange.startDate,
          endDate: options.dateRange.endDate,
        }
      ],
    };
  }

  /**
   * Fetch and normalize Google platform metrics
   */
  private async getGooglePlatformMetrics(options: AggregationOptions): Promise<PlatformMetrics | null> {
    const supabase = await createClient();

    // Check if client has Google connection
    const { data: connection } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', options.clientId)
      .eq('status', 'active')
      .single();

    if (!connection) {
      return null;
    }

    // Get Google campaigns and their metrics
    const { data: campaigns } = await supabase
      .from('google_ads_campaigns')
      .select(`
        *,
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
          roas
        )
      `)
      .eq('client_id', options.clientId)
      .gte('google_ads_metrics.date', options.dateRange.startDate)
      .lte('google_ads_metrics.date', options.dateRange.endDate);

    if (!campaigns || campaigns.length === 0) {
      return this.getEmptyPlatformMetrics('google');
    }

    // Aggregate Google metrics
    return this.aggregateGoogleCampaigns(campaigns);
  }

  // ==========================================================================
  // Aggregation Logic
  // ==========================================================================

  /**
   * Aggregate metrics from multiple platforms
   */
  private aggregateMetrics(platformMetrics: PlatformMetrics[], dateRange: DateRange): Omit<AggregatedMetrics, 'dataQuality'> {
    if (platformMetrics.length === 0) {
      return {
        total: this.getEmptyTotalMetrics(),
        byPlatform: [],
        dateRange,
        lastUpdated: new Date(),
      };
    }

    // Calculate totals
    const total = {
      spend: this.sumMetric(platformMetrics, 'spend'),
      conversions: this.sumMetric(platformMetrics, 'conversions'),
      impressions: this.sumMetric(platformMetrics, 'impressions'),
      clicks: this.sumMetric(platformMetrics, 'clicks'),
      averageRoas: this.calculateWeightedAverage(platformMetrics, 'roas', 'spend'),
      averageCtr: this.calculateWeightedAverage(platformMetrics, 'ctr', 'impressions'),
      averageCpc: this.calculateWeightedAverage(platformMetrics, 'cpc', 'clicks'),
      averageCpa: this.calculateWeightedAverage(platformMetrics, 'cpa', 'conversions'),
      averageConversionRate: this.calculateWeightedAverage(platformMetrics, 'conversionRate', 'clicks'),
    };

    return {
      total,
      byPlatform: platformMetrics,
      dateRange,
      lastUpdated: new Date(),
    };
  }

  /**
   * Aggregate Meta campaign data
   */
  private aggregateMetaCampaigns(campaigns: any[]): PlatformMetrics {
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalReach = 0;
    let weightedCpm = 0;
    let weightedCpc = 0;
    let weightedCtr = 0;
    let weightedConversionRate = 0;

    campaigns.forEach(campaign => {
      if (campaign.meta_campaign_insights) {
        campaign.meta_campaign_insights.forEach((insight: any) => {
          const spend = parseFloat(insight.spend || '0');
          const impressions = parseInt(insight.impressions || '0');
          const clicks = parseInt(insight.clicks || '0');
          const conversions = parseFloat(insight.conversions || '0');
          const reach = parseInt(insight.reach || '0');
          const cpm = parseFloat(insight.cpm || '0');
          const cpc = parseFloat(insight.cpc || '0');
          const ctr = parseFloat(insight.ctr || '0');
          const conversionRate = parseFloat(insight.conversion_rate || '0');

          totalSpend += spend;
          totalImpressions += impressions;
          totalClicks += clicks;
          totalConversions += conversions;
          totalReach += reach;

          // Weighted averages
          weightedCpm += cpm * impressions;
          weightedCpc += cpc * clicks;
          weightedCtr += ctr * impressions;
          weightedConversionRate += conversionRate * clicks;
        });
      }
    });

    // Calculate final metrics
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const roas = totalSpend > 0 ? (totalConversions * 50) / totalSpend : 0; // Assuming $50 per conversion
    const frequency = totalReach > 0 ? totalImpressions / totalReach : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

    return {
      platform: 'meta',
      spend: totalSpend,
      conversions: totalConversions,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr,
      cpc,
      cpa,
      roas,
      reach: totalReach,
      frequency,
      conversionRate,
    };
  }

  /**
   * Aggregate Google campaign data
   */
  private aggregateGoogleCampaigns(campaigns: any[]): PlatformMetrics {
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let weightedCtr = 0;
    let weightedConversionRate = 0;
    let weightedRoas = 0;

    campaigns.forEach(campaign => {
      if (campaign.google_ads_metrics) {
        campaign.google_ads_metrics.forEach((metric: any) => {
          const spend = parseFloat(metric.cost || '0');
          const impressions = parseInt(metric.impressions || '0');
          const clicks = parseInt(metric.clicks || '0');
          const conversions = parseFloat(metric.conversions || '0');
          const ctr = parseFloat(metric.ctr || '0');
          const conversionRate = parseFloat(metric.conversion_rate || '0');
          const roas = parseFloat(metric.roas || '0');

          totalSpend += spend;
          totalImpressions += impressions;
          totalClicks += clicks;
          totalConversions += conversions;

          // Weighted averages
          weightedCtr += ctr * impressions;
          weightedConversionRate += conversionRate * clicks;
          weightedRoas += roas * spend;
        });
      }
    });

    // Calculate final metrics
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const roas = totalSpend > 0 ? weightedRoas / totalSpend : 0;

    return {
      platform: 'google',
      spend: totalSpend,
      conversions: totalConversions,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr,
      cpc,
      cpa,
      roas,
      conversionRate,
    };
  }

  // ==========================================================================
  // Comparison Logic
  // ==========================================================================

  /**
   * Build platform comparison object
   */
  private buildPlatformComparison(
    metaMetrics?: PlatformMetrics,
    googleMetrics?: PlatformMetrics,
    dateRange?: DateRange
  ): PlatformComparison {
    const comparison: PlatformComparison = {
      dateRange: dateRange || { startDate: '', endDate: '' },
      platforms: {
        ...(metaMetrics && { meta: metaMetrics }),
        ...(googleMetrics && { google: googleMetrics }),
      },
      comparison: {
        betterPerformingPlatform: this.determineBetterPlatform(metaMetrics, googleMetrics),
        metrics: {
          spend: this.compareMetric('spend', metaMetrics, googleMetrics),
          conversions: this.compareMetric('conversions', metaMetrics, googleMetrics),
          roas: this.compareMetric('roas', metaMetrics, googleMetrics, true),
          ctr: this.compareMetric('ctr', metaMetrics, googleMetrics, true),
          cpc: this.compareMetric('cpc', metaMetrics, googleMetrics),
          cpa: this.compareMetric('cpa', metaMetrics, googleMetrics),
        },
      },
      insights: [],
    };

    return comparison;
  }

  /**
   * Compare a specific metric between platforms
   */
  private compareMetric(
    metric: MetricKey,
    metaMetrics?: PlatformMetrics,
    googleMetrics?: PlatformMetrics,
    higherIsBetter: boolean = false
  ) {
    const metaValue = metaMetrics?.[metric];
    const googleValue = googleMetrics?.[metric];

    if (metaValue === undefined && googleValue === undefined) {
      return { significance: 'none' as const };
    }

    if (metaValue === undefined) {
      return {
        google: googleValue,
        winner: 'google' as const,
        significance: 'medium' as const,
      };
    }

    if (googleValue === undefined) {
      return {
        meta: metaValue,
        winner: 'meta' as const,
        significance: 'medium' as const,
      };
    }

    const difference = ((googleValue - metaValue) / metaValue) * 100;
    const absDifference = Math.abs(difference);

    let winner: Platform | 'tie';
    if (absDifference < 5) {
      winner = 'tie';
    } else if (higherIsBetter) {
      winner = googleValue > metaValue ? 'google' : 'meta';
    } else {
      winner = googleValue < metaValue ? 'google' : 'meta';
    }

    let significance: 'high' | 'medium' | 'low' | 'none';
    if (absDifference > 25) {
      significance = 'high';
    } else if (absDifference > 10) {
      significance = 'medium';
    } else if (absDifference > 5) {
      significance = 'low';
    } else {
      significance = 'none';
    }

    return {
      meta: metaValue,
      google: googleValue,
      difference,
      winner,
      significance,
    };
  }

  /**
   * Determine which platform performs better overall
   */
  private determineBetterPlatform(
    metaMetrics?: PlatformMetrics,
    googleMetrics?: PlatformMetrics
  ): Platform | null {
    if (!metaMetrics && !googleMetrics) return null;
    if (!metaMetrics) return 'google';
    if (!googleMetrics) return 'meta';

    // Simple scoring based on ROAS and conversion rate
    const metaScore = (metaMetrics.roas || 0) * 0.6 + (metaMetrics.conversionRate || 0) * 0.4;
    const googleScore = (googleMetrics.roas || 0) * 0.6 + (googleMetrics.conversionRate || 0) * 0.4;

    return googleScore > metaScore ? 'google' : 'meta';
  }

  /**
   * Generate comparison insights
   */
  private generateComparisonInsights(
    metaMetrics?: PlatformMetrics,
    googleMetrics?: PlatformMetrics
  ): string[] {
    const insights: string[] = [];

    if (!metaMetrics && !googleMetrics) {
      insights.push('No data available for comparison');
      return insights;
    }

    if (!metaMetrics) {
      insights.push('Only Google Ads data is available. Consider connecting Meta Ads for comprehensive analysis.');
      return insights;
    }

    if (!googleMetrics) {
      insights.push('Only Meta Ads data is available. Consider connecting Google Ads for comprehensive analysis.');
      return insights;
    }

    // ROAS comparison
    if (metaMetrics.roas > googleMetrics.roas * 1.2) {
      insights.push(`Meta Ads shows ${((metaMetrics.roas / googleMetrics.roas - 1) * 100).toFixed(1)}% better ROAS than Google Ads`);
    } else if (googleMetrics.roas > metaMetrics.roas * 1.2) {
      insights.push(`Google Ads shows ${((googleMetrics.roas / metaMetrics.roas - 1) * 100).toFixed(1)}% better ROAS than Meta Ads`);
    }

    // CPC comparison
    if (metaMetrics.cpc < googleMetrics.cpc * 0.8) {
      insights.push(`Meta Ads has ${((1 - metaMetrics.cpc / googleMetrics.cpc) * 100).toFixed(1)}% lower cost per click`);
    } else if (googleMetrics.cpc < metaMetrics.cpc * 0.8) {
      insights.push(`Google Ads has ${((1 - googleMetrics.cpc / metaMetrics.cpc) * 100).toFixed(1)}% lower cost per click`);
    }

    // CTR comparison
    if (metaMetrics.ctr > googleMetrics.ctr * 1.2) {
      insights.push(`Meta Ads achieves ${((metaMetrics.ctr / googleMetrics.ctr - 1) * 100).toFixed(1)}% higher click-through rate`);
    } else if (googleMetrics.ctr > metaMetrics.ctr * 1.2) {
      insights.push(`Google Ads achieves ${((googleMetrics.ctr / metaMetrics.ctr - 1) * 100).toFixed(1)}% higher click-through rate`);
    }

    if (insights.length === 0) {
      insights.push('Both platforms show similar performance levels');
    }

    return insights;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Sum a specific metric across platforms
   */
  private sumMetric(metrics: PlatformMetrics[], key: MetricKey): number {
    return metrics.reduce((sum, metric) => sum + (metric[key] || 0), 0);
  }

  /**
   * Calculate weighted average of a metric
   */
  private calculateWeightedAverage(
    metrics: PlatformMetrics[],
    valueKey: MetricKey,
    weightKey: MetricKey
  ): number {
    let totalValue = 0;
    let totalWeight = 0;

    metrics.forEach(metric => {
      const value = metric[valueKey] || 0;
      const weight = metric[weightKey] || 0;
      
      totalValue += value * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalValue / totalWeight : 0;
  }

  /**
   * Get empty platform metrics
   */
  private getEmptyPlatformMetrics(platform: Platform): PlatformMetrics {
    return {
      platform,
      spend: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpa: 0,
      roas: 0,
      conversionRate: 0,
    };
  }

  /**
   * Get empty total metrics
   */
  private getEmptyTotalMetrics() {
    return {
      spend: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
      averageRoas: 0,
      averageCtr: 0,
      averageCpc: 0,
      averageCpa: 0,
      averageConversionRate: 0,
    };
  }

  /**
   * Get campaign count for a platform
   */
  private async getCampaignCount(clientId: string, platform: Platform): Promise<number> {
    const supabase = await createClient();

    if (platform === 'meta') {
      const { count } = await supabase
        .from('meta_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
      return count || 0;
    } else {
      const { count } = await supabase
        .from('google_ads_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId);
      return count || 0;
    }
  }

  /**
   * Generate date points for time series
   */
  private generateDatePoints(dateRange: DateRange, granularity: 'day' | 'week' | 'month'): string[] {
    const points: string[] = [];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    let current = new Date(start);
    
    while (current <= end) {
      points.push(current.toISOString().split('T')[0]);
      
      if (granularity === 'day') {
        current.setDate(current.getDate() + 1);
      } else if (granularity === 'week') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    return points;
  }
}