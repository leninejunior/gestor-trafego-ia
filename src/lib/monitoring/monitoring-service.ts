/**
 * Serviço de Monitoramento e Logs
 * - Coleta de métricas de sistema
 * - Logs estruturados
 * - Alertas automáticos
 * - Health checks
 * - Performance monitoring
 */

import { createClient } from '@/lib/supabase/server'
import { NotificationService } from '@/lib/notifications/notification-service'

interface SystemMetric {
  name: string
  value: number
  unit?: string
  tags?: Record<string, string>
  timestamp?: Date
}

interface SystemAlert {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  metadata?: Record<string, any>
}

interface HealthCheck {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  error?: string
  lastCheck: Date
}

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string
  service: string
  userId?: string
  organizationId?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export class MonitoringService {
  private supabase = createClient()
  private notificationService = new NotificationService()
  private healthChecks = new Map<string, HealthCheck>()
  private alertThresholds = {
    responseTime: 5000, // 5 segundos
    errorRate: 0.05,    // 5%
    memoryUsage: 0.85,  // 85%
    diskUsage: 0.90     // 90%
  }

  /**
   * Registra uma métrica do sistema
   */
  async recordMetric(metric: SystemMetric): Promise<void> {
    try {
      await this.supabase
        .from('system_metrics')
        .insert({
          metric_name: metric.name,
          metric_value: metric.value,
          metric_unit: metric.unit,
          tags: metric.tags || {},
          recorded_at: (metric.timestamp || new Date()).toISOString()
        })

      // Verificar se a métrica excede limites
      await this.checkMetricThresholds(metric)
    } catch (error) {
      console.error('Error recording metric:', error)
    }
  }

  /**
   * Registra múltiplas métricas
   */
  async recordMetrics(metrics: SystemMetric[]): Promise<void> {
    try {
      const records = metrics.map(metric => ({
        metric_name: metric.name,
        metric_value: metric.value,
        metric_unit: metric.unit,
        tags: metric.tags || {},
        recorded_at: (metric.timestamp || new Date()).toISOString()
      }))

      await this.supabase
        .from('system_metrics')
        .insert(records)

      // Verificar limites para cada métrica
      for (const metric of metrics) {
        await this.checkMetricThresholds(metric)
      }
    } catch (error) {
      console.error('Error recording metrics:', error)
    }
  }

  /**
   * Cria um alerta do sistema
   */
  async createAlert(alert: SystemAlert): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('system_alerts')
        .insert({
          alert_type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata || {},
          is_resolved: false,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      // Enviar notificação para super admins
      if (alert.severity === 'high' || alert.severity === 'critical') {
        await this.notifySystemAdmins(alert)
      }

      console.log(`System alert created: ${alert.title} (${alert.severity})`)
    } catch (error) {
      console.error('Error creating system alert:', error)
    }
  }

  /**
   * Resolve um alerta
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    try {
      await this.supabase
        .from('system_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy
        })
        .eq('id', alertId)

      console.log(`System alert ${alertId} resolved`)
    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  /**
   * Executa health check de um serviço
   */
  async performHealthCheck(serviceName: string, checkFunction: () => Promise<boolean>): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const isHealthy = await checkFunction()
      const responseTime = Date.now() - startTime
      
      const healthCheck: HealthCheck = {
        service: serviceName,
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date()
      }

      this.healthChecks.set(serviceName, healthCheck)

      // Registrar métrica de health check
      await this.recordMetric({
        name: 'health_check_response_time',
        value: responseTime,
        unit: 'ms',
        tags: { service: serviceName }
      })

      await this.recordMetric({
        name: 'health_check_status',
        value: isHealthy ? 1 : 0,
        tags: { service: serviceName }
      })

      // Criar alerta se serviço não estiver saudável
      if (!isHealthy) {
        await this.createAlert({
          type: 'service_unhealthy',
          severity: 'high',
          title: `Service ${serviceName} is unhealthy`,
          message: `Health check failed for service ${serviceName}`,
          metadata: { service: serviceName, responseTime }
        })
      }

      return healthCheck
    } catch (error) {
      const healthCheck: HealthCheck = {
        service: serviceName,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      }

      this.healthChecks.set(serviceName, healthCheck)

      await this.createAlert({
        type: 'service_error',
        severity: 'critical',
        title: `Service ${serviceName} error`,
        message: `Health check error for service ${serviceName}: ${healthCheck.error}`,
        metadata: { service: serviceName, error: healthCheck.error }
      })

      return healthCheck
    }
  }

  /**
   * Obtém status de todos os health checks
   */
  getHealthStatus(): Record<string, HealthCheck> {
    return Object.fromEntries(this.healthChecks.entries())
  }

  /**
   * Registra log estruturado
   */
  async log(entry: LogEntry): Promise<void> {
    try {
      // Log no console com formatação
      const timestamp = entry.timestamp.toISOString()
      const level = entry.level.toUpperCase().padEnd(5)
      const service = entry.service.padEnd(15)
      
      console.log(`[${timestamp}] ${level} ${service} ${entry.message}`, 
        entry.metadata ? JSON.stringify(entry.metadata) : '')

      // Salvar no banco se for warning ou erro
      if (['warn', 'error', 'fatal'].includes(entry.level)) {
        // Aqui você poderia salvar em uma tabela de logs
        // Por enquanto, apenas criar alerta para erros críticos
        if (entry.level === 'error' || entry.level === 'fatal') {
          await this.createAlert({
            type: 'application_error',
            severity: entry.level === 'fatal' ? 'critical' : 'medium',
            title: `${entry.level.toUpperCase()} in ${entry.service}`,
            message: entry.message,
            metadata: {
              service: entry.service,
              userId: entry.userId,
              organizationId: entry.organizationId,
              ...entry.metadata
            }
          })
        }
      }
    } catch (error) {
      console.error('Error logging entry:', error)
    }
  }

  /**
   * Coleta métricas do sistema
   */
  async collectSystemMetrics(): Promise<void> {
    try {
      const metrics: SystemMetric[] = []

      // Métricas de processo Node.js
      const memUsage = process.memoryUsage()
      metrics.push(
        { name: 'nodejs_memory_rss', value: memUsage.rss, unit: 'bytes' },
        { name: 'nodejs_memory_heap_used', value: memUsage.heapUsed, unit: 'bytes' },
        { name: 'nodejs_memory_heap_total', value: memUsage.heapTotal, unit: 'bytes' },
        { name: 'nodejs_memory_external', value: memUsage.external, unit: 'bytes' }
      )

      // Uptime do processo
      metrics.push({
        name: 'nodejs_uptime',
        value: process.uptime(),
        unit: 'seconds'
      })

      // Métricas de CPU (se disponível)
      if (process.cpuUsage) {
        const cpuUsage = process.cpuUsage()
        metrics.push(
          { name: 'nodejs_cpu_user', value: cpuUsage.user, unit: 'microseconds' },
          { name: 'nodejs_cpu_system', value: cpuUsage.system, unit: 'microseconds' }
        )
      }

      // Métricas de banco de dados
      await this.collectDatabaseMetrics(metrics)

      // Registrar todas as métricas
      await this.recordMetrics(metrics)
    } catch (error) {
      console.error('Error collecting system metrics:', error)
    }
  }

  /**
   * Coleta métricas do banco de dados
   */
  private async collectDatabaseMetrics(metrics: SystemMetric[]): Promise<void> {
    try {
      // Contar registros em tabelas principais
      const tables = [
        'organizations',
        'organization_members',
        'clients',
        'meta_campaigns',
        'meta_insights',
        'notifications'
      ]

      for (const table of tables) {
        try {
          const { count, error } = await this.supabase
            .from(table)
            .select('*', { count: 'exact', head: true })

          if (!error && count !== null) {
            metrics.push({
              name: 'database_table_count',
              value: count,
              tags: { table }
            })
          }
        } catch (error) {
          // Ignorar erros de tabelas específicas
        }
      }

      // Métricas de conexões ativas (se disponível via função personalizada)
      try {
        const { data: connections } = await this.supabase
          .rpc('get_active_connections_count')

        if (connections) {
          metrics.push({
            name: 'database_active_connections',
            value: connections
          })
        }
      } catch (error) {
        // Função pode não existir
      }
    } catch (error) {
      console.error('Error collecting database metrics:', error)
    }
  }

  /**
   * Verifica se métricas excedem limites
   */
  private async checkMetricThresholds(metric: SystemMetric): Promise<void> {
    const { name, value, tags } = metric

    switch (name) {
      case 'response_time':
        if (value > this.alertThresholds.responseTime) {
          await this.createAlert({
            type: 'high_response_time',
            severity: 'medium',
            title: 'High Response Time Detected',
            message: `Response time of ${value}ms exceeds threshold of ${this.alertThresholds.responseTime}ms`,
            metadata: { metric: name, value, threshold: this.alertThresholds.responseTime, tags }
          })
        }
        break

      case 'error_rate':
        if (value > this.alertThresholds.errorRate) {
          await this.createAlert({
            type: 'high_error_rate',
            severity: 'high',
            title: 'High Error Rate Detected',
            message: `Error rate of ${(value * 100).toFixed(2)}% exceeds threshold of ${(this.alertThresholds.errorRate * 100).toFixed(2)}%`,
            metadata: { metric: name, value, threshold: this.alertThresholds.errorRate, tags }
          })
        }
        break

      case 'nodejs_memory_heap_used':
        const heapUsagePercent = value / (process.memoryUsage().heapTotal || 1)
        if (heapUsagePercent > this.alertThresholds.memoryUsage) {
          await this.createAlert({
            type: 'high_memory_usage',
            severity: 'medium',
            title: 'High Memory Usage Detected',
            message: `Memory usage of ${(heapUsagePercent * 100).toFixed(2)}% exceeds threshold of ${(this.alertThresholds.memoryUsage * 100).toFixed(2)}%`,
            metadata: { metric: name, value, heapUsagePercent, threshold: this.alertThresholds.memoryUsage }
          })
        }
        break
    }
  }

  /**
   * Notifica super admins sobre alertas críticos
   */
  private async notifySystemAdmins(alert: SystemAlert): Promise<void> {
    try {
      // Buscar super admins
      const { data: superAdmins } = await this.supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin')

      if (!superAdmins || superAdmins.length === 0) return

      // Criar notificação para cada super admin
      for (const admin of superAdmins) {
        await this.notificationService.createNotification({
          userId: admin.user_id,
          type: 'system_alert',
          title: alert.title,
          message: alert.message,
          priority: alert.severity === 'critical' ? 'high' : 'medium',
          metadata: {
            alertType: alert.type,
            severity: alert.severity,
            ...alert.metadata
          }
        })
      }
    } catch (error) {
      console.error('Error notifying system admins:', error)
    }
  }

  /**
   * Executa health checks de todos os serviços
   */
  async performAllHealthChecks(): Promise<Record<string, HealthCheck>> {
    const services = {
      database: async () => {
        try {
          const { error } = await this.supabase.from('organizations').select('id').limit(1)
          return !error
        } catch {
          return false
        }
      },
      
      meta_api: async () => {
        try {
          // Verificar se consegue fazer uma requisição básica para Meta API
          const response = await fetch('https://graph.facebook.com/v18.0/me?access_token=invalid', {
            method: 'GET'
          })
          // Esperamos erro 400 (bad token), não erro de rede
          return response.status === 400
        } catch {
          return false
        }
      },

      file_system: async () => {
        try {
          const { promises: fs } = await import('fs')
          await fs.access('./package.json')
          return true
        } catch {
          return false
        }
      }
    }

    const results: Record<string, HealthCheck> = {}

    for (const [serviceName, checkFunction] of Object.entries(services)) {
      results[serviceName] = await this.performHealthCheck(serviceName, checkFunction)
    }

    return results
  }

  /**
   * Inicia coleta automática de métricas
   */
  startMetricsCollection(intervalMs: number = 60000): void {
    setInterval(async () => {
      await this.collectSystemMetrics()
      await this.performAllHealthChecks()
    }, intervalMs)

    console.log(`Metrics collection started with ${intervalMs}ms interval`)
  }

  /**
   * Obtém métricas recentes
   */
  async getRecentMetrics(metricName: string, hours: number = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const { data: metrics } = await this.supabase
      .from('system_metrics')
      .select('*')
      .eq('metric_name', metricName)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true })

    return metrics || []
  }

  /**
   * Obtém alertas ativos
   */
  async getActiveAlerts(): Promise<any[]> {
    const { data: alerts } = await this.supabase
      .from('system_alerts')
      .select('*')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })

    return alerts || []
  }
}

export default MonitoringService
