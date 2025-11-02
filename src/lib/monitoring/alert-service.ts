/**
 * Alert Service for Checkout and Payment Monitoring
 * 
 * Implementa alertas automáticos para problemas críticos no fluxo de checkout
 * Requirements: 4.4, 8.3 - Alertas para alta taxa de erro e problemas de pagamento
 */

import { createClient } from '@/lib/supabase/server'
import { NotificationService } from '@/lib/notifications/notification-service'
import CheckoutMetricsService from './checkout-metrics'

export interface AlertRule {
  id: string
  name: string
  description: string
  metric: string
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals'
  threshold: number
  time_window_minutes: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  notification_channels: string[]
  cooldown_minutes: number
  created_at: Date
  updated_at: Date
}

export interface AlertInstance {
  id: string
  rule_id: string
  title: string
  message: string
  severity: string
  metric_value: number
  threshold: number
  triggered_at: Date
  resolved_at?: Date
  is_resolved: boolean
  metadata: Record<string, any>
}

export interface AlertChannel {
  id: string
  name: string
  type: 'email' | 'webhook' | 'slack' | 'teams'
  config: Record<string, any>
  enabled: boolean
}

export class AlertService {
  private supabase = createClient()
  private notificationService = new NotificationService()
  private metricsService = new CheckoutMetricsService()
  
