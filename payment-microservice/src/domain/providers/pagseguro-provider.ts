import axios, { AxiosInstance, AxiosError } from 'axios';
import { BaseProvider } from './base-provider';
import {
  PaymentRequest,
  PaymentResponse,
  RefundResponse,
  SubscriptionRequest,
  SubscriptionResponse,
  SubscriptionUpdate,
  WebhookEvent,
  WebhookEventType,
  PaymentStatus,
  SubscriptionStatus,
  PaymentError,
  PaymentErrorType,
  ProviderConfig,
  Currency,
  BillingInterval
} from '../types';
import {
  PagSeguroConfig,
  PagSeguroPaymentData,
  PagSeguroSubscriptionData,
  PAGSEGURO_EVENT_MAPPING,
  PAGSEGURO_PAYMENT_STATUS_MAPPING,
  PAGSEGURO_SUBSCRIPTION_STATUS_MAPPING,
  PAGSEGURO_API_URLS
} from './pagseguro-types';

/**
 * Implementação do provedor PagSeguro
 * Suporta pagamentos únicos, assinaturas e webhooks
 */
export class PagSeguroProvider extends BaseProvider {
  private client?: AxiosInstance;
  private email?: string;
  private token?: string;
  private environment: 'sandbox' | 'production' = 'sandbox';

  constructor() {
    super('pagseguro', '1.0.0');
  }

