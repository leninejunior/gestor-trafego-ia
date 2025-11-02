/**
 * Automated Health Checker Service
 * 
 * Serviço para executar health checks automaticamente e registrar resultados
 * Requirements: 8.3, 8.4 - Health checks automáticos e monitoramento contínuo
 */

import HealthCheckService, { SystemHealth, HealthCheckResult } from './health-check-service'
import { createClient } from '@/lib/supabase/server'

export interface HealthCheckSchedule {
  id: string
  name: string
  endpoint: string
  interval_minutes: number
  enabled: boolean
  last_run?: Date
  next_run?: Date
  consecutive_failures: number
  max_failures_before_alert: number
}

export interface HealthCheckLog {
  id: string
  schedule_id: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  details: any
  error_message?: string
  checked_at: Date
}

export class AutomatedHealthChecker {
  private healthCheckService: HealthCheckService
  private runningChecks = new Set<string>()

  private async getSupabase() {
    return createClient()
  }

  constructor() {
    this.healthCheckService = new HealthCheckService()
  }

  /**
   * Executa todos os health checks agendados que estão prontos para execução
   */
  async runScheduledHealthChecks(): Promise<void> {
    try {
      const supabase = await this.getSupabase()
      const { data: schedules, error } = await supabase
        .from('health_check_schedules')
        .select('*')
        .eq('enabled', true)
        .or(`next_run.is.null,next_run.lte.${new Date().toISOString()}`)

      if (error) {
        console.error('Failed to fetch health check schedules:', error)
        return
      }

      if (!schedules || schedules.length === 0) {
        console.log('No health checks scheduled for execution')
        return
      }

      console.log(`Running ${schedules.length} scheduled health checks`)

      // Executar checks em paralelo
      const checkPromises = schedules.map(schedule => 
        this.executeScheduledCheck(schedule)
      )

      await Promise.allSettled(checkPromises)

    } catch (error) {
      console.error('Error running scheduled health checks:', error)
    }
  }

  /**
   * Executa um health check específico agendado
   */
  private async executeScheduledCheck(schedule: any): Promise<void> {
    // Evitar execução duplicada
    if (this.runningChecks.has(schedule.id)) {
      console.log(`Health check ${schedule.name} already running, skipping`)
      return
    }

    this.runningChecks.add(schedule.id)

    try {
      console.log(`Executing health check: ${schedule.name}`)
      const startTime = Date.now()

      let result: HealthCheckResult | SystemHealth
      let status: 'healthy' | 'degraded' | 'unhealthy'
      let responseTime: number
      let details: any
      let errorMessage: string | undefined

      // Executar o health check baseado no endpoint
      switch (schedule.endpoint) {
        case 'full':
          result = await this.healthCheckService.performFullHealthCheck()
          status = result.overall_status
          responseTime = Date.now() - startTime
          details = {
            components: result.components.length,
            summary: result.summary
          }
          break

        case 'quick':
          result = await this.healthCheckService.performQuickHealthCheck()
          status = result.overall_status
          responseTime = Date.now() - startTime
          details = {
            components: result.components.length,
            summary: result.summary
          }
          break

        case 'database':
          result = await this.healthCheckService.checkDatabase()
          status = result.status
          responseTime = result.response_time_ms
          details = result.details
          errorMessage = result.error
          break

        case 'iugu':
          result = await this.healthCheckService.checkIuguConnectivity()
          status = result.status
          responseTime = result.response_time_ms
          details = result.details
          errorMessage = result.error
          break

        case 'email':
          result = await this.healthCheckService.checkEmailService()
          status = result.status
          responseTime = result.response_time_ms
          details = result.details
          errorMessage = result.error
          break

        case 'redis':
          result = await this.healthCheckService.checkRedisCache()
          status = result.status
          responseTime = result.response_time_ms
          details = result.details
          errorMessage = result.error
          break

        default:
          throw new Error(`Unknown health check endpoint: ${schedule.endpoint}`)
      }

      // Registrar resultado
      await this.logHealthCheckResult({
        schedule_id: schedule.id,
        status,
        response_time_ms: responseTime,
        details,
        error_message: errorMessage,
        checked_at: new Date()
      })

      // Atualizar agendamento
      await this.updateScheduleAfterExecution(schedule, status === 'healthy')

      console.log(`Health check ${schedule.name} completed: ${status} (${responseTime}ms)`)

    } catch (error) {
      console.error(`Health check ${schedule.name} failed:`, error)

      // Registrar falha
      await this.logHealthCheckResult({
        schedule_id: schedule.id,
        status: 'unhealthy',
        response_time_ms: Date.now() - Date.now(), // 0 para falhas
        details: {},
        error_message: error instanceof Error ? error.message : 'Health check execution failed',
        checked_at: new Date()
      })

      // Atualizar agendamento com falha
      await this.updateScheduleAfterExecution(schedule, false)

    } finally {
      this.runningChecks.delete(schedule.id)
    }
  }

  /**
   * Registra o resultado de um health check
   */
  private async logHealthCheckResult(log: Omit<HealthCheckLog, 'id'>): Promise<void> {
    try {
      const supabase = await this.getSupabase()
      const { error } = await supabase
        .from('health_check_logs')
        .insert({
          schedule_id: log.schedule_id,
          status: log.status,
          response_time_ms: log.response_time_ms,
          details: log.details,
          error_message: log.error_message,
          checked_at: log.checked_at.toISOString()
        })

      if (error) {
        console.error('Failed to log health check result:', error)
      }
    } catch (error) {
      console.error('Error logging health check result:', error)
    }
  }

