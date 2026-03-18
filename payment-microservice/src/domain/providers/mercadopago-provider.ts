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
  MercadoPagoConfig,
  MercadoPagoPaymentData,
  MercadoPagoSubscriptionData,
  MERCADOPAGO_EVENT_MAPPING,
  MERCADOPAGO_PAYMENT_STATUS_MAPPING,
  MERCADOPAGO_SUBSCRIPTION_STATUS_MAPPING,
  MERCADOPAGO_API_URLS
} from './mercadopago-types';

/**
 * Implementação do provedor Mercado Pago
 * Suporta pagamentos únicos, assinaturas e webhooks
 */
export class MercadoPagoProvider extends BaseProvider {
  private client?: AxiosInstance;
  private accessToken?: string;
  private webhookSecret?: string;

  constructor() {
    super('mercadopago', '1.0.0');
  }

  /**
   * Configura o cliente Mercado Pago
   */
  protected async onConfigured(config: ProviderConfig): Promise<void> {
    const { accessToken, webhookSecret } = config.credentials;
    
    this.accessToken = accessToken;
    this.webhookSecret = webhookSecret;
    
    this.client = axios.create({
      baseURL: MERCADOPAGO_API_URLS.production,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Idempotency-Key': this.generateIdempotencyKey()
      },
      timeout: 30000
    });
  }

  /**
   * Valida a configuração específica do Mercado Pago
   */
  protected async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    const { accessToken } = config.credentials;
    
    if (!accessToken || accessToken.trim() === '') {
      return false;
    }

    try {
      // Testa a conexão fazendo uma chamada simples
      const testClient = axios.create({
        baseURL: MERCADOPAGO_API_URLS.production,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      await testClient.get('/users/me');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica a saúde da API do Mercado Pago
   */
  protected async performHealthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.get('/users/me');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cria um novo pagamento no Mercado Pago
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.ensureConfigured();
    
    try {
      const preferenceData = {
        items: [{
          title: request.description || 'Pagamento',
          quantity: 1,
          unit_price: request.amount / 100,
          currency_id: request.currency
        }],
        payer: {
          email: request.customerId ? `customer-${request.customerId}@example.com` : 'customer@example.com'
        },
        external_reference: request.organizationId,
        notification_url: process.env.WEBHOOK_URL,
        back_urls: {
          success: request.returnUrl,
          failure: request.cancelUrl,
          pending: request.returnUrl
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          installments: 12
        }
      };

      const response = await this.client!.post('/checkout/preferences', preferenceData);
      const preference = response.data;

      return {
        id: preference.id,
        providerPaymentId: preference.id,
        status: PaymentStatus.REQUIRES_ACTION, // Mercado Pago sempre requer ação do usuário
        amount: request.amount,
        currency: request.currency,
        checkoutUrl: preference.init_point,
        providerData: {
          id: preference.id,
          status: 'pending',
          initPoint: preference.init_point,
          sandboxInitPoint: preference.sandbox_init_point
        } as MercadoPagoPaymentData,
        createdAt: new Date(preference.date_created),
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
      // No Mercado Pago, busca o status do pagamento
      const response = await this.client!.get(`/v1/payments/${paymentId}`);
      const payment = response.data;

      return {
        id: payment.id.toString(),
        providerPaymentId: payment.id.toString(),
        status: this.mapMercadoPagoPaymentStatus(payment.status),
        amount: Math.round(payment.transaction_amount * 100),
        currency: payment.currency_id as Currency,
        providerData: {
          id: payment.id,
          status: payment.status,
          pointOfInteraction: payment.point_of_interaction
        } as MercadoPagoPaymentData,
        createdAt: new Date(payment.date_created),
        updatedAt: new Date(payment.date_last_updated || payment.date_created)
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
      const refundData: any = {};
      
      if (amount) {
        refundData.amount = amount / 100;
      }

      const response = await this.client!.post(`/v1/payments/${paymentId}/refunds`, refundData);
      const refund = response.data;

      return {
        id: refund.id.toString(),
        providerRefundId: refund.id.toString(),
        paymentId: paymentId,
        amount: Math.round((refund.amount || 0) * 100),
        status: PaymentStatus.SUCCEEDED, // Mercado Pago processa estornos imediatamente
        reason: refund.reason || 'requested_by_customer',
        createdAt: new Date(refund.date_created)
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
      const planData = {
        reason: `Plano ${request.planId}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: this.mapBillingIntervalToMercadoPago(request.billingInterval),
          transaction_amount: request.amount / 100,
          currency_id: request.currency
        },
        back_url: process.env.WEBHOOK_URL,
        payer_email: `customer-${request.customerId}@example.com`
      };

      const response = await this.client!.post('/preapproval', planData);
      const subscription = response.data;

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapMercadoPagoSubscriptionStatus(subscription.status),
        customerId: request.customerId,
        amount: request.amount,
        currency: request.currency as Currency,
        billingInterval: request.billingInterval,
        startDate: new Date(subscription.date_created),
        currentPeriodEnd: new Date(Date.now() + this.getBillingIntervalMs(request.billingInterval)),
        canceledAt: undefined,
        createdAt: new Date(subscription.date_created),
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
      const updateData: any = {};

      if (updates.cancelAtPeriodEnd !== undefined) {
        updateData.status = updates.cancelAtPeriodEnd ? 'cancelled' : 'authorized';
      }

      if (Object.keys(updateData).length > 0) {
        await this.client!.put(`/preapproval/${subscriptionId}`, updateData);
      }

      // Busca a assinatura atualizada
      const response = await this.client!.get(`/preapproval/${subscriptionId}`);
      const subscription = response.data;

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapMercadoPagoSubscriptionStatus(subscription.status),
        customerId: subscription.payer_email || '',
        amount: Math.round((subscription.auto_recurring?.transaction_amount || 0) * 100),
        currency: subscription.auto_recurring?.currency_id as Currency || Currency.BRL,
        billingInterval: this.mapMercadoPagoBillingInterval(subscription.auto_recurring?.frequency_type),
        startDate: new Date(subscription.date_created),
        currentPeriodEnd: new Date(subscription.next_payment_date || Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: subscription.status === 'cancelled' ? new Date() : undefined,
        createdAt: new Date(subscription.date_created),
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
      await this.client!.put(`/preapproval/${subscriptionId}`, {
        status: 'cancelled'
      });
      
      const response = await this.client!.get(`/preapproval/${subscriptionId}`);
      const subscription = response.data;

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: SubscriptionStatus.CANCELED,
        customerId: subscription.payer_email || '',
        amount: Math.round((subscription.auto_recurring?.transaction_amount || 0) * 100),
        currency: subscription.auto_recurring?.currency_id as Currency || Currency.BRL,
        billingInterval: this.mapMercadoPagoBillingInterval(subscription.auto_recurring?.frequency_type),
        startDate: new Date(subscription.date_created),
        currentPeriodEnd: new Date(subscription.next_payment_date || Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: new Date(), // Cancelado agora
        createdAt: new Date(subscription.date_created),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to cancel subscription');
    }
  }

  /**
   * Valida assinatura de webhook do Mercado Pago
   */
  validateWebhook(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      return false;
    }

    try {
      // Mercado Pago usa HMAC-SHA256 para validação
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      return false;
    }
  }

  /**
   * Processa e normaliza evento de webhook do Mercado Pago
   */
  parseWebhook(payload: string): WebhookEvent {
    try {
      const event = JSON.parse(payload);
      
      return this.createWebhookEvent(
        this.mapMercadoPagoEventType(event.type),
        event.id?.toString() || `mp_${Date.now()}`,
        event.data,
        event
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

  private generateIdempotencyKey(): string {
    return `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  private mapMercadoPagoPaymentStatus(status: string): PaymentStatus {
    const mapped = MERCADOPAGO_PAYMENT_STATUS_MAPPING[status as keyof typeof MERCADOPAGO_PAYMENT_STATUS_MAPPING];
    return mapped ? (mapped as PaymentStatus) : PaymentStatus.PROCESSING;
  }

  private mapMercadoPagoSubscriptionStatus(status: string): SubscriptionStatus {
    const mapped = MERCADOPAGO_SUBSCRIPTION_STATUS_MAPPING[status as keyof typeof MERCADOPAGO_SUBSCRIPTION_STATUS_MAPPING];
    return mapped ? (mapped as SubscriptionStatus) : SubscriptionStatus.INCOMPLETE;
  }

  private mapMercadoPagoBillingInterval(frequencyType?: string): BillingInterval {
    switch (frequencyType) {
      case 'months':
        return BillingInterval.MONTHLY;
      case 'years':
        return BillingInterval.YEARLY;
      case 'weeks':
        return BillingInterval.WEEKLY;
      case 'days':
        return BillingInterval.DAILY;
      default:
        return BillingInterval.MONTHLY;
    }
  }

  private mapBillingIntervalToMercadoPago(interval: BillingInterval): string {
    switch (interval) {
      case BillingInterval.MONTHLY:
        return 'months';
      case BillingInterval.YEARLY:
        return 'years';
      case BillingInterval.WEEKLY:
        return 'weeks';
      case BillingInterval.DAILY:
        return 'days';
      default:
        return 'months';
    }
  }

  private mapMercadoPagoEventType(eventType: string): WebhookEventType {
    const mapped = MERCADOPAGO_EVENT_MAPPING[eventType as keyof typeof MERCADOPAGO_EVENT_MAPPING];
    
    switch (mapped || eventType) {
      case 'payment.created':
      case 'payment.updated':
        return WebhookEventType.PAYMENT_SUCCEEDED; // Simplificado
      case 'subscription.created':
        return WebhookEventType.SUBSCRIPTION_CREATED;
      case 'subscription.updated':
        return WebhookEventType.SUBSCRIPTION_UPDATED;
      case 'subscription.canceled':
        return WebhookEventType.SUBSCRIPTION_CANCELED;
      default:
        return WebhookEventType.PAYMENT_SUCCEEDED; // Default fallback
    }
  }

  /**
   * Normaliza erros específicos do Mercado Pago
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
        case 422:
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
        ? `${context}: ${data?.message || error.message || 'Unknown Mercado Pago error'}`
        : data?.message || error.message || 'Unknown Mercado Pago error';

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