/**
 * Google Ads Metrics API Route
 * 
 * Provides metrics and analytics for Google Ads campaigns
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { googleAdsCache, CacheKeyBuilder, CACHE_TTL } from '@/lib/google/cache-service';
import { z } from 'zod';

// ============================================================================
// Request Validation Schemas
// ============================================================================

const MetricsQuerySchema = z.object({
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
  campaignIds: z.string().optional(), // Comma-separated campaign IDs
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  metrics: z.string().optional(), // Comma-separated metric names
  groupBy: z.enum(['campaign', 'date', 'campaign_date']).default('campaign_date'),
  compareWith: z.enum(['previous_period', 'previous_year', 'none']).default('none'),
  includeZeroImpressions: z.coerce.boolean().default(false),
});

// ============================================================================
// GET /api/google/metrics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Check if Google Ads is configured
    const isConfigured = !!(
      process.env.GOOGLE_CLIENT_ID && 
      process.env.GOOGLE_CLIENT_SECRET && 
      process.env.GOOGLE_DEVELOPER_TOKEN &&
      !process.env.GOOGLE_CLIENT_ID.includes('your_') &&
      !process.env.GOOGLE_CLIENT_SECRET.includes('your_') &&
      !process.env.GOOGLE_DEVELOPER_TOKEN.includes('your_')
    );

    if (!isConfigured) {
      return NextResponse.json(
        { 
          error: 'Google Ads não configurado',
          message: 'As credenciais do Google Ads não foram configuradas. Configure as variáveis GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_DEVELOPER_TOKEN no arquivo .env',
          configured: false
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const {
      clientId,
      campaignIds,
      dateFrom,
      dateTo,
      granularity,
      metrics,
      groupBy,
      compareWith,
      includeZeroImpressions,
    } = MetricsQuerySchema.parse(queryParams);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verify user has access to the client via organization membership
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // Check if user is member of the organization
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('organization_id', clientData.org_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    // Validate date range
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    
    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Data inicial deve ser anterior à data final' },
        { status: 400 }
      );
    }

    // Check if date range is too large (max 1 year)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return NextResponse.json(
        { error: 'Período máximo permitido é de 1 ano' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = CacheKeyBuilder.metrics(
      `${clientId}_${campaignIds || 'all'}`, 
      dateFrom, 
      dateTo
    );
    const cachedResult = await googleAdsCache.get(cacheKey);
    
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheKey
      });
    }

    // Build base query for metrics
    let metricsQuery = supabase
      .from('google_ads_metrics')
      .select(`
        *,
        google_ads_campaigns!inner(
          id,
          campaign_id,
          campaign_name,
          status,
          client_id
        )
      `)
      .eq('google_ads_campaigns.client_id', clientId)
      .gte('date', dateFrom)
      .lte('date', dateTo);

    // Filter by campaign IDs if specified
    if (campaignIds) {
      const campaignIdList = campaignIds.split(',').map(id => id.trim());
      metricsQuery = metricsQuery.in('google_ads_campaigns.id', campaignIdList);
    }

    // Filter zero impressions if requested
    if (!includeZeroImpressions) {
      metricsQuery = metricsQuery.gt('impressions', 0);
    }

    const { data: metricsData, error: metricsError } = await metricsQuery;

    if (metricsError) {
      console.error('[Google Metrics] Error fetching metrics:', metricsError);
      return NextResponse.json(
        { error: 'Erro ao buscar métricas' },
        { status: 500 }
      );
    }

    // Process metrics based on granularity and grouping
    const processedMetrics = processMetrics(metricsData || [], granularity, groupBy);

    // Get comparison data if requested
    let comparisonData = null;
    if (compareWith !== 'none') {
      comparisonData = await getComparisonData(
        supabase,
        clientId,
        campaignIds,
        dateFrom,
        dateTo,
        compareWith,
        granularity,
        groupBy,
        includeZeroImpressions
      );
    }

    // Calculate summary statistics
    const summary = calculateSummaryStats(metricsData || []);

    // Get top performing campaigns
    const topCampaigns = getTopPerformingCampaigns(metricsData || [], 5);

    const result = {
      clientId,
      dateRange: {
        from: dateFrom,
        to: dateTo,
        days: daysDiff,
      },
      granularity,
      groupBy,
      metrics: processedMetrics,
      summary,
      topCampaigns,
      comparison: comparisonData,
      totalRecords: metricsData?.length || 0,
      cached: false
    };

    // Cache the result
    await googleAdsCache.set(cacheKey, result, CACHE_TTL.metrics);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Google Metrics] Error:', error);

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
      { error: 'Falha ao carregar métricas' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function processMetrics(data: any[], granularity: string, groupBy: string) {
  if (groupBy === 'campaign') {
    return groupByCampaign(data);
  } else if (groupBy === 'date') {
    return groupByDate(data, granularity);
  } else {
    return groupByCampaignAndDate(data, granularity);
  }
}

function groupByCampaign(data: any[]) {
  const grouped = new Map();

  data.forEach(metric => {
    const campaign = metric.google_ads_campaigns;
    const key = campaign.id;

    if (!grouped.has(key)) {
      grouped.set(key, {
        campaignId: campaign.id,
        campaignName: campaign.campaign_name,
        campaignStatus: campaign.status,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cost: 0,
        days: 0,
      });
    }

    const group = grouped.get(key);
    group.impressions += parseInt(metric.impressions) || 0;
    group.clicks += parseInt(metric.clicks) || 0;
    group.conversions += parseFloat(metric.conversions) || 0;
    group.cost += parseFloat(metric.cost) || 0;
    group.days += 1;
  });

  return Array.from(grouped.values()).map(group => ({
    ...group,
    ctr: group.impressions > 0 ? parseFloat(((group.clicks / group.impressions) * 100).toFixed(2)) : 0,
    conversionRate: group.clicks > 0 ? parseFloat(((group.conversions / group.clicks) * 100).toFixed(2)) : 0,
    cpc: group.clicks > 0 ? parseFloat((group.cost / group.clicks).toFixed(2)) : 0,
    cpa: group.conversions > 0 ? parseFloat((group.cost / group.conversions).toFixed(2)) : 0,
    cost: parseFloat(group.cost.toFixed(2)),
  }));
}

function groupByDate(data: any[], granularity: string) {
  const grouped = new Map();

  data.forEach(metric => {
    const date = new Date(metric.date);
    let key: string;

    if (granularity === 'weekly') {
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      key = monday.toISOString().split('T')[0];
    } else if (granularity === 'monthly') {
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
        campaigns: new Set(),
      });
    }

    const group = grouped.get(key);
    group.impressions += parseInt(metric.impressions) || 0;
    group.clicks += parseInt(metric.clicks) || 0;
    group.conversions += parseFloat(metric.conversions) || 0;
    group.cost += parseFloat(metric.cost) || 0;
    group.campaigns.add(metric.google_ads_campaigns.id);
  });

  return Array.from(grouped.values()).map(group => ({
    date: group.date,
    impressions: group.impressions,
    clicks: group.clicks,
    conversions: group.conversions,
    cost: parseFloat(group.cost.toFixed(2)),
    ctr: group.impressions > 0 ? parseFloat(((group.clicks / group.impressions) * 100).toFixed(2)) : 0,
    conversionRate: group.clicks > 0 ? parseFloat(((group.conversions / group.clicks) * 100).toFixed(2)) : 0,
    cpc: group.clicks > 0 ? parseFloat((group.cost / group.clicks).toFixed(2)) : 0,
    cpa: group.conversions > 0 ? parseFloat((group.cost / group.conversions).toFixed(2)) : 0,
    campaignCount: group.campaigns.size,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function groupByCampaignAndDate(data: any[], granularity: string) {
  const grouped = new Map();

  data.forEach(metric => {
    const campaign = metric.google_ads_campaigns;
    const date = new Date(metric.date);
    let dateKey: string;

    if (granularity === 'weekly') {
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      dateKey = monday.toISOString().split('T')[0];
    } else if (granularity === 'monthly') {
      dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      dateKey = metric.date;
    }

    const key = `${campaign.id}_${dateKey}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        campaignId: campaign.id,
        campaignName: campaign.campaign_name,
        campaignStatus: campaign.status,
        date: dateKey,
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

  return Array.from(grouped.values()).map(group => ({
    campaignId: group.campaignId,
    campaignName: group.campaignName,
    campaignStatus: group.campaignStatus,
    date: group.date,
    impressions: group.impressions,
    clicks: group.clicks,
    conversions: group.conversions,
    cost: parseFloat(group.cost.toFixed(2)),
    ctr: group.impressions > 0 ? parseFloat(((group.clicks / group.impressions) * 100).toFixed(2)) : 0,
    conversionRate: group.clicks > 0 ? parseFloat(((group.conversions / group.clicks) * 100).toFixed(2)) : 0,
    cpc: group.clicks > 0 ? parseFloat((group.cost / group.clicks).toFixed(2)) : 0,
    cpa: group.conversions > 0 ? parseFloat((group.cost / group.conversions).toFixed(2)) : 0,
    days: group.count,
  })).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.campaignName.localeCompare(b.campaignName);
  });
}

function calculateSummaryStats(data: any[]) {
  const totals = data.reduce((acc, metric) => ({
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

  const uniqueCampaigns = new Set(data.map(m => m.google_ads_campaigns.id)).size;
  const uniqueDates = new Set(data.map(m => m.date)).size;

  return {
    totalImpressions: totals.impressions,
    totalClicks: totals.clicks,
    totalConversions: totals.conversions,
    totalCost: parseFloat(totals.cost.toFixed(2)),
    averageCtr: totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
    averageConversionRate: totals.clicks > 0 ? parseFloat(((totals.conversions / totals.clicks) * 100).toFixed(2)) : 0,
    averageCpc: totals.clicks > 0 ? parseFloat((totals.cost / totals.clicks).toFixed(2)) : 0,
    averageCpa: totals.conversions > 0 ? parseFloat((totals.cost / totals.conversions).toFixed(2)) : 0,
    campaignCount: uniqueCampaigns,
    dateCount: uniqueDates,
    recordCount: data.length,
  };
}

function getTopPerformingCampaigns(data: any[], limit: number) {
  const campaignMetrics = groupByCampaign(data);
  
  return {
    byConversions: campaignMetrics
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, limit),
    byCost: campaignMetrics
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit),
    byClicks: campaignMetrics
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, limit),
    byImpressions: campaignMetrics
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit),
  };
}

async function getComparisonData(
  supabase: any,
  clientId: string,
  campaignIds: string | undefined,
  dateFrom: string,
  dateTo: string,
  compareWith: string,
  granularity: string,
  groupBy: string,
  includeZeroImpressions: boolean
) {
  let comparisonDateFrom: string;
  let comparisonDateTo: string;

  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (compareWith === 'previous_period') {
    const comparisonStart = new Date(startDate);
    comparisonStart.setDate(comparisonStart.getDate() - daysDiff);
    const comparisonEnd = new Date(startDate);
    comparisonEnd.setDate(comparisonEnd.getDate() - 1);

    comparisonDateFrom = comparisonStart.toISOString().split('T')[0];
    comparisonDateTo = comparisonEnd.toISOString().split('T')[0];
  } else if (compareWith === 'previous_year') {
    const comparisonStart = new Date(startDate);
    comparisonStart.setFullYear(comparisonStart.getFullYear() - 1);
    const comparisonEnd = new Date(endDate);
    comparisonEnd.setFullYear(comparisonEnd.getFullYear() - 1);

    comparisonDateFrom = comparisonStart.toISOString().split('T')[0];
    comparisonDateTo = comparisonEnd.toISOString().split('T')[0];
  } else {
    return null;
  }

  // Fetch comparison data
  let comparisonQuery = supabase
    .from('google_ads_metrics')
    .select(`
      *,
      google_ads_campaigns!inner(
        id,
        campaign_id,
        campaign_name,
        status,
        client_id
      )
    `)
    .eq('google_ads_campaigns.client_id', clientId)
    .gte('date', comparisonDateFrom)
    .lte('date', comparisonDateTo);

  if (campaignIds) {
    const campaignIdList = campaignIds.split(',').map(id => id.trim());
    comparisonQuery = comparisonQuery.in('google_ads_campaigns.id', campaignIdList);
  }

  if (!includeZeroImpressions) {
    comparisonQuery = comparisonQuery.gt('impressions', 0);
  }

  const { data: comparisonData } = await comparisonQuery;

  if (!comparisonData || comparisonData.length === 0) {
    return {
      period: compareWith,
      dateRange: {
        from: comparisonDateFrom,
        to: comparisonDateTo,
      },
      metrics: [],
      summary: null,
    };
  }

  const processedComparison = processMetrics(comparisonData, granularity, groupBy);
  const comparisonSummary = calculateSummaryStats(comparisonData);

  return {
    period: compareWith,
    dateRange: {
      from: comparisonDateFrom,
      to: comparisonDateTo,
    },
    metrics: processedComparison,
    summary: comparisonSummary,
  };
}