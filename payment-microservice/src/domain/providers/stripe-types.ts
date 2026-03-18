/**
 * Tipos específicos do Stripe
 */

export interface StripeConfig {
  /** Chave secreta do Stripe */
  secretKey: string;
  
  /** Chave pública do Stripe */
  publishableKey?: string;
  
  /** Secret para validação de webhooks */
  webhookSecret?: string;
  
  /** Versão da API do Stripe */
  apiVersion?: string;
  
  /** Configurações adicionais */
  settings?: {
    /** Captura automática de pagamentos */
    automaticCapture?: boolean;
    
    /** Moedas suportadas */
    supportedCurrencies?: string[];
    
    /** Métodos de pagamento habilitados */
    paymentMethods?: string[];
  };
}

export interface StripePaymentIntentData {
  /** Client secret para o frontend */
  clientSecret?: string;
  
  /** Próxima ação necessária */
  nextAction?: {
    type: string;
    redirectToUrl?: {
      url: string;
      returnUrl?: string;
    };
  };
  
  /** Charges associadas */
  charges?: any[];
}

export interface StripeSubscriptionData {
  /** ID do customer no Stripe */
  customerId: string;
  
  /** ID do produto no Stripe */
  productId?: string;
  
  /** ID do preço no Stripe */
  priceId?: string;
  
  /** Dados da última fatura */
  latestInvoice?: {
    id: string;
    status: string;
    amountPaid: number;
    amountDue: number;
  };
}

export interface StripeWebhookEventData {
  /** Tipo do evento original do Stripe */
  originalType: string;
  
  /** ID do evento no Stripe */
  eventId: string;
  
  /** Timestamp do evento */
  created: number;
  
  /** Dados do objeto principal */
  object: any;
  
  /** Atributos anteriores (para eventos de update) */
  previousAttributes?: any;
}

export interface StripeErrorDetails {
  /** Tipo do erro do Stripe */
  type: string;
  
  /** Código do erro */
  code?: string;
  
  /** Parâmetro que causou o erro */
  param?: string;
  
  /** ID da requisição */
  requestId?: string;
  
  /** Status HTTP */
  statusCode?: number;
}

/**
 * Mapeamento de eventos do Stripe para eventos padronizados
 */
export const STRIPE_EVENT_MAPPING = {
  // Eventos de pagamento
  'payment_intent.succeeded': 'payment.succeeded',
  'payment_intent.payment_failed': 'payment.failed',
  'payment_intent.canceled': 'payment.canceled',
  'charge.dispute.created': 'payment.refunded',
  
  // Eventos de assinatura
  'customer.subscription.created': 'subscription.created',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.deleted': 'subscription.canceled',
  'invoice.payment_succeeded': 'subscription.payment_succeeded',
  'invoice.payment_failed': 'subscription.payment_failed',
  
  // Eventos de customer
  'customer.created': 'customer.created',
  'customer.updated': 'customer.updated',
  'customer.deleted': 'customer.deleted'
} as const;

/**
 * Status de pagamento do Stripe mapeados para status padronizados
 */
export const STRIPE_PAYMENT_STATUS_MAPPING = {
  'requires_payment_method': 'requires_action',
  'requires_confirmation': 'requires_action',
  'requires_action': 'requires_action',
  'processing': 'processing',
  'succeeded': 'succeeded',
  'canceled': 'canceled'
} as const;

/**
 * Status de assinatura do Stripe mapeados para status padronizados
 */
export const STRIPE_SUBSCRIPTION_STATUS_MAPPING = {
  'active': 'active',
  'canceled': 'canceled',
  'past_due': 'past_due',
  'unpaid': 'unpaid',
  'trialing': 'trialing',
  'incomplete': 'incomplete',
  'incomplete_expired': 'incomplete'
} as const;

/**
 * Intervalos de cobrança do Stripe
 */
export const STRIPE_BILLING_INTERVALS = {
  'day': 'daily',
  'week': 'weekly',
  'month': 'monthly',
  'year': 'yearly'
} as const;