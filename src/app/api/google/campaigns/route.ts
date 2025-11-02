/**
 * Google Ads Campaigns API Route
 * 
 * Lists and manages Google Ads campaigns
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleTokenManager } from '@/lib/google/token-manager';
import { GoogleAdsClient } from '@/lib/google/client';
import { googleAdsCache, CacheKeyBuilder, CACHE_TTL } from '@/lib/google/cache-service';
import { z } from 'zod';

// ============================================================================
// Request Validation Schemas
// ============================================================================

const CampaignsQuerySchema = z.object({
  clientId: z.string().uuid('Client ID deve ser um UUID válido'),
  status: z.enum(['ENABLED', 'PAUSED', 'REMOVED', 'all']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'status', 'cost', 'conversions', 'created_at']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  includeMetrics: z.coerce.boolean().default(true),
});

// ============================================================================
// GET /api/google/campaigns
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const {
      clientId,
      status,
      dateFrom,
      dateTo,
      search,
      sortBy,
      sortOrder,
      page,
      limit,
      includeMetrics,
    } = CampaignsQuerySchema.parse(queryParams);

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
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
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    // Check cache first
    const cacheFilters = { status, dateFrom, dateTo, search, sortBy, sortOrder, page, limit, includeMetrics };
    const cacheKey = CacheKeyBuilder.campaigns(clientId, cacheFilters);
    const cachedResult = await googleAdsCache.get(cacheKey);
    
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheKey
      });
    }

    // Build query for campaigns
    let query = supabase
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
        connection_id,
        google_ads_connections!inner(customer_id, status)
      `, { count: 'exact' })
      .eq('client_id', clientId);

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('campaign_name', `%${search}%`);
    }

    // Apply sorting
    const sortColumn = sortBy === 'name' ? 'campaign_name' : sortBy;
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: campaigns, error: campaignsError, count } = await query;

    if (campaignsError) {
      console.error('[Google Campaigns] Error fetching campaigns:', campaignsError);
      return NextResponse.json(
        { error: 'Erro ao buscar campanhas' },
        { status: 500 }
      );
    }

    // Get metrics for campaigns if requested
    let campaignsWithMetrics = campaigns || [];

    if (includeMetrics && campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      
      // Build date filter for metrics
      let metricsQuery = supabase
        .from('google_ads_metrics')
        .select(`
          campaign_id,
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
        `)
        .in('campaign_id', campaignIds);

      if (dateFrom) {
        metricsQuery = metricsQuery.gte('date', dateFrom);
      }

      if (dateTo) {
        metricsQuery = metricsQuery.lte('date', dateTo);
      }

      // Default to last 30 days if no date range specified
      if (!dateFrom && !dateTo) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        metricsQuery = metricsQuery.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
      }

      const { data: metrics, error: metricsError } = await metricsQuery;

      if (metricsError) {
        console.error('[Google Campaigns] Error fetching metrics:', metricsError);
        // Continue without metrics rather than failing
      }

      // Aggregate metrics by campaign
      const metricsMap = new Map();
      
      if (metrics) {
        metrics.forEach(metric => {
          const campaignId = metric.campaign_id;
          if (!metricsMap.has(campaignId)) {
            metricsMap.set(campaignId, {
              impressions: 0,
              clicks: 0,
              conversions: 0,
              cost: 0,
              dates: 0,
            });
          }

          const agg = metricsMap.get(campaignId);
          agg.impressions += parseInt(metric.impressions) || 0;
          agg.clicks += parseInt(metric.clicks) || 0;
          agg.conversions += parseFloat(metric.conversions) || 0;
          agg.cost += parseFloat(metric.cost) || 0;
          agg.dates += 1;
        });
      }

      // Add aggregated metrics to campaigns
      campaignsWithMetrics = campaigns.map(campaign => {
        const metrics = metricsMap.get(campaign.id);
        
        if (metrics) {
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const conversionRate = metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.cost / metrics.clicks : 0;
          const cpa = metrics.conversions > 0 ? metrics.cost / metrics.conversions : 0;

          return {
            ...campaign,
            metrics: {
              impressions: metrics.impressions,
              clicks: metrics.clicks,
              conversions: metrics.conversions,
              cost: metrics.cost,
              ctr: parseFloat(ctr.toFixed(2)),
              conversionRate: parseFloat(conversionRate.toFixed(2)),
              cpc: parseFloat(cpc.toFixed(2)),
              cpa: parseFloat(cpa.toFixed(2)),
              roas: 0, // Would need conversion value to calculate
              dateRange: {
                from: dateFrom,
                to: dateTo,
                days: metrics.dates,
              },
            },
          };
        }

        return {
          ...campaign,
          metrics: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            cost: 0,
            ctr: 0,
            conversionRate: 0,
            cpc: 0,
            cpa: 0,
            roas: 0,
            dateRange: {
              from: dateFrom,
              to: dateTo,
              days: 0,
            },
          },
        };
      });
    }

    // Get last sync information
    const { data: lastSync } = await supabase
      .from('google_ads_sync_logs')
      .select('completed_at, status')
      .in('connection_id', 
        supabase
          .from('google_ads_connections')
          .select('id')
          .eq('client_id', clientId)
      )
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    const result = {
      campaigns: campaignsWithMetrics,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: (page * limit) < (count || 0),
        hasPrev: page > 1,
      },
      filters: {
        clientId,
        status,
        dateFrom,
        dateTo,
        search,
        sortBy,
        sortOrder,
        includeMetrics,
      },
      lastSync: lastSync?.completed_at || null,
      lastSyncStatus: lastSync?.status || null,
      cached: false
    };

    // Cache the result
    await googleAdsCache.set(cacheKey, result, CACHE_TTL.campaigns);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Google Campaigns] Error:', error);

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
// POST /api/google/campaigns (trigger sync)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, action } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID é obrigatório' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
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
        { error: 'Acesso negado ao cliente especificado' },
        { status: 403 }
      );
    }

    if (action === 'sync') {
      // Trigger manual sync
      const response = await fetch(`${request.nextUrl.origin}/api/google/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
        },
        body: JSON.stringify({ clientId, fullSync: false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json(
          { error: errorData.error || 'Erro ao iniciar sincronização' },
          { status: response.status }
        );
      }

      const syncData = await response.json();
      return NextResponse.json({
        success: true,
        message: 'Sincronização iniciada',
        syncId: syncData.syncId,
      });
    }

    return NextResponse.json(
      { error: 'Ação não suportada' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Google Campaigns POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}