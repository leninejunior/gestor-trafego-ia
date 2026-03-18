import { IPaymentProvider } from '../interfaces/payment-provider.interface';
import { 
  ProviderConfig, 
  HealthStatus, 
  ProviderStatus, 
  PaymentError, 
  PaymentErrorType,
  WebhookEvent,
  WebhookEventType 
} from '../types';

/**
 * Classe base para provedores de pagamento
 * Implementa funcionalidades comuns que podem ser reutilizadas
 */
export abstract class BaseProvider implements IPaymentProvider {
  protected config?: ProviderConfig;
  protected isConfigured: boolean = false;

  constructor(
    public readonly name: string,
    public readonly version: string
  ) {}

  /**
   * Configura o provedor com as credenciais fornecidas
   */
  async configure(config: ProviderConfig): Promise<void> {
    const isValid = await this.validateConfig(config);
    if (!isValid) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Invalid configuration for provider ${this.name}`,
        undefined,
        false,
        this.name
      );
    }

    this.config = config;
    this.isConfigured = true;
    
    // Hook para configuração específica do provedor
    await this.onConfigured(config);
  }

  /**
   * Valida a configuração do provedor
   */
  async validateConfig(config: ProviderConfig): Promise<boolean> {
    try {
      // Validações básicas
      if (!config.credentials || Object.keys(config.credentials).length === 0) {
        return false;
      }

      // Validação específica do provedor
      return await this.validateProviderConfig(config);
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica o status de saúde do provedor
   */
  async healthCheck(): Promise<HealthStatus> {
    if (!this.isConfigured) {
      return {
        status: ProviderStatus.OFFLINE,
        lastCheck: new Date(),
        details: {
          apiAccessible: false,
          credentialsValid: false,
          errors: ['Provider not configured']
        }
      };
    }

    const startTime = Date.now();
    
    try {
      const isHealthy = await this.performHealthCheck();
      const responseTime = Date.now() - startTime;

      return {
        status: isHealthy ? ProviderStatus.HEALTHY : ProviderStatus.DEGRADED,
        responseTime,
        errorRate: 0,
        lastCheck: new Date(),
        details: {
          apiAccessible: isHealthy,
          credentialsValid: true,
          errors: []
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: ProviderStatus.UNHEALTHY,
        responseTime,
        errorRate: 100,
        lastCheck: new Date(),
        details: {
          apiAccessible: false,
          credentialsValid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      };
    }
  }

  /**
   * Normaliza erros do provedor para o formato padrão
   */
  protected normalizeError(error: any, context?: string): PaymentError {
    if (error instanceof PaymentError) {
      return error;
    }

    // Mapear erros comuns
    let errorType = PaymentErrorType.UNKNOWN_ERROR;
    let retryable = false;

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorType = PaymentErrorType.NETWORK_ERROR;
      retryable = true;
    } else if (error.status === 401 || error.status === 403) {
      errorType = PaymentErrorType.INVALID_CREDENTIALS;
      retryable = false;
    } else if (error.status >= 500) {
      errorType = PaymentErrorType.PROVIDER_UNAVAILABLE;
      retryable = true;
    }

    const message = context 
      ? `${context}: ${error.message || 'Unknown error'}`
      : error.message || 'Unknown error';

    return new PaymentError(
      errorType,
      message,
      error,
      retryable,
      this.name
    );
  }

  /**
   * Valida assinatura de webhook usando HMAC
   */
  protected validateHmacSignature(
    payload: string, 
    signature: string, 
    secret: string,
    algorithm: string = 'sha256'
  ): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(payload)
        .digest('hex');
      
      // Comparação segura para evitar timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Cria um evento de webhook normalizado
   */
  protected createWebhookEvent(
    type: WebhookEventType,
    id: string,
    data: Record<string, any>,
    rawData: Record<string, any>
  ): WebhookEvent {
    return {
      type,
      id,
      provider: this.name,
      data: {
        object: data
      },
      createdAt: new Date(),
      rawData
    };
  }

  /**
   * Verifica se o provedor está configurado
   */
  protected ensureConfigured(): void {
    if (!this.isConfigured || !this.config) {
      throw new PaymentError(
        PaymentErrorType.CONFIGURATION_ERROR,
        `Provider ${this.name} is not configured`,
        undefined,
        false,
        this.name
      );
    }
  }

  // Métodos abstratos que devem ser implementados pelos provedores específicos
  protected abstract validateProviderConfig(config: ProviderConfig): Promise<boolean>;
  protected abstract performHealthCheck(): Promise<boolean>;
  protected abstract onConfigured(config: ProviderConfig): Promise<void>;

  // Métodos abstratos da interface IPaymentProvider
  abstract createPayment(request: any): Promise<any>;
  abstract capturePayment(paymentId: string): Promise<any>;
  abstract refundPayment(paymentId: string, amount?: number): Promise<any>;
  abstract createSubscription(request: any): Promise<any>;
  abstract updateSubscription(subscriptionId: string, updates: any): Promise<any>;
  abstract cancelSubscription(subscriptionId: string): Promise<any>;
  abstract validateWebhook(payload: string, signature: string): boolean;
  abstract parseWebhook(payload: string): WebhookEvent;
}