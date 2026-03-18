/**
 * Tipos específicos do PagSeguro
 */

export interface PagSeguroConfig {
  /** Email da conta PagSeguro */
  email: string;
  
  /** Token de acesso da API */
  token: string;
  
  /** App ID para aplicações */
  appId?: string;
  
  /** App Key para aplicações */
  appKey?: string;
  
  /** Ambiente (sandbox ou production) */
  environment?: 'sandbox' | 'production';
  
  /** Configurações adicionais */
  settings?: {
    /** Captura automática de pagamentos */
    automaticCapture?: boolean;
    
    /** Moedas suportadas */
    supportedCurrencies?: string[];
    
    /** Métodos de pagamento habilitados */
    paymentMethods?: string[];
    
    /** URL de notificação padrão */
    notificationUrl?: string;
  };
}

export interface PagSeguroPaymentData {
  /** Código da transação no PagSeguro */
  code?: string;
  
  /** URL de redirecionamento para pagamento */
  paymentUrl?: string;
  
  /** Link de pagamento */
  paymentLink?: string;
  
  /** Dados do boleto */
  boleto?: {
    barcode: string;
    expirationDate: string;
  };
  
  /** Dados do PIX */
  pix?: {
    qrCode: string;
    qrCodeBase64: string;
    expirationDate: string;
  };
}

export interface PagSeguroSubscriptionData {
  /** Código da assinatura no PagSeguro */
  code: string;
  
  /** Status da assinatura */
  status: string;
  
  /** Dados do plano */
  plan?: {
    id: string;
    name: string;
  };
}

export interface PagSeguroWebhookEventData {
  /** Tipo do evento original do PagSeguro */
  originalType: string;
  
  /** Código da notificação */
  notificationCode: string;
  
  /** Tipo da notificação */
  notificationType: string;
  
  /** Dados da transação */
  transaction?: any;
}

export interface PagSeguroErrorDetails {
  /** Código do erro do PagSeguro */
  code?: string;
  
  /** Mensagem do erro */
  message: string;
  
  /** Detalhes adicionais */
  details?: any;
  
  /** Status HTTP */
  statusCode?: number;
}

/**
 * Mapeamento de eventos do PagSeguro para eventos padronizados
 */
export const PAGSEGURO_EVENT_MAPPING = {
  // Eventos de transação
  'transaction': 'payment.status_changed',
  
  // Eventos de assinatura
  'subscription': 'subscription.status_changed',
  
  // Eventos de aplicação
  'applicationAuthorization': 'application.authorized'
} as const;

/**
 * Status de pagamento do PagSeguro mapeados para status padronizados
 */
export const PAGSEGURO_PAYMENT_STATUS_MAPPING = {
  '1': 'processing', // Aguardando pagamento
  '2': 'processing', // Em análise
  '3': 'succeeded',  // Paga
  '4': 'succeeded',  // Disponível
  '5': 'processing', // Em disputa
  '6': 'refunded',   // Devolvida
  '7': 'canceled',   // Cancelada
  '8': 'processing', // Chargeback debitado
  '9': 'processing'  // Em contestação
} as const;

/**
 * Status de assinatura do PagSeguro mapeados para status padronizados
 */
export const PAGSEGURO_SUBSCRIPTION_STATUS_MAPPING = {
  'INITIATED': 'incomplete',
  'PENDING': 'incomplete',
  'ACTIVE': 'active',
  'PAYMENT_METHOD_CHANGE': 'active',
  'SUSPENDED': 'past_due',
  'CANCELLED': 'canceled',
  'CANCELLED_BY_RECEIVER': 'canceled',
  'CANCELLED_BY_SENDER': 'canceled',
  'EXPIRED': 'canceled'
} as const;

/**
 * Métodos de pagamento do PagSeguro
 */
export const PAGSEGURO_PAYMENT_METHODS = {
  'creditCard': 'card',
  'boleto': 'boleto',
  'pix': 'pix',
  'debitCard': 'debit_card',
  'balance': 'account_balance'
} as const;

/**
 * URLs da API do PagSeguro
 */
export const PAGSEGURO_API_URLS = {
  sandbox: {
    api: 'https://ws.sandbox.pagseguro.uol.com.br',
    checkout: 'https://sandbox.pagseguro.uol.com.br'
  },
  production: {
    api: 'https://ws.pagseguro.uol.com.br',
    checkout: 'https://pagseguro.uol.com.br'
  }
} as const;