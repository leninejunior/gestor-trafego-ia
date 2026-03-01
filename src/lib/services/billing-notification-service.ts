import { createClient } from '@/lib/supabase/server';
import { Subscription, SubscriptionInvoice } from '@/lib/types/subscription';

export interface NotificationTemplate {
  subject: string;
  body: string;
  type: 'email' | 'in_app' | 'webhook';
}

export interface PaymentFailureNotificationData {
  subscription: Subscription;
  invoice: SubscriptionInvoice;
  organization: {
    id: string;
    name: string;
    email?: string;
  };
  retryAttempt: number;
  maxRetries: number;
}

export interface RenewalReminderNotificationData {
  subscription: Subscription;
  organization: {
    id: string;
    name: string;
    email?: string;
  };
  daysUntilRenewal: number;
  amount: number;
}

export class BillingNotificationService {
  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailureNotification(data: PaymentFailureNotificationData): Promise<void> {
    try {
      const templates = this.getPaymentFailureTemplates(data);
      
      // Send email notification if organization has email
      if (data.organization.email) {
        await this.sendEmailNotification(
          data.organization.email,
          templates.email.subject,
          templates.email.body
        );
      }

      // Create in-app notification
      await this.createInAppNotification(
        data.organization.id,
        templates.in_app.subject,
        templates.in_app.body,
        'payment_failure'
      );

      // Log notification
      console.log(`Payment failure notification sent for subscription ${data.subscription.id}`);

    } catch (error) {
      console.error('Error sending payment failure notification:', error);
      throw error;
    }
  }

  /**
   * Send renewal reminder notification
   */
  async sendRenewalReminderNotification(data: RenewalReminderNotificationData): Promise<void> {
    try {
      const templates = this.getRenewalReminderTemplates(data);
      
      // Send email notification if organization has email
      if (data.organization.email) {
        await this.sendEmailNotification(
          data.organization.email,
          templates.email.subject,
          templates.email.body
        );
      }

      // Create in-app notification
      await this.createInAppNotification(
        data.organization.id,
        templates.in_app.subject,
        templates.in_app.body,
        'renewal_reminder'
      );

      console.log(`Renewal reminder sent for subscription ${data.subscription.id}`);

    } catch (error) {
      console.error('Error sending renewal reminder:', error);
      throw error;
    }
  }

  /**
   * Send subscription confirmation notification
   */
  async sendSubscriptionConfirmationNotification(
    subscription: Subscription,
    organization: { id: string; name: string; email?: string },
    planName: string
  ): Promise<void> {
    try {
      const subject = 'Subscription Confirmed - Welcome to Ads Manager!';
      const body = this.getSubscriptionConfirmationTemplate(organization.name, planName, subscription);

      // Send email notification if organization has email
      if (organization.email) {
        await this.sendEmailNotification(organization.email, subject, body);
      }

      // Create in-app notification
      await this.createInAppNotification(
        organization.id,
        subject,
        `Your ${planName} subscription is now active. Welcome to Ads Manager!`,
        'subscription_confirmed'
      );

      console.log(`Subscription confirmation sent for subscription ${subscription.id}`);

    } catch (error) {
      console.error('Error sending subscription confirmation:', error);
      throw error;
    }
  }

