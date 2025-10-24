/**
 * Tipos padronizados para operações de pagamento
 */

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REQUIRES_ACTION = 'requires_action'
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PIX = 'pix',
  BOLETO = 'boleto',
  BANK_TRANSFER = 'bank_transfer'
}

export enum Currency {
  BRL = 'BRL',
  USD = 'USD',
  EUR = 'EUR'
}

export interface PaymentRequest {
  /** Valor do pagamento em centavos */
  amount: number;
  
  /** Moeda do pagamento */
  currency: Currency;
  
  /** ID da organização */
  organizationId: string;
  
  /** ID do cliente (opcional) */
  customerId?: string;
  
  /** ID do método de pagamento */
  paymentMethodId?: string;
  
  /** Descrição do pagamento */
  description?: string;
  
  /** Metadados adicionais */
  metadata?: Record<string, any>;
  
  /** URL de retorno após sucesso */
  returnUrl?: string;
  
  /** URL de retorno após cancelamento */
  cancelUrl?: string;
  
  /** Método de pagamento preferido */
  preferredMethod?: PaymentMethod;
}

export interface PaymentResponse {
  /** ID único do pagamento no sistema */
  id: string;
  
  /** ID do pagamento no provedor */
  providerPaymentId: string;
  
  /** Status atual do pagamento */
  status: PaymentStatus;
  
  /** Valor do pagamento */
  amount: number;
  
  /** Moeda */
  currency: Currency;
  
  /** URL para completar o pagamento (se necessário) */
  checkoutUrl?: string;
  
  /** Dados adicionais do provedor */
  providerData?: Record<string, any>;
  
  /** Timestamp de criação */
  createdAt: Date;
  
  /** Timestamp de atualização */
  updatedAt: Date;
}

export interface RefundResponse {
  /** ID único do estorno */
  id: string;
  
  /** ID do estorno no provedor */
  providerRefundId: string;
  
  /** ID do pagamento original */
  paymentId: string;
  
  /** Valor estornado */
  amount: number;
  
  /** Status do estorno */
  status: PaymentStatus;
  
  /** Motivo do estorno */
  reason?: string;
  
  /** Timestamp de criação */
  createdAt: Date;
}