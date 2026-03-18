/**
 * Serviço de Notificações Push
 * - Web Push Notifications
 * - Server-Sent Events (SSE)
 * - Email automático
 * - SMS (Twilio)
 * - Notificações in-app
 */

import { createClient } from '@/lib/supabase/server'

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export class PushService {
  private supabase = createClient()
  private vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@yourapp.com'
  }

  /**
   * Registra uma nova subscription de push
   */
  async registerPushSubscription(
    userId: string,
    organizationId: string,
    subscription: PushSubscription
  ): Promise<boolean> {
    try {
      await this.supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          organization_id: organizationId,
          endpoint: subscription.endpoint,
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      return true
    } catch (error) {
      console.error('Failed to register push subscription:', error)
      return false
    }
  }

  /**
   * Remove uma subscription de push
   */
  async unregisterPushSubscription(endpoint: string): Promise<boolean> {
    try {
      await this.supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)

      return true
    } catch (error) {
      console.error('Failed to unregister push subscription:', error)
      return false
    }
  }

  /**
   * Envia notificação push para um usuário específico
   */
  async sendPushToUser(
    userId: string,
    payload: NotificationPayload
  ): Promise<{ success: number; failed: number }> {
    const { data: subscriptions } = await this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (!subscriptions || subscriptions.length === 0) {
      return { success: 0, failed: 0 }
    }

    return await this.sendPushToSubscriptions(subscriptions, payload)
  }

  /**
   * Envia notificação push para toda uma organização
   */
  async sendPushToOrganization(
    organizationId: string,
    payload: NotificationPayload,
    excludeUserId?: string
  ): Promise<{ success: number; failed: number }> {
    let query = this.supabase
      .from('push_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId)
    }

    const { data: subscriptions } = await query

    if (!subscriptions || subscriptions.length === 0) {
      return { success: 0, failed: 0 }
    }

    return await this.sendPushToSubscriptions(subscriptions, payload)
  }

  /**
   * Envia notificação push para múltiplas subscriptions
   */
  private async sendPushToSubscriptions(
    subscriptions: any[],
    payload: NotificationPayload
  ): Promise<{ success: number; failed: number }> {
    const webpush = await import('web-push')
    
    webpush.setVapidDetails(
      this.vapidKeys.subject,
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    )

    let success = 0
    let failed = 0

    const promises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        }

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(payload)
        )

        success++
      } catch (error: any) {
        console.error(`Failed to send push to ${sub.endpoint}:`, error)
        
        // Se a subscription é inválida, remover
        if (error.statusCode === 410 || error.statusCode === 404) {
          await this.unregisterPushSubscription(sub.endpoint)
        }
        
        failed++
      }
    })

    await Promise.all(promises)
    return { success, failed }
  }

  /**
   * Envia email usando Resend
   */
  async sendEmail(
    to: string | string[],
    template: EmailTemplate,
    data?: Record<string, any>
  ): Promise<boolean> {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      // Substituir variáveis no template
      let html = template.html
      let text = template.text
      let subject = template.subject

      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          const placeholder = `{{${key}}}`
          html = html.replace(new RegExp(placeholder, 'g'), String(value))
          text = text.replace(new RegExp(placeholder, 'g'), String(value))
          subject = subject.replace(new RegExp(placeholder, 'g'), String(value))
        })
      }

      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
      })

      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  /**
   * Envia SMS usando Twilio
   */
  async sendSMS(
    to: string,
    message: string
  ): Promise<boolean> {
    try {
      const twilio = await import('twilio')
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )

      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      })

      return true
    } catch (error) {
      console.error('Failed to send SMS:', error)
      return false
    }
  }

  /**
   * Cria conexão Server-Sent Events para notificações em tempo real
   */
  createSSEConnection(userId: string, organizationId: string): ReadableStream {
    return new ReadableStream({
      start(controller) {
        // Configurar heartbeat
        const heartbeat = setInterval(() => {
          controller.enqueue(`data: {"type":"heartbeat","timestamp":${Date.now()}}\n\n`)
        }, 30000)

        // Escutar notificações do Supabase
        const channel = this.supabase
          .channel(`notifications:${organizationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `organization_id=eq.${organizationId}`
            },
            (payload) => {
              // Verificar se a notificação é para este usuário
              if (payload.new.user_id === userId || !payload.new.user_id) {
                controller.enqueue(`data: ${JSON.stringify({
                  type: 'notification',
                  data: payload.new
                })}\n\n`)
              }
            }
          )
          .subscribe()

        // Cleanup quando a conexão for fechada
        return () => {
          clearInterval(heartbeat)
          channel.unsubscribe()
        }
      }
    })
  }

  /**
   * Obtém templates de email predefinidos
   */
  getEmailTemplate(type: string): EmailTemplate {
    const templates: Record<string, EmailTemplate> = {
      campaign_alert: {
        subject: '🚨 Campaign Alert: {{campaignName}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Campaign Alert</h2>
            <p>Your campaign <strong>{{campaignName}}</strong> requires attention.</p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Alert:</strong> {{alertMessage}}</p>
              <p><strong>Current Value:</strong> {{currentValue}}</p>
              <p><strong>Threshold:</strong> {{threshold}}</p>
            </div>
            <a href="{{dashboardUrl}}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Campaign
            </a>
          </div>
        `,
        text: `Campaign Alert: {{campaignName}}\n\n{{alertMessage}}\nCurrent Value: {{currentValue}}\nThreshold: {{threshold}}\n\nView campaign: {{dashboardUrl}}`
      },
      
      sync_failed: {
        subject: '⚠️ Sync Failed for {{accountName}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d97706;">Sync Failed</h2>
            <p>The synchronization for account <strong>{{accountName}}</strong> has failed.</p>
            <div style="background: #fffbeb; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Error:</strong> {{errorMessage}}</p>
              <p><strong>Failed at:</strong> {{failedAt}}</p>
            </div>
            <a href="{{settingsUrl}}" style="background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Check Settings
            </a>
          </div>
        `,
        text: `Sync Failed: {{accountName}}\n\nError: {{errorMessage}}\nFailed at: {{failedAt}}\n\nCheck settings: {{settingsUrl}}`
      },

      weekly_report: {
        subject: '📊 Weekly Report - {{organizationName}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Weekly Report</h2>
            <p>Here's your weekly performance summary for {{organizationName}}.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px;">
                <h3 style="margin: 0; color: #059669;">Total Spend</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 8px 0;">{{totalSpend}}</p>
              </div>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px;">
                <h3 style="margin: 0; color: #059669;">ROAS</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 8px 0;">{{roas}}</p>
              </div>
            </div>
            
            <a href="{{reportUrl}}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Full Report
            </a>
          </div>
        `,
        text: `Weekly Report - {{organizationName}}\n\nTotal Spend: {{totalSpend}}\nROAS: {{roas}}\n\nView full report: {{reportUrl}}`
      }
    }

    return templates[type] || templates.campaign_alert
  }

  /**
   * Programa notificação para envio futuro
   */
  async scheduleNotification(
    scheduledFor: Date,
    type: 'push' | 'email' | 'sms',
    target: string,
    payload: any
  ): Promise<string> {
    const { data } = await this.supabase
      .from('scheduled_notifications')
      .insert({
        scheduled_for: scheduledFor.toISOString(),
        type,
        target,
        payload,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    return data?.id
  }

  /**
   * Processa notificações agendadas
   */
  async processScheduledNotifications(): Promise<void> {
    const { data: notifications } = await this.supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())

    if (!notifications) return

    for (const notification of notifications) {
      try {
        let success = false

        switch (notification.type) {
          case 'push':
            const result = await this.sendPushToUser(notification.target, notification.payload)
            success = result.success > 0
            break
          
          case 'email':
            success = await this.sendEmail(notification.target, notification.payload)
            break
          
          case 'sms':
            success = await this.sendSMS(notification.target, notification.payload.message)
            break
        }

        await this.supabase
          .from('scheduled_notifications')
          .update({
            status: success ? 'sent' : 'failed',
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id)

      } catch (error) {
        console.error(`Failed to send scheduled notification ${notification.id}:`, error)
        
        await this.supabase
          .from('scheduled_notifications')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', notification.id)
      }
    }
  }
}

export default PushService