/**
 * Monitoring System Health Check API
 * 
 * Endpoint para verificação da saúde do próprio sistema de monitoramento
 * Requirements: 8.3 - Health checks do sistema de monitoramento
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface MonitoringHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  components: {
    metrics_collection: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      last_metric_timestamp?: string
      metrics_count_1h: number
      collection_rate_per_minute: number
    }
    alert_system: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      active_rules: number
      triggered_alerts_24h: number
      critical_alerts_24h: number
      last_alert_check?: string
    }
    health_checks: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      last_full_check?: string
      failed_checks_1h: number
      avg_check_duration_ms: number
    }
    observability: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      log_ingestion_rate: number
      trace_collection: boolean
      error_tracking: boolean
    }
  }
  system_metrics: {
    cpu_usage_percent?: number
    memory_usage_percent: number
    disk_usage_percent?: number
    network_latency_ms?: number
  }
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical'
    message: string
    component: string
    timestamp: string
  }>
  timestamp: string
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const supabase = createClient()
  
  const result: MonitoringHealthCheck = {
    status: 'healthy',
    response_time_ms: 0,
    components: {
      metrics_collection: {
        status: 'healthy',
        metrics_count_1h: 0,
        collection_rate_per_minute: 0
      },
      alert_system: {
        status: 'healthy',
        active_rules: 0,
        triggered_alerts_24h: 0,
        critical_alerts_24h: 0
      },
      health_checks: {
        status: 'healthy',
        failed_checks_1h: 0,
        avg_check_duration_ms: 0
      },
      observability: {
        status: 'healthy',
        log_ingestion_rate: 0,
        trace_collection: false,
        error_tracking: false
      }
    },
    system_metrics: {
      memory_usage_percent: 0
    },
    alerts: [],
    timestamp: new Date().toISOString()
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // 1. Verificar coleta de métricas
    const { data: recentMetrics, error: metricsError } = await supabase
      .from('system_metrics')
      .select('id, recorded_at, metric_type')
      .gte('recorded_at', oneHourAgo.toISOString())
      .order('recorded_at', { ascending: false })

    if (metricsError) {
      result.components.metrics_collection.status = 'unhealthy'
      result.alerts.push({
        severity: 'critical',
        message: 'Cannot access metrics data',
        component: 'metrics_collection',
        timestamp: new Date().toISOString()
      })
    } else {
      const metricsCount = recentMetrics?.length || 0
      result.components.metrics_collection.metrics_count_1h = metricsCount
      result.components.metrics_collection.collection_rate_per_minute = metricsCount / 60

      if (recentMetrics && recentMetrics.length > 0) {
        result.components.metrics_collection.last_metric_timestamp = recentMetrics[0].recorded_at
      }

      // Verificar se a coleta está funcionando adequadamente
      if (metricsCount === 0) {
        result.components.metrics_collection.status = 'unhealthy'
        result.alerts.push({
          severity: 'critical',
          message: 'No metrics collected in the last hour',
          component: 'metrics_collection',
          timestamp: new Date().toISOString()
        })
      } else if (metricsCount < 10) {
        result.components.metrics_collection.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: `Low metrics collection rate: ${metricsCount} metrics in last hour`,
          component: 'metrics_collection',
          timestamp: new Date().toISOString()
        })
      }
    }

    // 2. Verificar sistema de alertas
    const [
      { data: alertRules, error: rulesError },
      { data: recentAlerts, error: alertsError }
    ] = await Promise.all([
      supabase
        .from('alert_rules')
        .select('id, enabled, name, last_checked')
        .eq('enabled', true),
      
      supabase
        .from('alert_instances')
        .select('id, severity, triggered_at, rule_id')
        .gte('triggered_at', twentyFourHoursAgo.toISOString())
    ])

    if (rulesError) {
      result.components.alert_system.status = 'unhealthy'
      result.alerts.push({
        severity: 'critical',
        message: 'Cannot access alert rules',
        component: 'alert_system',
        timestamp: new Date().toISOString()
      })
    } else {
      result.components.alert_system.active_rules = alertRules?.length || 0
      
      if ((alertRules?.length || 0) === 0) {
        result.components.alert_system.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: 'No active alert rules configured',
          component: 'alert_system',
          timestamp: new Date().toISOString()
        })
      }

      // Verificar última verificação de alertas
      const lastChecked = alertRules?.reduce((latest, rule) => {
        if (!rule.last_checked) return latest
        const ruleTime = new Date(rule.last_checked).getTime()
        return ruleTime > latest ? ruleTime : latest
      }, 0)

      if (lastChecked) {
        result.components.alert_system.last_alert_check = new Date(lastChecked).toISOString()
        
        // Se a última verificação foi há mais de 10 minutos, algo pode estar errado
        if (Date.now() - lastChecked > 10 * 60 * 1000) {
          result.components.alert_system.status = 'degraded'
          result.alerts.push({
            severity: 'warning',
            message: 'Alert rules not being checked regularly',
            component: 'alert_system',
            timestamp: new Date().toISOString()
          })
        }
      }
    }

    if (!alertsError && recentAlerts) {
      result.components.alert_system.triggered_alerts_24h = recentAlerts.length
      result.components.alert_system.critical_alerts_24h = recentAlerts.filter(a => a.severity === 'critical').length

      // Muitos alertas críticos podem indicar problemas sistêmicos
      if (result.components.alert_system.critical_alerts_24h > 20) {
        result.components.alert_system.status = 'unhealthy'
        result.alerts.push({
          severity: 'critical',
          message: `High number of critical alerts: ${result.components.alert_system.critical_alerts_24h}`,
          component: 'alert_system',
          timestamp: new Date().toISOString()
        })
      } else if (result.components.alert_system.critical_alerts_24h > 10) {
        result.components.alert_system.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: `Elevated critical alerts: ${result.components.alert_system.critical_alerts_24h}`,
          component: 'alert_system',
          timestamp: new Date().toISOString()
        })
      }
    }

    // 3. Verificar health checks
    const { data: healthCheckLogs, error: healthError } = await supabase
      .from('health_check_logs')
      .select('id, status, duration_ms, checked_at')
      .gte('checked_at', oneHourAgo.toISOString())
      .order('checked_at', { ascending: false })

    if (!healthError && healthCheckLogs) {
      const failedChecks = healthCheckLogs.filter(h => h.status === 'failed').length
      const avgDuration = healthCheckLogs.length > 0
        ? healthCheckLogs.reduce((sum, h) => sum + (h.duration_ms || 0), 0) / healthCheckLogs.length
        : 0

      result.components.health_checks.failed_checks_1h = failedChecks
      result.components.health_checks.avg_check_duration_ms = avgDuration

      if (healthCheckLogs.length > 0) {
        result.components.health_checks.last_full_check = healthCheckLogs[0].checked_at
      }

      if (failedChecks > 5) {
        result.components.health_checks.status = 'unhealthy'
        result.alerts.push({
          severity: 'critical',
          message: `High health check failure rate: ${failedChecks} failures in last hour`,
          component: 'health_checks',
          timestamp: new Date().toISOString()
        })
      } else if (failedChecks > 2 || avgDuration > 30000) {
        result.components.health_checks.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: `Health check issues: ${failedChecks} failures, ${avgDuration.toFixed(0)}ms avg duration`,
          component: 'health_checks',
          timestamp: new Date().toISOString()
        })
      }
    }

    // 4. Verificar observabilidade
    result.components.observability.trace_collection = !!(
      process.env.JAEGER_ENDPOINT || 
      process.env.OTEL_EXPORTER_JAEGER_ENDPOINT
    )
    
    result.components.observability.error_tracking = !!(
      process.env.SENTRY_DSN || 
      process.env.BUGSNAG_API_KEY
    )

    // Verificar logs recentes
    const { data: recentLogs, error: logsError } = await supabase
      .from('application_logs')
      .select('id, level, created_at')
      .gte('created_at', oneHourAgo.toISOString())

    if (!logsError && recentLogs) {
      result.components.observability.log_ingestion_rate = recentLogs.length / 60 // por minuto
      
      if (recentLogs.length === 0) {
        result.components.observability.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: 'No application logs in the last hour',
          component: 'observability',
          timestamp: new Date().toISOString()
        })
      }
    }

    // 5. Métricas do sistema
    const memoryUsage = process.memoryUsage()
    result.system_metrics.memory_usage_percent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    if (result.system_metrics.memory_usage_percent > 90) {
      result.alerts.push({
        severity: 'critical',
        message: `High memory usage: ${result.system_metrics.memory_usage_percent.toFixed(1)}%`,
        component: 'system_resources',
        timestamp: new Date().toISOString()
      })
    } else if (result.system_metrics.memory_usage_percent > 75) {
      result.alerts.push({
        severity: 'warning',
        message: `Elevated memory usage: ${result.system_metrics.memory_usage_percent.toFixed(1)}%`,
        component: 'system_resources',
        timestamp: new Date().toISOString()
      })
    }

    // 6. Determinar status geral
    const componentStatuses = Object.values(result.components).map(c => c.status)
    const unhealthyCount = componentStatuses.filter(s => s === 'unhealthy').length
    const degradedCount = componentStatuses.filter(s => s === 'degraded').length

    if (unhealthyCount > 0) {
      result.status = 'unhealthy'
    } else if (degradedCount > 1) { // Mais tolerante para sistema de monitoramento
      result.status = 'degraded'
    } else {
      result.status = 'healthy'
    }

    result.response_time_ms = Date.now() - startTime

    const statusCode = result.status === 'unhealthy' ? 503 : 200

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        'X-Monitoring-Status': result.status,
        'X-Response-Time': result.response_time_ms.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error('Monitoring health check failed:', error)
    
    result.status = 'unhealthy'
    result.response_time_ms = Date.now() - startTime
    result.alerts.push({
      severity: 'critical',
      message: error instanceof Error ? error.message : 'Monitoring health check failed',
      component: 'system',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(result, {
      status: 503,
      headers: {
        'X-Monitoring-Status': 'unhealthy'
      }
    })
  }
}