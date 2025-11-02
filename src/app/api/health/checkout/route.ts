/**
 * Checkout System Health Check API
 * 
 * Endpoint específico para verificação da saúde do sistema de checkout
 * Requirements: 8.3, 8.4 - Health checks específicos do checkout
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface CheckoutHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  components: {
    subscription_intents: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      pending_count: number
      old_pending_count: number
      completion_rate_24h: number
    }
    webhook_processing: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      success_rate_24h: number
      avg_processing_time_ms: number
      failed_count_24h: number
    }
    payment_gateway: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      iugu_connectivity: boolean
      last_successful_webhook?: string
    }
    database_performance: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      query_time_ms: number
      connection_pool: string
    }
  }
  metrics: {
    checkouts_started_24h: number
    checkouts_completed_24h: number
    conversion_rate_24h: number
    avg_checkout_time_ms: number
  }
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical'
    message: string
    component: string
  }>
  timestamp: string
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  const result: CheckoutHealthCheck = {
    status: 'healthy',
    response_time_ms: 0,
    components: {
      subscription_intents: {
        status: 'healthy',
        pending_count: 0,
        old_pending_count: 0,
        completion_rate_24h: 0
      },
      webhook_processing: {
        status: 'healthy',
        success_rate_24h: 0,
        avg_processing_time_ms: 0,
        failed_count_24h: 0
      },
      payment_gateway: {
        status: 'healthy',
        iugu_connectivity: false
      },
      database_performance: {
        status: 'healthy',
        query_time_ms: 0,
        connection_pool: 'unknown'
      }
    },
    metrics: {
      checkouts_started_24h: 0,
      checkouts_completed_24h: 0,
      conversion_rate_24h: 0,
      avg_checkout_time_ms: 0
    },
    alerts: [],
    timestamp: new Date().toISOString()
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // 1. Verificar Subscription Intents
    const dbStartTime = Date.now()
    const supabase = await createClient()
    
    const [
      { data: pendingIntents, error: pendingError },
      { data: oldPendingIntents, error: oldPendingError },
      { data: recentIntents, error: recentError }
    ] = await Promise.all([
      supabase
        .from('subscription_intents')
        .select('id')
        .eq('status', 'pending'),
      
      supabase
        .from('subscription_intents')
        .select('id')
        .eq('status', 'pending')
        .lt('created_at', oneDayAgo.toISOString()),
      
      supabase
        .from('subscription_intents')
        .select('id, status, created_at, completed_at')
        .gte('created_at', twentyFourHoursAgo.toISOString())
    ])

    result.components.database_performance.query_time_ms = Date.now() - dbStartTime

    if (pendingError || oldPendingError || recentError) {
      result.components.subscription_intents.status = 'unhealthy'
      result.alerts.push({
        severity: 'critical',
        message: 'Database query errors in subscription intents',
        component: 'subscription_intents'
      })
    } else {
      const pendingCount = pendingIntents?.length || 0
      const oldPendingCount = oldPendingIntents?.length || 0
      const recentCount = recentIntents?.length || 0
      const completedCount = recentIntents?.filter((i: any) => i.status === 'completed').length || 0

      result.components.subscription_intents.pending_count = pendingCount
      result.components.subscription_intents.old_pending_count = oldPendingCount
      result.components.subscription_intents.completion_rate_24h = recentCount > 0 ? (completedCount / recentCount) * 100 : 0

      // Determinar status dos subscription intents
      if (oldPendingCount > 50) {
        result.components.subscription_intents.status = 'unhealthy'
        result.alerts.push({
          severity: 'critical',
          message: `${oldPendingCount} subscription intents pending for over 24h`,
          component: 'subscription_intents'
        })
      } else if (oldPendingCount > 10 || result.components.subscription_intents.completion_rate_24h < 70) {
        result.components.subscription_intents.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: `${oldPendingCount} old pending intents, ${result.components.subscription_intents.completion_rate_24h.toFixed(1)}% completion rate`,
          component: 'subscription_intents'
        })
      }
    }

    // 2. Verificar Webhook Processing
    const { data: webhookMetrics, error: webhookError } = await supabase
      .from('webhook_logs')
      .select('id, status, processing_time_ms, created_at')
      .gte('created_at', twentyFourHoursAgo.toISOString())

    if (webhookError) {
      result.components.webhook_processing.status = 'unhealthy'
      result.alerts.push({
        severity: 'critical',
        message: 'Cannot access webhook logs',
        component: 'webhook_processing'
      })
    } else if (webhookMetrics) {
      const totalWebhooks = webhookMetrics.length
      const successfulWebhooks = webhookMetrics.filter((w: any) => w.status === 'success').length
      const failedWebhooks = webhookMetrics.filter((w: any) => w.status === 'failed').length
      const avgProcessingTime = totalWebhooks > 0 
        ? webhookMetrics.reduce((sum: number, w: any) => sum + (w.processing_time_ms || 0), 0) / totalWebhooks
        : 0

      result.components.webhook_processing.success_rate_24h = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 100
      result.components.webhook_processing.avg_processing_time_ms = avgProcessingTime
      result.components.webhook_processing.failed_count_24h = failedWebhooks

      // Determinar status do webhook processing
      if (result.components.webhook_processing.success_rate_24h < 90) {
        result.components.webhook_processing.status = 'unhealthy'
        result.alerts.push({
          severity: 'critical',
          message: `Webhook success rate: ${result.components.webhook_processing.success_rate_24h.toFixed(1)}%`,
          component: 'webhook_processing'
        })
      } else if (result.components.webhook_processing.success_rate_24h < 95 || avgProcessingTime > 10000) {
        result.components.webhook_processing.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: `Webhook performance degraded: ${result.components.webhook_processing.success_rate_24h.toFixed(1)}% success, ${avgProcessingTime.toFixed(0)}ms avg`,
          component: 'webhook_processing'
        })
      }

      // Verificar último webhook bem-sucedido
      const lastSuccessfulWebhook = webhookMetrics
        .filter((w: any) => w.status === 'success')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      if (lastSuccessfulWebhook) {
        result.components.payment_gateway.last_successful_webhook = lastSuccessfulWebhook.created_at
      }
    }

    // 3. Verificar conectividade com Iugu
    try {
      const iuguResponse = await fetch('https://api.iugu.com/v1/ping', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      result.components.payment_gateway.iugu_connectivity = iuguResponse.ok
      
      if (!iuguResponse.ok) {
        result.components.payment_gateway.status = 'degraded'
        result.alerts.push({
          severity: 'warning',
          message: `Iugu API not responding: HTTP ${iuguResponse.status}`,
          component: 'payment_gateway'
        })
      }
    } catch (error) {
      result.components.payment_gateway.status = 'unhealthy'
      result.components.payment_gateway.iugu_connectivity = false
      result.alerts.push({
        severity: 'critical',
        message: 'Cannot connect to Iugu API',
        component: 'payment_gateway'
      })
    }

    // 4. Verificar métricas de checkout
    const { data: checkoutMetrics, error: metricsError } = await supabase
      .from('checkout_metrics')
      .select('checkouts_started, checkouts_completed, avg_completion_time_ms')
      .gte('timestamp', twentyFourHoursAgo.toISOString())

    if (!metricsError && checkoutMetrics) {
      result.metrics.checkouts_started_24h = checkoutMetrics.reduce((sum: number, m: any) => sum + (m.checkouts_started || 0), 0)
      result.metrics.checkouts_completed_24h = checkoutMetrics.reduce((sum: number, m: any) => sum + (m.checkouts_completed || 0), 0)
      result.metrics.conversion_rate_24h = result.metrics.checkouts_started_24h > 0 
        ? (result.metrics.checkouts_completed_24h / result.metrics.checkouts_started_24h) * 100 
        : 0
      result.metrics.avg_checkout_time_ms = checkoutMetrics.length > 0
        ? checkoutMetrics.reduce((sum: number, m: any) => sum + (m.avg_completion_time_ms || 0), 0) / checkoutMetrics.length
        : 0

      // Alertas baseados em métricas
      if (result.metrics.conversion_rate_24h < 50) {
        result.alerts.push({
          severity: 'critical',
          message: `Low conversion rate: ${result.metrics.conversion_rate_24h.toFixed(1)}%`,
          component: 'checkout_metrics'
        })
      } else if (result.metrics.conversion_rate_24h < 70) {
        result.alerts.push({
          severity: 'warning',
          message: `Below target conversion rate: ${result.metrics.conversion_rate_24h.toFixed(1)}%`,
          component: 'checkout_metrics'
        })
      }
    }

    // 5. Determinar status geral
    const componentStatuses = Object.values(result.components).map(c => c.status)
    const unhealthyCount = componentStatuses.filter(s => s === 'unhealthy').length
    const degradedCount = componentStatuses.filter(s => s === 'degraded').length

    if (unhealthyCount > 0) {
      result.status = 'unhealthy'
    } else if (degradedCount > 0) {
      result.status = 'degraded'
    } else {
      result.status = 'healthy'
    }

    // Performance do banco
    if (result.components.database_performance.query_time_ms > 2000) {
      result.components.database_performance.status = 'degraded'
      result.alerts.push({
        severity: 'warning',
        message: `Slow database queries: ${result.components.database_performance.query_time_ms}ms`,
        component: 'database_performance'
      })
    }

    result.response_time_ms = Date.now() - startTime

    const statusCode = result.status === 'unhealthy' ? 503 : 200

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        'X-Checkout-Status': result.status,
        'X-Response-Time': result.response_time_ms.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error('Checkout health check failed:', error)
    
    result.status = 'unhealthy'
    result.response_time_ms = Date.now() - startTime
    result.alerts.push({
      severity: 'critical',
      message: error instanceof Error ? error.message : 'Checkout health check failed',
      component: 'system'
    })

    return NextResponse.json(result, {
      status: 503,
      headers: {
        'X-Checkout-Status': 'unhealthy'
      }
    })
  }
}