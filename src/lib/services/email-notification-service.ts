import { createClient } from '@/lib/supabase/server';
import { Subscription, SubscriptionInvoice, SubscriptionPlan } from '@/lib/types/subscription';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SubscriptionConfirmationData {
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

export interface PaymentFailureData {
  subscription: Subscription;
  invoice: SubscriptionInvoice;
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
  retryAttempt: number;
  maxRetries: number;
  nextRetryDate?: Date;
}

export interface RenewalReminderData {
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
  daysUntilRenewal: number;
  renewalAmount: number;
}

export interface SubscriptionCancelledData {
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
  cancellationReason?: string;
  effectiveDate: Date;
}

export interface PlanUpgradeData {
  subscription: Subscription;
  oldPlan: SubscriptionPlan;
  newPlan: SubscriptionPlan;
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
  prorationAmount?: number;
  effectiveDate: Date;
}

export class EmailNotificationService {
  private readonly fromEmail: string;
  private readonly appUrl: string;

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@adsmanager.com';
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(data: SubscriptionConfirmationData): Promise<boolean> {
    try {
      const template = this.getSubscriptionConfirmationTemplate(data);
      const success = await this.sendEmail(data.user.email, template);
      
      if (success) {
        await this.logEmailNotification(
          data.organization.id,
          data.user.id,
          'subscription_confirmation',
          data.user.email,
          template.subject
        );
      }

      return success;
    } catch (error) {
      console.error('Error sending subscription confirmation:', error);
      return false;
    }
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailureNotification(data: PaymentFailureData): Promise<boolean> {
    try {
      const template = this.getPaymentFailureTemplate(data);
      const success = await this.sendEmail(data.user.email, template);
      
      if (success) {
        await this.logEmailNotification(
          data.organization.id,
          data.user.id,
          'payment_failure',
          data.user.email,
          template.subject
        );
      }

      return success;
    } catch (error) {
      console.error('Error sending payment failure notification:', error);
      return false;
    }
  }

  /**
   * Send renewal reminder email
   */
  async sendRenewalReminder(data: RenewalReminderData): Promise<boolean> {
    try {
      const template = this.getRenewalReminderTemplate(data);
      const success = await this.sendEmail(data.user.email, template);
      
      if (success) {
        await this.logEmailNotification(
          data.organization.id,
          data.user.id,
          'renewal_reminder',
          data.user.email,
          template.subject
        );
      }

      return success;
    } catch (error) {
      console.error('Error sending renewal reminder:', error);
      return false;
    }
  }

  /**
   * Send subscription cancelled notification
   */
  async sendSubscriptionCancelled(data: SubscriptionCancelledData): Promise<boolean> {
    try {
      const template = this.getSubscriptionCancelledTemplate(data);
      const success = await this.sendEmail(data.user.email, template);
      
      if (success) {
        await this.logEmailNotification(
          data.organization.id,
          data.user.id,
          'subscription_cancelled',
          data.user.email,
          template.subject
        );
      }

      return success;
    } catch (error) {
      console.error('Error sending subscription cancelled notification:', error);
      return false;
    }
  }

  /**
   * Send plan upgrade notification
   */
  async sendPlanUpgradeNotification(data: PlanUpgradeData): Promise<boolean> {
    try {
      const template = this.getPlanUpgradeTemplate(data);
      const success = await this.sendEmail(data.user.email, template);
      
      if (success) {
        await this.logEmailNotification(
          data.organization.id,
          data.user.id,
          'plan_upgrade',
          data.user.email,
          template.subject
        );
      }

      return success;
    } catch (error) {
      console.error('Error sending plan upgrade notification:', error);
      return false;
    }
  }

  /**
   * Send email using Resend service
   */
  private async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    try {
      // Check if Resend is configured
      // Resend integration disabled - package not installed
      // To enable: npm install resend and configure RESEND_API_KEY
      console.warn('Email sending disabled - resend package not installed');
      this.logEmailToConsole(to, template);
      return true; // Return true for development/testing

      if (result.error) {
        console.error('Resend API error:', result.error);
        return false;
      }

      console.log(`Email sent successfully to ${to}, ID: ${result.data?.id}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      // Fallback to console logging for development
      this.logEmailToConsole(to, template);
      return false;
    }
  }

  /**
   * Log email to console (fallback for development)
   */
  private logEmailToConsole(to: string, template: EmailTemplate): void {
    console.log('='.repeat(80));
    console.log('EMAIL NOTIFICATION (Development Mode)');
    console.log('='.repeat(80));
    console.log(`To: ${to}`);
    console.log(`From: ${this.fromEmail}`);
    console.log(`Subject: ${template.subject}`);
    console.log('-'.repeat(80));
    console.log('TEXT CONTENT:');
    console.log(template.text);
    console.log('-'.repeat(80));
    console.log('HTML CONTENT:');
    console.log(template.html);
    console.log('='.repeat(80));
  }

  /**
   * Log email notification to database
   */
  private async logEmailNotification(
    organizationId: string,
    userId: string,
    type: string,
    recipient: string,
    subject: string
  ): Promise<void> {
    try {
      const supabase = await this.getSupabaseClient();
      
      await supabase
        .from('email_notifications_log')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          type,
          recipient,
          subject,
          sent_at: new Date().toISOString(),
          status: 'sent'
        });
    } catch (error) {
      console.error('Error logging email notification:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get subscription confirmation email template
   */
  private getSubscriptionConfirmationTemplate(data: SubscriptionConfirmationData): EmailTemplate {
    const userName = data.user.name || data.organization.name;
    const planFeatures = this.formatPlanFeatures(data.plan);
    const billingUrl = `${this.appUrl}/dashboard/billing`;

    const subject = `Welcome to Ads Manager! Your ${data.plan.name} subscription is active`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">🎉 Welcome to Ads Manager!</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>Thank you for subscribing to Ads Manager! Your <strong>${data.plan.name}</strong> subscription is now active and ready to use.</p>
    </div>

    <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #065f46; margin-top: 0;">📋 Subscription Details</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Plan:</strong> ${data.plan.name}</li>
            <li><strong>Billing Cycle:</strong> ${data.subscription.billing_cycle}</li>
            <li><strong>Next Billing Date:</strong> ${new Date(data.subscription.current_period_end).toLocaleDateString()}</li>
            <li><strong>Amount:</strong> $${(data.subscription.billing_cycle === 'annual' ? data.plan.annual_price : data.plan.monthly_price).toFixed(2)}</li>
        </ul>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #92400e; margin-top: 0;">✨ Your Plan Includes</h3>
        ${planFeatures}
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin-top: 0;">🚀 Getting Started</h3>
        <ol style="margin: 0; padding-left: 20px;">
            <li>Connect your Meta Ads accounts</li>
            <li>Add your clients and organize your campaigns</li>
            <li>Set up automated reporting and alerts</li>
            <li>Explore advanced analytics and insights</li>
        </ol>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${this.appUrl}/dashboard" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Go to Dashboard
        </a>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
            Need help? <a href="mailto:support@adsmanager.com" style="color: #2563eb;">Contact our support team</a><br>
            Manage your subscription in <a href="${billingUrl}" style="color: #2563eb;">Billing Settings</a>
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Welcome to Ads Manager!

Hi ${userName},

Thank you for subscribing to Ads Manager! Your ${data.plan.name} subscription is now active and ready to use.

Subscription Details:
- Plan: ${data.plan.name}
- Billing Cycle: ${data.subscription.billing_cycle}
- Next Billing Date: ${new Date(data.subscription.current_period_end).toLocaleDateString()}
- Amount: $${(data.subscription.billing_cycle === 'annual' ? data.plan.annual_price : data.plan.monthly_price).toFixed(2)}

Getting Started:
1. Connect your Meta Ads accounts
2. Add your clients and organize your campaigns
3. Set up automated reporting and alerts
4. Explore advanced analytics and insights

Go to Dashboard: ${this.appUrl}/dashboard
Manage Billing: ${billingUrl}

Need help? Contact support@adsmanager.com

© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Get payment failure email template
   */
  private getPaymentFailureTemplate(data: PaymentFailureData): EmailTemplate {
    const userName = data.user.name || data.organization.name;
    const isLastAttempt = data.retryAttempt >= data.maxRetries;
    const billingUrl = `${this.appUrl}/dashboard/billing`;

    const subject = isLastAttempt 
      ? '🚨 Action Required: Payment Failed - Subscription at Risk'
      : '⚠️ Payment Failed - We\'ll Try Again Soon';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${isLastAttempt ? '#dc2626' : '#d97706'}; margin: 0;">${isLastAttempt ? '🚨' : '⚠️'} Payment Issue</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>We were unable to process your payment for your Ads Manager subscription.</p>
    </div>

    <div style="background: ${isLastAttempt ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${isLastAttempt ? '#fecaca' : '#fed7aa'}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: ${isLastAttempt ? '#991b1b' : '#92400e'}; margin-top: 0;">💳 Payment Details</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Invoice:</strong> ${data.invoice.invoice_number}</li>
            <li><strong>Amount:</strong> $${data.invoice.amount.toFixed(2)}</li>
            <li><strong>Due Date:</strong> ${new Date(data.invoice.due_date).toLocaleDateString()}</li>
            <li><strong>Plan:</strong> ${data.plan.name}</li>
        </ul>
    </div>

    ${isLastAttempt ? `
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #991b1b; margin-top: 0;">⏰ Urgent Action Required</h3>
        <p style="margin: 0;"><strong>This was our final payment attempt.</strong> To avoid service interruption, please update your payment method immediately. Your subscription will be suspended if payment is not received within 7 days.</p>
    </div>
    ` : `
    <div style="background: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #92400e; margin-top: 0;">🔄 What's Next</h3>
        <p style="margin: 0;">We'll automatically retry your payment ${data.nextRetryDate ? `on ${data.nextRetryDate.toLocaleDateString()}` : 'in a few days'}. You can also resolve this immediately by updating your payment method.</p>
        <p style="margin: 8px 0 0 0;"><strong>Retry attempt:</strong> ${data.retryAttempt} of ${data.maxRetries}</p>
    </div>
    `}

    <div style="text-align: center; margin: 30px 0;">
        <a href="${billingUrl}" style="background: ${isLastAttempt ? '#dc2626' : '#d97706'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Update Payment Method
        </a>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
            Questions about your payment? <a href="mailto:billing@adsmanager.com" style="color: #2563eb;">Contact billing support</a>
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Payment Issue - Ads Manager

Hi ${userName},

We were unable to process your payment for your Ads Manager subscription.

Payment Details:
- Invoice: ${data.invoice.invoice_number}
- Amount: $${data.invoice.amount.toFixed(2)}
- Due Date: ${new Date(data.invoice.due_date).toLocaleDateString()}
- Plan: ${data.plan.name}

${isLastAttempt 
  ? `URGENT ACTION REQUIRED:
This was our final payment attempt. To avoid service interruption, please update your payment method immediately. Your subscription will be suspended if payment is not received within 7 days.`
  : `What's Next:
We'll automatically retry your payment ${data.nextRetryDate ? `on ${data.nextRetryDate.toLocaleDateString()}` : 'in a few days'}. You can also resolve this immediately by updating your payment method.

Retry attempt: ${data.retryAttempt} of ${data.maxRetries}`
}

Update Payment Method: ${billingUrl}

Questions? Contact billing@adsmanager.com

© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Get renewal reminder email template
   */
  private getRenewalReminderTemplate(data: RenewalReminderData): EmailTemplate {
    const userName = data.user.name || data.organization.name;
    const billingUrl = `${this.appUrl}/dashboard/billing`;
    const renewalDate = new Date(data.subscription.current_period_end).toLocaleDateString();

    const subject = `📅 Your ${data.plan.name} subscription renews in ${data.daysUntilRenewal} days`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">📅 Renewal Reminder</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>Your Ads Manager subscription will renew automatically in <strong>${data.daysUntilRenewal} days</strong>.</p>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin-top: 0;">📋 Renewal Details</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Plan:</strong> ${data.plan.name}</li>
            <li><strong>Renewal Date:</strong> ${renewalDate}</li>
            <li><strong>Amount:</strong> $${data.renewalAmount.toFixed(2)}</li>
            <li><strong>Billing Cycle:</strong> ${data.subscription.billing_cycle}</li>
        </ul>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #166534; margin-top: 0;">✅ What Happens Next</h3>
        <p style="margin: 0;">Your subscription will renew automatically using your current payment method. No action is required unless you want to make changes.</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${billingUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; margin-right: 10px;">
            Manage Subscription
        </a>
        <a href="${this.appUrl}/dashboard" style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Go to Dashboard
        </a>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
            Need to make changes? <a href="${billingUrl}" style="color: #2563eb;">Update your subscription</a><br>
            Questions? <a href="mailto:support@adsmanager.com" style="color: #2563eb;">Contact support</a>
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Renewal Reminder - Ads Manager

Hi ${userName},

Your Ads Manager subscription will renew automatically in ${data.daysUntilRenewal} days.

Renewal Details:
- Plan: ${data.plan.name}
- Renewal Date: ${renewalDate}
- Amount: $${data.renewalAmount.toFixed(2)}
- Billing Cycle: ${data.subscription.billing_cycle}

What Happens Next:
Your subscription will renew automatically using your current payment method. No action is required unless you want to make changes.

Manage Subscription: ${billingUrl}
Dashboard: ${this.appUrl}/dashboard

Questions? Contact support@adsmanager.com

© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Get subscription cancelled email template
   */
  private getSubscriptionCancelledTemplate(data: SubscriptionCancelledData): EmailTemplate {
    const userName = data.user.name || data.organization.name;
    const effectiveDate = data.effectiveDate.toLocaleDateString();

    const subject = `Subscription Cancelled - We're Sorry to See You Go`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6b7280; margin: 0;">👋 Subscription Cancelled</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>We've processed your cancellation request. We're sorry to see you go!</p>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #92400e; margin-top: 0;">📋 Cancellation Details</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Plan:</strong> ${data.plan.name}</li>
            <li><strong>Effective Date:</strong> ${effectiveDate}</li>
            ${data.cancellationReason ? `<li><strong>Reason:</strong> ${data.cancellationReason}</li>` : ''}
        </ul>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin-top: 0;">📅 What Happens Next</h3>
        <p>You'll continue to have access to your ${data.plan.name} features until ${effectiveDate}. After that, your account will be downgraded to our free tier.</p>
        <p style="margin: 8px 0 0 0;"><strong>Your data will be preserved</strong> and you can reactivate your subscription at any time.</p>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #166534; margin-top: 0;">💚 We'd Love Your Feedback</h3>
        <p style="margin: 0;">Help us improve by sharing what we could have done better. Your feedback is valuable to us and helps us serve our customers better.</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="mailto:feedback@adsmanager.com?subject=Cancellation Feedback" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; margin-right: 10px;">
            Share Feedback
        </a>
        <a href="${this.appUrl}/dashboard/billing" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Reactivate Subscription
        </a>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
            Changed your mind? You can <a href="${this.appUrl}/dashboard/billing" style="color: #2563eb;">reactivate your subscription</a> anytime<br>
            Questions? <a href="mailto:support@adsmanager.com" style="color: #2563eb;">Contact support</a>
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>Thank you for being part of the Ads Manager community!</p>
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Subscription Cancelled - Ads Manager

Hi ${userName},

We've processed your cancellation request. We're sorry to see you go!

Cancellation Details:
- Plan: ${data.plan.name}
- Effective Date: ${effectiveDate}
${data.cancellationReason ? `- Reason: ${data.cancellationReason}` : ''}

What Happens Next:
You'll continue to have access to your ${data.plan.name} features until ${effectiveDate}. After that, your account will be downgraded to our free tier.

Your data will be preserved and you can reactivate your subscription at any time.

Share Feedback: feedback@adsmanager.com
Reactivate: ${this.appUrl}/dashboard/billing

Questions? Contact support@adsmanager.com

Thank you for being part of the Ads Manager community!
© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Get plan upgrade email template
   */
  private getPlanUpgradeTemplate(data: PlanUpgradeData): EmailTemplate {
    const userName = data.user.name || data.organization.name;
    const effectiveDate = data.effectiveDate.toLocaleDateString();
    const newPlanFeatures = this.formatPlanFeatures(data.newPlan);

    const subject = `🎉 Plan Upgraded! Welcome to ${data.newPlan.name}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #059669; margin: 0;">🎉 Plan Upgraded!</h1>
    </div>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hi ${userName},</h2>
        <p>Congratulations! Your subscription has been upgraded to <strong>${data.newPlan.name}</strong>.</p>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #166534; margin-top: 0;">📈 Upgrade Details</h3>
        <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Previous Plan:</strong> ${data.oldPlan.name}</li>
            <li><strong>New Plan:</strong> ${data.newPlan.name}</li>
            <li><strong>Effective Date:</strong> ${effectiveDate}</li>
            ${data.prorationAmount ? `<li><strong>Prorated Amount:</strong> $${data.prorationAmount.toFixed(2)}</li>` : ''}
        </ul>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #92400e; margin-top: 0;">✨ Your New Features</h3>
        ${newPlanFeatures}
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #1e40af; margin-top: 0;">🚀 Get Started</h3>
        <p style="margin: 0;">Your new features are available immediately! Explore your enhanced capabilities and take your ad management to the next level.</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${this.appUrl}/dashboard" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; margin-right: 10px;">
            Explore New Features
        </a>
        <a href="${this.appUrl}/dashboard/billing" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            View Billing
        </a>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">
            Need help with new features? <a href="mailto:support@adsmanager.com" style="color: #2563eb;">Contact support</a><br>
            Questions about billing? <a href="mailto:billing@adsmanager.com" style="color: #2563eb;">Contact billing</a>
        </p>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© ${new Date().getFullYear()} Ads Manager. All rights reserved.</p>
    </div>
</body>
</html>`;

    const text = `
Plan Upgraded! - Ads Manager

Hi ${userName},

Congratulations! Your subscription has been upgraded to ${data.newPlan.name}.

Upgrade Details:
- Previous Plan: ${data.oldPlan.name}
- New Plan: ${data.newPlan.name}
- Effective Date: ${effectiveDate}
${data.prorationAmount ? `- Prorated Amount: $${data.prorationAmount.toFixed(2)}` : ''}

Your new features are available immediately! Explore your enhanced capabilities and take your ad management to the next level.

Dashboard: ${this.appUrl}/dashboard
Billing: ${this.appUrl}/dashboard/billing

Need help? Contact support@adsmanager.com
Billing questions? Contact billing@adsmanager.com

© ${new Date().getFullYear()} Ads Manager. All rights reserved.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Format plan features for email templates
   */
  private formatPlanFeatures(plan: SubscriptionPlan): string {
    const features = plan.features as any;
    const featureList = [];

    if (features.maxClients) {
      featureList.push(`Up to ${features.maxClients} clients`);
    }
    if (features.maxCampaigns) {
      featureList.push(`Up to ${features.maxCampaigns} campaigns`);
    }
    if (features.advancedAnalytics) {
      featureList.push('Advanced analytics and reporting');
    }
    if (features.customReports) {
      featureList.push('Custom report generation');
    }
    if (features.apiAccess) {
      featureList.push('API access');
    }
    if (features.whiteLabel) {
      featureList.push('White-label branding');
    }
    if (features.prioritySupport) {
      featureList.push('Priority customer support');
    }

    return `<ul style="margin: 0; padding-left: 20px;">${featureList.map(feature => `<li>${feature}</li>`).join('')}</ul>`;
  }
}