  // Alertas pré-configurados para checkout e pagamentos
  private defaultAlertRules: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      name: 'High Checkout Abandonment Rate',
      description: 'Taxa de abandono de checkout acima de 70%',
      metric: 'checkout_abandonment_rate',
      condition: 'greater_than',
      threshold: 70,
      time_window_minutes: 60,
      severity: 'high',
      enabled: true,
      notification_channels: ['email', 'slack'],
      cooldown_minutes: 30
    },
    {
      name: 'Low Conversion Rate',
      description: 'Taxa de conversão abaixo de 30%',
      metric: 'checkout_conversion_rate',
      condition: 'less_than',
      threshold: 30,
      time_window_minutes: 120,
      severity: 'medium',
      enabled: true,
      notification_channels: ['email'],
      cooldown_minutes: 60
    },
    {
      name: 'High Webhook Failure Rate',
      description: 'Taxa de falha de webhook acima de 10%',
      metric: 'webhook_failure_rate',
      condition: 'greater_than',
      threshold: 10,
      time_window_minutes: 30,
      severity: 'critical',
      enabled: true,
      notification_channels: ['email', 'slack', 'webhook'],
      cooldown_minutes: 15
    },
    {
      name: 'Payment Processing Delays',
      description: 'Tempo médio de processamento de pagamento acima de 30 segundos',
      metric: 'avg_payment_processing_time',
      condition: 'greater_than',
      threshold: 30000, // 30 segundos em ms
      time_window_minutes: 15,
      severity: 'high',
      enabled: true,
      notification_channels: ['email', 'slack'],
      cooldown_minutes: 20
    },
    {
      name: 'Account Creation Failures',
      description: 'Taxa de falha na criação automática de contas acima de 5%',
      metric: 'account_creation_failure_rate',
      condition: 'greater_than',
      threshold: 5,
      time_window_minutes: 60,
      severity: 'high',
      enabled: true,
      notification_channels: ['email', 'webhook'],
      cooldown_minutes: 30
    },
    {
      name: 'API Response Time Alert',
      description: 'Tempo de resposta da API acima de 5 segundos',
      metric: 'api_response_time',
      condition: 'greater_than',
      threshold: 5000, // 5 segundos em ms
      time_window_minutes: 10,
      severity: 'medium',
      enabled: true,
      notification_channels: ['email'],
      cooldown_minutes: 15
    },
    {
      name: 'High API Error Rate',
      description: 'Taxa de erro da API acima de 5%',
      metric: 'api_error_rate',
      condition: 'greater_than',
      threshold: 5,
      time_window_minutes: 15,
      severity: 'high',
      enabled: true,
      notification_channels: ['email', 'slack'],
      cooldown_minutes: 20
    },
    {
      name: 'Zero Checkouts Started',
      description: 'Nenhum checkout iniciado nas últimas 2 horas',
      metric: 'checkouts_started',
      condition: 'equals',
      threshold: 0,
      time_window_minutes: 120,
      severity: 'medium',
      enabled: true,
      notification_channels: ['email'],
      cooldown_minutes: 60
    },
    {
      name: 'Revenue Drop Alert',
      description: 'Receita horária abaixo de 50% da média',
      metric: 'hourly_revenue_drop',
      condition: 'greater_than',
      threshold: 50, // 50% de queda
      time_window_minutes: 60,
      severity: 'high',
      enabled: true,
      notification_channels: ['email', 'slack'],
      cooldown_minutes: 30
    },
    {
      name: 'Webhook Retry Spike',
      description: 'Número de tentativas de webhook acima do normal',
      metric: 'webhook_retry_count',
      condition: 'greater_than',
      threshold: 10,
      time_window_minutes: 30,
      severity: 'medium',
      enabled: true,
      notification_channels: ['email'],
      cooldown_minutes: 20
    }
  ]

  /**
   * Inicializa o serviço de alertas com regras padrão
   */
  async initializeDefaultAlerts(): Promise<void> {
    try {
      for (const rule of this.defaultAlertRules) {
        await this.createAlertRule(rule)
      }
      console.log('Default alert rules initialized')
    } catch (error) {
      console.error('Error initializing default alerts:', error)
    }
  }

  /**
   * Cria uma nova regra de alerta
   */
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      // Verificar se já existe uma regra com o mesmo nome
      const { data: existing } = await this.supabase
        .from('alert_rules')
        .select('id')
        .eq('name', rule.name)
        .single()

      if (existing) {
        console.log(`Alert rule '${rule.name}' already exists`)
        return existing.id
      }

      const { data, error } = await this.supabase
        .from('alert_rules')
        .insert({
          name: rule.name,
          description: rule.description,
          metric: rule.metric,
          condition: rule.condition,
          threshold: rule.threshold,
          time_window_minutes: rule.time_window_minutes,
          severity: rule.severity,
          enabled: rule.enabled,
          notification_channels: rule.notification_channels,
          cooldown_minutes: rule.cooldown_minutes
        })
        .select('id')
        .single()

      if (error) throw error

      console.log(`Created alert rule: ${rule.name}`)
      return data.id
    } catch (error) {
      console.error('Error creating alert rule:', error)
      throw error
    }
  }

  /**
   * Executa verificação de todas as regras de alerta ativas
   */
  async checkAllAlerts(): Promise<void> {
    try {
      const { data: rules } = await this.supabase
        .from('alert_rules')
        .select('*')
        .eq('enabled', true)

      if (!rules || rules.length === 0) {
        console.log('No active alert rules found')
        return
      }

      console.log(`Checking ${rules.length} alert rules`)

      for (const rule of rules) {
        await this.checkAlertRule(rule as AlertRule)
      }
    } catch (error) {
      console.error('Error checking alerts:', error)
    }
  }

  /**
   * Verifica uma regra de alerta específica
   */
  async checkAlertRule(rule: AlertRule): Promise<void> {
    try {
      // Verificar se está em cooldown
      const isInCooldown = await this.isRuleInCooldown(rule.id, rule.cooldown_minutes)
      if (isInCooldown) {
        return
      }

      // Obter valor atual da métrica
      const metricValue = await this.getMetricValue(rule.metric, rule.time_window_minutes)
      
      // Verificar se a condição é atendida
      const conditionMet = this.evaluateCondition(metricValue, rule.condition, rule.threshold)

      if (conditionMet) {
        await this.triggerAlert(rule, metricValue)
      }
    } catch (error) {
      console.error(`Error checking alert rule ${rule.name}:`, error)
    }
  }

  /**
   * Obtém o valor atual de uma métrica
   */
  private async getMetricValue(metric: string, timeWindowMinutes: number): Promise<number> {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - timeWindowMinutes * 60 * 1000)

    switch (metric) {
      case 'checkout_abandonment_rate':
        return await this.getCheckoutAbandonmentRate(startTime, endTime)
      
      case 'checkout_conversion_rate':
        return await this.getCheckoutConversionRate(startTime, endTime)
      
      case 'webhook_failure_rate':
        return await this.getWebhookFailureRate(startTime, endTime)
      
      case 'avg_payment_processing_time':
        return await this.getAvgPaymentProcessingTime(startTime, endTime)
      
      case 'account_creation_failure_rate':
        return await this.getAccountCreationFailureRate(startTime, endTime)
      
      case 'api_response_time':
        return await this.getAvgApiResponseTime(startTime, endTime)
      
      case 'api_error_rate':
        return await this.getApiErrorRate(startTime, endTime)
      
      case 'checkouts_started':
        return await this.getCheckoutsStarted(startTime, endTime)
      
      case 'hourly_revenue_drop':
        return await this.getHourlyRevenueDrop(startTime, endTime)
      
      case 'webhook_retry_count':
        return await this.getWebhookRetryCount(startTime, endTime)
      
      default:
        console.warn(`Unknown metric: ${metric}`)
        return 0
    }
  }

  /**
   * Avalia se uma condição de alerta é atendida
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold
      case 'less_than':
        return value < threshold
      case 'equals':
        return value === threshold
      case 'not_equals':
        return value !== threshold
      default:
        return false
    }
  }

  /**
   * Dispara um alerta
   */
  private async triggerAlert(rule: AlertRule, metricValue: number): Promise<void> {
    try {
      const alertInstance: Omit<AlertInstance, 'id'> = {
        rule_id: rule.id,
        title: rule.name,
        message: this.generateAlertMessage(rule, metricValue),
        severity: rule.severity,
        metric_value: metricValue,
        threshold: rule.threshold,
        triggered_at: new Date(),
        is_resolved: false,
        metadata: {
          metric: rule.metric,
          condition: rule.condition,
          time_window_minutes: rule.time_window_minutes
        }
      }

      // Salvar instância do alerta
      const { data: alert, error } = await this.supabase
        .from('alert_instances')
        .insert(alertInstance)
        .select('*')
        .single()

      if (error) throw error

      // Enviar notificações
      await this.sendAlertNotifications(rule, alert as AlertInstance)

      console.log(`Alert triggered: ${rule.name} (value: ${metricValue}, threshold: ${rule.threshold})`)
    } catch (error) {
      console.error('Error triggering alert:', error)
    }
  }

  /**
   * Gera mensagem do alerta
   */
  private generateAlertMessage(rule: AlertRule, metricValue: number): string {
    const formattedValue = this.formatMetricValue(rule.metric, metricValue)
    const formattedThreshold = this.formatMetricValue(rule.metric, rule.threshold)
    
    return `${rule.description}\n\nValor atual: ${formattedValue}\nLimite: ${formattedThreshold}\nJanela de tempo: ${rule.time_window_minutes} minutos`
  }

  /**
   * Formata valor da métrica para exibição
   */
  private formatMetricValue(metric: string, value: number): string {
    if (metric.includes('rate') || metric.includes('drop')) {
      return `${value.toFixed(2)}%`
    }
    if (metric.includes('time')) {
      return `${value.toFixed(0)}ms`
    }
    if (metric.includes('revenue')) {
      return `R$ ${value.toFixed(2)}`
    }
    return value.toString()
  }

  /**
   * Envia notificações do alerta
   */
  private async sendAlertNotifications(rule: AlertRule, alert: AlertInstance): Promise<void> {
    try {
      // Buscar super admins para notificação
      const { data: superAdmins } = await this.supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin')

      if (!superAdmins || superAdmins.length === 0) {
        console.warn('No super admins found for alert notifications')
        return
      }

      // Criar notificação para cada super admin
      for (const admin of superAdmins) {
        await this.notificationService.createNotification({
          userId: admin.user_id,
          type: 'system_alert',
          title: alert.title,
          message: alert.message,
          priority: this.mapSeverityToPriority(alert.severity),
          metadata: {
            alert_id: alert.id,
            rule_id: rule.id,
            metric: rule.metric,
            severity: alert.severity,
            metric_value: alert.metric_value,
            threshold: alert.threshold
          }
        })
      }

      // Enviar para canais externos (webhook, Slack, etc.)
      for (const channel of rule.notification_channels) {
        await this.sendExternalNotification(channel, rule, alert)
      }
    } catch (error) {
      console.error('Error sending alert notifications:', error)
    }
  }

  /**
   * Mapeia severidade para prioridade de notificação
   */
  private mapSeverityToPriority(severity: string): 'low' | 'medium' | 'high' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'high'
      case 'medium':
        return 'medium'
      default:
        return 'low'
    }
  }

  /**
   * Envia notificação para canal externo
   */
  private async sendExternalNotification(
    channel: string,
    rule: AlertRule,
    alert: AlertInstance
  ): Promise<void> {
    try {
      switch (channel) {
        case 'webhook':
          await this.sendWebhookNotification(rule, alert)
          break
        case 'slack':
          await this.sendSlackNotification(rule, alert)
          break
        case 'teams':
          await this.sendTeamsNotification(rule, alert)
          break
        default:
          console.log(`External notification channel '${channel}' not implemented`)
      }
    } catch (error) {
      console.error(`Error sending ${channel} notification:`, error)
    }
  }

  /**
   * Envia notificação via webhook
   */
  private async sendWebhookNotification(rule: AlertRule, alert: AlertInstance): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL
    if (!webhookUrl) {
      console.warn('ALERT_WEBHOOK_URL not configured')
      return
    }

    const payload = {
      alert_id: alert.id,
      rule_name: rule.name,
      severity: alert.severity,
      message: alert.message,
      metric_value: alert.metric_value,
      threshold: alert.threshold,
      triggered_at: alert.triggered_at
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  }

  /**
   * Envia notificação para Slack
   */
  private async sendSlackNotification(rule: AlertRule, alert: AlertInstance): Promise<void> {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
    if (!slackWebhookUrl) {
      console.warn('SLACK_WEBHOOK_URL not configured')
      return
    }

    const color = this.getSeverityColor(alert.severity)
    const payload = {
      attachments: [{
        color,
        title: `🚨 ${alert.title}`,
        text: alert.message,
        fields: [
          {
            title: 'Severidade',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Valor Atual',
            value: this.formatMetricValue(rule.metric, alert.metric_value),
            short: true
          }
        ],
        timestamp: Math.floor(alert.triggered_at.getTime() / 1000)
      }]
    }

    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  }

  /**
   * Envia notificação para Microsoft Teams
   */
  private async sendTeamsNotification(rule: AlertRule, alert: AlertInstance): Promise<void> {
    const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL
    if (!teamsWebhookUrl) {
      console.warn('TEAMS_WEBHOOK_URL not configured')
      return
    }

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getSeverityColor(alert.severity),
      summary: alert.title,
      sections: [{
        activityTitle: `🚨 ${alert.title}`,
        activitySubtitle: `Severidade: ${alert.severity.toUpperCase()}`,
        text: alert.message,
        facts: [
          {
            name: 'Valor Atual',
            value: this.formatMetricValue(rule.metric, alert.metric_value)
          },
          {
            name: 'Limite',
            value: this.formatMetricValue(rule.metric, alert.threshold)
          },
          {
            name: 'Disparado em',
            value: alert.triggered_at.toLocaleString('pt-BR')
          }
        ]
      }]
    }

    await fetch(teamsWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  }

  /**
   * Obtém cor baseada na severidade
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#FF0000' // Vermelho
      case 'high':
        return '#FF8C00' // Laranja
      case 'medium':
        return '#FFD700' // Amarelo
      case 'low':
        return '#32CD32' // Verde
      default:
        return '#808080' // Cinza
    }
  }

  /**
   * Verifica se uma regra está em cooldown
   */
  private async isRuleInCooldown(ruleId: string, cooldownMinutes: number): Promise<boolean> {
    const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000)

    const { data: recentAlert } = await this.supabase
      .from('alert_instances')
      .select('triggered_at')
      .eq('rule_id', ruleId)
      .gte('triggered_at', cooldownTime.toISOString())
      .order('triggered_at', { ascending: false })
      .limit(1)
      .single()

    return !!recentAlert
  }

  /**
   * Métodos para calcular métricas específicas
   */
  private async getCheckoutAbandonmentRate(startTime: Date, endTime: Date): Promise<number> {
    const { data: events } = await this.supabase
      .from('checkout_metrics')
      .select('event_type')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!events || events.length === 0) return 0

    const started = events.filter(e => e.event_type === 'checkout_started').length
    const abandoned = events.filter(e => e.event_type === 'checkout_abandoned').length

    return started > 0 ? (abandoned / started) * 100 : 0
  }

  private async getCheckoutConversionRate(startTime: Date, endTime: Date): Promise<number> {
    const { data: events } = await this.supabase
      .from('checkout_metrics')
      .select('event_type')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!events || events.length === 0) return 0

    const started = events.filter(e => e.event_type === 'checkout_started').length
    const completed = events.filter(e => e.event_type === 'checkout_completed').length

    return started > 0 ? (completed / started) * 100 : 0
  }

  private async getWebhookFailureRate(startTime: Date, endTime: Date): Promise<number> {
    const { data: webhooks } = await this.supabase
      .from('webhook_metrics')
      .select('status')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!webhooks || webhooks.length === 0) return 0

    const total = webhooks.length
    const failed = webhooks.filter(w => w.status === 'failed').length

    return (failed / total) * 100
  }

  private async getAvgPaymentProcessingTime(startTime: Date, endTime: Date): Promise<number> {
    const { data: webhooks } = await this.supabase
      .from('webhook_metrics')
      .select('processing_time_ms')
      .eq('status', 'success')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!webhooks || webhooks.length === 0) return 0

    const total = webhooks.reduce((sum, w) => sum + (w.processing_time_ms || 0), 0)
    return total / webhooks.length
  }

  private async getAccountCreationFailureRate(startTime: Date, endTime: Date): Promise<number> {
    const { data: accounts } = await this.supabase
      .from('account_creation_metrics')
      .select('success')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!accounts || accounts.length === 0) return 0

    const total = accounts.length
    const failed = accounts.filter(a => !a.success).length

    return (failed / total) * 100
  }

  private async getAvgApiResponseTime(startTime: Date, endTime: Date): Promise<number> {
    const { data: apis } = await this.supabase
      .from('api_metrics')
      .select('response_time_ms')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!apis || apis.length === 0) return 0

    const total = apis.reduce((sum, a) => sum + (a.response_time_ms || 0), 0)
    return total / apis.length
  }

  private async getApiErrorRate(startTime: Date, endTime: Date): Promise<number> {
    const { data: apis } = await this.supabase
      .from('api_metrics')
      .select('status_code')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!apis || apis.length === 0) return 0

    const total = apis.length
    const errors = apis.filter(a => a.status_code >= 400).length

    return (errors / total) * 100
  }

  private async getCheckoutsStarted(startTime: Date, endTime: Date): Promise<number> {
    const { count } = await this.supabase
      .from('checkout_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'checkout_started')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    return count || 0
  }

  private async getHourlyRevenueDrop(startTime: Date, endTime: Date): Promise<number> {
    // Implementar lógica para calcular queda de receita comparada com média histórica
    // Por enquanto, retorna 0
    return 0
  }

  private async getWebhookRetryCount(startTime: Date, endTime: Date): Promise<number> {
    const { data: webhooks } = await this.supabase
      .from('webhook_metrics')
      .select('retry_count')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())

    if (!webhooks || webhooks.length === 0) return 0

    return webhooks.reduce((sum, w) => sum + (w.retry_count || 0), 0)
  }

  /**
   * Resolve um alerta manualmente
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      await this.supabase
        .from('alert_instances')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy
        })
        .eq('id', alertId)

      console.log(`Alert ${alertId} resolved by ${resolvedBy}`)
    } catch (error) {
      console.error('Error resolving alert:', error)
      throw error
    }
  }

  /**
   * Obtém alertas ativos
   */
  async getActiveAlerts(): Promise<AlertInstance[]> {
    const { data: alerts, error } = await this.supabase
      .from('alert_instances')
      .select('*')
      .eq('is_resolved', false)
      .order('triggered_at', { ascending: false })

    if (error) throw error
    return alerts || []
  }

  /**
   * Inicia monitoramento automático de alertas
   */
  startAlertMonitoring(intervalMinutes: number = 5): void {
    setInterval(async () => {
      await this.checkAllAlerts()
    }, intervalMinutes * 60 * 1000)

    console.log(`Alert monitoring started with ${intervalMinutes} minute interval`)
  }
}

export default AlertService