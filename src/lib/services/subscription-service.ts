import { createClient } from '@/lib/supabase/server';
import { 
  Subscription,
  SubscriptionStatus,
  BillingCycle,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  SubscriptionWithPlan,
  ProrationCalculation,
  BillingCycleInfo
} from '@/lib/types/subscription';
import { PlanManager } from './plan-manager';
import { SubscriptionNotificationIntegration } from './subscription-notification-integration';

export class SubscriptionService {
  private planManager: PlanManager;
  private notificationIntegration: SubscriptionNotificationIntegration;

  constructor() {
    this.planManager = new PlanManager();
    this.notificationIntegration = new SubscriptionNotificationIntegration();
  }

  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Create a new subscription with payment integration
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    const supabase = await this.getSupabaseClient();
    
    // Validate the plan exists and is active
    const plan = await this.planManager.getPlanById(request.plan_id);
    if (!plan || !plan.is_active) {
      throw new Error('Invalid or inactive subscription plan');
    }

    // Check if organization already has an active subscription
    const existingSubscription = await this.getActiveSubscription(request.organization_id);
    if (existingSubscription) {
      throw new Error('Organization already has an active subscription');
    }

    // Calculate period dates
    const now = new Date();
    const periodStart = now;
    let periodEnd: Date;
    let trialEnd: Date | null = null;

    // Set trial period if specified
    if (request.trial_days && request.trial_days > 0) {
      trialEnd = new Date(now.getTime() + (request.trial_days * 24 * 60 * 60 * 1000));
    }

