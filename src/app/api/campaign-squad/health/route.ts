import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function GET(request: NextRequest) {
  return proxyCampaignSquadRequest(request, '/health')
}

