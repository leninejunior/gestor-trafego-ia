/**
 * Health Check Service
 * 
 * Serviço completo de verificação de saúde do sistema
 * Requirements: 8.3, 8.4 - Health checks e verificações de dependências externas
 */

import { createClient } from '@/lib/supabase/server'

export interface HealthCheckResult {
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  error?: string
  details?: Record<string, any>
  timestamp: Date
}

export interface SystemHealth {
  overall_status: 'healthy' | 'degraded' | 'unhealthy'
  components: HealthCheckResult[]
  summary: {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
  }
  last_check: Date
}

export class HealthCheckService {
  private async getSupabase() {
    return createClient()
  }

  /**
   * Executa verificação completa de saúde do sistema
   */
  async performFullHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = []

    // Executar todas as verificações em paralelo
    const checkPromises = [
      this.checkDatabase(),
      this.checkIuguConnectivity(),
      this.checkFileSystem(),
      this.checkSystemResources(),
      this.checkAlertSystem(),
      this.checkMetricsCollection(),
      this.checkWebhookProcessing(),
      this.checkSubscriptionIntents(),
      this.checkEmailService(),
      this.checkRedisCache()
    ]

    const results = await Promise.allSettled(checkPromises)
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(result.value)
      } else {
        // Se a verificação falhou, criar um resultado de erro
        const componentNames = [
          'database', 'iugu_api', 'file_system', 'system_resources',
          'alert_system', 'metrics_collection', 'webhook_processing',
          'subscription_intents', 'email_service', 'redis_cache'
        ]
        
        checks.push({
          component: componentNames[index] || 'unknown',
          status: 'unhealthy',
          response_time_ms: 0,
          error: result.reason?.message || 'Health check failed',
          timestamp: new Date()
        })
      }
    })

    // Calcular status geral
    const unhealthy = checks.filter(c => c.status === 'unhealthy').length
    const degraded = checks.filter(c => c.status === 'degraded').length
    const healthy = checks.filter(c => c.status === 'healthy').length

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthy > 0) {
      overallStatus = 'unhealthy'
    } else if (degraded > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    return {
      overall_status: overallStatus,
      components: checks,
      summary: {
        total: checks.length,
        healthy,
        degraded,
        unhealthy
      },
      last_check: new Date()
    }
  }

  /**
   * Verifica conectividade com banco de dados
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Teste de conectividade básica
      const supabase = await this.getSupabase()
      const { error: connectError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)

      if (connectError) {
        return {
          component: 'database',
          status: 'unhealthy',
          response_time_ms: Date.now() - startTime,
          error: connectError.message,
          timestamp: new Date()
        }
      }

      // Teste de performance de query
      const queryStartTime = Date.now()
      const { error: queryError } = await supabase
        .from('subscription_intents')
        .select('id, status')
        .limit(10)

      const queryTime = Date.now() - queryStartTime
      const totalTime = Date.now() - startTime

      if (queryError) {
        return {
          component: 'database',
          status: 'degraded',
          response_time_ms: totalTime,
          error: `Query error: ${queryError.message}`,
          details: {
            connection_test: 'passed',
            query_test: 'failed'
          },
          timestamp: new Date()
        }
      }

      // Determinar status baseado na performance
      const status = totalTime > 2000 ? 'degraded' : 'healthy'

      return {
        component: 'database',
        status,
        response_time_ms: totalTime,
        details: {
          connection_test: 'passed',
          query_test: 'passed',
          query_time_ms: queryTime,
          performance: totalTime < 500 ? 'excellent' : totalTime < 1000 ? 'good' : 'slow'
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'database',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Database connection failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica conectividade com API do Iugu
   */
  async checkIuguConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos timeout

      const response = await fetch('https://api.iugu.com/v1/ping', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HealthCheck/1.0'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      if (!response.ok) {
        return {
          component: 'iugu_api',
          status: 'degraded',
          response_time_ms: responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: {
            status_code: response.status,
            endpoint: 'https://api.iugu.com/v1/ping'
          },
          timestamp: new Date()
        }
      }

      // Verificar se há credenciais configuradas
      const hasCredentials = !!(process.env.IUGU_API_TOKEN || process.env.IUGU_ACCOUNT_ID)

      return {
        component: 'iugu_api',
        status: responseTime > 5000 ? 'degraded' : 'healthy',
        response_time_ms: responseTime,
        details: {
          status_code: response.status,
          endpoint: 'https://api.iugu.com/v1/ping',
          credentials_configured: hasCredentials,
          performance: responseTime < 1000 ? 'excellent' : responseTime < 3000 ? 'good' : 'slow'
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'iugu_api',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Iugu API connection failed',
        details: {
          endpoint: 'https://api.iugu.com/v1/ping'
        },
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica sistema de arquivos
   */
  async checkFileSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const { promises: fs } = await import('fs')
      const path = await import('path')

      // Verificar leitura
      await fs.access('./package.json', fs.constants.R_OK)
      
      // Verificar escrita (criar arquivo temporário)
      const tempFile = path.join(process.cwd(), '.health-check-temp')
      await fs.writeFile(tempFile, 'health-check-test')
      await fs.unlink(tempFile)

      const responseTime = Date.now() - startTime

      return {
        component: 'file_system',
        status: 'healthy',
        response_time_ms: responseTime,
        details: {
          read_access: true,
          write_access: true,
          working_directory: process.cwd()
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'file_system',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'File system error',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica recursos do sistema
   */
  async checkSystemResources(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const memoryUsage = process.memoryUsage()
      const uptime = process.uptime()
      
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024
      const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100

      // Determinar status baseado no uso de memória
      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (memoryUsagePercent > 90) {
        status = 'unhealthy'
      } else if (memoryUsagePercent > 75) {
        status = 'degraded'
      } else {
        status = 'healthy'
      }

      return {
        component: 'system_resources',
        status,
        response_time_ms: Date.now() - startTime,
        details: {
          memory: {
            heap_used_mb: Math.round(heapUsedMB),
            heap_total_mb: Math.round(heapTotalMB),
            usage_percent: Math.round(memoryUsagePercent),
            rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
            external_mb: Math.round(memoryUsage.external / 1024 / 1024)
          },
          process: {
            uptime_seconds: Math.round(uptime),
            uptime_hours: Math.round(uptime / 3600 * 100) / 100,
            pid: process.pid,
            node_version: process.version
          }
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'system_resources',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'System resources check failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica sistema de alertas
   */
  async checkAlertSystem(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Verificar se existem regras de alerta ativas
      const supabase = await this.getSupabase()
      const { data: alertRules, error: rulesError } = await supabase
        .from('alert_rules')
        .select('id, enabled, name')
        .eq('enabled', true)

      if (rulesError) {
        return {
          component: 'alert_system',
          status: 'unhealthy',
          response_time_ms: Date.now() - startTime,
          error: rulesError.message,
          timestamp: new Date()
        }
      }

      // Verificar alertas recentes
      const { data: recentAlerts, error: alertsError } = await supabase
        .from('alert_instances')
        .select('id, severity, triggered_at')
        .gte('triggered_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (alertsError) {
        return {
          component: 'alert_system',
          status: 'degraded',
          response_time_ms: Date.now() - startTime,
          error: `Recent alerts check failed: ${alertsError.message}`,
          details: {
            active_rules: alertRules?.length || 0
          },
          timestamp: new Date()
        }
      }

      const criticalAlerts = recentAlerts?.filter((a: any) => a.severity === 'critical').length || 0
      
      // Determinar status
      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (criticalAlerts > 10) {
        status = 'unhealthy'
      } else if (criticalAlerts > 5 || (alertRules?.length || 0) === 0) {
        status = 'degraded'
      } else {
        status = 'healthy'
      }

      return {
        component: 'alert_system',
        status,
        response_time_ms: Date.now() - startTime,
        details: {
          active_rules: alertRules?.length || 0,
          recent_alerts_24h: recentAlerts?.length || 0,
          critical_alerts_24h: criticalAlerts,
          rules_configured: (alertRules?.length || 0) > 0
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'alert_system',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Alert system check failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica coleta de métricas
   */
  async checkMetricsCollection(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Verificar se há métricas recentes
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const supabase = await this.getSupabase()
      const { data: recentMetrics, error: metricsError } = await supabase
        .from('checkout_metrics')
        .select('id, timestamp')
        .gte('timestamp', oneHourAgo.toISOString())
        .limit(5)

      if (metricsError) {
        return {
          component: 'metrics_collection',
          status: 'unhealthy',
          response_time_ms: Date.now() - startTime,
          error: metricsError.message,
          timestamp: new Date()
        }
      }

      // Verificar métricas do sistema
      const { data: systemMetrics, error: systemError } = await supabase
        .from('system_metrics')
        .select('id, recorded_at')
        .gte('recorded_at', oneHourAgo.toISOString())
        .limit(5)

      const hasRecentMetrics = (recentMetrics?.length || 0) > 0
      const hasSystemMetrics = (systemMetrics?.length || 0) > 0

      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (!hasRecentMetrics && !hasSystemMetrics) {
        status = 'unhealthy'
      } else if (!hasRecentMetrics || !hasSystemMetrics) {
        status = 'degraded'
      } else {
        status = 'healthy'
      }

      return {
        component: 'metrics_collection',
        status,
        response_time_ms: Date.now() - startTime,
        details: {
          checkout_metrics_last_hour: recentMetrics?.length || 0,
          system_metrics_last_hour: systemMetrics?.length || 0,
          collection_active: hasRecentMetrics || hasSystemMetrics,
          system_metrics_error: systemError?.message
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'metrics_collection',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Metrics collection check failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica processamento de webhooks
   */
  async checkWebhookProcessing(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const supabase = await this.getSupabase()
      const { data: recentWebhooks, error: webhookError } = await supabase
        .from('webhook_metrics')
        .select('id, status, processing_time_ms')
        .gte('timestamp', oneHourAgo.toISOString())

      if (webhookError) {
        return {
          component: 'webhook_processing',
          status: 'unhealthy',
          response_time_ms: Date.now() - startTime,
          error: webhookError.message,
          timestamp: new Date()
        }
      }

      const totalWebhooks = recentWebhooks?.length || 0
      const successfulWebhooks = recentWebhooks?.filter((w: any) => w.status === 'success').length || 0
      const failedWebhooks = recentWebhooks?.filter((w: any) => w.status === 'failed').length || 0
      
      const successRate = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 100
      const avgProcessingTime = totalWebhooks > 0 
        ? recentWebhooks!.reduce((sum: number, w: any) => sum + (w.processing_time_ms || 0), 0) / totalWebhooks
        : 0

      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (successRate < 90) {
        status = 'unhealthy'
      } else if (successRate < 95 || avgProcessingTime > 10000) {
        status = 'degraded'
      } else {
        status = 'healthy'
      }

      return {
        component: 'webhook_processing',
        status,
        response_time_ms: Date.now() - startTime,
        details: {
          webhooks_last_hour: totalWebhooks,
          successful_webhooks: successfulWebhooks,
          failed_webhooks: failedWebhooks,
          success_rate_percent: Math.round(successRate * 100) / 100,
          avg_processing_time_ms: Math.round(avgProcessingTime),
          performance: avgProcessingTime < 1000 ? 'excellent' : avgProcessingTime < 5000 ? 'good' : 'slow'
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'webhook_processing',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Webhook processing check failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica sistema de subscription intents
   */
  async checkSubscriptionIntents(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Verificar intents pendentes há muito tempo
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      const supabase = await this.getSupabase()
      const { data: oldPendingIntents, error: pendingError } = await supabase
        .from('subscription_intents')
        .select('id, status, created_at')
        .eq('status', 'pending')
        .lt('created_at', oneDayAgo.toISOString())

      if (pendingError) {
        return {
          component: 'subscription_intents',
          status: 'unhealthy',
          response_time_ms: Date.now() - startTime,
          error: pendingError.message,
          timestamp: new Date()
        }
      }

      // Verificar intents recentes
      const { data: recentIntents, error: recentError } = await supabase
        .from('subscription_intents')
        .select('id, status')
        .gte('created_at', oneDayAgo.toISOString())

      const oldPendingCount = oldPendingIntents?.length || 0
      const recentIntentsCount = recentIntents?.length || 0
      const completedRecent = recentIntents?.filter((i: any) => i.status === 'completed').length || 0

      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (oldPendingCount > 50) {
        status = 'unhealthy'
      } else if (oldPendingCount > 10) {
        status = 'degraded'
      } else {
        status = 'healthy'
      }

      return {
        component: 'subscription_intents',
        status,
        response_time_ms: Date.now() - startTime,
        details: {
          old_pending_intents: oldPendingCount,
          recent_intents_24h: recentIntentsCount,
          completed_recent: completedRecent,
          completion_rate_recent: recentIntentsCount > 0 ? Math.round((completedRecent / recentIntentsCount) * 100) : 0,
          recent_error: recentError?.message
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'subscription_intents',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Subscription intents check failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica serviço de email
   */
  async checkEmailService(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Verificar configuração de email
      const emailConfigured = !!(
        process.env.SMTP_HOST || 
        process.env.SENDGRID_API_KEY || 
        process.env.RESEND_API_KEY
      )

      if (!emailConfigured) {
        return {
          component: 'email_service',
          status: 'degraded',
          response_time_ms: Date.now() - startTime,
          error: 'No email service configured',
          details: {
            smtp_configured: !!process.env.SMTP_HOST,
            sendgrid_configured: !!process.env.SENDGRID_API_KEY,
            resend_configured: !!process.env.RESEND_API_KEY
          },
          timestamp: new Date()
        }
      }

      // Para uma verificação mais completa, poderíamos tentar enviar um email de teste
      // Por enquanto, apenas verificamos a configuração

      return {
        component: 'email_service',
        status: 'healthy',
        response_time_ms: Date.now() - startTime,
        details: {
          service_configured: true,
          smtp_configured: !!process.env.SMTP_HOST,
          sendgrid_configured: !!process.env.SENDGRID_API_KEY,
          resend_configured: !!process.env.RESEND_API_KEY
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'email_service',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Email service check failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Verifica cache Redis (se configurado)
   */
  async checkRedisCache(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL

      if (!redisUrl) {
        return {
          component: 'redis_cache',
          status: 'degraded',
          response_time_ms: Date.now() - startTime,
          error: 'Redis not configured',
          details: {
            configured: false,
            optional: true
          },
          timestamp: new Date()
        }
      }

      // Se Redis estiver configurado, poderíamos fazer uma verificação real
      // Por enquanto, apenas verificamos a configuração

      return {
        component: 'redis_cache',
        status: 'healthy',
        response_time_ms: Date.now() - startTime,
        details: {
          configured: true,
          url_configured: !!redisUrl
        },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        component: 'redis_cache',
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Redis cache check failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Executa verificação rápida (apenas componentes críticos)
   */
  async performQuickHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = []

    // Apenas verificações críticas e rápidas
    const quickChecks = [
      this.checkDatabase(),
      this.checkSystemResources()
    ]

    const results = await Promise.allSettled(quickChecks)
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(result.value)
      } else {
        const componentNames = ['database', 'system_resources']
        checks.push({
          component: componentNames[index],
          status: 'unhealthy',
          response_time_ms: 0,
          error: result.reason?.message || 'Quick health check failed',
          timestamp: new Date()
        })
      }
    })

    const unhealthy = checks.filter(c => c.status === 'unhealthy').length
    const degraded = checks.filter(c => c.status === 'degraded').length
    const healthy = checks.filter(c => c.status === 'healthy').length

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthy > 0) {
      overallStatus = 'unhealthy'
    } else if (degraded > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    return {
      overall_status: overallStatus,
      components: checks,
      summary: {
        total: checks.length,
        healthy,
        degraded,
        unhealthy
      },
      last_check: new Date()
    }
  }
}

export default HealthCheckService