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
  IuguConfig,
  IuguPaymentData,
  IuguSubscriptionData,
  IUGU_EVENT_MAPPING,
  IUGU_PAYMENT_STATUS_MAPPING,
  IUGU_SUBSCRIPTION_STATUS_MAPPING
} from './iugu-types';

/**
 * Implementação do provedor Iugu
 * Suporta pagamentos únicos, assinaturas e webhooks
 */
export class IuguProvider extends BaseProvider {
  private client?: AxiosInstance;
  private webhookToken?: string;

  constructor() {
    super('iugu', '1.0.0');
  }

  /**
   * Configura o cliente Iugu
   */
  protected async onConfigured(config: ProviderConfig): Promise<void> {
    const { apiToken, webhookToken } = config.credentials;
    
    this.client = axios.create({
      baseURL: 'https://api.iugu.com/v1',
      auth: {
        username: apiToken,
        password: ''
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    this.webhookToken = webhookToken;
  }

  /**
   * Valida a configuração específica do Iugu
   */
  protected async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    const { apiToken } = config.credentials;
    
    if (!apiToken || apiToken.trim() === '') {
      return false;
    }

    try {
      // Testa a conexão fazendo uma chamada simples
      const testClient = axios.create({
        baseURL: 'https://api.iugu.com/v1',
        auth: {
          username: apiToken,
          password: ''
        },
        timeout: 10000
      });
      
      await testClient.get('/account');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica a saúde da API do Iugu
   */
  protected async performHealthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.get('/account');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cria um novo pagamento no Iugu
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.ensureConfigured();
    
    try {
      const invoiceData = {
        email: request.customerId ? `customer-${request.customerId}@example.com` : 'customer@example.com',
        due_date: this.calculateDueDate(),
        items: [{
          description: request.description || 'Pagamento',
          quantity: 1,
          price_cents: request.amount
        }],
        return_url: request.returnUrl,
        expired_url: request.cancelUrl,
        notification_url: process.env.WEBHOOK_URL,
        custom_variables: [
          {
            name: 'organization_id',
            value: request.organizationId
          },
          {
            name: 'customer_id',
            value: request.customerId || ''
          }
        ]
      };

      // Adiciona método de pagamento se especificado
      if (request.paymentMethodId) {
        (invoiceData as any).payable_with = request.paymentMethodId;
      }

      const response = await this.client!.post('/invoices', invoiceData);
      const invoice = response.data;

      return {
        id: invoice.id,
        providerPaymentId: invoice.id,
        status: this.mapIuguPaymentStatus(invoice.status),
        amount: request.amount,
        currency: request.currency,
        checkoutUrl: invoice.secure_url,
        providerData: {
          paymentUrl: invoice.secure_url,
          token: invoice.token,
          bankSlip: invoice.bank_slip ? {
            url: invoice.bank_slip.url,
            digitableLine: invoice.bank_slip.digitable_line,
            barcode: invoice.bank_slip.barcode
          } : undefined,
          pix: invoice.pix ? {
            qrCode: invoice.pix.qr_code,
            qrCodeText: invoice.pix.qr_code_text,
            expirationDate: invoice.pix.expiration_date
          } : undefined
        } as IuguPaymentData,
        createdAt: new Date(invoice.created_at),
        updatedAt: new Date(invoice.updated_at || invoice.created_at)
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to create payment');
    }
  }

  /**
   * Captura um pagamento autorizado (não aplicável ao Iugu)
   */
  async capturePayment(paymentId: string): Promise<PaymentResponse> {
    this.ensureConfigured();
    
    try {
      // No Iugu, não há captura manual - busca o status atual
      const response = await this.client!.get(`/invoices/${paymentId}`);
      const invoice = response.data;

      return {
        id: invoice.id,
        providerPaymentId: invoice.id,
        status: this.mapIuguPaymentStatus(invoice.status),
        amount: invoice.total_cents,
        currency: Currency.BRL, // Iugu trabalha principalmente com BRL
        providerData: {
          paymentUrl: invoice.secure_url,
          token: invoice.token
        } as IuguPaymentData,
        createdAt: new Date(invoice.created_at),
        updatedAt: new Date(invoice.updated_at || invoice.created_at)
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
        refundData.amount_cents = amount;
      }

      const response = await this.client!.post(`/invoices/${paymentId}/refund`, refundData);
      const refund = response.data;

      return {
        id: refund.id || `refund_${paymentId}_${Date.now()}`,
        providerRefundId: refund.id || paymentId,
        paymentId: paymentId,
        amount: amount || refund.amount_cents || 0,
        status: PaymentStatus.SUCCEEDED, // Iugu processa estornos imediatamente
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
      // Primeiro, cria ou recupera o customer
      let customer;
      try {
        const customerResponse = await this.client!.get(`/customers/${request.customerId}`);
        customer = customerResponse.data;
      } catch {
        // Se o customer não existe, cria um novo
        const customerData = {
          email: `customer-${request.customerId}@example.com`,
          name: `Customer ${request.customerId}`,
          custom_variables: [
            {
              name: 'organization_id',
              value: request.organizationId
            }
          ]
        };
        
        const customerResponse = await this.client!.post('/customers', customerData);
        customer = customerResponse.data;
      }

      // Cria ou recupera o plano
      const plan = await this.createOrRetrievePlan(
        request.planId,
        request.amount,
        request.billingInterval
      );

      const subscriptionData = {
        customer_id: customer.id,
        plan_identifier: plan.identifier,
        custom_variables: [
          {
            name: 'organization_id',
            value: request.organizationId
          },
          {
            name: 'plan_id',
            value: request.planId
          }
        ]
      };

      const response = await this.client!.post('/subscriptions', subscriptionData);
      const subscription = response.data;

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapIuguSubscriptionStatus(subscription.status),
        customerId: customer.id,
        amount: request.amount,
        currency: Currency.BRL,
        billingInterval: request.billingInterval,
        startDate: new Date(subscription.created_at),
        currentPeriodEnd: new Date(subscription.expires_at || Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: subscription.suspended_at ? new Date(subscription.suspended_at) : undefined,
        createdAt: new Date(subscription.created_at),
        updatedAt: new Date(subscription.updated_at || subscription.created_at)
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
        // No Iugu, suspende a assinatura
        if (updates.cancelAtPeriodEnd) {
          await this.client!.post(`/subscriptions/${subscriptionId}/suspend`);
        } else {
          await this.client!.post(`/subscriptions/${subscriptionId}/activate`);
        }
      }

      // Busca a assinatura atualizada
      const response = await this.client!.get(`/subscriptions/${subscriptionId}`);
      const subscription = response.data;

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapIuguSubscriptionStatus(subscription.status),
        customerId: subscription.customer_id,
        amount: subscription.price_cents || 0,
        currency: Currency.BRL,
        billingInterval: this.mapIuguBillingInterval(subscription.interval_type),
        startDate: new Date(subscription.created_at),
        currentPeriodEnd: new Date(subscription.expires_at || Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: subscription.suspended_at ? new Date(subscription.suspended_at) : undefined,
        createdAt: new Date(subscription.created_at),
        updatedAt: new Date(subscription.updated_at || subscription.created_at)
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
      await this.client!.post(`/subscriptions/${subscriptionId}/suspend`);
      
      const response = await this.client!.get(`/subscriptions/${subscriptionId}`);
      const subscription = response.data;

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapIuguSubscriptionStatus(subscription.status),
        customerId: subscription.customer_id,
        amount: subscription.price_cents || 0,
        currency: Currency.BRL,
        billingInterval: this.mapIuguBillingInterval(subscription.interval_type),
        startDate: new Date(subscription.created_at),
        currentPeriodEnd: new Date(subscription.expires_at || Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: new Date(), // Cancelado agora
        createdAt: new Date(subscription.created_at),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to cancel subscription');
    }
  }

  /**
   * Valida assinatura de webhook do Iugu
   */
  validateWebhook(payload: string, signature: string): boolean {
    if (!this.webhookToken) {
      return false;
    }

    try {
      // Iugu usa um token simples para validação
      // A validação real seria feita comparando o token enviado no header
      return signature === this.webhookToken;
    } catch (error) {
      return false;
    }
  }

  /**
   * Processa e normaliza evento de webhook do Iugu
   */
  parseWebhook(payload: string): WebhookEvent {
    try {
      const event = JSON.parse(payload);
      
      return this.createWebhookEvent(
        this.mapIuguEventType(event.event),
        event.id || `iugu_${Date.now()}`,
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

  private calculateDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // 3 dias para vencimento
    return dueDate.toISOString().split('T')[0];
  }

  private async createOrRetrievePlan(
    planId: string,
    amount: number,
    interval: BillingInterval
  ): Promise<any> {
    try {
      // Tenta recuperar o plano existente
      const response = await this.client!.get(`/plans/${planId}`);
      return response.data;
    } catch {
      // Cria o plano se não existir
      const planData = {
        identifier: planId,
        name: `Plan ${planId}`,
        interval: this.mapBillingIntervalToIugu(interval),
        interval_type: this.mapBillingIntervalToIugu(interval),
        value_cents: amount,
        currency: 'BRL' // Iugu API expects string, not enum
      };

      const response = await this.client!.post('/plans', planData);
      return response.data;
    }
  }

  private mapIuguPaymentStatus(status: string): PaymentStatus {
    const mapped = IUGU_PAYMENT_STATUS_MAPPING[status as keyof typeof IUGU_PAYMENT_STATUS_MAPPING];
    return mapped ? (mapped as PaymentStatus) : PaymentStatus.PROCESSING;
  }

  private mapIuguSubscriptionStatus(status: string): SubscriptionStatus {
    const mapped = IUGU_SUBSCRIPTION_STATUS_MAPPING[status as keyof typeof IUGU_SUBSCRIPTION_STATUS_MAPPING];
    return mapped ? (mapped as SubscriptionStatus) : SubscriptionStatus.INCOMPLETE;
  }

  private mapIuguBillingInterval(interval?: string): BillingInterval {
    switch (interval) {
      case 'monthly':
        return BillingInterval.MONTHLY;
      case 'yearly':
        return BillingInterval.YEARLY;
      case 'weekly':
        return BillingInterval.WEEKLY;
      default:
        return BillingInterval.MONTHLY;
    }
  }

  private mapBillingIntervalToIugu(interval: BillingInterval): string {
    switch (interval) {
      case BillingInterval.MONTHLY:
        return 'monthly';
      case BillingInterval.YEARLY:
        return 'yearly';
      case BillingInterval.WEEKLY:
        return 'weekly';
      case BillingInterval.DAILY:
        return 'monthly'; // Iugu não suporta diário, usa mensal
      default:
        return 'monthly';
    }
  }

  private mapIuguEventType(eventType: string): WebhookEventType {
    const mapped = IUGU_EVENT_MAPPING[eventType as keyof typeof IUGU_EVENT_MAPPING];
    
    switch (mapped || eventType) {
      case 'payment.succeeded':
        return WebhookEventType.PAYMENT_SUCCEEDED;
      case 'payment.failed':
        return WebhookEventType.PAYMENT_FAILED;
      case 'payment.refunded':
        return WebhookEventType.PAYMENT_REFUNDED;
      case 'subscription.created':
        return WebhookEventType.SUBSCRIPTION_CREATED;
      case 'subscription.activated':
        return WebhookEventType.SUBSCRIPTION_UPDATED;
      case 'subscription.suspended':
      case 'subscription.canceled':
        return WebhookEventType.SUBSCRIPTION_CANCELED;
      default:
        return WebhookEventType.PAYMENT_SUCCEEDED; // Default fallback
    }
  }

  /**
   * Normaliza erros específicos do Iugu
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
        ? `${context}: ${data?.message || error.message || 'Unknown Iugu error'}`
        : data?.message || error.message || 'Unknown Iugu error';

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