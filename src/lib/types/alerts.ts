// Tipos para Sistema de Alertas de Saldo

export type AlertType = 'low_balance' | 'no_balance' | 'daily_limit' | 'weekly_limit'
export type AlertStatus = 'unknown' | 'critical' | 'warning' | 'ok'
export type SendVia = 'whatsapp' | 'email' | 'push' | 'sms'
export type SendStatus = 'sent' | 'failed' | 'pending' | 'delivered'

export interface BalanceAlert {
  id: string
  client_id: string
  ad_account_id: string
  ad_account_name?: string
  threshold_amount: number
  alert_type: AlertType
  current_balance?: number
  is_active: boolean
  last_checked_at?: string
  last_alert_sent_at?: string
  created_at: string
  updated_at: string
}

export interface BalanceAlertWithClient extends BalanceAlert {
  client_name: string
  organization_id: string
  organization_name: string
  alert_status: AlertStatus
  hours_since_last_alert?: number
}

export interface WhatsAppConfig {
  id: string
  organization_id: string
  evolution_api_url: string
  evolution_api_key: string
  instance_name: string
  phone_number: string
  is_active: boolean
  send_to_admin: boolean
  send_to_client: boolean
  created_at: string
  updated_at: string
  last_test_at?: string
}

export interface AlertHistory {
  id: string
  alert_id: string
  sent_at: string
  sent_via: SendVia
  recipient: string
  message: string
  status: SendStatus
  error_message?: string
  balance_at_send?: number
  threshold_at_send?: number
}

export interface AlertRecipient {
  id: string
  client_id: string
  name: string
  phone_number?: string
  email?: string
  receive_whatsapp: boolean
  receive_email: boolean
  receive_push: boolean
  alert_types: AlertType[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AlertStatistics {
  organization_id: string
  organization_name: string
  total_alerts: number
  active_alerts: number
  total_sent: number
  sent_last_24h: number
  failed_sends: number
}

// Tipos para criação/atualização
export interface CreateBalanceAlertInput {
  client_id: string
  ad_account_id: string
  ad_account_name?: string
  threshold_amount: number
  alert_type: AlertType
  is_active?: boolean
}

export interface UpdateBalanceAlertInput {
  threshold_amount?: number
  alert_type?: AlertType
  is_active?: boolean
  current_balance?: number
}

export interface CreateWhatsAppConfigInput {
  organization_id: string
  evolution_api_url: string
  evolution_api_key: string
  instance_name: string
  phone_number: string
  send_to_admin?: boolean
  send_to_client?: boolean
}

export interface CreateAlertRecipientInput {
  client_id: string
  name: string
  phone_number?: string
  email?: string
  receive_whatsapp?: boolean
  receive_email?: boolean
  receive_push?: boolean
  alert_types?: AlertType[]
}

// Tipos para Evolution API
export interface EvolutionAPIMessage {
  number: string
  text: string
}

export interface EvolutionAPIResponse {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: {
    extendedTextMessage: {
      text: string
    }
  }
  messageTimestamp: number
  status: string
}

export interface EvolutionInstanceStatus {
  instance: {
    instanceName: string
    status: 'open' | 'close' | 'connecting'
  }
  qrcode?: {
    code: string
    base64: string
  }
}