  /**
   * Configura o cliente PagSeguro
   */
  protected async onConfigured(config: ProviderConfig): Promise<void> {
    const { email, token, environment = 'sandbox' } = config.credentials;
    
    this.email = email;
    this.token = token;
    this.environment = environment as 'sandbox' | 'production';
    
    const baseURL = PAGSEGURO_API_URLS[this.environment].api;
    
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/xml; charset=ISO-8859-1',
        'Accept': 'application/xml'
      },
      timeout: 30000
    });
  }

  /**
   * Valida a configuração específica do PagSeguro
   */
  protected async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    const { email, token } = config.credentials;
    
    if (!email || !token || email.trim() === '' || token.trim() === '') {
      return false;
    }

    try {
      // Testa a conexão fazendo uma chamada simples
      const testClient = axios.create({
        baseURL: PAGSEGURO_API_URLS.sandbox.api,
        timeout: 10000
      });
      
      await testClient.get(`/v2/sessions?email=${email}&token=${token}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica a saúde da API do PagSeguro
   */
  protected async performHealthCheck(): Promise<boolean> {
    if (!this.client || !this.email || !this.token) return false;

    try {
      await this.client.get(`/v2/sessions?email=${this.email}&token=${this.token}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cria um novo pagamento no PagSeguro
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.ensureConfigured();
    
    try {
      // Constrói o XML para o checkout
      const checkoutXml = this.buildCheckoutXml(request);
      
      const response = await this.client!.post(
        `/v2/checkout?email=${this.email}&token=${this.token}`,
        checkoutXml,
        {
          headers: {
            'Content-Type': 'application/xml; charset=ISO-8859-1'
          }
        }
      );

      const checkoutCode = this.extractCheckoutCode(response.data);
      const paymentUrl = `${PAGSEGURO_API_URLS[this.environment].checkout}/v2/checkout/payment.html?code=${checkoutCode}`;

      return {
        id: checkoutCode,
        providerPaymentId: checkoutCode,
        status: PaymentStatus.REQUIRES_ACTION, // PagSeguro sempre requer ação do usuário
        amount: request.amount,
        currency: request.currency,
        checkoutUrl: paymentUrl,
        providerData: {
          code: checkoutCode,
          paymentUrl: paymentUrl,
          paymentLink: paymentUrl
        } as PagSeguroPaymentData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to create payment');
    }
  }

  /**
   * Captura um pagamento autorizado (busca status atual)
   */
  async capturePayment(paymentId: string): Promise<PaymentResponse> {
    this.ensureConfigured();
    
    try {
      // No PagSeguro, busca o status da transação
      const response = await this.client!.get(
        `/v3/transactions/${paymentId}?email=${this.email}&token=${this.token}`
      );

      const transaction = this.parseXmlResponse(response.data);

      return {
        id: transaction.code || paymentId,
        providerPaymentId: transaction.code || paymentId,
        status: this.mapPagSeguroPaymentStatus(transaction.status),
        amount: Math.round(parseFloat(transaction.grossAmount || '0') * 100),
        currency: Currency.BRL, // PagSeguro trabalha apenas com BRL
        providerData: {
          code: transaction.code
        } as PagSeguroPaymentData,
        createdAt: new Date(transaction.date || Date.now()),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to capture payment');
    }
  }

  /**
   * Realiza estorno de um pagamento
   */
  async refundPayment(paymentId: string, amount?: number): Promise<RefundResponse> {
    this.ensureConfigured();
    
    try {
      const refundXml = this.buildRefundXml(amount);
      
      const response = await this.client!.post(
        `/v2/transactions/refunds?email=${this.email}&token=${this.token}`,
        refundXml,
        {
          headers: {
            'Content-Type': 'application/xml; charset=ISO-8859-1'
          }
        }
      );

      const refundResult = this.parseXmlResponse(response.data);

      return {
        id: refundResult.code || `refund_${paymentId}_${Date.now()}`,
        providerRefundId: refundResult.code || paymentId,
        paymentId: paymentId,
        amount: amount || 0,
        status: PaymentStatus.SUCCEEDED, // PagSeguro processa estornos imediatamente
        reason: 'requested_by_customer',
        createdAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to refund payment');
    }
  }

  /**
   * Cria uma nova assinatura
   */
  async createSubscription(request: SubscriptionRequest): Promise<SubscriptionResponse> {
    this.ensureConfigured();
    
    try {
      // Primeiro, cria o plano de assinatura
      const planXml = this.buildSubscriptionPlanXml(request);
      
      const planResponse = await this.client!.post(
        `/v2/pre-approvals/request?email=${this.email}&token=${this.token}`,
        planXml,
        {
          headers: {
            'Content-Type': 'application/xml; charset=ISO-8859-1'
          }
        }
      );

      const planResult = this.parseXmlResponse(planResponse.data);
      const subscriptionUrl = `${PAGSEGURO_API_URLS[this.environment].checkout}/v2/pre-approvals/request.html?code=${planResult.code}`;

      return {
        id: planResult.code,
        providerSubscriptionId: planResult.code,
        status: SubscriptionStatus.INCOMPLETE, // Aguardando aprovação do usuário
        customerId: request.customerId,
        amount: request.amount,
        currency: Currency.BRL,
        billingInterval: request.billingInterval,
        startDate: new Date(),
        currentPeriodEnd: new Date(Date.now() + this.getBillingIntervalMs(request.billingInterval)),
        canceledAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to create subscription');
    }
  }

  /**
   * Atualiza uma assinatura existente
   */
  async updateSubscription(subscriptionId: string, updates: SubscriptionUpdate): Promise<SubscriptionResponse> {
    this.ensureConfigured();
    
    try {
      // PagSeguro tem limitações para atualização de assinaturas
      // Busca o status atual
      const response = await this.client!.get(
        `/v2/pre-approvals/${subscriptionId}?email=${this.email}&token=${this.token}`
      );

      const subscription = this.parseXmlResponse(response.data);

      // Se solicitado cancelamento, cancela a assinatura
      if (updates.cancelAtPeriodEnd) {
        await this.client!.put(
          `/v2/pre-approvals/${subscriptionId}/cancel?email=${this.email}&token=${this.token}`
        );
      }

      return {
        id: subscription.code || subscriptionId,
        providerSubscriptionId: subscription.code || subscriptionId,
        status: this.mapPagSeguroSubscriptionStatus(subscription.status),
        customerId: subscription.sender?.email || '',
        amount: Math.round(parseFloat(subscription.amount || '0') * 100),
        currency: Currency.BRL,
        billingInterval: this.mapPagSeguroBillingInterval(subscription.period),
        startDate: new Date(subscription.date || Date.now()),
        currentPeriodEnd: new Date(subscription.nextPaymentDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: subscription.status === 'CANCELLED' ? new Date() : undefined,
        createdAt: new Date(subscription.date || Date.now()),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to update subscription');
    }
  }

  /**
   * Cancela uma assinatura
   */
  async cancelSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
    this.ensureConfigured();
    
    try {
      await this.client!.put(
        `/v2/pre-approvals/${subscriptionId}/cancel?email=${this.email}&token=${this.token}`
      );
      
      const response = await this.client!.get(
        `/v2/pre-approvals/${subscriptionId}?email=${this.email}&token=${this.token}`
      );

      const subscription = this.parseXmlResponse(response.data);

      return {
        id: subscription.code || subscriptionId,
        providerSubscriptionId: subscription.code || subscriptionId,
        status: SubscriptionStatus.CANCELED,
        customerId: subscription.sender?.email || '',
        amount: Math.round(parseFloat(subscription.amount || '0') * 100),
        currency: Currency.BRL,
        billingInterval: this.mapPagSeguroBillingInterval(subscription.period),
        startDate: new Date(subscription.date || Date.now()),
        currentPeriodEnd: new Date(subscription.nextPaymentDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: new Date(), // Cancelado agora
        createdAt: new Date(subscription.date || Date.now()),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to cancel subscription');
    }
  }

  /**
   * Valida assinatura de webhook do PagSeguro
   */
  validateWebhook(payload: string, signature: string): boolean {
    // PagSeguro não usa assinatura de webhook, apenas notificações por código
    // A validação é feita consultando a API com o código de notificação
    return true;
  }

  /**
   * Processa e normaliza evento de webhook do PagSeguro
   */
  parseWebhook(payload: string): WebhookEvent {
    try {
      // PagSeguro envia notificações como form data
      const params = new URLSearchParams(payload);
      const notificationCode = params.get('notificationCode');
      const notificationType = params.get('notificationType');
      
      if (!notificationCode || !notificationType) {
        throw new Error('Invalid PagSeguro notification');
      }

      return this.createWebhookEvent(
        this.mapPagSeguroEventType(notificationType),
        notificationCode,
        {
          notificationCode,
          notificationType
        },
        {
          originalType: notificationType,
          notificationCode,
          notificationType
        }
      );
    } catch (error) {
      throw new PaymentError(
        PaymentErrorType.WEBHOOK_VALIDATION_ERROR,
        'Failed to parse webhook payload',
        error,
        false,
        this.name
      );
    }
  }

  // Métodos auxiliares privados

  private buildCheckoutXml(request: PaymentRequest): string {
    return `<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>
<checkout>
    <currency>BRL</currency>
    <items>
        <item>
            <id>1</id>
            <description>${this.escapeXml(request.description || 'Pagamento')}</description>
            <amount>${(request.amount / 100).toFixed(2)}</amount>
            <quantity>1</quantity>
        </item>
    </items>
    <reference>${request.organizationId}</reference>
    <sender>
        <email>customer@example.com</email>
    </sender>
    <redirectURL>${request.returnUrl || ''}</redirectURL>
    <notificationURL>${process.env.WEBHOOK_URL || ''}</notificationURL>
</checkout>`;
  }

  private buildRefundXml(amount?: number): string {
    const refundAmount = amount ? (amount / 100).toFixed(2) : '';
    
    return `<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>
<refundRequest>
    ${refundAmount ? `<value>${refundAmount}</value>` : ''}
</refundRequest>`;
  }

  private buildSubscriptionPlanXml(request: SubscriptionRequest): string {
    const period = this.mapBillingIntervalToPagSeguro(request.billingInterval);
    
    return `<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>
<preApprovalRequest>
    <reference>${request.planId}</reference>
    <sender>
        <email>customer@example.com</email>
    </sender>
    <preApproval>
        <name>Plano ${request.planId}</name>
        <details>Assinatura do plano ${request.planId}</details>
        <amountPerPayment>${(request.amount / 100).toFixed(2)}</amountPerPayment>
        <period>${period}</period>
        <dateOfExpiration>${this.getExpirationDate()}</dateOfExpiration>
    </preApproval>
</preApprovalRequest>`;
  }

  private extractCheckoutCode(xmlResponse: string): string {
    const match = xmlResponse.match(/<code>([^<]+)<\/code>/);
    return match ? match[1] : '';
  }

  private parseXmlResponse(xmlResponse: string): any {
    // Implementação simples de parsing XML
    // Em produção, seria recomendado usar uma biblioteca como xml2js
    const result: any = {};
    
    const extractValue = (tag: string) => {
      const regex = new RegExp(`<${tag}>([^<]+)<\/${tag}>`, 'i');
      const match = xmlResponse.match(regex);
      return match ? match[1] : null;
    };

    result.code = extractValue('code');
    result.status = extractValue('status');
    result.grossAmount = extractValue('grossAmount');
    result.date = extractValue('date');
    result.amount = extractValue('amount');
    result.period = extractValue('period');
    result.nextPaymentDate = extractValue('nextPaymentDate');

    return result;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getExpirationDate(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1); // 1 ano de validade
    return date.toISOString().split('T')[0];
  }

  private getBillingIntervalMs(interval: BillingInterval): number {
    switch (interval) {
      case BillingInterval.DAILY:
        return 24 * 60 * 60 * 1000;
      case BillingInterval.WEEKLY:
        return 7 * 24 * 60 * 60 * 1000;
      case BillingInterval.MONTHLY:
        return 30 * 24 * 60 * 60 * 1000;
      case BillingInterval.YEARLY:
        return 365 * 24 * 60 * 60 * 1000;
      default:
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private mapPagSeguroPaymentStatus(status: string): PaymentStatus {
    const mapped = PAGSEGURO_PAYMENT_STATUS_MAPPING[status as keyof typeof PAGSEGURO_PAYMENT_STATUS_MAPPING];
    return mapped ? (mapped as PaymentStatus) : PaymentStatus.PROCESSING;
  }

  private mapPagSeguroSubscriptionStatus(status: string): SubscriptionStatus {
    const mapped = PAGSEGURO_SUBSCRIPTION_STATUS_MAPPING[status as keyof typeof PAGSEGURO_SUBSCRIPTION_STATUS_MAPPING];
    return mapped ? (mapped as SubscriptionStatus) : SubscriptionStatus.INCOMPLETE;
  }

  private mapPagSeguroBillingInterval(period?: string): BillingInterval {
    switch (period?.toUpperCase()) {
      case 'MONTHLY':
        return BillingInterval.MONTHLY;
      case 'YEARLY':
        return BillingInterval.YEARLY;
      case 'WEEKLY':
        return BillingInterval.WEEKLY;
      default:
        return BillingInterval.MONTHLY;
    }
  }

  private mapBillingIntervalToPagSeguro(interval: BillingInterval): string {
    switch (interval) {
      case BillingInterval.MONTHLY:
        return 'MONTHLY';
      case BillingInterval.YEARLY:
        return 'YEARLY';
      case BillingInterval.WEEKLY:
        return 'WEEKLY';
      case BillingInterval.DAILY:
        return 'MONTHLY'; // PagSeguro não suporta diário, usa mensal
      default:
        return 'MONTHLY';
    }
  }

  private mapPagSeguroEventType(eventType: string): WebhookEventType {
    const mapped = PAGSEGURO_EVENT_MAPPING[eventType as keyof typeof PAGSEGURO_EVENT_MAPPING];
    
    switch (mapped || eventType) {
      case 'payment.status_changed':
        return WebhookEventType.PAYMENT_SUCCEEDED; // Simplificado
      case 'subscription.status_changed':
        return WebhookEventType.SUBSCRIPTION_UPDATED;
      default:
        return WebhookEventType.PAYMENT_SUCCEEDED; // Default fallback
    }
  }

  /**
   * Normaliza erros específicos do PagSeguro
   */
  protected normalizeError(error: any, context?: string): PaymentError {
    if (error instanceof PaymentError) {
      return error;
    }

    let errorType = PaymentErrorType.UNKNOWN_ERROR;
    let retryable = false;

    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const data = error.response?.data;

      switch (status) {
        case 400:
          errorType = PaymentErrorType.VALIDATION_ERROR;
          retryable = false;
          break;
        case 401:
          errorType = PaymentErrorType.INVALID_CREDENTIALS;
          retryable = false;
          break;
        case 402:
          errorType = PaymentErrorType.PAYMENT_DECLINED;
          retryable = false;
          break;
        case 404:
          errorType = PaymentErrorType.VALIDATION_ERROR;
          retryable = false;
          break;
        case 429:
          errorType = PaymentErrorType.PROVIDER_UNAVAILABLE;
          retryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          errorType = PaymentErrorType.PROVIDER_UNAVAILABLE;
          retryable = true;
          break;
        default:
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            errorType = PaymentErrorType.NETWORK_ERROR;
            retryable = true;
          }
      }

      const message = context 
        ? `${context}: ${data?.message || error.message || 'Unknown PagSeguro error'}`
        : data?.message || error.message || 'Unknown PagSeguro error';

      return new PaymentError(
        errorType,
        message,
        error,
        retryable,
        this.name
      );
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
}