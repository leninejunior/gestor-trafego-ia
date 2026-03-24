import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createApiError,
  createApiSuccess,
  parsePositiveNumber,
  requireApiKey,
  validateClientScope
} from '@/app/api/v1/_lib/api-v1-utils'
import { callMetaCampaignUpdate, resolveScopedCampaign } from '@/app/api/v1/_lib/campaign-helpers'

type UpdateBudgetBody = {
  client_id?: string
  daily_budget?: number | string
  lifetime_budget?: number | string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const authResult = await requireApiKey(request, 'campaigns:write')
  if (authResult.ok === false) {
    return authResult.response
  }

  const { campaignId } = await params
  const body = (await request.json().catch(() => ({}))) as UpdateBudgetBody

  const clientId = body.client_id?.trim()
  const dailyBudget = parsePositiveNumber(body.daily_budget)
  const lifetimeBudget = parsePositiveNumber(body.lifetime_budget)

  if (!clientId) {
    return createApiError(400, 'MISSING_CLIENT_ID', 'Body field client_id is required')
  }

  if (!dailyBudget && !lifetimeBudget) {
    return createApiError(
      422,
      'INVALID_BUDGET_PAYLOAD',
      'Provide at least one valid value: daily_budget or lifetime_budget'
    )
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

    if (!campaign.connection.is_active || !campaign.connection.access_token) {
      return createApiError(
        422,
        'META_CONNECTION_UNAVAILABLE',
        'Client has no active Meta connection with access token'
      )
    }

    const payload: Record<string, unknown> = {}
    const updateFields: Record<string, unknown> = { updated_time: new Date().toISOString() }

    if (dailyBudget) {
      const cents = Math.round(dailyBudget * 100)
      payload.daily_budget = cents
      updateFields.daily_budget = String(cents)
    }

    if (lifetimeBudget) {
      const cents = Math.round(lifetimeBudget * 100)
      payload.lifetime_budget = cents
      updateFields.lifetime_budget = String(cents)
    }

    const { response, data } = await callMetaCampaignUpdate(campaignId, campaign.connection.access_token, payload)
    if (!response.ok || (data && typeof data === 'object' && 'error' in data)) {
      return createApiError(502, 'META_API_ERROR', 'Failed to update campaign budget in Meta API', data)
    }

    const supabase = createServiceClient()
    await supabase
      .from('meta_campaigns')
      .update(updateFields as never)
      .eq('id', campaignId)

    return createApiSuccess(
      {
        campaign_id: campaignId,
        campaign_name: campaign.name,
        client_id: clientId,
        daily_budget: dailyBudget ? Number(dailyBudget.toFixed(2)) : null,
        lifetime_budget: lifetimeBudget ? Number(lifetimeBudget.toFixed(2)) : null,
        applied_meta_payload: payload
      },
      { warnings: [] }
    )
  } catch (error) {
    console.error('[v1/campaigns/:id/budget] unexpected error:', error)
    return createApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  }
}

