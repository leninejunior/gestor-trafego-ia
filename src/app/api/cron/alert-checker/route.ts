/**
 * Cron Job for Automatic Alert Checking
 * 
 * Executa verificação automática de alertas em intervalos regulares
 * Requirements: 4.4, 8.3 - Alertas automáticos para problemas críticos
 */

import { NextRequest, NextResponse } from 'next/server'
import AlertService from '@/lib/monitoring/alert-service'

export async function GET(request: NextRequest) {
  try {
    // Verificar se é uma requisição de cron job válida
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting automatic alert checking...')
    
    const alertService = new AlertService()
    
    // Executar verificação de todos os alertas
    await alertService.checkAllAlerts()
    
    // Obter estatísticas dos alertas ativos
    const activeAlerts = await alertService.getActiveAlerts()
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      active_alerts_count: activeAlerts.length,
      critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
      high_alerts: activeAlerts.filter(a => a.severity === 'high').length,
      medium_alerts: activeAlerts.filter(a => a.severity === 'medium').length,
      low_alerts: activeAlerts.filter(a => a.severity === 'low').length,
      message: 'Alert checking completed successfully'
    }
    
    console.log('Alert checking completed:', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Error in alert checker cron job:', error)
    
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
  try {
    // Permitir execução manual via POST para testes
    const body = await request.json()
    const { secret } = body
    
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Invalid secret' },
        { status: 401 }
      )
    }

    console.log('Manual alert checking triggered...')
    
    const alertService = new AlertService()
    
    // Executar verificação de todos os alertas
    await alertService.checkAllAlerts()
    
    // Obter alertas ativos
    const activeAlerts = await alertService.getActiveAlerts()
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      active_alerts_count: activeAlerts.length,
      active_alerts: activeAlerts.map(alert => ({
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        triggered_at: alert.triggered_at,
        metric_value: alert.metric_value,
        threshold: alert.threshold
      })),
      message: 'Manual alert checking completed'
    }
    
    console.log('Manual alert checking completed:', result)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Error in manual alert checking:', error)
    
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