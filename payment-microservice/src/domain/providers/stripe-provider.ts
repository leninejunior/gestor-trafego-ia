import Stripe from 'stripe';
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

/**
 * Implementação do provedor Stripe
 * Suporta pagamentos únicos, assinaturas e webhooks
 */
export class StripeProvider extends BaseProvider {
  private stripe?: Stripe;
  private webhookSecret?: string;

  constructor() {
    super('stripe', '1.0.0');
  }

  /**
   * Configura o cliente Stripe
   */
  protected async onConfigured(config: ProviderConfig): Promise<void> {
    const { secretKey, webhookSecret } = config.credentials;
    
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
    
    this.webhookSecret = webhookSecret;
  }

  /**
   * Valida a configuração específica do Stripe
   */
  protected async validateProviderConfig(config: ProviderConfig): Promise<boolean> {
    const { secretKey } = config.credentials;
    
    if (!secretKey || !secretKey.startsWith('sk_')) {
      return false;
    }

    try {
      // Testa a conexão fazendo uma chamada simples
      const testStripe = new Stripe(secretKey, {
        apiVersion: '2023-10-16',
      });
      
      await testStripe.balance.retrieve();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica a saúde da API do Stripe
   */
  protected async performHealthCheck(): Promise<boolean> {
    if (!this.stripe) return false;

    try {
      await this.stripe.balance.retrieve();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cria um novo pagamento no Stripe
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.ensureConfigured();
    
    try {
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: request.amount,
        currency: request.currency.toLowerCase() as any,
        description: request.description,
        metadata: {
          organizationId: request.organizationId,
          customerId: request.customerId || '',
          ...request.metadata
        }
      };

      // Adiciona customer se fornecido
      if (request.customerId) {
        paymentIntentParams.customer = request.customerId;
      }

      // Adiciona método de pagamento se fornecido
      if (request.paymentMethodId) {
        paymentIntentParams.payment_method = request.paymentMethodId;
        paymentIntentParams.confirmation_method = 'manual';
        paymentIntentParams.confirm = true;
      }

      // Adiciona URLs de retorno se fornecidas
      if (request.returnUrl) {
        paymentIntentParams.return_url = request.returnUrl;
      }

      const paymentIntent = await this.stripe!.paymentIntents.create(paymentIntentParams);

      return {
        id: paymentIntent.id,
        providerPaymentId: paymentIntent.id,
        status: this.mapStripePaymentStatus(paymentIntent.status),
        amount: paymentIntent.amount,
        currency: request.currency,
        checkoutUrl: paymentIntent.next_action?.redirect_to_url?.url || undefined,
        providerData: {
          clientSecret: paymentIntent.client_secret,
          nextAction: paymentIntent.next_action
        },
        createdAt: new Date(paymentIntent.created * 1000),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to create payment');
    }
  }

  /**
   * Captura um pagamento autorizado
   */
  async capturePayment(paymentId: string): Promise<PaymentResponse> {
    this.ensureConfigured();
    
    try {
      const paymentIntent = await this.stripe!.paymentIntents.capture(paymentId);

      return {
        id: paymentIntent.id,
        providerPaymentId: paymentIntent.id,
        status: this.mapStripePaymentStatus(paymentIntent.status),
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase() as Currency,
        providerData: {
          charges: (paymentIntent as any).charges
        },
        createdAt: new Date(paymentIntent.created * 1000),
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
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentId
      };

      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await this.stripe!.refunds.create(refundParams);

      return {
        id: refund.id,
        providerRefundId: refund.id,
        paymentId: paymentId,
        amount: refund.amount,
        status: this.mapStripeRefundStatus(refund.status || 'failed'),
        reason: refund.reason || undefined,
        createdAt: new Date(refund.created * 1000)
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
      let customer: Stripe.Customer;
      try {
        customer = await this.stripe!.customers.retrieve(request.customerId) as Stripe.Customer;
      } catch {
        // Se o customer não existe, cria um novo
        customer = await this.stripe!.customers.create({
          metadata: {
            organizationId: request.organizationId
          }
        });
      }

      // Cria ou recupera o produto e preço
      const price = await this.createOrRetrievePrice(
        request.planId,
        request.amount,
        request.currency,
        request.billingInterval
      );

      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{ price: price.id }],
        metadata: {
          organizationId: request.organizationId,
          planId: request.planId,
          ...request.metadata
        }
      };

      // Adiciona período de teste se fornecido
      if (request.trialPeriodDays) {
        subscriptionParams.trial_period_days = request.trialPeriodDays;
      }

      const subscription = await this.stripe!.subscriptions.create(subscriptionParams);

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapStripeSubscriptionStatus(subscription.status),
        customerId: customer.id,
        amount: request.amount,
        currency: request.currency,
        billingInterval: request.billingInterval,
        startDate: new Date(subscription.start_date * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
        createdAt: new Date(subscription.created * 1000),
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
      const updateParams: Stripe.SubscriptionUpdateParams = {};

      if (updates.metadata) {
        updateParams.metadata = updates.metadata;
      }

      if (updates.cancelAtPeriodEnd !== undefined) {
        updateParams.cancel_at_period_end = updates.cancelAtPeriodEnd;
      }

      // Se há mudança de plano ou valor, atualiza os items
      if (updates.planId || updates.amount) {
        const currentSubscription = await this.stripe!.subscriptions.retrieve(subscriptionId);
        const currentItem = currentSubscription.items.data[0];
        
        if (updates.planId && updates.amount) {
          // Cria novo preço se necessário
          const price = await this.createOrRetrievePrice(
            updates.planId,
            updates.amount,
            currentSubscription.currency,
            BillingInterval.MONTHLY // Default, pode ser melhorado
          );
          
          updateParams.items = [{
            id: currentItem.id,
            price: price.id
          }];
        }
      }

      const subscription = await this.stripe!.subscriptions.update(subscriptionId, updateParams);

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapStripeSubscriptionStatus(subscription.status),
        customerId: subscription.customer as string,
        amount: subscription.items.data[0].price.unit_amount || 0,
        currency: subscription.currency.toUpperCase(),
        billingInterval: this.mapStripeBillingInterval(subscription.items.data[0].price.recurring?.interval),
        startDate: new Date(subscription.start_date * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
        createdAt: new Date(subscription.created * 1000),
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
      const subscription = await this.stripe!.subscriptions.cancel(subscriptionId);

      return {
        id: subscription.id,
        providerSubscriptionId: subscription.id,
        status: this.mapStripeSubscriptionStatus(subscription.status),
        customerId: subscription.customer as string,
        amount: subscription.items.data[0].price.unit_amount || 0,
        currency: subscription.currency.toUpperCase(),
        billingInterval: this.mapStripeBillingInterval(subscription.items.data[0].price.recurring?.interval),
        startDate: new Date(subscription.start_date * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
        createdAt: new Date(subscription.created * 1000),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.normalizeError(error, 'Failed to cancel subscription');
    }
  }

  /**
   * Valida assinatura de webhook do Stripe
   */
  validateWebhook(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      return false;
    }

    try {
      this.stripe!.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Processa e normaliza evento de webhook do Stripe
   */
  parseWebhook(payload: string): WebhookEvent {
    if (!this.webhookSecret) {
      throw new PaymentError(
        PaymentErrorType.WEBHOOK_VALIDATION_ERROR,
        'Webhook secret not configured',
        undefined,
        false,
        this.name
      );
    }

    try {
      const event = JSON.parse(payload) as Stripe.Event;
      
      return this.createWebhookEvent(
        this.mapStripeEventType(event.type),
        event.id,
        event.data.object,
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

  private async createOrRetrievePrice(
    planId: string,
    amount: number,
    currency: string,
    interval: BillingInterval
  ): Promise<Stripe.Price> {
    try {
      // Tenta recuperar o preço existente
      const prices = await this.stripe!.prices.list({
        lookup_keys: [planId],
        limit: 1
      });

      if (prices.data.length > 0) {
        return prices.data[0];
      }

      // Cria produto se não existir
      const product = await this.stripe!.products.create({
        name: `Plan ${planId}`,
        metadata: { planId }
      });

      // Cria o preço
      return await this.stripe!.prices.create({
        unit_amount: amount,
        currency: currency.toLowerCase(),
        recurring: {
          interval: this.mapBillingIntervalToStripe(interval)
        },
        product: product.id,
        lookup_key: planId
      });
    } catch (error) {
      throw this.normalizeError(error, 'Failed to create or retrieve price');
    }
  }

  private mapStripePaymentStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
    switch (status) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return PaymentStatus.REQUIRES_ACTION;
      case 'processing':
        return PaymentStatus.PROCESSING;
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'canceled':
        return PaymentStatus.CANCELED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private mapStripeRefundStatus(status: string): PaymentStatus {
    switch (status) {
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'pending':
        return PaymentStatus.PROCESSING;
      case 'failed':
        return PaymentStatus.FAILED;
      case 'canceled':
        return PaymentStatus.CANCELED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'incomplete':
      case 'incomplete_expired':
        return SubscriptionStatus.INCOMPLETE;
      default:
        return SubscriptionStatus.INCOMPLETE;
    }
  }

  private mapStripeBillingInterval(interval?: string): BillingInterval {
    switch (interval) {
      case 'month':
        return BillingInterval.MONTHLY;
      case 'year':
        return BillingInterval.YEARLY;
      case 'week':
        return BillingInterval.WEEKLY;
      case 'day':
        return BillingInterval.DAILY;
      default:
        return BillingInterval.MONTHLY;
    }
  }

  private mapBillingIntervalToStripe(interval: BillingInterval): Stripe.Price.Recurring.Interval {
    switch (interval) {
      case BillingInterval.MONTHLY:
        return 'month';
      case BillingInterval.YEARLY:
        return 'year';
      case BillingInterval.WEEKLY:
        return 'week';
      case BillingInterval.DAILY:
        return 'day';
      default:
        return 'month';
    }
  }

  private mapStripeEventType(eventType: string): WebhookEventType {
    switch (eventType) {
      case 'payment_intent.succeeded':
        return WebhookEventType.PAYMENT_SUCCEEDED;
      case 'payment_intent.payment_failed':
        return WebhookEventType.PAYMENT_FAILED;
      case 'payment_intent.canceled':
        return WebhookEventType.PAYMENT_CANCELED;
      case 'charge.dispute.created':
        return WebhookEventType.PAYMENT_REFUNDED;
      case 'customer.subscription.created':
        return WebhookEventType.SUBSCRIPTION_CREATED;
      case 'customer.subscription.updated':
        return WebhookEventType.SUBSCRIPTION_UPDATED;
      case 'customer.subscription.deleted':
        return WebhookEventType.SUBSCRIPTION_CANCELED;
      case 'invoice.payment_succeeded':
        return WebhookEventType.SUBSCRIPTION_PAYMENT_SUCCEEDED;
      case 'invoice.payment_failed':
        return WebhookEventType.SUBSCRIPTION_PAYMENT_FAILED;
      default:
        return WebhookEventType.PAYMENT_SUCCEEDED; // Default fallback
    }
  }

  /**
   * Normaliza erros específicos do Stripe
   */
  protected normalizeError(error: any, context?: string): PaymentError {
    if (error instanceof PaymentError) {
      return error;
    }

    let errorType = PaymentErrorType.UNKNOWN_ERROR;
    let retryable = false;

    if (error.type === 'StripeCardError') {
      errorType = PaymentErrorType.PAYMENT_DECLINED;
      retryable = false;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorType = PaymentErrorType.VALIDATION_ERROR;
      retryable = false;
    } else if (error.type === 'StripeAPIError') {
      errorType = PaymentErrorType.PROVIDER_UNAVAILABLE;
      retryable = true;
    } else if (error.type === 'StripeConnectionError') {
      errorType = PaymentErrorType.NETWORK_ERROR;
      retryable = true;
    } else if (error.type === 'StripeAuthenticationError') {
      errorType = PaymentErrorType.INVALID_CREDENTIALS;
      retryable = false;
    }

    const message = context 
      ? `${context}: ${error.message || 'Unknown Stripe error'}`
      : error.message || 'Unknown Stripe error';

    return new PaymentError(
      errorType,
      message,
      error,
      retryable,
      this.name
    );
  }
}