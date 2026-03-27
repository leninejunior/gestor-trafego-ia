import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function POST(request: NextRequest) {
  return proxyCampaignSquadRequest(request, '/schedules/trigger-due', {
    method: 'POST'
  })
}

