import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ approvalId: string }> }
) {
  const body = await request.json()
  const { approvalId } = await context.params

  return proxyCampaignSquadRequest(request, `/approvals/${approvalId}`, {
    method: 'POST',
    body
  })
}

