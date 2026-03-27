import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const body = await request.json()
  const { runId } = await context.params

  return proxyCampaignSquadRequest(request, `/runs/${runId}/plan-draft`, {
    method: 'PATCH',
    body
  })
}
