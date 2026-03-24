import { META_CONFIG } from '@/lib/meta/config'
import { createServiceClient } from '@/lib/supabase/server'

export type ScopedCampaign = {
  id: string
  name: string | null
  status: string | null
  objective: string | null
  daily_budget: string | null
  lifetime_budget: string | null
  updated_time: string | null
  connection_id: string
  connection: {
    id: string
    client_id: string
    ad_account_id: string | null
    account_name: string | null
    access_token: string | null
    is_active: boolean | null
  }
}

export async function resolveScopedCampaign(clientId: string, campaignId: string): Promise<ScopedCampaign | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_campaigns')
    .select(
      `
        id,
        name,
        status,
        objective,
        daily_budget,
        lifetime_budget,
        updated_time,
        connection_id,
        client_meta_connections!inner(
          id,
          client_id,
          ad_account_id,
          account_name,
          access_token,
          is_active
        )
      `
    )
    .eq('id', campaignId)
    .eq('client_meta_connections.client_id', clientId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const connection = data.client_meta_connections as any
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    objective: data.objective,
    daily_budget: data.daily_budget,
    lifetime_budget: data.lifetime_budget,
    updated_time: data.updated_time,
    connection_id: data.connection_id,
    connection: {
      id: connection.id,
      client_id: connection.client_id,
      ad_account_id: connection.ad_account_id,
      account_name: connection.account_name,
      access_token: connection.access_token,
      is_active: connection.is_active
    }
  }
}

export async function callMetaCampaignUpdate(
  campaignId: string,
  accessToken: string,
  payload: Record<string, unknown>
) {
  const response = await fetch(`${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${campaignId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...payload,
      access_token: accessToken
    })
  })

  const data = await response.json().catch(async () => ({ error: { message: await response.text() } }))
  return { response, data }
}
