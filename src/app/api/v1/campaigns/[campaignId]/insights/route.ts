import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createApiError,
  createApiSuccess,
  requireApiKey,
  resolveDateRange,
  toNumber,
  validateClientScope
} from '@/app/api/v1/_lib/api-v1-utils'
import { resolveScopedCampaign } from '@/app/api/v1/_lib/campaign-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const authResult = await requireApiKey(request, 'campaigns:read')
  if (authResult.ok === false) {
    return authResult.response
  }

  const { campaignId } = await params
  const clientId = request.nextUrl.searchParams.get('client_id')?.trim()
  if (!clientId) {
    return createApiError(400, 'MISSING_CLIENT_ID', 'Query parameter client_id is required')
  }

  let dateRange
  try {
    dateRange = resolveDateRange(request.nextUrl.searchParams)
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

    const campaign = await resolveScopedCampaign(clientId, campaignId)
    if (!campaign) {
      return createApiError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found for this client')
    }

    const supabase = createServiceClient()
    const { data: insights, error } = await supabase
      .from('meta_campaign_insights')
      .select('date_start, date_stop, impressions, clicks, spend, reach, conversions, ctr, cpc, cpm')
      .eq('campaign_id', campaignId)
      .gte('date_start', dateRange.dateFrom)
      .lte('date_start', dateRange.dateTo)
      .order('date_start', { ascending: true })

    if (error) {
      console.error('[v1/campaigns/:id/insights] fetch error:', error)
      return createApiError(500, 'INSIGHTS_FETCH_FAILED', 'Failed to fetch campaign insights')
    }

    const daily = (insights ?? []).map((row: any) => ({
      date_start: row.date_start,
      date_stop: row.date_stop,
      impressions: Math.round(toNumber(row.impressions)),
      clicks: Math.round(toNumber(row.clicks)),
      reach: Math.round(toNumber(row.reach)),
      conversions: Number(toNumber(row.conversions).toFixed(2)),
      spend: Number(toNumber(row.spend).toFixed(2)),
      ctr: Number(toNumber(row.ctr).toFixed(4)),
      cpc: Number(toNumber(row.cpc).toFixed(4)),
      cpm: Number(toNumber(row.cpm).toFixed(4))
    }))

    const totals = daily.reduce(
      (acc, row) => {
        acc.impressions += row.impressions
        acc.clicks += row.clicks
        acc.reach += row.reach
        acc.conversions += row.conversions
        acc.spend += row.spend
        return acc
      },
      { impressions: 0, clicks: 0, reach: 0, conversions: 0, spend: 0 }
    )

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0

    return createApiSuccess(
      {
        client_id: clientId,
        client_name: scopedClient.client.name ?? null,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          account_id: campaign.connection.ad_account_id,
          account_name: campaign.connection.account_name
        },
        summary: {
          impressions: Math.round(totals.impressions),
          clicks: Math.round(totals.clicks),
          reach: Math.round(totals.reach),
          conversions: Number(totals.conversions.toFixed(2)),
          spend: Number(totals.spend.toFixed(2)),
          ctr: Number(ctr.toFixed(2)),
          cpc: Number(cpc.toFixed(4)),
          cpm: Number(cpm.toFixed(4))
        },
        daily
      },
      {
        date_range: {
          date_from: dateRange.dateFrom,
          date_to: dateRange.dateTo,
          date_default_applied: dateRange.dateDefaultApplied
        },
        warnings: dateRange.warnings
      }
    )
  } catch (error) {
    console.error('[v1/campaigns/:id/insights] unexpected error:', error)
    return createApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  }
}

