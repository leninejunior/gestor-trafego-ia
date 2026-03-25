import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createApiError,
  createApiSuccess,
  requireApiKey,
  resolveDateRange,
  toNumber,
  validateClientScope
} from '../_lib/api-v1-utils'

export async function GET(request: NextRequest) {
  const authResult = await requireApiKey(request, 'campaigns:read')
  if (authResult.ok === false) {
    return authResult.response
  }

  const { searchParams } = request.nextUrl
  const clientId = searchParams.get('client_id')?.trim()

  if (!clientId) {
    return createApiError(400, 'MISSING_CLIENT_ID', 'Query parameter client_id is required')
  }

  const limitRaw = searchParams.get('limit')
  const offsetRaw = searchParams.get('offset')
  const statusFilter = searchParams.get('status')?.trim().toUpperCase()

  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0

  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return createApiError(422, 'INVALID_LIMIT', 'limit must be an integer between 1 and 100')
  }

  if (!Number.isFinite(offset) || offset < 0) {
    return createApiError(422, 'INVALID_OFFSET', 'offset must be an integer greater than or equal to 0')
  }

  let dateRange
  try {
    dateRange = resolveDateRange(searchParams)
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_DATE_FORMAT') {
      return createApiError(422, 'INVALID_DATE_FORMAT', 'Use date format YYYY-MM-DD for date_from and date_to')
    }

    if (error instanceof Error && error.message === 'INVALID_DATE_RANGE') {
      return createApiError(422, 'INVALID_DATE_RANGE', 'date_from must be before or equal to date_to')
    }

    return createApiError(422, 'INVALID_DATE_RANGE_INPUT', 'Invalid date range')
  }

  try {
    const scopedClient = await validateClientScope(clientId, authResult.auth.organizationId)
    if (!scopedClient.ok) {
      return scopedClient.response
    }

    const supabase = createServiceClient()
    let campaignsQuery = supabase
      .from('meta_campaigns')
      .select(
        `
          id,
          name,
          status,
          objective,
          created_time,
          updated_time,
          start_time,
          stop_time,
          daily_budget,
          lifetime_budget,
          connection_id,
          client_meta_connections!inner(
            client_id,
            account_name,
            ad_account_id
          )
        `,
        { count: 'exact' }
      )
      .eq('client_meta_connections.client_id', clientId)
      .order('updated_time', { ascending: false })
      .range(offset, offset + limit - 1)

    if (statusFilter) {
      campaignsQuery = campaignsQuery.eq('status', statusFilter)
    }

    const { data: campaigns, error: campaignsError, count } = await campaignsQuery

    if (campaignsError) {
      console.error('[v1/campaigns] fetch error:', campaignsError)
      return createApiError(500, 'CAMPAIGNS_FETCH_FAILED', 'Failed to fetch campaigns')
    }

    const campaignIds = (campaigns ?? []).map((campaign: any) => campaign.id)
    let insightsByCampaignId = new Map<
      string,
      {
        impressions: number
        clicks: number
        spend: number
        conversions: number
      }
    >()

    if (campaignIds.length > 0) {
      const { data: insights, error: insightsError } = await supabase
        .from('meta_campaign_insights')
        .select('campaign_id, impressions, clicks, spend, conversions')
        .in('campaign_id', campaignIds)
        .gte('date_start', dateRange.dateFrom)
        .lte('date_start', dateRange.dateTo)

      if (insightsError) {
        console.error('[v1/campaigns] insights error:', insightsError)
        return createApiError(500, 'INSIGHTS_FETCH_FAILED', 'Failed to fetch campaign insights')
      }

      insightsByCampaignId = (insights ?? []).reduce((acc: any, row: any) => {
        const current = acc.get(row.campaign_id) ?? {
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0
        }

        current.impressions += toNumber(row.impressions)
        current.clicks += toNumber(row.clicks)
        current.spend += toNumber(row.spend)
        current.conversions += toNumber(row.conversions)
        acc.set(row.campaign_id, current)
        return acc
      }, new Map())
    }

    const items = (campaigns ?? []).map((campaign: any) => {
      const totals = insightsByCampaignId.get(campaign.id) ?? {
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0
      }

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
      const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        account_id: campaign.client_meta_connections?.ad_account_id ?? null,
        account_name: campaign.client_meta_connections?.account_name ?? null,
        ad_account_id: campaign.client_meta_connections?.ad_account_id ?? null,
        daily_budget: campaign.daily_budget,
        lifetime_budget: campaign.lifetime_budget,
        start_time: campaign.start_time,
        stop_time: campaign.stop_time,
        updated_time: campaign.updated_time,
        metrics: {
          impressions: Math.round(totals.impressions),
          clicks: Math.round(totals.clicks),
          conversions: Number(totals.conversions.toFixed(2)),
          spend: Number(totals.spend.toFixed(2)),
          ctr: Number(ctr.toFixed(2)),
          cpc: Number(cpc.toFixed(4)),
          cpm: Number(cpm.toFixed(4))
        }
      }
    })

    return createApiSuccess(
      {
        client_id: clientId,
        client_name: scopedClient.client.name ?? null,
        campaigns: items
      },
      {
        pagination: {
          limit,
          offset,
          total: count ?? 0,
          has_more: (count ?? 0) > offset + limit
        },
        date_range: {
          date_from: dateRange.dateFrom,
          date_to: dateRange.dateTo,
          date_default_applied: dateRange.dateDefaultApplied
        },
        warnings: dateRange.warnings
      }
    )
  } catch (error) {
    console.error('[v1/campaigns] unexpected error:', error)
    return createApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  }
}