    // Calculate billing period end
    if (request.billing_cycle === 'annual') {
      periodEnd = new Date(periodStart.getFullYear() + 1, periodStart.getMonth(), periodStart.getDate());
    } else {
      periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, periodStart.getDate());
    }

    // Create subscription record
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        organization_id: request.organization_id,
        plan_id: request.plan_id,
        status: trialEnd ? 'trialing' : 'active',
        billing_cycle: request.billing_cycle,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_end: trialEnd?.toISOString() || null,
        payment_method_id: request.payment_method_id || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    const subscription = this.mapDatabaseSubscriptionToInterface(data);

    // Send subscription confirmation notifications
    try {
      await this.notificationIntegration.handleSubscriptionConfirmation(
        subscription.id,
        request.plan_id,
        request.organization_id
      );
    } catch (notificationError) {
      console.error('Failed to send subscription confirmation notifications:', notificationError);
      // Don't throw error as this shouldn't block subscription creation
    }

    return subscription;
  }

  /**
   * Get active subscription for an organization
   */
  async getActiveSubscription(organizationId: string): Promise<SubscriptionWithPlan | null> {
    const supabase = await this.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    return {
      ...this.mapDatabaseSubscriptionToInterface(data),
      plan: data.subscription_plans
    };
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(
    subscriptionId: string, 
    status: SubscriptionStatus,
    metadata?: Record<string, any>
  ): Promise<Subscription> {
    const supabase = await this.getSupabaseClient();
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    // Add metadata fields if provided
    if (metadata?.stripe_subscription_id) {
      updateData.stripe_subscription_id = metadata.stripe_subscription_id;
    }
    if (metadata?.stripe_customer_id) {
      updateData.stripe_customer_id = metadata.stripe_customer_id;
    }
    if (metadata?.payment_method_id) {
      updateData.payment_method_id = metadata.payment_method_id;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update subscription status: ${error.message}`);
    }

    return this.mapDatabaseSubscriptionToInterface(data);
  }

  /**
   * Upgrade or downgrade subscription plan with prorations
   */
  async upgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
    effectiveDate?: Date
  ): Promise<{
    subscription: Subscription;
    proration: ProrationCalculation;
  }> {
    const supabase = await this.getSupabaseClient();
    
    // Get current subscription
    const currentSubscription = await this.getSubscriptionById(subscriptionId);
    if (!currentSubscription) {
      throw new Error('Subscription not found');
    }

    // Validate new plan
    const newPlan = await this.planManager.getPlanById(newPlanId);
    if (!newPlan || !newPlan.is_active) {
      throw new Error('Invalid or inactive target plan');
    }

    // Calculate proration
    const proration = await this.calculateProration(currentSubscription, newPlanId, effectiveDate);

    // Update subscription
    const now = effectiveDate || new Date();
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan_id: newPlanId,
        updated_at: now.toISOString()
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upgrade subscription: ${error.message}`);
    }

    const updatedSubscription = this.mapDatabaseSubscriptionToInterface(data);

    // Send plan upgrade notifications
    try {
      await this.notificationIntegration.handlePlanUpgrade(
        subscriptionId,
        currentSubscription.plan_id,
        newPlanId,
        proration.prorated_amount,
        effectiveDate
      );
    } catch (notificationError) {
      console.error('Failed to send plan upgrade notifications:', notificationError);
      // Don't throw error as this shouldn't block the upgrade
    }

    return {
      subscription: updatedSubscription,
      proration
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ): Promise<Subscription> {
    const supabase = await this.getSupabaseClient();
    
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    let newStatus: SubscriptionStatus;
    let updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (cancelAtPeriodEnd) {
      // Cancel at period end - keep active until then
      newStatus = 'active';
      updateData.cancel_at_period_end = true;
      updateData.cancellation_reason = reason;
    } else {
      // Cancel immediately
      newStatus = 'canceled';
      updateData.status = newStatus;
      updateData.canceled_at = new Date().toISOString();
      updateData.cancellation_reason = reason;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }

    const cancelledSubscription = this.mapDatabaseSubscriptionToInterface(data);

    // Send cancellation notifications (only for immediate cancellations)
    if (!cancelAtPeriodEnd) {
      try {
        await this.notificationIntegration.handleSubscriptionCancellation(
          subscriptionId,
          reason,
          new Date()
        );
      } catch (notificationError) {
        console.error('Failed to send cancellation notifications:', notificationError);
        // Don't throw error as this shouldn't block the cancellation
      }
    }

    return cancelledSubscription;
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<Subscription> {
    const supabase = await this.getSupabaseClient();
    
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'canceled') {
      throw new Error('Only canceled subscriptions can be reactivated');
    }

    // Extend the period if it has already ended
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    let newPeriodEnd = periodEnd;

    if (periodEnd <= now) {
      // Extend period based on billing cycle
      if (subscription.billing_cycle === 'annual') {
        newPeriodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      } else {
        newPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: newPeriodEnd.toISOString(),
        cancel_at_period_end: false,
        canceled_at: null,
        cancellation_reason: null,
        updated_at: now.toISOString()
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reactivate subscription: ${error.message}`);
    }

    return this.mapDatabaseSubscriptionToInterface(data);
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
    const supabase = await this.getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    return this.mapDatabaseSubscriptionToInterface(data);
  }

  /**
   * Get billing cycle information
   */
  async getBillingCycleInfo(subscriptionId: string): Promise<BillingCycleInfo> {
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const daysUntilRenewal = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate next billing date
    let nextBillingDate: Date;
    if (subscription.billing_cycle === 'annual') {
      nextBillingDate = new Date(periodEnd.getFullYear() + 1, periodEnd.getMonth(), periodEnd.getDate());
    } else {
      nextBillingDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, periodEnd.getDate());
    }

    return {
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      next_billing_date: nextBillingDate.toISOString(),
      days_until_renewal: Math.max(0, daysUntilRenewal)
    };
  }

  /**
   * Calculate proration for plan changes
   */
  private async calculateProration(
    currentSubscription: Subscription,
    newPlanId: string,
    effectiveDate?: Date
  ): Promise<ProrationCalculation> {
    const currentPlan = await this.planManager.getPlanById(currentSubscription.plan_id);
    const newPlan = await this.planManager.getPlanById(newPlanId);

    if (!currentPlan || !newPlan) {
      throw new Error('Invalid plan IDs for proration calculation');
    }

    const now = effectiveDate || new Date();
    const periodEnd = new Date(currentSubscription.current_period_end);
    const periodStart = new Date(currentSubscription.current_period_start);
    
    // Calculate days remaining in current period
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 0) {
      return {
        current_plan_cost: 0,
        new_plan_cost: this.getPlanPrice(newPlan, currentSubscription.billing_cycle),
        prorated_amount: this.getPlanPrice(newPlan, currentSubscription.billing_cycle),
        days_remaining: 0,
        effective_date: now.toISOString()
      };
    }

    // Calculate pricing
    const currentPlanPrice = this.getPlanPrice(currentPlan, currentSubscription.billing_cycle);
    const newPlanPrice = this.getPlanPrice(newPlan, currentSubscription.billing_cycle);

    // Calculate prorated amounts
    const dailyCurrentRate = currentPlanPrice / totalDays;
    const dailyNewRate = newPlanPrice / totalDays;
    
    const currentPlanCredit = dailyCurrentRate * daysRemaining;
    const newPlanCost = dailyNewRate * daysRemaining;
    const proratedAmount = newPlanCost - currentPlanCredit;

    return {
      current_plan_cost: currentPlanCredit,
      new_plan_cost: newPlanCost,
      prorated_amount: Math.max(0, proratedAmount),
      days_remaining: daysRemaining,
      effective_date: now.toISOString()
    };
  }

  /**
   * Get plan price based on billing cycle
   */
  private getPlanPrice(plan: any, billingCycle: BillingCycle): number {
    return billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
  }

  /**
   * Map database row to Subscription interface
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
   * Get subscriptions expiring soon (for renewal processing)
   */
  async getSubscriptionsExpiringIn(days: number): Promise<Subscription[]> {
    const supabase = await this.getSupabaseClient();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('current_period_end', futureDate.toISOString())
      .order('current_period_end', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch expiring subscriptions: ${error.message}`);
    }

    return data.map(this.mapDatabaseSubscriptionToInterface);
  }

  /**
   * Process subscription renewals
   */
  async processRenewal(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const now = new Date();
    const currentPeriodEnd = new Date(subscription.current_period_end);
    
    // Calculate new period
    let newPeriodStart = currentPeriodEnd;
    let newPeriodEnd: Date;

    if (subscription.billing_cycle === 'annual') {
      newPeriodEnd = new Date(newPeriodStart.getFullYear() + 1, newPeriodStart.getMonth(), newPeriodStart.getDate());
    } else {
      newPeriodEnd = new Date(newPeriodStart.getFullYear(), newPeriodStart.getMonth() + 1, newPeriodStart.getDate());
    }

    const supabase = await this.getSupabaseClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        current_period_start: newPeriodStart.toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to process renewal: ${error.message}`);
    }

    return this.mapDatabaseSubscriptionToInterface(data);
  }
}