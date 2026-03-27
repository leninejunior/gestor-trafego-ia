import { NextRequest } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyCampaignSquadRequest(request, '/uploads/ready-creative', {
    method: 'POST',
    body
  })
}