  /**
   * Send admin notification for critical billing events
   */
  async sendAdminNotification(
    type: 'billing_failure' | 'high_churn' | 'payment_issues',
    data: Record<string, any>
  ): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.warn('ADMIN_EMAIL not configured, skipping admin notification');
        return;
      }

      let subject: string;
      let body: string;

      switch (type) {
        case 'billing_failure':
          subject = 'URGENT: Billing Process Failure';
          body = `The automated billing process has failed.\n\nError: ${data.error}\nTimestamp: ${data.timestamp}\n\nPlease investigate immediately.`;
          break;
        case 'high_churn':
          subject = 'Alert: High Subscription Churn Rate';
          body = `High churn rate detected.\n\nCancellations today: ${data.cancellations}\nChurn rate: ${data.churnRate}%\n\nPlease review subscription health.`;
          break;
        case 'payment_issues':
          subject = 'Alert: Multiple Payment Failures';
          body = `Multiple payment failures detected.\n\nFailed payments: ${data.failedCount}\nAffected subscriptions: ${data.subscriptionCount}\n\nPlease review payment processing.`;
          break;
        default:
          subject = 'Billing System Alert';
          body = JSON.stringify(data, null, 2);
      }

      await this.sendEmailNotification(adminEmail, subject, body);
      console.log(`Admin notification sent: ${type}`);

    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  }

  /**
   * Get payment failure notification templates
   */
  private getPaymentFailureTemplates(data: PaymentFailureNotificationData): {
    email: NotificationTemplate;
    in_app: NotificationTemplate;
  } {
    const isLastAttempt = data.retryAttempt >= data.maxRetries;
    
    return {
      email: {
        subject: isLastAttempt 
          ? 'Action Required: Payment Failed - Subscription at Risk'
          : 'Payment Failed - We\'ll Try Again Soon',
        body: this.getPaymentFailureEmailTemplate(data, isLastAttempt),
        type: 'email'
      },
      in_app: {
        subject: isLastAttempt 
          ? 'Payment Failed - Update Payment Method'
          : 'Payment Failed - Retrying Soon',
        body: isLastAttempt
          ? 'Your payment failed. Please update your payment method to avoid service interruption.'
          : `Payment failed (attempt ${data.retryAttempt}/${data.maxRetries}). We'll retry automatically.`,
        type: 'in_app'
      }
    };
  }

  /**
   * Get renewal reminder notification templates
   */
  private getRenewalReminderTemplates(data: RenewalReminderNotificationData): {
    email: NotificationTemplate;
    in_app: NotificationTemplate;
  } {
    return {
      email: {
        subject: `Your Ads Manager subscription renews in ${data.daysUntilRenewal} days`,
        body: this.getRenewalReminderEmailTemplate(data),
        type: 'email'
      },
      in_app: {
        subject: `Renewal in ${data.daysUntilRenewal} days`,
        body: `Your subscription will renew on ${new Date(data.subscription.current_period_end).toLocaleDateString()} for $${data.amount}.`,
        type: 'in_app'
      }
    };
  }

  /**
   * Generate payment failure email template
   */
  private getPaymentFailureEmailTemplate(data: PaymentFailureNotificationData, isLastAttempt: boolean): string {
    return `
Dear ${data.organization.name},

We were unable to process your payment for your Ads Manager subscription.

Invoice Details:
- Invoice Number: ${data.invoice.invoice_number}
- Amount: $${data.invoice.amount.toFixed(2)}
- Due Date: ${new Date(data.invoice.due_date).toLocaleDateString()}

${isLastAttempt 
  ? `This was our final attempt to process your payment. To avoid service interruption, please update your payment method immediately by logging into your account.

If your subscription is not renewed within 7 days, your account will be suspended.`
  : `We'll automatically retry your payment in a few days. If you'd like to resolve this immediately, you can update your payment method in your account settings.

Retry attempt: ${data.retryAttempt} of ${data.maxRetries}`
}

To update your payment method:
1. Log into your Ads Manager account
2. Go to Billing Settings
3. Update your payment method

If you have any questions, please contact our support team.

Best regards,
The Ads Manager Team
    `.trim();
  }

  /**
   * Generate renewal reminder email template
   */
  private getRenewalReminderEmailTemplate(data: RenewalReminderNotificationData): string {
    return `
Dear ${data.organization.name},

Your Ads Manager subscription will renew automatically in ${data.daysUntilRenewal} days.

Renewal Details:
- Renewal Date: ${new Date(data.subscription.current_period_end).toLocaleDateString()}
- Amount: $${data.amount.toFixed(2)}
- Billing Cycle: ${data.subscription.billing_cycle}

Your current payment method will be charged automatically. If you need to update your payment method or make changes to your subscription, please log into your account.

Thank you for being a valued customer!

Best regards,
The Ads Manager Team
    `.trim();
  }

  /**
   * Generate subscription confirmation email template
   */
  private getSubscriptionConfirmationTemplate(
    organizationName: string,
    planName: string,
    subscription: Subscription
  ): string {
    return `
Dear ${organizationName},

Welcome to Ads Manager! Your ${planName} subscription is now active.

Subscription Details:
- Plan: ${planName}
- Billing Cycle: ${subscription.billing_cycle}
- Next Billing Date: ${new Date(subscription.current_period_end).toLocaleDateString()}

You now have access to all the features included in your plan. Get started by:
1. Connecting your Meta Ads accounts
2. Adding your clients
3. Setting up your first campaigns

If you have any questions or need help getting started, our support team is here to help.

Best regards,
The Ads Manager Team
    `.trim();
  }

  /**
   * Send email notification (console fallback implementation)
   */
  private async sendEmailNotification(
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    // In a production environment, you would integrate with an email service
    // such as SendGrid, AWS SES, Mailgun, etc.
    
    console.log('EMAIL NOTIFICATION:', {
      to,
      subject,
      body: body.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    // TODO: Implement actual email sending
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ to, from: 'noreply@adsmanager.com', subject, text: body });
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    organizationId: string,
    title: string,
    message: string,
    type: string
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Check if notifications table exists (it should be created by the notification system)
      const { error } = await supabase
        .from('notifications')
        .insert({
          organization_id: organizationId,
          title,
          message,
          type,
          is_read: false,
          created_at: new Date().toISOString()
        });

      if (error) {
        // If notifications table doesn't exist, just log it
        console.log('In-app notification (table not available):', { organizationId, title, message, type });
      }

    } catch (error) {
      console.error('Error creating in-app notification:', error);
      // Don't throw error as this is not critical
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
        .select(`
          *,
          plan:subscription_plans(name, monthly_price, annual_price),
          organization:organizations(id, name, email)
        `)
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
        .lte('current_period_end', reminderDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch subscriptions for renewal reminders: ${error.message}`);
      }

      result.processed = subscriptions?.length || 0;

      for (const subscription of subscriptions || []) {
        try {
          const amount = subscription.billing_cycle === 'annual' 
            ? subscription.plan.annual_price 
            : subscription.plan.monthly_price;

          const daysUntilRenewal = Math.ceil(
            (new Date(subscription.current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          await this.sendRenewalReminderNotification({
            subscription,
            organization: subscription.organization,
            daysUntilRenewal,
            amount
          });

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
}
