/**
 * Tipos para eventos de webhook
 */

export enum WebhookEventType {
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CANCELED = 'payment.canceled',
  PAYMENT_REFUNDED = 'payment.refunded',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  SUBSCRIPTION_PAYMENT_SUCCEEDED = 'subscription.payment_succeeded',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment_failed'
}

export interface WebhookEvent {
  /** Tipo do evento */
  type: WebhookEventType;
  
  /** ID único do evento */
  id: string;
  
  /** Nome do provedor que enviou o evento */
  provider: string;
  
  /** Dados do evento */
  data: {
    /** Objeto principal do evento (payment, subscription, etc.) */
    object: Record<string, any>;
    
    /** Objeto anterior (para eventos de atualização) */
    previousAttributes?: Record<string, any>;
  };
  
  /** Timestamp do evento */
  createdAt: Date;
  
  /** Dados brutos do provedor */
  rawData: Record<string, any>;
}

export interface WebhookValidationResult {
  /** Se a validação foi bem-sucedida */
  isValid: boolean;
  
  /** Motivo da falha (se aplicável) */
  reason?: string;
  
  /** Dados extraídos do webhook */
  event?: WebhookEvent;
}