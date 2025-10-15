/**
 * API para métricas do sistema
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import MonitoringService from '@/lib/monitoring/monitoring-service'

export async function GET(request: NextRequest) {
  try {
    // Verificar se é super admin
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const metricName = searchParams.get('metric')
    const hours = parseInt(searchParams.get('hours') || '1')

    const monitoringService = new MonitoringService()

    if (metricName) {
      // Buscar métrica específica
      const metrics = await monitoringService.getRecentMetrics(metricName, hours)
      return NextResponse.json(metrics)
    } else {
      // Buscar métricas mais recentes de cada tipo
      const since = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      const { data: metrics } = await supabase
        .from('system_metrics')
        .select('*')
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: false })

      // Agrupar por metric_name e pegar o mais recente de cada
      const latestMetrics = new Map()
      
      metrics?.forEach(metric => {
        if (!latestMetrics.has(metric.metric_name)) {
          latestMetrics.set(metric.metric_name, metric)
        }
      })

      return NextResponse.json(Array.from(latestMetrics.values()))
    }
  } catch (error) {
    console.error('Error getting metrics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar se é super admin
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Coletar métricas manualmente
    const monitoringService = new MonitoringService()
    await monitoringService.collectSystemMetrics()

    return NextResponse.json({ success: true, message: 'Metrics collected' })
  } catch (error) {
    console.error('Error collecting metrics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}