/**
 * Admin Monitoring Metrics API
 * 
 * Fornece métricas agregadas para o dashboard de monitoramento
 * Requirements: 4.4, 6.2 - Métricas de sistema e negócio
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import CheckoutMetricsService from '@/lib/monitoring/checkout-metrics'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar se o usuário é super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
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

    const metricsService = new CheckoutMetricsService()
    
    // Período das últimas 24 horas
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)

    // Obter métricas de checkout
    const checkoutMetrics = await metricsService.getCheckoutMetrics(startTime, endTime)
    
    // Obter métricas de pagamento
    const paymentMetrics = await metricsService.getPaymentMetrics(startTime, endTime)
    
    // Obter métricas de performance
    const performanceMetrics = await metricsService.getPerformanceMetrics(startTime, endTime)

    // Obter alertas ativos
    const { data: alertsData } = await supabase
      .from('alert_instances')
      .select('severity, is_resolved')
      .eq('is_resolved', false)

    const alerts = {
      active_alerts: alertsData?.length || 0,
      critical_alerts: alertsData?.filter(a => a.severity === 'critical').length || 0,
      high_alerts: alertsData?.filter(a => a.severity === 'high').length || 0,
      medium_alerts: alertsData?.filter(a => a.severity === 'medium').length || 0,
      low_alerts: alertsData?.filter(a => a.severity === 'low').length || 0
    }

    // Métricas de sistema (simuladas para exemplo)
    const systemMetrics = {
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      cpu_usage_percent: Math.random() * 20 + 10, // Simulado
      uptime_seconds: process.uptime()
    }

    const response = {
      checkout: checkoutMetrics,
      payment: paymentMetrics,
      performance: {
        ...performanceMetrics,
        memory_usage_mb: systemMetrics.memory_usage_mb,
        cpu_usage_percent: systemMetrics.cpu_usage_percent
      },
      alerts,
      system: systemMetrics,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching monitoring metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}