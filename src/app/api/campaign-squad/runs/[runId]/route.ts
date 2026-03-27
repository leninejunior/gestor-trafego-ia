import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params
  return proxyCampaignSquadRequest(request, `/runs/${runId}`)
}

