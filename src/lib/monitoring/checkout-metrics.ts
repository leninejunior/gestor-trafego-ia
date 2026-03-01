/**
 * Checkout and Payment Metrics Collection Service
 * 
 * Implementa coleta detalhada de métricas para o fluxo de checkout e pagamentos
 * Requirements: 4.3, 6.2 - Métricas de performance e negócio
 */

import { createClient } from '@/lib/supabase/server'

export interface CheckoutMetrics {
  // Métricas de conversão
  checkouts_started: number
  checkouts_completed: number
  conversion_rate: number
  abandonment_rate: number
  
  // Métricas de performance
  avg_checkout_duration_ms: number
  avg_payment_processing_time_ms: number
  
  // Métricas de negócio
  total_revenue: number
  avg_order_value: number
  
  // Métricas por plano
  metrics_by_plan: PlanMetrics[]
  
  // Período das métricas
  period_start: Date
  period_end: Date
}

export interface PlanMetrics {
  plan_id: string
  plan_name: string
  checkouts_started: number
  checkouts_completed: number
  conversion_rate: number
  total_revenue: number
  avg_order_value: number
}

export interface PaymentMetrics {
  // Métricas de webhook
  webhooks_received: number
  webhooks_processed: number
  webhooks_failed: number
  webhook_processing_rate: number
  
  // Métricas de retry
  retry_attempts: number
  retry_success_rate: number
  
  // Métricas de tempo
  avg_webhook_processing_time_ms: number
  avg_account_creation_time_ms: number
  
  // Métricas de erro
  payment_failures: number
  account_creation_failures: number
  error_rate: number
}

export interface BusinessMetrics {
  // Métricas de receita
  daily_revenue: number
  monthly_revenue: number
  revenue_growth_rate: number
  
  // Métricas de clientes
  new_customers: number
  customer_acquisition_cost: number
  customer_lifetime_value: number
  
  // Métricas de retenção
  churn_rate: number
  retention_rate: number
  
  // Métricas de suporte
  support_tickets: number
  resolution_time_hours: number
}

export interface PerformanceMetrics {
  // Métricas de API
  api_response_time_ms: number
  api_error_rate: number
  api_throughput_rps: number
  
  // Métricas de banco
  db_query_time_ms: number
  db_connection_pool_usage: number
  
  // Métricas de sistema
  memory_usage_mb: number
  cpu_usage_percent: number
  
  // Métricas de cache
  cache_hit_rate: number
  cache_miss_rate: number
}

export class CheckoutMetricsService {
  private supabase = createClient()

  /**
   * Registra início de checkout
   */
  async recordCheckoutStarted(data: {
    plan_id: string
    billing_cycle: string
    user_email: string
    organization_name: string
    session_id?: string
    referrer?: string
    user_agent?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('checkout_metrics')
        .insert({
          event_type: 'checkout_started',
          plan_id: data.plan_id,
          billing_cycle: data.billing_cycle,
          user_email: data.user_email,
          organization_name: data.organization_name,
          session_id: data.session_id,
          referrer: data.referrer,
          user_agent: data.user_agent,
          timestamp: new Date().toISOString()
        })

      // Incrementar contador diário
      await this.incrementDailyCounter('checkouts_started', data.plan_id)
    } catch (error) {
      console.error('Error recording checkout started:', error)
    }
  }

  /**
   * Registra checkout completado
   */
  async recordCheckoutCompleted(data: {
    intent_id: string
    plan_id: string
    billing_cycle: string
    amount: number
    duration_ms: number
    payment_method?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('checkout_metrics')
        .insert({
          event_type: 'checkout_completed',
          intent_id: data.intent_id,
          plan_id: data.plan_id,
          billing_cycle: data.billing_cycle,
          amount: data.amount,
          duration_ms: data.duration_ms,
          payment_method: data.payment_method,
          timestamp: new Date().toISOString()
        })

      // Incrementar contadores
      await this.incrementDailyCounter('checkouts_completed', data.plan_id)
      await this.incrementDailyRevenue(data.amount, data.plan_id)
    } catch (error) {
      console.error('Error recording checkout completed:', error)
    }
  }

