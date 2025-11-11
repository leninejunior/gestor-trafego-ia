/**
 * Serviço de Alertas de Saldo
 * Verifica saldos e dispara alertas quando necessário
 */

import { createClient } from '@supabase/supabase-js'

interface BalanceAlert {
  id: string
  client_id: string
  ad_account_id: string
  ad_account_name: string
  threshold_amount: number
  alert_type: 'low_balance' | 'no_balance' | 'daily_limit' | 'weekly_limit'
  current_balance: number | null
  is_active: boolean
  last_alert_sent_at: string | null
}

interface AlertRecipient {
  id: string
  client_id: string
  name: string
  phone_number: string | null
  email: string | null
  receive_whatsapp: boolean
  receive_email: boolean
  alert_types: string[]
  is_active: boolean
}

export class BalanceAlertService {
  private supabase

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Verifica todos os alertas ativos e dispara notificações se necessário
   */
  async checkAllAlerts(): Promise<{
    checked: number
    triggered: number
    errors: number
  }> {
    let checked = 0
    let triggered = 0
    let errors = 0

    try {
      // Buscar todos os alertas ativos
      const { data: alerts, error: alertsError } = await this.supabase
        .from('balance_alerts')
        .select('*')
        .eq('is_active', true)

      if (alertsError) {
        console.error('Error fetching alerts:', alertsError)
        return { checked: 0, triggered: 0, errors: 1 }
      }

      for (const alert of alerts || []) {
        checked++

        try {
          const shouldTrigger = await this.shouldTriggerAlert(alert)
          
          if (shouldTrigger) {
            await this.triggerAlert(alert)
            triggered++
          }
        } catch (error) {
          console.error(`Error processing alert ${alert.id}:`, error)
          errors++
        }
      }

      return { checked, triggered, errors }

    } catch (error) {
      console.error('Error in checkAllAlerts:', error)
      return { checked, triggered, errors: errors + 1 }
    }
  }

  /**
   * Verifica se um alerta deve ser disparado
   */
  private async shouldTriggerAlert(alert: BalanceAlert): Promise<boolean> {
    // Se não tem saldo atual, não pode verificar
    if (alert.current_balance === null) {
      return false
    }

    // Verificar tipo de alerta
    switch (alert.alert_type) {
      case 'no_balance':
        // Alerta crítico: saldo zerado ou negativo
        if (alert.current_balance <= 0) {
          return this.canSendAlert(alert)
        }
        break

      case 'low_balance':
        // Alerta de saldo baixo: abaixo do threshold
        if (alert.current_balance <= alert.threshold_amount) {
          return this.canSendAlert(alert)
        }
        break

      case 'daily_limit':
      case 'weekly_limit':
        // Implementar lógica de limites diários/semanais
        // Por enquanto, retorna false
        return false

      default:
        return false
    }

    return false
  }

  /**
   * Verifica se pode enviar alerta (evita spam)
   */
  private canSendAlert(alert: BalanceAlert): boolean {
    // Se nunca enviou, pode enviar
    if (!alert.last_alert_sent_at) {
      return true
    }

    // Calcular tempo desde último alerta
    const lastSent = new Date(alert.last_alert_sent_at)
    const now = new Date()
    const hoursSinceLastAlert = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60)

    // Alertas críticos (no_balance): enviar a cada 2 horas
    if (alert.alert_type === 'no_balance' && hoursSinceLastAlert >= 2) {
      return true
    }

    // Alertas de saldo baixo: enviar a cada 24 horas
    if (alert.alert_type === 'low_balance' && hoursSinceLastAlert >= 24) {
      return true
    }

