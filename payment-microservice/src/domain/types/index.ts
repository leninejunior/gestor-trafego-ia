/**
 * Exporta todos os tipos do domínio
 */

// Payment types
export * from './payment.types';

// Subscription types
export * from './subscription.types';

// Webhook types
export * from './webhook.types';

// Provider types
export * from './provider.types';

// Common error types
export enum PaymentErrorType {
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  WEBHOOK_VALIDATION_ERROR = 'WEBHOOK_VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class PaymentError extends Error {
  constructor(
    public readonly type: PaymentErrorType,
    public readonly message: string,
    public readonly providerError?: any,
    public readonly retryable: boolean = false,
    public readonly providerName?: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

// Processing options
export interface ProcessingOptions {
  /** Provedor preferido */
  preferredProvider?: string;
  
  /** Se deve usar failover */
  enableFailover?: boolean;
  
  /** Timeout em milissegundos */
  timeout?: number;
  
  /** Número máximo de tentativas */
  maxRetries?: number;
  
  /** Metadados adicionais */
  metadata?: Record<string, any>;
}