  /**
   * Registra abandono de checkout
   */
  async recordCheckoutAbandoned(data: {
    intent_id?: string
    plan_id: string
    stage: 'form_fill' | 'payment_processing' | 'payment_failed'
    duration_ms: number
    reason?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('checkout_metrics')
        .insert({
          event_type: 'checkout_abandoned',
          intent_id: data.intent_id,
          plan_id: data.plan_id,
          stage: data.stage,
          duration_ms: data.duration_ms,
          reason: data.reason,
          timestamp: new Date().toISOString()
        })

      await this.incrementDailyCounter('checkouts_abandoned', data.plan_id)
    } catch (error) {
      console.error('Error recording checkout abandoned:', error)
    }
  }

  /**
   * Registra processamento de webhook
   */
  async recordWebhookProcessed(data: {
    webhook_id: string
    event_type: string
    intent_id?: string
    status: 'success' | 'failed' | 'retry'
    processing_time_ms: number
    retry_count?: number
    error_message?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('webhook_metrics')
        .insert({
          webhook_id: data.webhook_id,
          event_type: data.event_type,
          intent_id: data.intent_id,
          status: data.status,
          processing_time_ms: data.processing_time_ms,
          retry_count: data.retry_count || 0,
          error_message: data.error_message,
          timestamp: new Date().toISOString()
        })

      // Incrementar contadores
      await this.incrementDailyCounter('webhooks_processed')
      if (data.status === 'failed') {
        await this.incrementDailyCounter('webhooks_failed')
      }
    } catch (error) {
      console.error('Error recording webhook processed:', error)
    }
  }

  /**
   * Registra criação de conta automática
   */
  async recordAccountCreated(data: {
    intent_id: string
    user_id: string
    organization_id: string
    duration_ms: number
    success: boolean
    error_message?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('account_creation_metrics')
        .insert({
          intent_id: data.intent_id,
          user_id: data.user_id,
          organization_id: data.organization_id,
          duration_ms: data.duration_ms,
          success: data.success,
          error_message: data.error_message,
          timestamp: new Date().toISOString()
        })

      if (data.success) {
        await this.incrementDailyCounter('accounts_created')
      } else {
        await this.incrementDailyCounter('account_creation_failures')
      }
    } catch (error) {
      console.error('Error recording account created:', error)
    }
  }

  /**
   * Registra métricas de performance de API
   */
  async recordApiMetrics(data: {
    endpoint: string
    method: string
    status_code: number
    response_time_ms: number
    user_id?: string
    error_message?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('api_metrics')
        .insert({
          endpoint: data.endpoint,
          method: data.method,
          status_code: data.status_code,
          response_time_ms: data.response_time_ms,
          user_id: data.user_id,
          error_message: data.error_message,
          timestamp: new Date().toISOString()
        })

      // Incrementar contadores
      await this.incrementDailyCounter('api_requests')
      if (data.status_code >= 400) {
        await this.incrementDailyCounter('api_errors')
      }
    } catch (error) {
      console.error('Error recording API metrics:', error)
    }
  }

