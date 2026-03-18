/**
 * Tipos específicos do Mercado Pago
 */

export interface MercadoPagoConfig {
  /** Access Token do Mercado Pago */
  accessToken: string;
  
  /** Public Key do Mercado Pago */
  publicKey?: string;
  
  /** Client ID da aplicação */
  clientId?: string;
  
  /** Client Secret da aplicação */
  clientSecret?: string;
  
  /** Webhook Secret para validação */
  webhookSecret?: string;
  
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
    
    /** Configurações do PIX */
    pixSettings?: {
      expirationMinutes?: number;
    };
  };
}

export interface MercadoPagoPaymentData {
  /** ID do pagamento no Mercado Pago */
  id?: number;
  
  /** Status do pagamento */
  status?: string;
  
  /** URL de checkout */
  initPoint?: string;
  
  /** Sandbox URL */
  sandboxInitPoint?: string;
  
  /** Dados do boleto */
  barcode?: {
    content: string;
    type: string;
    width: number;
    height: number;
  };
  
  /** Dados do PIX */
  pointOfInteraction?: {
    transactionData?: {
      qrCode?: string;
      qrCodeBase64?: string;
      ticketUrl?: string;
    };
  };
}

export interface MercadoPagoSubscriptionData {
  /** ID da assinatura no Mercado Pago */
  id: string;
  
  /** Status da assinatura */
  status: string;
  
  /** ID do plano */
  planId?: string;
  
  /** Dados do pagador */
  payer?: {
    id: string;
    email: string;
  };
  
  /** Próxima cobrança */
  nextPaymentDate?: string;
}

export interface MercadoPagoWebhookEventData {
  /** Tipo do evento original do Mercado Pago */
  originalType: string;
  
  /** ID do evento */
  id: number;
  
  /** Ação do evento */
  action: string;
  
  /** Timestamp do evento */
  dateCreated: string;
  
  /** Dados do objeto principal */
  data: {
    id: string;
  };
}

export interface MercadoPagoErrorDetails {
  /** Código do erro do Mercado Pago */
  code?: string;
  
  /** Mensagem do erro */
  message: string;
  
  /** Status do erro */
  status?: number;
  
  /** Causa do erro */
  cause?: any[];
  
  /** Status HTTP */
  statusCode?: number;
}

/**
 * Mapeamento de eventos do Mercado Pago para eventos padronizados
 */
export const MERCADOPAGO_EVENT_MAPPING = {
  // Eventos de pagamento
  'payment.created': 'payment.created',
  'payment.updated': 'payment.updated',
  
  // Eventos de assinatura
  'subscription.created': 'subscription.created',
  'subscription.updated': 'subscription.updated',
  'subscription.cancelled': 'subscription.canceled',
  
  // Eventos de plano
  'plan.created': 'plan.created',
  'plan.updated': 'plan.updated'
} as const;

/**
 * Status de pagamento do Mercado Pago mapeados para status padronizados
 */
export const MERCADOPAGO_PAYMENT_STATUS_MAPPING = {
  'pending': 'processing',
  'approved': 'succeeded',
  'authorized': 'requires_action',
  'in_process': 'processing',
  'in_mediation': 'processing',
  'rejected': 'failed',
  'cancelled': 'canceled',
  'refunded': 'refunded',
  'charged_back': 'refunded'
} as const;

/**
 * Status de assinatura do Mercado Pago mapeados para status padronizados
 */
export const MERCADOPAGO_SUBSCRIPTION_STATUS_MAPPING = {
  'pending': 'incomplete',
  'authorized': 'active',
  'paused': 'past_due',
  'cancelled': 'canceled'
} as const;

/**
 * Métodos de pagamento do Mercado Pago
 */
export const MERCADOPAGO_PAYMENT_METHODS = {
  'credit_card': 'card',
  'debit_card': 'debit_card',
  'ticket': 'boleto',
  'bank_transfer': 'bank_transfer',
  'pix': 'pix',
  'account_money': 'account_balance'
} as const;

/**
 * URLs da API do Mercado Pago
 */
export const MERCADOPAGO_API_URLS = {
  production: 'https://api.mercadopago.com',
  sandbox: 'https://api.mercadopago.com' // Mesmo endpoint, diferenciado pelo access token
} as const;