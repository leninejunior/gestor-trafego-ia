/**
 * Health Check Schedules Management API
 * 
 * API para gerenciar agendamentos de health checks
 * Requirements: 8.3 - Gerenciamento de health checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const enabled = searchParams.get('enabled')
    const endpoint = searchParams.get('endpoint')

    let query = supabase
      .from('health_check_schedules')
      .select('*')
      .order('name')

    if (enabled !== null) {
      query = query.eq('enabled', enabled === 'true')
    }

    if (endpoint) {
      query = query.eq('endpoint', endpoint)
    }

    const { data: schedules, error } = await query

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch health check schedules',
        details: error.message
      }, { status: 500 })
    }

    // Buscar estatísticas recentes para cada agendamento
    const schedulesWithStats = await Promise.all(
      (schedules || []).map(async (schedule) => {
        const { data: recentLogs } = await supabase
          .from('health_check_logs')
          .select('status, response_time_ms, checked_at')
          .eq('schedule_id', schedule.id)
          .gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('checked_at', { ascending: false })
          .limit(10)

        const stats = {
          total_runs_24h: recentLogs?.length || 0,
          success_rate_24h: 0,
          avg_response_time_ms: 0,
          last_status: recentLogs?.[0]?.status || 'unknown',
          last_run: recentLogs?.[0]?.checked_at || null
        }

        if (recentLogs && recentLogs.length > 0) {
          const successful = recentLogs.filter(l => l.status === 'healthy' || l.status === 'degraded').length
          stats.success_rate_24h = (successful / recentLogs.length) * 100
          stats.avg_response_time_ms = recentLogs.reduce((sum, l) => sum + l.response_time_ms, 0) / recentLogs.length
        }

        return {
          ...schedule,
          stats
        }
      })
    )

    return NextResponse.json({
      schedules: schedulesWithStats,
      total: schedulesWithStats.length
    })

  } catch (error) {
    console.error('Error fetching health check schedules:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()

    // Validar dados de entrada
    const {
      name,
      endpoint,
      interval_minutes,
      enabled = true,
      max_failures_before_alert = 3
    } = body

    if (!name || !endpoint || !interval_minutes) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['name', 'endpoint', 'interval_minutes']
      }, { status: 400 })
    }

    // Validar endpoint
    const validEndpoints = ['full', 'quick', 'database', 'iugu', 'email', 'redis', 'checkout', 'monitoring']
    if (!validEndpoints.includes(endpoint)) {
      return NextResponse.json({
        error: 'Invalid endpoint',
        valid_endpoints: validEndpoints
      }, { status: 400 })
    }

    // Validar intervalo
    if (interval_minutes < 1 || interval_minutes > 1440) { // 1 minuto a 24 horas
      return NextResponse.json({
        error: 'Invalid interval',
        message: 'Interval must be between 1 and 1440 minutes'
      }, { status: 400 })
    }

    // Verificar se já existe um agendamento com o mesmo nome
    const { data: existing } = await supabase
      .from('health_check_schedules')
      .select('id')
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json({
        error: 'Schedule with this name already exists'
      }, { status: 409 })
    }

    // Criar agendamento
    const nextRun = new Date(Date.now() + interval_minutes * 60 * 1000)

    const { data: schedule, error } = await supabase
      .from('health_check_schedules')
      .insert({
        name,
        endpoint,
        interval_minutes,
        enabled,
        max_failures_before_alert,
        consecutive_failures: 0,
        next_run: nextRun.toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({
        error: 'Failed to create health check schedule',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Health check schedule created successfully',
      schedule
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating health check schedule:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}