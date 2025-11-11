/**
 * Cron Job: Verificar Alertas de Saldo
 * Executa a cada 1 hora para verificar saldos e disparar alertas
 * 
 * Configurar no Vercel:
 * - Path: /api/cron/check-balance-alerts
 * - Schedule: 0 * * * * (a cada hora)
 */

import { NextRequest, NextResponse } from 'next/server'
import { BalanceAlertService } from '@/lib/services/balance-alert-service'

export const runtime = 'edge'
export const maxDuration = 300 // 5 minutos

export async function GET(request: NextRequest) {
  try {
    // Verificar autorização (Vercel Cron ou chave de API)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting balance alerts check...')

    const service = new BalanceAlertService()
    const result = await service.checkAllAlerts()

    console.log('Balance alerts check completed:', result)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        checked: result.checked,
        triggered: result.triggered,
        errors: result.errors
      }
    })

  } catch (error) {
    console.error('Error in balance alerts cron:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Permitir POST também (para testes manuais)
export async function POST(request: NextRequest) {
  return GET(request)
}
