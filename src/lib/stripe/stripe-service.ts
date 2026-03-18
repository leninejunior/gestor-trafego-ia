import Stripe from 'stripe';
import { stripe, STRIPE_CONFIG } from './config';
import { SubscriptionPlan, Subscription, BillingCycle } from '@/lib/types/subscription';

export class StripeService {
  public stripe = stripe;

  /**
   * Create or retrieve a Stripe customer
   */
  async createOrGetCustomer(
    organizationId: string,
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    // First, try to find existing customer by organization ID
    const existingCustomers = await stripe.customers.list({
      metadata: { organization_id: organizationId },
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        organization_id: organizationId,
        ...metadata
      }
    });

    return customer;
  }

  /**
   * Create a payment intent for subscription
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: metadata || {}
    });

    return paymentIntent;
  }

  /**
   * Create a Stripe subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string,
    trialPeriodDays?: number,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: metadata || {}
    };

    // Add payment method if provided
    if (paymentMethodId) {
      subscriptionData.default_payment_method = paymentMethodId;
    }

    // Add trial period if specified
    if (trialPeriodDays && trialPeriodDays > 0) {
      subscriptionData.trial_period_days = trialPeriodDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);
    return subscription;
  }

  /**
   * Update a Stripe subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      priceId?: string;
      paymentMethodId?: string;
      metadata?: Record<string, string>;
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<Stripe.Subscription> {
    const updateData: Stripe.SubscriptionUpdateParams = {};

    if (updates.priceId) {
      updateData.items = [{ price: updates.priceId }];
      updateData.proration_behavior = 'create_prorations';
    }

    if (updates.paymentMethodId) {
      updateData.default_payment_method = updates.paymentMethodId;
    }

    if (updates.metadata) {
      updateData.metadata = updates.metadata;
    }

    if (updates.cancelAtPeriodEnd !== undefined) {
      updateData.cancel_at_period_end = updates.cancelAtPeriodEnd;
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, updateData);
    return subscription;
  }

  /**
   * Cancel a Stripe subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    if (cancelAtPeriodEnd) {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } else {
      return await stripe.subscriptions.cancel(subscriptionId);
    }
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    customerId: string,
    priceId: string,
    organizationId: string,
    planId: string,
    billingCycle: BillingCycle,
    trialPeriodDays?: number
  ): Promise<Stripe.Checkout.Session> {
    const sessionData: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: STRIPE_CONFIG.payment_method_types,
      billing_address_collection: STRIPE_CONFIG.billing_address_collection,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: STRIPE_CONFIG.mode,
      success_url: STRIPE_CONFIG.success_url,
      cancel_url: STRIPE_CONFIG.cancel_url,
      metadata: {
        organization_id: organizationId,
        plan_id: planId,
        billing_cycle: billingCycle
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
          plan_id: planId,
          billing_cycle: billingCycle
        }
      }
    };

    // Add trial period if specified
    if (trialPeriodDays && trialPeriodDays > 0) {
      sessionData.subscription_data!.trial_period_days = trialPeriodDays;
    }

    const session = await stripe.checkout.sessions.create(sessionData);
    return session;
  }

  /**
   * Create or update Stripe prices for a subscription plan
   */
  async createOrUpdatePlanPrices(
    plan: SubscriptionPlan,
    productId?: string
  ): Promise<{
    productId: string;
    monthlyPriceId: string;
    annualPriceId: string;
  }> {
    // Create or update product
    let product: Stripe.Product;
    
    if (productId) {
      product = await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          plan_id: plan.id,
          max_clients: plan.max_clients.toString(),
          max_campaigns: plan.max_campaigns.toString()
        }
      });
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          plan_id: plan.id,
          max_clients: plan.max_clients.toString(),
          max_campaigns: plan.max_campaigns.toString()
        }
      });
    }

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.monthly_price * 100), // Convert to cents
      currency: STRIPE_CONFIG.currency,
      recurring: {
        interval: 'month',
        interval_count: 1
      },
      metadata: {
        plan_id: plan.id,
        billing_cycle: 'monthly'
      }
    });

    // Create annual price
    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.annual_price * 100), // Convert to cents
      currency: STRIPE_CONFIG.currency,
      recurring: {
        interval: 'year',
        interval_count: 1
      },
      metadata: {
        plan_id: plan.id,
        billing_cycle: 'annual'
      }
    });

    return {
      productId: product.id,
      monthlyPriceId: monthlyPrice.id,
      annualPriceId: annualPrice.id
    };
  }

  /**
   * Retrieve a Stripe subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'latest_invoice']
    });
  }

  /**
   * List customer's payment methods
   */
  async getCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    return paymentMethods.data;
  }

  /**
   * Update customer's default payment method
   */
  async updateDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    const customer = await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    return customer;
  }

  /**
   * Create a setup intent for saving payment method
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session'
    });

    return setupIntent;
  }

  /**
   * Get upcoming invoice for subscription
   */
  async getUpcomingInvoice(subscriptionId: string): Promise<Stripe.Invoice> {
    return await stripe.invoices.retrieveUpcoming({
      subscription: subscriptionId
    });
  }

  /**
   * List customer invoices
   */
  async getCustomerInvoices(
    customerId: string,
    limit: number = 10
  ): Promise<Stripe.Invoice[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
      status: 'paid'
    });

    return invoices.data;
  }

  /**
   * Retry failed payment
   */
  async retryFailedPayment(invoiceId: string): Promise<Stripe.Invoice> {
    return await stripe.invoices.pay(invoiceId);
  }

  /**
   * Construct webhook event from request
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Calculate proration preview for subscription change
   */
  async previewSubscriptionChange(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Invoice> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return await stripe.invoices.retrieveUpcoming({
      subscription: subscriptionId,
      subscription_items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId
        }
      ],
      proration_behavior: 'create_prorations'
    });
  }
}