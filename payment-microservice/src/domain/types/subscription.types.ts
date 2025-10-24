/**
 * Tipos para operações de assinatura
 */

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete'
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  WEEKLY = 'weekly',
  DAILY = 'daily'
}

export interface SubscriptionRequest {
  /** ID do cliente */
  customerId: string;
  
  /** ID da organização */
  organizationId: string;
  
  /** ID do plano */
  planId: string;
  
  /** Valor da assinatura em centavos */
  amount: number;
  
  /** Moeda */
  currency: string;
  
  /** Intervalo de cobrança */
  billingInterval: BillingInterval;
  
  /** Período de teste em dias (opcional) */
  trialPeriodDays?: number;
  
  /** Metadados adicionais */
  metadata?: Record<string, any>;
}

export interface SubscriptionResponse {
  /** ID único da assinatura */
  id: string;
  
  /** ID da assinatura no provedor */
  providerSubscriptionId: string;
  
  /** Status da assinatura */
  status: SubscriptionStatus;
  
  /** ID do cliente */
  customerId: string;
  
  /** Valor da assinatura */
  amount: number;
  
  /** Moeda */
  currency: string;
  
  /** Intervalo de cobrança */
  billingInterval: BillingInterval;
  
  /** Data de início */
  startDate: Date;
  
  /** Data de fim do período atual */
  currentPeriodEnd: Date;
  
  /** Data de cancelamento (se aplicável) */
  canceledAt?: Date;
  
  /** Timestamp de criação */
  createdAt: Date;
  
  /** Timestamp de atualização */
  updatedAt: Date;
}

export interface SubscriptionUpdate {
  /** Novo valor (opcional) */
  amount?: number;
  
  /** Novo plano (opcional) */
  planId?: string;
  
  /** Metadados para atualizar */
  metadata?: Record<string, any>;
  
  /** Cancelar no fim do período */
  cancelAtPeriodEnd?: boolean;
}