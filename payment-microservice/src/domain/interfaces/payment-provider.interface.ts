import { 
  PaymentRequest, 
  PaymentResponse, 
  RefundResponse, 
  SubscriptionRequest, 
  SubscriptionResponse, 
  SubscriptionUpdate,
  WebhookEvent,
  HealthStatus,
  ProviderConfig 
} from '../types';

/**
 * Interface principal para provedores de pagamento
 * Define o contrato que todos os provedores devem implementar
 */
export interface IPaymentProvider {
  /** Nome único do provedor */
  readonly name: string;
  
  /** Versão do provedor */
  readonly version: string;
  
  // Configuration
  /**
   * Configura o provedor com as credenciais e configurações necessárias
   */
  configure(config: ProviderConfig): Promise<void>;
  
  /**
   * Valida se a configuração fornecida é válida
   */
  validateConfig(config: ProviderConfig): Promise<boolean>;
  
  // Payment Operations
  /**
   * Cria um novo pagamento
   */
  createPayment(request: PaymentRequest): Promise<PaymentResponse>;
  
  /**
   * Captura um pagamento previamente autorizado
   */
  capturePayment(paymentId: string): Promise<PaymentResponse>;
  
  /**
   * Realiza o estorno de um pagamento
   */
  refundPayment(paymentId: string, amount?: number): Promise<RefundResponse>;
  
  // Subscription Operations
  /**
   * Cria uma nova assinatura
   */
  createSubscription(request: SubscriptionRequest): Promise<SubscriptionResponse>;
  
  /**
   * Atualiza uma assinatura existente
   */
  updateSubscription(subscriptionId: string, updates: SubscriptionUpdate): Promise<SubscriptionResponse>;
  
  /**
   * Cancela uma assinatura
   */
  cancelSubscription(subscriptionId: string): Promise<SubscriptionResponse>;
  
  // Webhook Operations
  /**
   * Valida a assinatura de um webhook
   */
  validateWebhook(payload: string, signature: string): boolean;
  
  /**
   * Processa e normaliza um evento de webhook
   */
  parseWebhook(payload: string): WebhookEvent;
  
  // Health Check
  /**
   * Verifica o status de saúde do provedor
   */
  healthCheck(): Promise<HealthStatus>;
}