    return false
  }

  /**
   * Dispara um alerta
   */
  private async triggerAlert(alert: BalanceAlert): Promise<void> {
    try {
      // Buscar destinatários do alerta
      const { data: recipients, error: recipientsError } = await this.supabase
        .from('alert_recipients')
        .select('*')
        .eq('client_id', alert.client_id)
        .eq('is_active', true)

      if (recipientsError) {
        console.error('Error fetching recipients:', recipientsError)
        return
      }

      // Filtrar destinatários que querem receber este tipo de alerta
      const validRecipients = (recipients || []).filter(r => 
        r.alert_types.includes(alert.alert_type)
      )

      // Enviar notificações
      for (const recipient of validRecipients) {
        await this.sendNotifications(alert, recipient)
      }

      // Atualizar timestamp do último alerta
      await this.supabase
        .from('balance_alerts')
        .update({
          last_alert_sent_at: new Date().toISOString()
        })
        .eq('id', alert.id)

      console.log(`Alert triggered for account ${alert.ad_account_id}`)

    } catch (error) {
      console.error('Error triggering alert:', error)
      throw error
    }
  }

  /**
   * Envia notificações para um destinatário
   */
  private async sendNotifications(
    alert: BalanceAlert,
    recipient: AlertRecipient
  ): Promise<void> {
    const message = this.formatAlertMessage(alert)

    // WhatsApp
    if (recipient.receive_whatsapp && recipient.phone_number) {
      await this.sendWhatsAppAlert(alert, recipient, message)
    }

    // Email
    if (recipient.receive_email && recipient.email) {
      await this.sendEmailAlert(alert, recipient, message)
    }
  }

  /**
   * Formata mensagem do alerta
   */
  private formatAlertMessage(alert: BalanceAlert): string {
    const balance = alert.current_balance || 0
    const formattedBalance = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(balance)

    if (alert.alert_type === 'no_balance') {
      return `🚨 *ALERTA CRÍTICO - SALDO ZERADO*\n\n` +
        `Conta: ${alert.ad_account_name}\n` +
        `ID: ${alert.ad_account_id}\n` +
        `Saldo atual: ${formattedBalance}\n\n` +
        `⚠️ Suas campanhas podem ser pausadas a qualquer momento!\n` +
        `Por favor, adicione créditos imediatamente.`
    } else {
      const threshold = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(alert.threshold_amount)

      return `⚠️ *ALERTA - SALDO BAIXO*\n\n` +
        `Conta: ${alert.ad_account_name}\n` +
        `ID: ${alert.ad_account_id}\n` +
        `Saldo atual: ${formattedBalance}\n` +
        `Limite configurado: ${threshold}\n\n` +
        `Considere adicionar créditos em breve para evitar interrupções.`
    }
  }

  /**
   * Envia alerta via WhatsApp
   */
  private async sendWhatsAppAlert(
    alert: BalanceAlert,
    recipient: AlertRecipient,
    message: string
  ): Promise<void> {
    try {
      // Buscar configuração do WhatsApp
      const { data: whatsappConfig } = await this.supabase
        .from('whatsapp_config')
        .select('*')
        .eq('is_active', true)
        .single()

      if (!whatsappConfig) {
        console.log('WhatsApp not configured')
        return
      }

      // Enviar via Evolution API
      const response = await fetch(`${whatsappConfig.evolution_api_url}/message/sendText/${whatsappConfig.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': whatsappConfig.evolution_api_key
        },
        body: JSON.stringify({
          number: recipient.phone_number,
          text: message
        })
      })

      const status = response.ok ? 'sent' : 'failed'
      const errorMessage = response.ok ? null : await response.text()

      // Registrar no histórico
      await this.supabase
        .from('alert_history')
        .insert({
          alert_id: alert.id,
          sent_via: 'whatsapp',
          recipient: recipient.phone_number,
          message,
          status,
          error_message: errorMessage,
          balance_at_send: alert.current_balance,
          threshold_at_send: alert.threshold_amount
        })

      console.log(`WhatsApp alert sent to ${recipient.phone_number}: ${status}`)

    } catch (error) {
      console.error('Error sending WhatsApp alert:', error)
      
      // Registrar erro no histórico
      await this.supabase
        .from('alert_history')
        .insert({
          alert_id: alert.id,
          sent_via: 'whatsapp',
          recipient: recipient.phone_number || '',
          message,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          balance_at_send: alert.current_balance,
          threshold_at_send: alert.threshold_amount
        })
    }
  }

  /**
   * Envia alerta via Email
   */
  private async sendEmailAlert(
    alert: BalanceAlert,
    recipient: AlertRecipient,
    message: string
  ): Promise<void> {
    try {
      // TODO: Implementar envio de email
      // Por enquanto, apenas registra no histórico
      
      await this.supabase
        .from('alert_history')
        .insert({
          alert_id: alert.id,
          sent_via: 'email',
          recipient: recipient.email,
          message,
          status: 'pending',
          balance_at_send: alert.current_balance,
          threshold_at_send: alert.threshold_amount
        })

      console.log(`Email alert queued for ${recipient.email}`)

    } catch (error) {
      console.error('Error sending email alert:', error)
    }
  }

  /**
   * Cria alerta automático para uma conta
   */
  async createAutoAlert(
    clientId: string,
    accountId: string,
    accountName: string,
    thresholdAmount: number = 100
  ): Promise<void> {
    try {
      // Criar alerta de saldo baixo
      await this.supabase
        .from('balance_alerts')
        .upsert({
          client_id: clientId,
          ad_account_id: accountId,
          ad_account_name: accountName,
          threshold_amount: thresholdAmount,
          alert_type: 'low_balance',
          is_active: true
        }, {
          onConflict: 'client_id,ad_account_id,alert_type'
        })

      // Criar alerta de saldo zerado
      await this.supabase
        .from('balance_alerts')
        .upsert({
          client_id: clientId,
          ad_account_id: accountId,
          ad_account_name: accountName,
          threshold_amount: 0,
          alert_type: 'no_balance',
          is_active: true
        }, {
          onConflict: 'client_id,ad_account_id,alert_type'
        })

      console.log(`Auto alerts created for account ${accountId}`)

    } catch (error) {
      console.error('Error creating auto alerts:', error)
    }
  }
}
