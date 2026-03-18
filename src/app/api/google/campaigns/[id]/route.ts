/**
 * Google Ads Campaign Details API Route
 * 
 * Gets detailed information for a specific Google Ads campaign
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleTokenManager } from '@/lib/google/token-manager';
import { GoogleAdsClient } from '@/lib/google/client';
import { z } from 'zod';

// ============================================================================
// Request Validation Schema
// ============================================================================

const CampaignDetailsQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  includeHistorical: z.coerce.boolean().default(true),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

// ============================================================================
// GET /api/google/campaigns/[id]
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const {
      dateFrom,
      dateTo,
      includeHistorical,
      granularity,
    } = CampaignDetailsQuerySchema.parse(queryParams);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Get campaign details with client verification
    const { data: campaign, error: campaignError } = await supabase
      .from('google_ads_campaigns')
      .select(`
        id,
        campaign_id,
        campaign_name,
        status,
        budget_amount,
        budget_currency,
        start_date,
        end_date,
        created_at,
        updated_at,
        client_id,
        connection_id,
        google_ads_connections!inner(
          customer_id,
          status,
          last_sync_at
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    // Verify user has access to this campaign's client
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', campaign.client_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Acesso negado à campanha especificada' },
        { status: 403 }
      );
    }

    // Set default date range if not provided
    const endDate = dateTo || new Date().toISOString().split('T')[0];
    const startDate = dateFrom || (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
    })();

    // Get campaign metrics
    let metricsQuery = supabase
      .from('google_ads_metrics')
      .select('*')
      .eq('campaign_id', campaignId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    const { data: metrics, error: metricsError } = await metricsQuery;

    if (metricsError) {
      console.error('[Google Campaign Details] Error fetching metrics:', metricsError);
      return NextResponse.json(
        { error: 'Erro ao buscar métricas da campanha' },
        { status: 500 }
      );
    }

    // Process metrics based on granularity
    const processedMetrics = processMetricsByGranularity(metrics || [], granularity);

    // Calculate summary metrics
    const summary = calculateSummaryMetrics(metrics || []);

    // Get recent performance comparison (last 7 days vs previous 7 days)
    const comparisonData = await getPerformanceComparison(supabase, campaignId);

    // Get historical data if requested
    let historicalData = null;
    if (includeHistorical) {
      historicalData = await getHistoricalTrends(supabase, campaignId);
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        campaignId: campaign.campaign_id,
        name: campaign.campaign_name,
        status: campaign.status,
        budget: {
          amount: campaign.budget_amount,
          currency: campaign.budget_currency,
        },
        dates: {
          start: campaign.start_date,
          end: campaign.end_date,
        },
        connection: {
          id: campaign.connection_id,
          customerId: campaign.google_ads_connections.customer_id,
          status: campaign.google_ads_connections.status,
          lastSync: campaign.google_ads_connections.last_sync_at,
        },
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      },
      metrics: {
        summary,
        timeSeries: processedMetrics,
        dateRange: {
          from: startDate,
          to: endDate,
          granularity,
        },
      },
      comparison: comparisonData,
      historical: historicalData,
    });

  } catch (error) {
    console.error('[Google Campaign Details] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Parâmetros inválidos',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function processMetricsByGranularity(metrics: any[], granularity: string) {
  if (granularity === 'daily') {
    return metrics;
  }

  const grouped = new Map();

  metrics.forEach(metric => {
    const date = new Date(metric.date);
    let key: string;

    if (granularity === 'weekly') {
      // Get Monday of the week
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      key = monday.toISOString().split('T')[0];
    } else if (granularity === 'monthly') {
      // Get first day of the month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      key = metric.date;
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cost: 0,
        count: 0,
      });
    }

    const group = grouped.get(key);
    group.impressions += parseInt(metric.impressions) || 0;
    group.clicks += parseInt(metric.clicks) || 0;
    group.conversions += parseFloat(metric.conversions) || 0;
    group.cost += parseFloat(metric.cost) || 0;
    group.count += 1;
  });

  // Calculate averages and derived metrics
  return Array.from(grouped.values()).map(group => {
    const ctr = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
    const conversionRate = group.clicks > 0 ? (group.conversions / group.clicks) * 100 : 0;
    const cpc = group.clicks > 0 ? group.cost / group.clicks : 0;
    const cpa = group.conversions > 0 ? group.cost / group.conversions : 0;

    return {
      date: group.date,
      impressions: group.impressions,
      clicks: group.clicks,
      conversions: group.conversions,
      cost: parseFloat(group.cost.toFixed(2)),
      ctr: parseFloat(ctr.toFixed(2)),
      conversion_rate: parseFloat(conversionRate.toFixed(2)),
      cpc: parseFloat(cpc.toFixed(2)),
      cpa: parseFloat(cpa.toFixed(2)),
      roas: 0, // Would need conversion value
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateSummaryMetrics(metrics: any[]) {
  const totals = metrics.reduce((acc, metric) => ({
    impressions: acc.impressions + (parseInt(metric.impressions) || 0),
    clicks: acc.clicks + (parseInt(metric.clicks) || 0),
    conversions: acc.conversions + (parseFloat(metric.conversions) || 0),
    cost: acc.cost + (parseFloat(metric.cost) || 0),
  }), {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    cost: 0,
  });

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
  const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

  return {
    impressions: totals.impressions,
    clicks: totals.clicks,
    conversions: totals.conversions,
    cost: parseFloat(totals.cost.toFixed(2)),
    ctr: parseFloat(ctr.toFixed(2)),
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    cpc: parseFloat(cpc.toFixed(2)),
    cpa: parseFloat(cpa.toFixed(2)),
    roas: 0,
    days: metrics.length,
  };
}

async function getPerformanceComparison(supabase: any, campaignId: string) {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(today.getDate() - 14);

  // Get last 7 days
  const { data: recent } = await supabase
    .from('google_ads_metrics')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    .lt('date', today.toISOString().split('T')[0]);

  // Get previous 7 days
  const { data: previous } = await supabase
    .from('google_ads_metrics')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
    .lt('date', sevenDaysAgo.toISOString().split('T')[0]);

  const recentSummary = calculateSummaryMetrics(recent || []);
  const previousSummary = calculateSummaryMetrics(previous || []);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return {
    recent: recentSummary,
    previous: previousSummary,
    changes: {
      impressions: parseFloat(calculateChange(recentSummary.impressions, previousSummary.impressions).toFixed(2)),
      clicks: parseFloat(calculateChange(recentSummary.clicks, previousSummary.clicks).toFixed(2)),
      conversions: parseFloat(calculateChange(recentSummary.conversions, previousSummary.conversions).toFixed(2)),
      cost: parseFloat(calculateChange(recentSummary.cost, previousSummary.cost).toFixed(2)),
      ctr: parseFloat(calculateChange(recentSummary.ctr, previousSummary.ctr).toFixed(2)),
      conversionRate: parseFloat(calculateChange(recentSummary.conversionRate, previousSummary.conversionRate).toFixed(2)),
    },
  };
}

async function getHistoricalTrends(supabase: any, campaignId: string) {
  // Get last 90 days of data
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: historical } = await supabase
    .from('google_ads_metrics')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (!historical || historical.length === 0) {
    return null;
  }

  // Group by week for trend analysis
  const weeklyData = processMetricsByGranularity(historical, 'weekly');

  return {
    totalDays: historical.length,
    weeklyTrends: weeklyData,
    summary: calculateSummaryMetrics(historical),
  };
}