  /**
   * Atualiza o agendamento após execução
   */
  private async updateScheduleAfterExecution(schedule: any, success: boolean): Promise<void> {
    try {
      const now = new Date()
      const nextRun = new Date(now.getTime() + schedule.interval_minutes * 60 * 1000)
      
      const consecutiveFailures = success ? 0 : schedule.consecutive_failures + 1

      const supabase = await this.getSupabase()
      const { error } = await supabase
        .from('health_check_schedules')
        .update({
          last_run: now.toISOString(),
          next_run: nextRun.toISOString(),
          consecutive_failures: consecutiveFailures
        })
        .eq('id', schedule.id)

      if (error) {
        console.error('Failed to update health check schedule:', error)
      }

      // Verificar se deve gerar alerta
      if (consecutiveFailures >= schedule.max_failures_before_alert) {
        await this.generateHealthCheckAlert(schedule, consecutiveFailures)
      }

    } catch (error) {
      console.error('Error updating health check schedule:', error)
    }
  }

  /**
   * Gera alerta para health check com falhas consecutivas
   */
  private async generateHealthCheckAlert(schedule: any, consecutiveFailures: number): Promise<void> {
    try {
      const supabase = await this.getSupabase()
      const { error } = await supabase
        .from('alert_instances')
        .insert({
          rule_id: `health_check_${schedule.id}`,
          severity: consecutiveFailures >= schedule.max_failures_before_alert * 2 ? 'critical' : 'warning',
          title: `Health Check Failure: ${schedule.name}`,
          message: `Health check "${schedule.name}" has failed ${consecutiveFailures} consecutive times`,
          metadata: {
            schedule_id: schedule.id,
            schedule_name: schedule.name,
            endpoint: schedule.endpoint,
            consecutive_failures: consecutiveFailures,
            max_failures: schedule.max_failures_before_alert
          },
          triggered_at: new Date().toISOString()
        })

      if (error) {
        console.error('Failed to generate health check alert:', error)
      } else {
        console.log(`Generated alert for health check: ${schedule.name} (${consecutiveFailures} failures)`)
      }
    } catch (error) {
      console.error('Error generating health check alert:', error)
    }
  }

  /**
   * Cria agendamentos padrão de health checks
   */
  async createDefaultSchedules(): Promise<void> {
    const defaultSchedules = [
      {
        name: 'System Health Check',
        endpoint: 'full',
        interval_minutes: 15,
        max_failures_before_alert: 3
      },
      {
        name: 'Quick Health Check',
        endpoint: 'quick',
        interval_minutes: 5,
        max_failures_before_alert: 5
      },
      {
        name: 'Database Connectivity',
        endpoint: 'database',
        interval_minutes: 2,
        max_failures_before_alert: 3
      },
      {
        name: 'Iugu API Connectivity',
        endpoint: 'iugu',
        interval_minutes: 10,
        max_failures_before_alert: 2
      },
      {
        name: 'Email Service Check',
        endpoint: 'email',
        interval_minutes: 30,
        max_failures_before_alert: 2
      },
      {
        name: 'Redis Cache Check',
        endpoint: 'redis',
        interval_minutes: 15,
        max_failures_before_alert: 3
      }
    ]

    for (const schedule of defaultSchedules) {
      try {
        // Verificar se já existe
        const supabase = await this.getSupabase()
        const { data: existing } = await supabase
          .from('health_check_schedules')
          .select('id')
          .eq('name', schedule.name)
          .single()

        if (!existing) {
          const { error } = await supabase
            .from('health_check_schedules')
            .insert({
              name: schedule.name,
              endpoint: schedule.endpoint,
              interval_minutes: schedule.interval_minutes,
              enabled: true,
              consecutive_failures: 0,
              max_failures_before_alert: schedule.max_failures_before_alert,
              next_run: new Date().toISOString()
            })

          if (error) {
            console.error(`Failed to create schedule ${schedule.name}:`, error)
          } else {
            console.log(`Created health check schedule: ${schedule.name}`)
          }
        }
      } catch (error) {
        console.error(`Error creating schedule ${schedule.name}:`, error)
      }
    }
  }

  /**
   * Limpa logs antigos de health checks
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)

      const supabase = await this.getSupabase()
      const { error } = await supabase
        .from('health_check_logs')
        .delete()
        .lt('checked_at', cutoffDate.toISOString())

      if (error) {
        console.error('Failed to cleanup old health check logs:', error)
      } else {
        console.log(`Cleaned up health check logs older than ${daysToKeep} days`)
      }
    } catch (error) {
      console.error('Error cleaning up health check logs:', error)
    }
  }

  /**
   * Obtém estatísticas de health checks
   */
  async getHealthCheckStatistics(hours: number = 24): Promise<any> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000)

      const supabase = await this.getSupabase()
      const { data: logs, error } = await supabase
        .from('health_check_logs')
        .select('schedule_id, status, response_time_ms, checked_at')
        .gte('checked_at', since.toISOString())

      if (error) {
        throw error
      }

      const stats = {
        total_checks: logs?.length || 0,
        healthy: logs?.filter(l => l.status === 'healthy').length || 0,
        degraded: logs?.filter(l => l.status === 'degraded').length || 0,
        unhealthy: logs?.filter(l => l.status === 'unhealthy').length || 0,
        avg_response_time_ms: 0,
        success_rate_percent: 0
      }

      if (stats.total_checks > 0) {
        stats.avg_response_time_ms = logs!.reduce((sum: number, l: any) => sum + l.response_time_ms, 0) / stats.total_checks
        stats.success_rate_percent = ((stats.healthy + stats.degraded) / stats.total_checks) * 100
      }

      return stats
    } catch (error) {
      console.error('Error getting health check statistics:', error)
      return null
    }
  }
}

export default AutomatedHealthChecker