  /**
   * Obtém métricas de checkout para período
   */
  async getCheckoutMetrics(
    startDate: Date,
    endDate: Date,
    planId?: string
  ): Promise<CheckoutMetrics> {
    try {
      // Buscar métricas básicas
      let query = this.supabase
        .from('checkout_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      if (planId) {
        query = query.eq('plan_id', planId)
      }

      const { data: events } = await query

      // Calcular métricas agregadas
      const started = events?.filter(e => e.event_type === 'checkout_started').length || 0
      const completed = events?.filter(e => e.event_type === 'checkout_completed').length || 0
      const abandoned = events?.filter(e => e.event_type === 'checkout_abandoned').length || 0

      const completedEvents = events?.filter(e => e.event_type === 'checkout_completed') || []
      const totalRevenue = completedEvents.reduce((sum, e) => sum + (e.amount || 0), 0)
      const avgOrderValue = completed > 0 ? totalRevenue / completed : 0

      const avgDuration = completedEvents.length > 0
        ? completedEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / completedEvents.length
        : 0

      // Métricas por plano
      const planMetrics = await this.getMetricsByPlan(startDate, endDate)

      return {
        checkouts_started: started,
        checkouts_completed: completed,
        conversion_rate: started > 0 ? (completed / started) * 100 : 0,
        abandonment_rate: started > 0 ? (abandoned / started) * 100 : 0,
        avg_checkout_duration_ms: avgDuration,
        avg_payment_processing_time_ms: 0, // Calculado separadamente
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        metrics_by_plan: planMetrics,
        period_start: startDate,
        period_end: endDate
      }
    } catch (error) {
      console.error('Error getting checkout metrics:', error)
      throw error
    }
  }

