import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createApiError,
  createApiSuccess,
  requireApiKey,
  validateClientScope
} from '@/app/api/v1/_lib/api-v1-utils'
import { callMetaCampaignUpdate, resolveScopedCampaign } from '@/app/api/v1/_lib/campaign-helpers'

type UpdateStatusBody = {
  client_id?: string
  status?: string
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
  const body = (await request.json().catch(() => ({}))) as UpdateStatusBody
  const clientId = body.client_id?.trim()
  const status = body.status?.trim().toUpperCase()

  if (!clientId) {
    return createApiError(400, 'MISSING_CLIENT_ID', 'Body field client_id is required')
  }

  if (!status || !['ACTIVE', 'PAUSED'].includes(status)) {
    return createApiError(422, 'INVALID_STATUS', 'status must be ACTIVE or PAUSED')
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

    const { response, data } = await callMetaCampaignUpdate(campaignId, campaign.connection.access_token, { status })
    if (!response.ok || (data && typeof data === 'object' && 'error' in data)) {
      return createApiError(502, 'META_API_ERROR', 'Failed to update campaign status in Meta API', data)
    }

    const supabase = createServiceClient()
    await supabase
      .from('meta_campaigns')
      .update({
        status,
        updated_time: new Date().toISOString()
      } as never)
      .eq('id', campaignId)

    return createApiSuccess(
      {
        campaign_id: campaignId,
        campaign_name: campaign.name,
        client_id: clientId,
        previous_status: campaign.status,
        new_status: status
      },
      { warnings: [] }
    )
  } catch (error) {
    console.error('[v1/campaigns/:id/status] unexpected error:', error)
    return createApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error')
  }
}

