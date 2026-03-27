// Cron Job: sincronizar saldos de campanha (Meta Ads)
// Configuracao de agendamento recomendada:
// - Path: /api/cron/balance-sync
// - Schedule: "*/10 * * * *" (a cada 10 minutos)

import { NextRequest, NextResponse } from 'next/server'
import { syncMetaAdAccountBalances } from '@/lib/balance/sync-meta-ad-account-balances'

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return true
  }

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await syncMetaAdAccountBalances()

    return NextResponse.json({
      success: true,
      message: `Sincronizacao concluida: ${result.synced} contas atualizadas`,
      synced: result.synced,
      errors: result.errors,
      totalConnections: result.totalConnections,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[cron/balance-sync] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