  /**
   * Obtém métricas de pagamento para período
   */
  async getPaymentMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<PaymentMetrics> {
    try {
      const { data: webhookEvents } = await this.supabase
        .from('webhook_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      const received = webhookEvents?.length || 0
      const processed = webhookEvents?.filter(e => e.status === 'success').length || 0
      const failed = webhookEvents?.filter(e => e.status === 'failed').length || 0
      const retries = webhookEvents?.filter(e => (e.retry_count || 0) > 0).length || 0

      const avgProcessingTime = webhookEvents && webhookEvents.length > 0
        ? webhookEvents.reduce((sum, e) => sum + (e.processing_time_ms || 0), 0) / webhookEvents.length
        : 0

      const { data: accountEvents } = await this.supabase
        .from('account_creation_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      const accountCreationFailures = accountEvents?.filter(e => !e.success).length || 0
      const avgAccountCreationTime = accountEvents && accountEvents.length > 0
        ? accountEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / accountEvents.length
        : 0

      return {
        webhooks_received: received,
        webhooks_processed: processed,
        webhooks_failed: failed,
        webhook_processing_rate: received > 0 ? (processed / received) * 100 : 0,
        retry_attempts: retries,
        retry_success_rate: retries > 0 ? ((retries - failed) / retries) * 100 : 0,
        avg_webhook_processing_time_ms: avgProcessingTime,
        avg_account_creation_time_ms: avgAccountCreationTime,
        payment_failures: failed,
        account_creation_failures: accountCreationFailures,
        error_rate: received > 0 ? (failed / received) * 100 : 0
      }
    } catch (error) {
      console.error('Error getting payment metrics:', error)
      throw error
    }
  }

  /**
   * Obtém métricas de negócio
   */
  async getBusinessMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<BusinessMetrics> {
    try {
      // Receita do período
      const { data: revenueData } = await this.supabase
        .from('daily_metrics')
        .select('revenue')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])

      const totalRevenue = revenueData?.reduce((sum, d) => sum + (d.revenue || 0), 0) || 0

      // Novos clientes
      const { count: newCustomers } = await this.supabase
        .from('subscription_intents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString())

      // Métricas básicas com valores conservadores quando não há fonte dedicada
      return {
        daily_revenue: totalRevenue / Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))),
        monthly_revenue: totalRevenue,
        revenue_growth_rate: 0, // Calcular comparando com período anterior
        new_customers: newCustomers || 0,
        customer_acquisition_cost: 0, // Calcular baseado em custos de marketing
        customer_lifetime_value: 0, // Calcular baseado em dados históricos
        churn_rate: 0, // Calcular baseado em cancelamentos
        retention_rate: 0, // Calcular baseado em renovações
        support_tickets: 0, // Integrar com sistema de suporte
        resolution_time_hours: 0 // Calcular tempo médio de resolução
      }
    } catch (error) {
      console.error('Error getting business metrics:', error)
      throw error
    }
  }

  /**
   * Obtém métricas de performance do sistema
   */
  async getPerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics> {
    try {
      const { data: apiMetrics } = await this.supabase
        .from('api_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      const totalRequests = apiMetrics?.length || 0
      const errorRequests = apiMetrics?.filter(m => m.status_code >= 400).length || 0
      const avgResponseTime = totalRequests > 0
        ? apiMetrics!.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) / totalRequests
        : 0

      const periodHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
      const throughput = periodHours > 0 ? totalRequests / (periodHours * 3600) : 0

      return {
        api_response_time_ms: avgResponseTime,
        api_error_rate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
        api_throughput_rps: throughput,
        db_query_time_ms: 0, // Implementar com métricas de banco
        db_connection_pool_usage: 0, // Implementar com métricas de conexão
        memory_usage_mb: 0, // Implementar com métricas de sistema
        cpu_usage_percent: 0, // Implementar com métricas de sistema
        cache_hit_rate: 0, // Implementar com métricas de cache
        cache_miss_rate: 0 // Implementar com métricas de cache
      }
    } catch (error) {
      console.error('Error getting performance metrics:', error)
      throw error
    }
  }

  /**
   * Incrementa contador diário
   */
  private async incrementDailyCounter(
    metric: string,
    planId?: string
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]

    try {
      const { data: existing } = await this.supabase
        .from('daily_metrics')
        .select('*')
        .eq('date', today)
        .eq('plan_id', planId || '')
        .single()

      if (existing) {
        await this.supabase
          .from('daily_metrics')
          .update({
            [metric]: (existing[metric] || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        await this.supabase
          .from('daily_metrics')
          .insert({
            date: today,
            plan_id: planId || '',
            [metric]: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      }
    } catch (error) {
      console.error('Error incrementing daily counter:', error)
    }
  }

  /**
   * Incrementa receita diária
   */
  private async incrementDailyRevenue(
    amount: number,
    planId?: string
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]

    try {
      const { data: existing } = await this.supabase
        .from('daily_metrics')
        .select('*')
        .eq('date', today)
        .eq('plan_id', planId || '')
        .single()

      if (existing) {
        await this.supabase
          .from('daily_metrics')
          .update({
            revenue: (existing.revenue || 0) + amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        await this.supabase
          .from('daily_metrics')
          .insert({
            date: today,
            plan_id: planId || '',
            revenue: amount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
      }
    } catch (error) {
      console.error('Error incrementing daily revenue:', error)
    }
  }

  /**
   * Obtém métricas por plano
   */
  private async getMetricsByPlan(
    startDate: Date,
    endDate: Date
  ): Promise<PlanMetrics[]> {
    try {
      const { data: planData } = await this.supabase
        .from('subscription_plans')
        .select('id, name')

      if (!planData) return []

      const metrics: PlanMetrics[] = []

      for (const plan of planData) {
        const planMetrics = await this.getCheckoutMetrics(startDate, endDate, plan.id)
        
        metrics.push({
          plan_id: plan.id,
          plan_name: plan.name,
          checkouts_started: planMetrics.checkouts_started,
          checkouts_completed: planMetrics.checkouts_completed,
          conversion_rate: planMetrics.conversion_rate,
          total_revenue: planMetrics.total_revenue,
          avg_order_value: planMetrics.avg_order_value
        })
      }

      return metrics
    } catch (error) {
      console.error('Error getting metrics by plan:', error)
      return []
    }
  }

  /**
   * Gera relatório completo de métricas
   */
  async generateMetricsReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    checkout: CheckoutMetrics
    payment: PaymentMetrics
    business: BusinessMetrics
    performance: PerformanceMetrics
  }> {
    const [checkout, payment, business, performance] = await Promise.all([
      this.getCheckoutMetrics(startDate, endDate),
      this.getPaymentMetrics(startDate, endDate),
      this.getBusinessMetrics(startDate, endDate),
      this.getPerformanceMetrics(startDate, endDate)
    ])

    return {
      checkout,
      payment,
      business,
      performance
    }
  }
}

export default CheckoutMetricsService
