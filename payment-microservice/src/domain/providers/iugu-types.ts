/**
 * Tipos específicos do Iugu
 */

export interface IuguConfig {
  /** API Token do Iugu */
  apiToken: string;
  
  /** Account ID do Iugu */
  accountId?: string;
  
  /** Webhook Token para validação */
  webhookToken?: string;
  
  /** Configurações adicionais */
  settings?: {
    /** Captura automática de pagamentos */
    automaticCapture?: boolean;
    
    /** Moedas suportadas */
    supportedCurrencies?: string[];
    
    /** Métodos de pagamento habilitados */
    paymentMethods?: string[];
    
    /** Dias para vencimento de boleto */
    boletoExpirationDays?: number;
  };
}

export interface IuguPaymentData {
  /** URL para pagamento */
  paymentUrl?: string;
  
  /** Token do pagamento */
  token?: string;
  
  /** Dados do boleto */
  bankSlip?: {
    url: string;
    digitableLine: string;
    barcode: string;
  };
  
  /** Dados do PIX */
  pix?: {
    qrCode: string;
    qrCodeText: string;
    expirationDate: string;
  };
}

export interface IuguSubscriptionData {
  /** ID do customer no Iugu */
  customerId: string;
  
  /** ID do plano no Iugu */
  planId?: string;
  
  /** Dados da última fatura */
  lastInvoice?: {
    id: string;
    status: string;
    total: number;
    dueDate: string;
  };
}

export interface IuguWebhookEventData {
  /** Tipo do evento original do Iugu */
  originalType: string;
  
  /** ID do evento no Iugu */
  eventId: string;
  
  /** Timestamp do evento */
  occurredAt: string;
  
  /** Dados do objeto principal */
  data: any;
}

export interface IuguErrorDetails {
  /** Código do erro do Iugu */
  code?: string;
  
  /** Mensagem do erro */
  message: string;
  
  /** Detalhes adicionais */
  details?: any;
  
  /** Status HTTP */
  statusCode?: number;
}

/**
 * Mapeamento de eventos do Iugu para eventos padronizados
 */
export const IUGU_EVENT_MAPPING = {
  // Eventos de pagamento
  'invoice.status_changed': 'payment.status_changed',
  'invoice.payment_completed': 'payment.succeeded',
  'invoice.payment_failed': 'payment.failed',
  'invoice.refund': 'payment.refunded',
  
  // Eventos de assinatura
  'subscription.created': 'subscription.created',
  'subscription.activated': 'subscription.activated',
  'subscription.suspended': 'subscription.suspended',
  'subscription.expired': 'subscription.canceled',
  
  // Eventos de customer
  'customer.created': 'customer.created',
  'customer.updated': 'customer.updated'
} as const;

/**
 * Status de pagamento do Iugu mapeados para status padronizados
 */
export const IUGU_PAYMENT_STATUS_MAPPING = {
  'pending': 'processing',
  'paid': 'succeeded',
  'canceled': 'canceled',
  'partially_paid': 'processing',
  'expired': 'failed',
  'authorized': 'requires_action',
  'captured': 'succeeded',
  'refunded': 'refunded'
} as const;

/**
 * Status de assinatura do Iugu mapeados para status padronizados
 */
export const IUGU_SUBSCRIPTION_STATUS_MAPPING = {
  'active': 'active',
  'suspended': 'past_due',
  'expired': 'canceled',
  'inactive': 'incomplete'
} as const;

/**
 * Métodos de pagamento do Iugu
 */
export const IUGU_PAYMENT_METHODS = {
  'credit_card': 'card',
  'bank_slip': 'boleto',
  'pix': 'pix'
} as const;