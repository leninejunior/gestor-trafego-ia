import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ scheduleId: string }> }
) {
  const body = await request.json()
  const { scheduleId } = await context.params

  return proxyCampaignSquadRequest(request, `/schedules/${scheduleId}`, {
    method: 'PATCH',
    body
  })
}

