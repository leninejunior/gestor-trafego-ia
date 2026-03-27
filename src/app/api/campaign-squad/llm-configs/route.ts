import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function GET(request: NextRequest) {
  return proxyCampaignSquadRequest(request, '/llm-configs', {
    method: 'GET',
    query: request.nextUrl.searchParams
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyCampaignSquadRequest(request, '/llm-configs', {
    method: 'POST',
    body
  })
}

