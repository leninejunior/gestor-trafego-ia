import { createClient } from '@/lib/supabase/server';
import { EmailNotificationService } from './email-notification-service';
import { 
  Subscription, 
  SubscriptionPlan, 
  SubscriptionInvoice,
  SubscriptionStatus 
} from '@/lib/types/subscription';

export interface NotificationContext {
  subscription: Subscription;
  plan: SubscriptionPlan;
  organization: {
    id: string;
    name: string;
    email?: string;
  };
  user: {
    id: string;
    name?: string;
    email: string;
  };
}

export interface AdminNotificationData {
  type: 'billing_failure' | 'high_churn' | 'payment_issues' | 'subscription_milestone';
  title: string;
  message: string;
  data: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class SubscriptionNotificationIntegration {
  private emailService: EmailNotificationService;

  constructor() {
    this.emailService = new EmailNotificationService();
  }

  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Get user data for organization owner
   */
  private async getOrganizationOwner(organizationId: string): Promise<{
    id: string;
    name?: string;
    email: string;
  } | null> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get primary user for the organization
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .single();

      if (!membership) {
        return null;
      }

      // Get user details from auth
      const { data: userData } = await supabase.auth.admin.getUserById(membership.user_id);
      if (!userData.user) {
        return null;
      }

      return {
        id: userData.user.id,
        name: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name,
        email: userData.user.email || ''
      };
    } catch (error) {
      console.error('Error getting organization owner:', error);
      return null;
    }
  }

  /**
   * Handle subscription confirmation notifications
   */
  async handleSubscriptionConfirmation(
    subscriptionId: string,
    planId: string,
    organizationId: string
  ): Promise<void> {
    try {
      const context = await this.getNotificationContext(subscriptionId, planId, organizationId);
      
      // Send email notification
      await this.emailService.sendSubscriptionConfirmation({
        subscription: context.subscription,
        plan: context.plan,
        organization: context.organization,
        user: context.user
      });

      // Create in-app notification
      await this.createInAppNotification(
        context.organization.id,
        context.user.id,
        'subscription_confirmed',
        `Welcome to ${context.plan.name}!`,
        `Your ${context.plan.name} subscription is now active. Start exploring your new features.`,
        'success'
      );

      console.log(`Subscription confirmation notifications sent for subscription ${subscriptionId}`);
    } catch (error) {
      console.error('Error handling subscription confirmation notifications:', error);
      // Don't throw error as this shouldn't block the subscription process
    }
  }

  /**
   * Handle payment failure notifications
   */
  async handlePaymentFailure(
    subscriptionId: string,
    invoiceId: string,
    retryAttempt: number,
    maxRetries: number,
    nextRetryDate?: Date
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get subscription with plan and invoice details
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*),
          organization:organizations(id, name, email)
        `)
        .eq('id', subscriptionId)
        .single();

      const { data: invoiceData } = await supabase
        .from('subscription_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (!subscriptionData || !invoiceData) {
        throw new Error('Subscription or invoice not found');
      }

      // Get primary user for the organization
      const user = await this.getOrganizationOwner(subscriptionData.organization_id);
      if (!user) {
        console.warn(`No owner found for organization ${subscriptionData.organization_id}`);
        return;
      }

      // Send email notification
      await this.emailService.sendPaymentFailureNotification({
        subscription: subscriptionData,
        invoice: invoiceData,
        plan: subscriptionData.plan,
        organization: subscriptionData.organization,
        user,
        retryAttempt,
        maxRetries,
        nextRetryDate
      });

      // Create in-app notification
      const isLastAttempt = retryAttempt >= maxRetries;
      await this.createInAppNotification(
        subscriptionData.organization_id,
        user.id,
        'payment_failure',
        isLastAttempt ? 'Payment Failed - Action Required' : 'Payment Failed - Retrying Soon',
        isLastAttempt 
          ? 'Your payment failed. Please update your payment method to avoid service interruption.'
          : `Payment failed (attempt ${retryAttempt}/${maxRetries}). We'll retry automatically.`,
        isLastAttempt ? 'error' : 'warning'
      );

      // Send admin notification for critical failures
      if (isLastAttempt) {
        await this.sendAdminNotification({
          type: 'payment_issues',
          title: 'Critical Payment Failure',
          message: `Final payment attempt failed for subscription ${subscriptionId}`,
          data: {
            subscriptionId,
            organizationId: subscriptionData.organization_id,
            organizationName: subscriptionData.organization.name,
            planName: subscriptionData.plan.name,
            invoiceAmount: invoiceData.amount,
            retryAttempt,
            maxRetries
          },
          severity: 'critical'
        });
      }

      console.log(`Payment failure notifications sent for subscription ${subscriptionId}, attempt ${retryAttempt}/${maxRetries}`);
    } catch (error) {
      console.error('Error handling payment failure notifications:', error);
    }
  }

  /**
   * Handle renewal reminder notifications
   */
  async handleRenewalReminder(
    subscriptionId: string,
    daysUntilRenewal: number
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get subscription with plan details
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*),
          organization:organizations(id, name, email)
        `)
        .eq('id', subscriptionId)
        .single();

      if (!subscriptionData) {
        throw new Error('Subscription not found');
      }

      // Get primary user for the organization
      const user = await this.getOrganizationOwner(subscriptionData.organization_id);
      if (!user) {
        console.warn(`No owner found for organization ${subscriptionData.organization_id}`);
        return;
      }

      const renewalAmount = subscriptionData.billing_cycle === 'annual' 
        ? subscriptionData.plan.annual_price 
        : subscriptionData.plan.monthly_price;

      // Send email notification
      await this.emailService.sendRenewalReminder({
        subscription: subscriptionData,
        plan: subscriptionData.plan,
        organization: subscriptionData.organization,
        user,
        daysUntilRenewal,
        renewalAmount
      });

      // Create in-app notification
      await this.createInAppNotification(
        subscriptionData.organization_id,
        user.id,
        'renewal_reminder',
        `Renewal in ${daysUntilRenewal} days`,
        `Your ${subscriptionData.plan.name} subscription will renew on ${new Date(subscriptionData.current_period_end).toLocaleDateString()}.`,
        'info'
      );

      console.log(`Renewal reminder notifications sent for subscription ${subscriptionId}, ${daysUntilRenewal} days until renewal`);
    } catch (error) {
      console.error('Error handling renewal reminder notifications:', error);
    }
  }

  /**
   * Handle subscription cancellation notifications
   */
  async handleSubscriptionCancellation(
    subscriptionId: string,
    cancellationReason?: string,
    effectiveDate?: Date
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get subscription with plan details
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*),
          organization:organizations(id, name, email)
        `)
        .eq('id', subscriptionId)
        .single();

      if (!subscriptionData) {
        throw new Error('Subscription not found');
      }

      // Get primary user for the organization
      const user = await this.getOrganizationOwner(subscriptionData.organization_id);
      if (!user) {
        console.warn(`No owner found for organization ${subscriptionData.organization_id}`);
        return;
      }

      const cancelEffectiveDate = effectiveDate || new Date(subscriptionData.current_period_end);

      // Send email notification
      await this.emailService.sendSubscriptionCancelled({
        subscription: subscriptionData,
        plan: subscriptionData.plan,
        organization: subscriptionData.organization,
        user,
        cancellationReason,
        effectiveDate: cancelEffectiveDate
      });

      // Create in-app notification
      await this.createInAppNotification(
        subscriptionData.organization_id,
        user.id,
        'subscription_cancelled',
        'Subscription Cancelled',
        `Your ${subscriptionData.plan.name} subscription has been cancelled. Access continues until ${cancelEffectiveDate.toLocaleDateString()}.`,
        'warning'
      );

      // Send admin notification for churn tracking
      await this.sendAdminNotification({
        type: 'high_churn',
        title: 'Subscription Cancelled',
        message: `Subscription cancelled for ${subscriptionData.organization.name}`,
        data: {
          subscriptionId,
          organizationId: subscriptionData.organization_id,
          organizationName: subscriptionData.organization.name,
          planName: subscriptionData.plan.name,
          cancellationReason,
          effectiveDate: cancelEffectiveDate.toISOString()
        },
        severity: 'medium'
      });

      console.log(`Subscription cancellation notifications sent for subscription ${subscriptionId}`);
    } catch (error) {
      console.error('Error handling subscription cancellation notifications:', error);
    }
  }

  /**
   * Handle plan upgrade notifications
   */
  async handlePlanUpgrade(
    subscriptionId: string,
    oldPlanId: string,
    newPlanId: string,
    prorationAmount?: number,
    effectiveDate?: Date
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get subscription with new plan details
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*),
          organization:organizations(id, name, email)
        `)
        .eq('id', subscriptionId)
        .single();

      // Get old plan details
      const { data: oldPlanData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', oldPlanId)
        .single();

      if (!subscriptionData || !oldPlanData) {
        throw new Error('Subscription or plan not found');
      }

      // Get primary user for the organization
      const user = await this.getOrganizationOwner(subscriptionData.organization_id);
      if (!user) {
        console.warn(`No owner found for organization ${subscriptionData.organization_id}`);
        return;
      }

      const upgradeEffectiveDate = effectiveDate || new Date();

      // Send email notification
      await this.emailService.sendPlanUpgradeNotification({
        subscription: subscriptionData,
        oldPlan: oldPlanData,
        newPlan: subscriptionData.plan,
        organization: subscriptionData.organization,
        user,
        prorationAmount,
        effectiveDate: upgradeEffectiveDate
      });

      // Create in-app notification
      await this.createInAppNotification(
        subscriptionData.organization_id,
        user.id,
        'plan_upgrade',
        `Upgraded to ${subscriptionData.plan.name}!`,
        `Your subscription has been upgraded from ${oldPlanData.name} to ${subscriptionData.plan.name}. New features are available now.`,
        'success'
      );

      console.log(`Plan upgrade notifications sent for subscription ${subscriptionId}: ${oldPlanData.name} → ${subscriptionData.plan.name}`);
    } catch (error) {
      console.error('Error handling plan upgrade notifications:', error);
    }
  }

  /**
   * Process renewal reminders for subscriptions expiring soon
   */
  async processRenewalReminders(): Promise<{
    processed: number;
    sent: number;
    errors: Array<{ subscriptionId: string; error: string }>;
  }> {
    const result = {
      processed: 0,
      sent: 0,
      errors: [] as Array<{ subscriptionId: string; error: string }>
    };

    try {
      const supabase = await this.getSupabaseClient();
      
      // Get subscriptions expiring in 3 days
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 3);

      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('id, current_period_end')
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
        .lte('current_period_end', reminderDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch subscriptions for renewal reminders: ${error.message}`);
      }

      result.processed = subscriptions?.length || 0;

      for (const subscription of subscriptions || []) {
        try {
          const daysUntilRenewal = Math.ceil(
            (new Date(subscription.current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          await this.handleRenewalReminder(subscription.id, daysUntilRenewal);
          result.sent++;
        } catch (error) {
          result.errors.push({
            subscriptionId: subscription.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error processing renewal reminders:', error);
      throw error;
    }
  }

  /**
   * Get notification context for a subscription
   */
  private async getNotificationContext(
    subscriptionId: string,
    planId: string,
    organizationId: string
  ): Promise<NotificationContext> {
    const supabase = await this.getSupabaseClient();
    
    // Get subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    // Get plan
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    // Get organization
    const { data: organization } = await supabase
      .from('organizations')
      .select('id, name, email')
      .eq('id', organizationId)
      .single();

    // Get primary user (owner) for the organization
    const user = await this.getOrganizationOwner(organizationId);

    if (!subscription || !plan || !organization || !user) {
      throw new Error('Failed to get notification context: missing required data');
    }

    return {
      subscription,
      plan,
      organization,
      user
    };
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    organizationId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    priority: 'info' | 'success' | 'warning' | 'error'
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      await supabase
        .from('notifications')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          type,
          title,
          message,
          priority,
          is_read: false,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error creating in-app notification:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Send admin notification for critical events
   */
  private async sendAdminNotification(data: AdminNotificationData): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Get super admin users
      const { data: superAdmins } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('role', 'super_admin');

      // Create in-app notifications for super admins
      for (const admin of superAdmins || []) {
        await supabase
          .from('notifications')
          .insert({
            user_id: admin.user_id,
            type: 'admin_alert',
            title: data.title,
            message: data.message,
            priority: data.severity === 'critical' ? 'error' : data.severity === 'high' ? 'warning' : 'info',
            metadata: data.data,
            is_read: false,
            created_at: new Date().toISOString()
          });
      }

      // Send email to admin if configured and severity is high or critical
      if ((data.severity === 'high' || data.severity === 'critical') && process.env.ADMIN_EMAIL) {
        // Use the existing email service for admin notifications
        console.log('ADMIN NOTIFICATION:', {
          type: data.type,
          title: data.title,
          message: data.message,
          severity: data.severity,
          data: data.data,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`Admin notification sent: ${data.type} - ${data.title}`);
    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  }
}