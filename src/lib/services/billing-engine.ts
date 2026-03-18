import { createClient } from '@/lib/supabase/server';
import { StripeService } from '@/lib/stripe/stripe-service';
import { 
  Subscription,
  SubscriptionPlan,
  SubscriptionInvoice,
  InvoiceLineItem,
  InvoiceStatus,
  SubscriptionStatus,
  BillingCycle
} from '@/lib/types/subscription';
import { SubscriptionService } from './subscription-service';
import { PlanManager } from './plan-manager';
import { BillingNotificationService } from './billing-notification-service';
import { SubscriptionNotificationIntegration } from './subscription-notification-integration';

interface BillingProcessResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
}

interface InvoiceGenerationRequest {
  subscriptionId: string;
  amount: number;
  currency?: string;
  lineItems: InvoiceLineItem[];
  dueDate?: Date;
}

export class BillingEngine {
  private stripeService: StripeService;
  private subscriptionService: SubscriptionService;
  private planManager: PlanManager;
  private notificationService: BillingNotificationService;
  private notificationIntegration: SubscriptionNotificationIntegration;
  
  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000  // 30 seconds
  };

  constructor() {
    this.stripeService = new StripeService();
    this.subscriptionService = new SubscriptionService();
    this.planManager = new PlanManager();
    this.notificationService = new BillingNotificationService();
    this.notificationIntegration = new SubscriptionNotificationIntegration();
  }

  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Process recurring billing for all due subscriptions
   */
  async processRecurringBilling(): Promise<BillingProcessResult> {
    const result: BillingProcessResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      // Get subscriptions due for billing (current period ends today or earlier)
      const dueSubscriptions = await this.getSubscriptionsDueForBilling();
      result.processed = dueSubscriptions.length;

      console.log(`Processing ${dueSubscriptions.length} subscriptions for billing`);

      // Process each subscription
      for (const subscription of dueSubscriptions) {
        try {
          await this.processSingleSubscriptionBilling(subscription);
          result.successful++;
          console.log(`Successfully processed billing for subscription ${subscription.id}`);
        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            subscriptionId: subscription.id,
            error: errorMessage
          });
          console.error(`Failed to process billing for subscription ${subscription.id}:`, errorMessage);
        }
      }

      console.log(`Billing processing complete: ${result.successful} successful, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error('Error in processRecurringBilling:', error);
      throw error;
    }
  }

  /**
   * Process billing for a single subscription
   */
  private async processSingleSubscriptionBilling(subscription: Subscription): Promise<void> {
    // Skip if subscription is not active or in trial
    if (subscription.status !== 'active') {
      console.log(`Skipping subscription ${subscription.id} - status: ${subscription.status}`);
      return;
    }

    // Get subscription plan for pricing
    const plan = await this.planManager.getPlanById(subscription.plan_id);
    if (!plan) {
      throw new Error(`Plan not found for subscription ${subscription.id}`);
    }

    // Calculate billing amount
    const amount = subscription.billing_cycle === 'annual' ? plan.annual_price : plan.monthly_price;

    // Create line items
    const lineItems: InvoiceLineItem[] = [
      {
        id: `plan-${plan.id}`,
        description: `${plan.name} - ${subscription.billing_cycle} subscription`,
        quantity: 1,
        unit_price: amount,
        total: amount
      }
    ];

    // Generate invoice
    const invoice = await this.createInvoice({
      subscriptionId: subscription.id,
      amount,
      lineItems,
      dueDate: new Date() // Due immediately
    });

    // Process payment
    await this.processInvoicePayment(invoice, subscription);

    // Update subscription period if payment successful
    if (invoice.status === 'paid') {
      await this.advanceSubscriptionPeriod(subscription);
    }
  }

  /**
   * Create an invoice for a subscription
   */
  async createInvoice(request: InvoiceGenerationRequest): Promise<SubscriptionInvoice> {
    const supabase = await this.getSupabaseClient();
    
    const invoiceData = {
      subscription_id: request.subscriptionId,
      amount: request.amount,
      currency: request.currency || 'USD',
      status: 'open' as InvoiceStatus,
      line_items: request.lineItems,
      due_date: (request.dueDate || new Date()).toISOString(),
    };

    const { data, error } = await supabase
      .from('subscription_invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    return this.mapDatabaseInvoiceToInterface(data);
  }

  /**
   * Process payment for an invoice
   */
  private async processInvoicePayment(
    invoice: SubscriptionInvoice, 
    subscription: Subscription
  ): Promise<void> {
    try {
      // If subscription has Stripe integration, use Stripe
      if (subscription.stripe_subscription_id && subscription.stripe_customer_id) {
        await this.processStripePayment(invoice, subscription);
      } else {
        // For now, mark as failed if no payment method
        await this.updateInvoiceStatus(invoice.id, 'uncollectible');
        throw new Error('No payment method configured for subscription');
      }
    } catch (error) {
      console.error(`Payment processing failed for invoice ${invoice.id}:`, error);
      await this.updateInvoiceStatus(invoice.id, 'open');
      
      // Start retry process
      await this.schedulePaymentRetry(invoice, subscription);
      throw error;
    }
  }

  /**
   * Process payment through Stripe
   */
  private async processStripePayment(
    invoice: SubscriptionInvoice,
    subscription: Subscription
  ): Promise<void> {
    try {
      // Get Stripe subscription to trigger billing
      const stripeSubscription = await this.stripeService.getSubscription(
        subscription.stripe_subscription_id!
      );

      // Get the latest invoice from Stripe
      const stripeInvoice = stripeSubscription.latest_invoice;
      
      if (typeof stripeInvoice === 'string') {
        // If it's just an ID, we need to fetch the full invoice
        const stripe = await import('stripe').then(m => m.default);
        const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
        const fullInvoice = await stripeClient.invoices.retrieve(stripeInvoice);
        await this.handleStripeInvoiceResult(invoice, fullInvoice);
      } else if (stripeInvoice) {
        await this.handleStripeInvoiceResult(invoice, stripeInvoice);
      } else {
        throw new Error('No Stripe invoice found');
      }
    } catch (error) {
      console.error('Stripe payment processing error:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe invoice result
   */
  private async handleStripeInvoiceResult(
    invoice: SubscriptionInvoice,
    stripeInvoice: any
  ): Promise<void> {
    const supabase = await this.getSupabaseClient();
    
    let status: InvoiceStatus;
    let paidAt: string | null = null;
    
    switch (stripeInvoice.status) {
      case 'paid':
        status = 'paid';
        paidAt = new Date().toISOString();
        break;
      case 'open':
        status = 'open';
        break;
      case 'void':
        status = 'void';
        break;
      case 'uncollectible':
        status = 'uncollectible';
        break;
      default:
        status = 'open';
    }

    const updateData: any = {
      status,
      stripe_invoice_id: stripeInvoice.id,
      updated_at: new Date().toISOString()
    };

    if (paidAt) {
      updateData.paid_at = paidAt;
    }

    if (stripeInvoice.payment_intent) {
      updateData.payment_intent_id = typeof stripeInvoice.payment_intent === 'string' 
        ? stripeInvoice.payment_intent 
        : stripeInvoice.payment_intent.id;
    }

    const { error } = await supabase
      .from('subscription_invoices')
      .update(updateData)
      .eq('id', invoice.id);

    if (error) {
      throw new Error(`Failed to update invoice status: ${error.message}`);
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(
    invoiceId: string, 
    status: InvoiceStatus,
    paidAt?: Date
  ): Promise<void> {
    const supabase = await this.getSupabaseClient();
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'paid' && paidAt) {
      updateData.paid_at = paidAt.toISOString();
    }

    const { error } = await supabase
      .from('subscription_invoices')
      .update(updateData)
      .eq('id', invoiceId);

    if (error) {
      throw new Error(`Failed to update invoice status: ${error.message}`);
    }
  }

  /**
   * Schedule payment retry with exponential backoff
   */
  private async schedulePaymentRetry(
    invoice: SubscriptionInvoice,
    subscription: Subscription,
    retryCount: number = 0
  ): Promise<void> {
    if (retryCount >= this.DEFAULT_RETRY_CONFIG.maxRetries) {
      console.log(`Max retries reached for invoice ${invoice.id}`);
      await this.handleMaxRetriesReached(invoice, subscription);
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.DEFAULT_RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
      this.DEFAULT_RETRY_CONFIG.maxDelay
    );

    console.log(`Scheduling retry ${retryCount + 1} for invoice ${invoice.id} in ${delay}ms`);

    // In a production environment, you would use a proper job queue
    // For now, we'll use setTimeout (not recommended for production)
    setTimeout(async () => {
      try {
        await this.retryInvoicePayment(invoice, subscription, retryCount + 1);
      } catch (error) {
        console.error(`Retry ${retryCount + 1} failed for invoice ${invoice.id}:`, error);
        await this.schedulePaymentRetry(invoice, subscription, retryCount + 1);
      }
    }, delay);
  }

  /**
   * Retry payment for an invoice
   */
  private async retryInvoicePayment(
    invoice: SubscriptionInvoice,
    subscription: Subscription,
    retryCount: number
  ): Promise<void> {
    console.log(`Retrying payment for invoice ${invoice.id} (attempt ${retryCount})`);
    
    try {
      if (subscription.stripe_subscription_id) {
        // Try to retry the Stripe invoice
        const stripeInvoice = await this.stripeService.retryFailedPayment(invoice.stripe_invoice_id!);
        await this.handleStripeInvoiceResult(invoice, stripeInvoice);
        
        if (stripeInvoice.status === 'paid') {
          console.log(`Payment retry successful for invoice ${invoice.id}`);
          await this.advanceSubscriptionPeriod(subscription);
          return;
        }
      }
      
      throw new Error('Payment retry failed');
    } catch (error) {
      console.error(`Payment retry failed for invoice ${invoice.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle when max retries are reached
   */
  private async handleMaxRetriesReached(
    invoice: SubscriptionInvoice,
    subscription: Subscription
  ): Promise<void> {
    console.log(`Max retries reached for invoice ${invoice.id}, updating subscription status`);
    
    // Mark invoice as uncollectible
    await this.updateInvoiceStatus(invoice.id, 'uncollectible');
    
    // Update subscription status to past_due
    await this.subscriptionService.updateSubscriptionStatus(
      subscription.id,
      'past_due'
    );

    // Send notification to customer about failed payment
    try {
      await this.notificationIntegration.handlePaymentFailure(
        subscription.id,
        invoice.id,
        this.DEFAULT_RETRY_CONFIG.maxRetries,
        this.DEFAULT_RETRY_CONFIG.maxRetries
      );
    } catch (notificationError) {
      console.error('Failed to send payment failure notification:', notificationError);
    }
  }

  /**
   * Advance subscription to next billing period
   */
  private async advanceSubscriptionPeriod(subscription: Subscription): Promise<void> {
    const currentPeriodEnd = new Date(subscription.current_period_end);
    let newPeriodStart = currentPeriodEnd;
    let newPeriodEnd: Date;

    // Calculate new period based on billing cycle
    if (subscription.billing_cycle === 'annual') {
      newPeriodEnd = new Date(newPeriodStart.getFullYear() + 1, newPeriodStart.getMonth(), newPeriodStart.getDate());
    } else {
      newPeriodEnd = new Date(newPeriodStart.getFullYear(), newPeriodStart.getMonth() + 1, newPeriodStart.getDate());
    }

    const supabase = await this.getSupabaseClient();
    const { error } = await supabase
      .from('subscriptions')
      .update({
        current_period_start: newPeriodStart.toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (error) {
      throw new Error(`Failed to advance subscription period: ${error.message}`);
    }

    console.log(`Advanced subscription ${subscription.id} to next billing period`);
  }

  /**
   * Get subscriptions due for billing
   */
  private async getSubscriptionsDueForBilling(): Promise<Subscription[]> {
    const supabase = await this.getSupabaseClient();
    const now = new Date();
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('current_period_end', now.toISOString())
      .order('current_period_end', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch due subscriptions: ${error.message}`);
    }

    return data.map(this.mapDatabaseSubscriptionToInterface);
  }

  /**
   * Get billing history for a subscription
   */
  async getBillingHistory(
    subscriptionId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<SubscriptionInvoice[]> {
    const supabase = await this.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscription_invoices')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch billing history: ${error.message}`);
    }

    return data.map(this.mapDatabaseInvoiceToInterface);
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<SubscriptionInvoice | null> {
    const supabase = await this.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscription_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }

    return this.mapDatabaseInvoiceToInterface(data);
  }

  /**
   * Get failed invoices for retry processing
   */
  async getFailedInvoices(limit: number = 50): Promise<SubscriptionInvoice[]> {
    const supabase = await this.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscription_invoices')
      .select('*')
      .in('status', ['open', 'past_due'])
      .lt('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch failed invoices: ${error.message}`);
    }

    return data.map(this.mapDatabaseInvoiceToInterface);
  }

  /**
   * Calculate billing cycle management info
   */
  async getBillingCycleInfo(subscriptionId: string): Promise<{
    nextBillingDate: string;
    daysUntilBilling: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }> {
    const subscription = await this.subscriptionService.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const daysUntilBilling = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      nextBillingDate: subscription.current_period_end,
      daysUntilBilling: Math.max(0, daysUntilBilling),
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    };
  }

  /**
   * Map database subscription row to interface
   */
  private mapDatabaseSubscriptionToInterface(data: any): Subscription {
    return {
      id: data.id,
      organization_id: data.organization_id,
      plan_id: data.plan_id,
      status: data.status,
      billing_cycle: data.billing_cycle,
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      trial_end: data.trial_end,
      payment_method_id: data.payment_method_id,
      stripe_subscription_id: data.stripe_subscription_id,
      stripe_customer_id: data.stripe_customer_id,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  /**
   * Map database invoice row to interface
   */
  private mapDatabaseInvoiceToInterface(data: any): SubscriptionInvoice {
    return {
      id: data.id,
      subscription_id: data.subscription_id,
      invoice_number: data.invoice_number,
      amount: parseFloat(data.amount),
      currency: data.currency,
      status: data.status,
      line_items: data.line_items || [],
      due_date: data.due_date,
      paid_at: data.paid_at,
      payment_intent_id: data.payment_intent_id,
      stripe_invoice_id: data.stripe_invoice_id,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }
}