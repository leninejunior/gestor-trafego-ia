/**
 * Automated Health Checks Cron Job
 * 
 * Endpoint cron para executar health checks automaticamente
 * Requirements: 8.3, 8.4 - Health checks automáticos
 */

import { NextRequest, NextResponse } from 'next/server'
import AutomatedHealthChecker from '@/lib/monitoring/automated-health-checker'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Verificar autorização do cron job
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    console.log('Starting automated health checks...')

    const healthChecker = new AutomatedHealthChecker()
    
    // Executar health checks agendados
    await healthChecker.runScheduledHealthChecks()

    // Limpar logs antigos (executar apenas uma vez por dia)
    const { searchParams } = new URL(request.url)
    const cleanup = searchParams.get('cleanup') === 'true'
    
    if (cleanup) {
      await healthChecker.cleanupOldLogs(30) // Manter 30 dias
    }

    const executionTime = Date.now() - startTime

    console.log(`Automated health checks completed in ${executionTime}ms`)

    return NextResponse.json({
      success: true,
      message: 'Health checks executed successfully',
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Automated health checks failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Health checks failed',
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Endpoint para configurar agendamentos padrão
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const healthChecker = new AutomatedHealthChecker()
    
    // Criar agendamentos padrão
    await healthChecker.createDefaultSchedules()

    return NextResponse.json({
      success: true,
      message: 'Default health check schedules created',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to create health check schedules:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create schedules',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}