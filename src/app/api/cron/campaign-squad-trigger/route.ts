import { NextRequest, NextResponse } from 'next/server'
import { proxyCampaignSquadRequest } from '@/lib/campaign-squad/proxy'

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return proxyCampaignSquadRequest(request, '/schedules/trigger-due', {
    method: 'POST'
  })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return proxyCampaignSquadRequest(request, '/schedules/trigger-due', {
    method: 'POST'
  })
}
