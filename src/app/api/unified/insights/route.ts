/**
 * Unified Insights API Route
 * 
 * Provides intelligent insights and recommendations across platforms
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlatformAggregationService } from '@/lib/services/platform-aggregation';
import { 
  PerformanceInsight, 
  InsightsReport, 
  DateRange,
  Platform,
  PlatformMetrics 
} from '@/lib/types/platform-aggregation';

// ============================================================================
// GET /api/unified/insights
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract and validate parameters
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const platformsParam = searchParams.get('platforms');
    const insightTypes = searchParams.get('types')?.split(',') || ['opportunity', 'warning', 'success', 'info'];
    const minImpact = searchParams.get('minImpact') as 'high' | 'medium' | 'low' | null;

    // Validate required parameters
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Parse platforms filter
    let platforms: Platform[] = ['meta', 'google'];
    if (platformsParam) {
      const platformList = platformsParam.split(',').map(p => p.trim()) as Platform[];
      const validPlatforms = platformList.filter(p => ['meta', 'google'].includes(p));
      
      if (validPlatforms.length > 0) {
        platforms = validPlatforms;
      }
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user has access to the client
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this client' },
        { status: 403 }
      );
    }

    // Get aggregated metrics for insights generation
    const aggregationService = new PlatformAggregationService();
    const dateRange: DateRange = { startDate, endDate };
    
    const metricsResult = await aggregationService.getAggregatedMetrics({
      clientId,
      dateRange,
      platforms,
    });

    if (!metricsResult.success || !metricsResult.data) {
      return NextResponse.json(
        {
          error: 'Failed to generate insights',
          details: metricsResult.errors,
        },
        { status: 500 }
      );
    }

    // Generate insights
    const insights = await generateInsights(
      metricsResult.data,
      platforms,
      dateRange,
      clientId
    );

    // Filter insights by type and impact
    let filteredInsights = insights.filter(insight => 
      insightTypes.includes(insight.type)
    );

    if (minImpact) {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const minImpactLevel = impactOrder[minImpact];
      filteredInsights = filteredInsights.filter(insight => 
        impactOrder[insight.impact] >= minImpactLevel
      );
    }

    // Create insights report
    const report: InsightsReport = {
      clientId,
      dateRange,
      insights: filteredInsights,
      summary: {
        totalInsights: filteredInsights.length,
        highImpactInsights: filteredInsights.filter(i => i.impact === 'high').length,
        actionableInsights: filteredInsights.filter(i => i.actionable).length,
        platformSpecificInsights: {
          meta: filteredInsights.filter(i => i.platform === 'meta').length,
          google: filteredInsights.filter(i => i.platform === 'google').length,
          unified: filteredInsights.filter(i => !i.platform).length,
        },
      },
    };

    return NextResponse.json({
      success: true,
      data: report,
      meta: {
        clientId,
        dateRange,
        platforms,
        filters: {
          types: insightTypes,
          minImpact,
        },
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Insights API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Insights Generation Logic
// ============================================================================

async function generateInsights(
  aggregatedData: any,
  platforms: Platform[],
  dateRange: DateRange,
  clientId: string
): Promise<PerformanceInsight[]> {
  const insights: PerformanceInsight[] = [];
  const { total, byPlatform, dataQuality } = aggregatedData;

  // Platform availability insights
  if (!dataQuality.metaDataAvailable && platforms.includes('meta')) {
    insights.push({
      type: 'warning',
      metric: 'connectivity',
      title: 'Meta Ads Not Connected',
      description: 'Meta Ads account is not connected. You\'re missing out on comprehensive cross-platform analysis.',
      impact: 'medium',
      actionable: true,
      recommendation: 'Connect your Meta Ads account to get complete performance insights.',
    });
  }

  if (!dataQuality.googleDataAvailable && platforms.includes('google')) {
    insights.push({
      type: 'warning',
      metric: 'connectivity',
      title: 'Google Ads Not Connected',
      description: 'Google Ads account is not connected. You\'re missing out on comprehensive cross-platform analysis.',
      impact: 'medium',
      actionable: true,
      recommendation: 'Connect your Google Ads account to get complete performance insights.',
    });
  }

  // Performance insights
  if (total.spend > 0) {
    // ROAS insights
    if (total.averageRoas < 2) {
      insights.push({
        type: 'warning',
        metric: 'roas',
        title: 'Low Return on Ad Spend',
        description: `Current ROAS of ${total.averageRoas.toFixed(2)} is below the recommended 2.0 threshold.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Review targeting, ad creative, and landing page optimization to improve conversion rates.',
      });
    } else if (total.averageRoas > 4) {
      insights.push({
        type: 'success',
        metric: 'roas',
        title: 'Excellent Return on Ad Spend',
        description: `Outstanding ROAS of ${total.averageRoas.toFixed(2)} indicates highly effective campaigns.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Consider increasing budget allocation to scale successful campaigns.',
      });
    }

    // CTR insights
    if (total.averageCtr < 1) {
      insights.push({
        type: 'opportunity',
        metric: 'ctr',
        title: 'Low Click-Through Rate',
        description: `CTR of ${total.averageCtr.toFixed(2)}% suggests ad creative may need improvement.`,
        impact: 'medium',
        actionable: true,
        recommendation: 'Test new ad creatives, headlines, and calls-to-action to improve engagement.',
      });
    } else if (total.averageCtr > 3) {
      insights.push({
        type: 'success',
        metric: 'ctr',
        title: 'High Click-Through Rate',
        description: `Excellent CTR of ${total.averageCtr.toFixed(2)}% shows strong ad engagement.`,
        impact: 'medium',
        actionable: false,
      });
    }

    // Conversion rate insights
    if (total.averageConversionRate < 2) {
      insights.push({
        type: 'opportunity',
        metric: 'conversionRate',
        title: 'Low Conversion Rate',
        description: `Conversion rate of ${total.averageConversionRate.toFixed(2)}% indicates potential landing page issues.`,
        impact: 'high',
        actionable: true,
        recommendation: 'Optimize landing pages, improve page load speed, and test different conversion flows.',
      });
    }
  }

  // Platform comparison insights
  if (byPlatform.length === 2) {
    const metaMetrics = byPlatform.find((p: any) => p.platform === 'meta');
    const googleMetrics = byPlatform.find((p: any) => p.platform === 'google');

    if (metaMetrics && googleMetrics) {
      // Compare ROAS
      const roasDiff = Math.abs(metaMetrics.roas - googleMetrics.roas);
      if (roasDiff > 1) {
        const betterPlatform = metaMetrics.roas > googleMetrics.roas ? 'Meta' : 'Google';
        const worseRoas = Math.min(metaMetrics.roas, googleMetrics.roas);
        
        insights.push({
          type: 'opportunity',
          metric: 'roas',
          title: 'Platform Performance Gap',
          description: `${betterPlatform} Ads significantly outperforms the other platform in ROAS.`,
          impact: 'high',
          actionable: true,
          recommendation: `Analyze successful strategies from ${betterPlatform} and apply them to improve the underperforming platform.`,
        });
      }

      // Compare CPC
      const cpcDiff = Math.abs(metaMetrics.cpc - googleMetrics.cpc) / Math.max(metaMetrics.cpc, googleMetrics.cpc);
      if (cpcDiff > 0.3) {
        const cheaperPlatform = metaMetrics.cpc < googleMetrics.cpc ? 'Meta' : 'Google';
        
        insights.push({
          type: 'info',
          metric: 'cpc',
          title: 'Cost Per Click Variation',
          description: `${cheaperPlatform} Ads shows significantly lower cost per click.`,
          impact: 'medium',
          actionable: true,
          recommendation: `Consider reallocating budget to ${cheaperPlatform} for more cost-effective traffic acquisition.`,
        });
      }
    }
  }

  // Budget insights
  if (total.spend > 10000) { // High spend threshold
    insights.push({
      type: 'info',
      metric: 'spend',
      title: 'High Ad Spend Volume',
      description: `Total spend of $${total.spend.toLocaleString()} indicates significant advertising investment.`,
      impact: 'medium',
      actionable: true,
      recommendation: 'Ensure proper tracking and attribution are in place to maximize ROI on this investment.',
    });
  }

  // Campaign count insights
  if (dataQuality.totalCampaigns < 3) {
    insights.push({
      type: 'opportunity',
      metric: 'campaigns',
      title: 'Limited Campaign Diversity',
      description: `Only ${dataQuality.totalCampaigns} active campaigns may limit testing opportunities.`,
      impact: 'low',
      actionable: true,
      recommendation: 'Consider creating additional campaigns to test different audiences, creatives, or objectives.',
    });
  }

  return insights;
}

// ============================================================================
// OPTIONS /api/unified/insights (CORS support)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}