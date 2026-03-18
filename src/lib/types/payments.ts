// Tipos TypeScript para o Sistema de Pagamentos

export interface PaymentProvider {
  id: string;
  org_id: string;
  name: 'stripe' | 'iugu' | 'pagseguro' | 'mercadopago';
  display_name: string;
  is_active: boolean;
  is_sandbox: boolean;
  priority: number;
  config: Record<string, any>;
  success_rate: number;
  avg_response_time: number;
  last_health_check: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  org_id: string;
  client_id?: string;
  provider_id: string;
  external_id?: string;
  reference_id?: string;
  amount: number;
  currency: string;
  description?: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  failure_reason?: string;
  customer_data: Record<string, any>;
  metadata: Record<string, any>;
  processed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  provider?: PaymentProvider;
  client?: {
    id: string;
    name: string;
  };
}

export interface PaymentSubscription {
  id: string;
  org_id: string;
  client_id?: string;
  provider_id: string;
  external_id?: string;
  plan_name: string;
  amount: number;
  currency: string;
  interval_type: 'monthly' | 'yearly' | 'weekly';
  interval_count: number;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  customer_data: Record<string, any>;
  current_period_start?: string;
  current_period_end?: string;
  canceled_at?: string;
  trial_end?: string;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  provider?: PaymentProvider;
  client?: {
    id: string;
    name: string;
  };
}

export interface PaymentWebhook {
  id: string;
  provider_name: string;
  event_type: string;
  event_id?: string;
  payload: Record<string, any>;
  headers: Record<string, any>;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  transaction_id?: string;
  subscription_id?: string;
  created_at: string;
}

export interface PaymentAuditLog {
  id: string;
  org_id: string;
  user_id?: string;
  action: string;
  entity_type: 'transaction' | 'subscription' | 'provider';
  entity_id: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
}

// Tipos para requests/responses das APIs
export interface CreatePaymentRequest {
  client_id?: string;
  provider_name?: string;
  amount: number;
  currency?: string;
  description?: string;
  customer_data: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

export interface CreatePaymentResponse {
  transaction: PaymentTransaction;
  payment_url?: string;
  qr_code?: string;
  barcode?: string;
}

export interface CreateSubscriptionRequest {
  client_id?: string;
  provider_name?: string;
  plan_name: string;
  amount: number;
  currency?: string;
  interval_type: 'monthly' | 'yearly' | 'weekly';
  interval_count?: number;
  customer_data: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  trial_days?: number;
}

export interface CreateSubscriptionResponse {
  subscription: PaymentSubscription;
  payment_url?: string;
}

export interface PaymentProviderConfig {
  stripe?: {
    api_key: string;
    webhook_secret: string;
  };
  iugu?: {
    api_token: string;
  };
  pagseguro?: {
    email: string;
    token: string;
  };
  mercadopago?: {
    access_token: string;
  };
}

export interface PaymentStats {
  total_transactions: number;
  total_amount: number;
  success_rate: number;
  avg_processing_time: number;
  transactions_by_status: Record<string, number>;
  transactions_by_provider: Record<string, number>;
  monthly_revenue: Array<{
    month: string;
    amount: number;
    transactions: number;
  }>;
}

// Tipos para webhooks específicos de cada provedor
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

export interface IuguWebhookEvent {
  event: string;
  data: any;
}

export interface PagSeguroWebhookEvent {
  notificationCode: string;
  notificationType: string;
}

export interface MercadoPagoWebhookEvent {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: number;
  user_id: number;
  version: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

// Tipos para configuração de failover
export interface FailoverConfig {
  enabled: boolean;
  max_retries: number;
  retry_delay: number; // em segundos
  health_check_interval: number; // em segundos
  success_rate_threshold: number; // porcentagem mínima
  response_time_threshold: number; // em millisegundos
}

// Tipos para relatórios
export interface PaymentReport {
  period: {
    start: string;
    end: string;
  };
  summary: {
    total_transactions: number;
    total_amount: number;
    success_rate: number;
    failed_transactions: number;
    refunded_amount: number;
  };
  by_provider: Array<{
    provider_name: string;
    transactions: number;
    amount: number;
    success_rate: number;
  }>;
  by_status: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  timeline: Array<{
    date: string;
    transactions: number;
    amount: number;
  }>;
}