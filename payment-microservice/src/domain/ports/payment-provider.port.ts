import { ProviderConfig } from '../entities/provider-config';

export interface PaymentRequest {
  amount: number;
  currency: string;
  organizationId: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  providerTransactionId: string;
  redirectUrl?: string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  providerRefundId: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionRequest {
  customerId: string;
  planId: string;
  organizationId: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionResponse {
  id: string;
  status: string;
  customerId: string;
  planId: string;
  providerSubscriptionId: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionUpdate {
  planId?: string;
  metadata?: Record<string, any>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface HealthStatus {
  isHealthy: boolean;
  responseTime: number;
  lastCheck: Date;
  errorMessage?: string;
}

export interface IPaymentProvider {
  readonly name: string;
  readonly version: string;

  // Configuration
  configure(config: ProviderConfig): Promise<void>;
  validateConfig(config: ProviderConfig): Promise<boolean>;

  // Payment Operations
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;
  capturePayment(paymentId: string): Promise<PaymentResponse>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResponse>;

  // Subscription Operations
  createSubscription(request: SubscriptionRequest): Promise<SubscriptionResponse>;
  updateSubscription(subscriptionId: string, updates: SubscriptionUpdate): Promise<SubscriptionResponse>;
  cancelSubscription(subscriptionId: string): Promise<SubscriptionResponse>;

  // Webhook Operations
  validateWebhook(payload: string, signature: string): boolean;
  parseWebhook(payload: string): WebhookEvent;

  // Health Check
  healthCheck(): Promise<HealthStatus>;
}