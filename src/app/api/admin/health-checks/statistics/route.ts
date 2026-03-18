/**
 * Health Check Statistics API
 * 
 * API para estatísticas e métricas de health checks
 * Requirements: 8.3 - Estatísticas e métricas de health checks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const hours = parseInt(searchParams.get('hours') || '24')
    const groupBy = searchParams.get('group_by') || 'hour' // hour, day, schedule
    
    if (hours < 1 || hours > 8760) { // Máximo 1 ano
      return NextResponse.json({
        error: 'Invalid hours parameter',
        message: 'Hours must be between 1 and 8760 (1 year)'
      }, { status: 400 })
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    // 1. Estatísticas gerais
    const { data: allLogs, error: logsError } = await supabase
      .from('health_check_logs')
      .select('status, response_time_ms, checked_at, schedule_id')
      .gte('checked_at', since.toISOString())

    if (logsError) {
      return NextResponse.json({
        error: 'Failed to fetch health check logs',
        details: logsError.message
      }, { status: 500 })
    }

    const logs = allLogs || []

    // Estatísticas gerais
    const generalStats = {
      total_checks: logs.length,
      healthy: logs.filter(l => l.status === 'healthy').length,
      degraded: logs.filter(l => l.status === 'degraded').length,
      unhealthy: logs.filter(l => l.status === 'unhealthy').length,
      success_rate_percent: 0,
      avg_response_time_ms: 0,
      min_response_time_ms: 0,
      max_response_time_ms: 0,
      period_hours: hours,
      period_start: since.toISOString(),
      period_end: new Date().toISOString()
    }

    if (logs.length > 0) {
      const successful = generalStats.healthy + generalStats.degraded
      generalStats.success_rate_percent = (successful / logs.length) * 100
      generalStats.avg_response_time_ms = logs.reduce((sum, l) => sum + l.response_time_ms, 0) / logs.length
      generalStats.min_response_time_ms = Math.min(...logs.map(l => l.response_time_ms))
      generalStats.max_response_time_ms = Math.max(...logs.map(l => l.response_time_ms))
    }

    // 2. Estatísticas por agendamento
    const { data: schedules, error: schedulesError } = await supabase
      .from('health_check_schedules')
      .select('id, name, endpoint, enabled')

    const scheduleStats = (schedules || []).map(schedule => {
      const scheduleLogs = logs.filter(l => l.schedule_id === schedule.id)
      
      const stats = {
        schedule_id: schedule.id,
        schedule_name: schedule.name,
        endpoint: schedule.endpoint,
        enabled: schedule.enabled,
        total_checks: scheduleLogs.length,
        healthy: scheduleLogs.filter(l => l.status === 'healthy').length,
        degraded: scheduleLogs.filter(l => l.status === 'degraded').length,
        unhealthy: scheduleLogs.filter(l => l.status === 'unhealthy').length,
        success_rate_percent: 0,
        avg_response_time_ms: 0,
        last_check: null as string | null,
        last_status: 'unknown' as string
      }

      if (scheduleLogs.length > 0) {
        const successful = stats.healthy + stats.degraded
        stats.success_rate_percent = (successful / scheduleLogs.length) * 100
        stats.avg_response_time_ms = scheduleLogs.reduce((sum, l) => sum + l.response_time_ms, 0) / scheduleLogs.length
        
        // Último check
        const lastLog = scheduleLogs.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0]
        stats.last_check = lastLog.checked_at
        stats.last_status = lastLog.status
      }

      return stats
    })

    // 3. Dados para gráficos (agrupados por tempo)
    let timeSeriesData: any[] = []

    if (groupBy === 'hour' && hours <= 168) { // Máximo 7 dias para agrupamento por hora
      // Agrupar por hora
      const hourlyData = new Map<string, any>()
      
      for (let i = 0; i < hours; i++) {
        const hourStart = new Date(Date.now() - (hours - i) * 60 * 60 * 1000)
        const hourKey = hourStart.toISOString().substring(0, 13) + ':00:00.000Z'
        
        hourlyData.set(hourKey, {
          timestamp: hourKey,
          total: 0,
          healthy: 0,
          degraded: 0,
          unhealthy: 0,
          avg_response_time_ms: 0
        })
      }

      logs.forEach(log => {
        const logHour = new Date(log.checked_at).toISOString().substring(0, 13) + ':00:00.000Z'
        const hourData = hourlyData.get(logHour)
        
        if (hourData) {
          hourData.total++
          hourData[log.status]++
        }
      })

      // Calcular médias de tempo de resposta
      hourlyData.forEach((data, hour) => {
        const hourLogs = logs.filter(l => {
          const logHour = new Date(l.checked_at).toISOString().substring(0, 13) + ':00:00.000Z'
          return logHour === hour
        })
        
        if (hourLogs.length > 0) {
          data.avg_response_time_ms = hourLogs.reduce((sum, l) => sum + l.response_time_ms, 0) / hourLogs.length
        }
      })

      timeSeriesData = Array.from(hourlyData.values())

    } else if (groupBy === 'day' || hours > 168) {
      // Agrupar por dia
      const days = Math.ceil(hours / 24)
      const dailyData = new Map<string, any>()
      
      for (let i = 0; i < days; i++) {
        const dayStart = new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000)
        const dayKey = dayStart.toISOString().substring(0, 10)
        
        dailyData.set(dayKey, {
          timestamp: dayKey + 'T00:00:00.000Z',
          total: 0,
          healthy: 0,
          degraded: 0,
          unhealthy: 0,
          avg_response_time_ms: 0
        })
      }

      logs.forEach(log => {
        const logDay = new Date(log.checked_at).toISOString().substring(0, 10)
        const dayData = dailyData.get(logDay)
        
        if (dayData) {
          dayData.total++
          dayData[log.status]++
        }
      })

      // Calcular médias de tempo de resposta
      dailyData.forEach((data, day) => {
        const dayLogs = logs.filter(l => {
          const logDay = new Date(l.checked_at).toISOString().substring(0, 10)
          return logDay === day
        })
        
        if (dayLogs.length > 0) {
          data.avg_response_time_ms = dayLogs.reduce((sum, l) => sum + l.response_time_ms, 0) / dayLogs.length
        }
      })

      timeSeriesData = Array.from(dailyData.values())
    }

    // 4. Alertas e problemas identificados
    const alerts = []

    // Verificar agendamentos com alta taxa de falha
    scheduleStats.forEach(schedule => {
      if (schedule.total_checks > 0 && schedule.success_rate_percent < 90) {
        alerts.push({
          type: 'low_success_rate',
          severity: schedule.success_rate_percent < 70 ? 'critical' : 'warning',
          message: `${schedule.schedule_name} has ${schedule.success_rate_percent.toFixed(1)}% success rate`,
          schedule_id: schedule.schedule_id,
          schedule_name: schedule.schedule_name
        })
      }

      if (schedule.avg_response_time_ms > 10000) {
        alerts.push({
          type: 'slow_response',
          severity: 'warning',
          message: `${schedule.schedule_name} has slow response time: ${schedule.avg_response_time_ms.toFixed(0)}ms`,
          schedule_id: schedule.schedule_id,
          schedule_name: schedule.schedule_name
        })
      }
    })

    // Verificar se há agendamentos que não executaram recentemente
    const { data: enabledSchedules } = await supabase
      .from('health_check_schedules')
      .select('id, name, last_run, interval_minutes')
      .eq('enabled', true)

    const now = new Date()
    enabledSchedules?.forEach(schedule => {
      if (schedule.last_run) {
        const lastRun = new Date(schedule.last_run)
        const expectedNextRun = new Date(lastRun.getTime() + schedule.interval_minutes * 60 * 1000 * 2) // 2x o intervalo
        
        if (now > expectedNextRun) {
          alerts.push({
            type: 'missed_execution',
            severity: 'warning',
            message: `${schedule.name} hasn't run recently (last: ${schedule.last_run})`,
            schedule_id: schedule.id,
            schedule_name: schedule.name
          })
        }
      }
    })

    return NextResponse.json({
      general_stats: generalStats,
      schedule_stats: scheduleStats,
      time_series: timeSeriesData,
      alerts,
      metadata: {
        group_by: groupBy,
        hours_analyzed: hours,
        schedules_count: schedules?.length || 0,
        generated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error generating health check statistics:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}