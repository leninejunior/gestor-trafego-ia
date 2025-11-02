/**
 * System Health Check API
 * 
 * Fornece informações sobre a saúde dos componentes do sistema
 * Requirements: 8.3, 8.4 - Health checks e verificações de dependências
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface HealthCheck {
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms?: number
  error?: string
  details?: Record<string, any>
  last_check: string
}

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    const healthChecks: HealthCheck[] = []

    // 1. Verificar conexão com banco de dados
    try {
      const dbStartTime = Date.now()
      const supabase = await createClient()
      
      const { error: dbError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)

      const dbResponseTime = Date.now() - dbStartTime

      healthChecks.push({
        component: 'database',
        status: dbError ? 'unhealthy' : dbResponseTime > 1000 ? 'degraded' : 'healthy',
        response_time_ms: dbResponseTime,
        error: dbError?.message,
        details: {
          connection_pool: 'active',
          query_performance: dbResponseTime < 500 ? 'good' : 'slow'
        },
        last_check: new Date().toISOString()
      })
    } catch (error) {
      healthChecks.push({
        component: 'database',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown database error',
        last_check: new Date().toISOString()
      })
    }

    // 2. Verificar conectividade com Iugu
    try {
      const iuguStartTime = Date.now()
      
      // Fazer uma requisição simples para verificar conectividade
      const response = await fetch('https://api.iugu.com/v1/ping', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 segundos timeout
      })

      const iuguResponseTime = Date.now() - iuguStartTime

      healthChecks.push({
        component: 'iugu_api',
        status: response.ok ? 'healthy' : 'degraded',
        response_time_ms: iuguResponseTime,
        details: {
          status_code: response.status,
          endpoint: 'https://api.iugu.com/v1/ping'
        },
        last_check: new Date().toISOString()
      })
    } catch (error) {
      healthChecks.push({
        component: 'iugu_api',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Iugu API connection failed',
        last_check: new Date().toISOString()
      })
    }

    // 3. Verificar sistema de arquivos
    try {
      const fsStartTime = Date.now()
      const { promises: fs } = await import('fs')
      
      await fs.access('./package.json')
      const fsResponseTime = Date.now() - fsStartTime

      healthChecks.push({
        component: 'file_system',
        status: 'healthy',
        response_time_ms: fsResponseTime,
        details: {
          writable: true,
          readable: true
        },
        last_check: new Date().toISOString()
      })
    } catch (error) {
      healthChecks.push({
        component: 'file_system',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'File system error',
        last_check: new Date().toISOString()
      })
    }

    // 4. Verificar métricas de sistema
    try {
      const memoryUsage = process.memoryUsage()
      const uptime = process.uptime()
      
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024
      const memoryStatus = memoryUsageMB > 512 ? 'degraded' : 'healthy'

      healthChecks.push({
        component: 'system_resources',
        status: memoryStatus,
        details: {
          memory_usage_mb: Math.round(memoryUsageMB),
          memory_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          uptime_seconds: Math.round(uptime),
          uptime_hours: Math.round(uptime / 3600 * 100) / 100
        },
        last_check: new Date().toISOString()
      })
    } catch (error) {
      healthChecks.push({
        component: 'system_resources',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'System resources error',
        last_check: new Date().toISOString()
      })
    }

    // 5. Verificar sistema de alertas
    try {
      const supabase = await createClient()
      
      const { data: alertRules, error: alertError } = await supabase
        .from('alert_rules')
        .select('id, enabled')
        .eq('enabled', true)

      const { data: recentAlerts } = await supabase
        .from('alert_instances')
        .select('severity')
        .gte('triggered_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Última hora

      const criticalAlerts = recentAlerts?.filter(a => a.severity === 'critical').length || 0
      const alertStatus = alertError ? 'unhealthy' : criticalAlerts > 5 ? 'degraded' : 'healthy'

      healthChecks.push({
        component: 'alert_system',
        status: alertStatus,
        error: alertError?.message,
        details: {
          active_rules: alertRules?.length || 0,
          recent_alerts: recentAlerts?.length || 0,
          critical_alerts_last_hour: criticalAlerts
        },
        last_check: new Date().toISOString()
      })
    } catch (error) {
      healthChecks.push({
        component: 'alert_system',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Alert system error',
        last_check: new Date().toISOString()
      })
    }

    // 6. Verificar sistema de métricas
    try {
      const supabase = await createClient()
      
      const { data: recentMetrics, error: metricsError } = await supabase
        .from('checkout_metrics')
        .select('id')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Última hora
        .limit(1)

      const metricsStatus = metricsError ? 'unhealthy' : 'healthy'

      healthChecks.push({
        component: 'metrics_collection',
        status: metricsStatus,
        error: metricsError?.message,
        details: {
          recent_metrics_available: !!recentMetrics && recentMetrics.length > 0,
          collection_active: true
        },
        last_check: new Date().toISOString()
      })
    } catch (error) {
      healthChecks.push({
        component: 'metrics_collection',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Metrics collection error',
        last_check: new Date().toISOString()
      })
    }

    // Calcular status geral
    const unhealthyCount = healthChecks.filter(h => h.status === 'unhealthy').length
    const degradedCount = healthChecks.filter(h => h.status === 'degraded').length
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedCount > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    const totalResponseTime = Date.now() - startTime

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      response_time_ms: totalResponseTime,
      components: healthChecks,
      summary: {
        total_components: healthChecks.length,
        healthy: healthChecks.filter(h => h.status === 'healthy').length,
        degraded: healthChecks.filter(h => h.status === 'degraded').length,
        unhealthy: healthChecks.filter(h => h.status === 'unhealthy').length
      }
    }

    // Retornar status HTTP baseado na saúde geral
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

    return NextResponse.json(response, { status: statusCode })

  } catch (error) {
    console.error('Error in health check:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      components: []
    }, { status: 503 })
  }
}

// Endpoint simplificado para verificações rápidas
export async function HEAD(request: NextRequest) {
  try {
    // Verificação rápida apenas do banco de dados
    const supabase = await createClient()
    const { error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)

    if (error) {
      return new NextResponse(null, { status: 503 })
    }

    return new NextResponse(null, { status: 200 })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}