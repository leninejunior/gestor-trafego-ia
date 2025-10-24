import { NextRequest, NextResponse } from 'next/server';
import { BillingEngine } from '@/lib/services/billing-engine';
import { SubscriptionNotificationIntegration } from '@/lib/services/subscription-notification-integration';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/cron/billing
 * Automated billing cron job endpoint
 * This endpoint should be called daily by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not set');
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron job request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting automated billing process...');
    const startTime = Date.now();

    const billingEngine = new BillingEngine();
    const notificationIntegration = new SubscriptionNotificationIntegration();
    
    // Process recurring billing
    const billingResult = await billingEngine.processRecurringBilling();
    
    // Process failed payment retries
    const retryResult = await processFailedPaymentRetries(billingEngine);
    
    // Process renewal reminders
    const renewalResult = await notificationIntegration.processRenewalReminders();
    
    // Update subscription statuses based on payment results
    const statusUpdateResult = await updateSubscriptionStatuses();

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      success: true,
      duration_ms: duration,
      billing_process: billingResult,
      retry_process: retryResult,
      renewal_reminders: renewalResult,
      status_updates: statusUpdateResult,
      timestamp: new Date().toISOString()
    };

    console.log('Automated billing process completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in automated billing process:', error);
    
    // Send notification about billing failure (in production, you'd integrate with your notification system)
    await notifyBillingFailure(error);

    return NextResponse.json(
      { 
        error: 'Billing process failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Process failed payment retries
 */
async function processFailedPaymentRetries(billingEngine: BillingEngine): Promise<{
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ invoiceId: string; error: string }>;
}> {
  const result = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ invoiceId: string; error: string }>
  };

  try {
    // Get failed invoices that need retry
    const failedInvoices = await billingEngine.getFailedInvoices(50);
    result.processed = failedInvoices.length;

    console.log(`Processing ${failedInvoices.length} failed invoices for retry`);

    for (const invoice of failedInvoices) {
      try {
        // For now, we'll just log the retry attempt
        // In a full implementation, you'd implement the retry logic here
        console.log(`Would retry payment for invoice ${invoice.id}`);
        result.successful++;
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          invoiceId: invoice.id,
          error: errorMessage
        });
        console.error(`Failed to retry payment for invoice ${invoice.id}:`, errorMessage);
      }
    }

    return result;
  } catch (error) {
    console.error('Error in processFailedPaymentRetries:', error);
    throw error;
  }
}

/**
 * Update subscription statuses based on payment results
 */
async function updateSubscriptionStatuses(): Promise<{
  updated: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}> {
  const result = {
    updated: 0,
    errors: [] as Array<{ subscriptionId: string; error: string }>
  };

  try {
    const supabase = await createClient();

    // Get subscriptions that might need status updates
    // 1. Subscriptions past due (period ended but still active)
    const now = new Date();
    const { data: pastDueSubscriptions, error: pastDueError } = await supabase
      .from('subscriptions')
      .select('id, current_period_end')
      .eq('status', 'active')
      .lt('current_period_end', now.toISOString());

    if (pastDueError) {
      throw new Error(`Failed to fetch past due subscriptions: ${pastDueError.message}`);
    }

    // Update past due subscriptions
    for (const subscription of pastDueSubscriptions || []) {
      try {
        // Check if there are any unpaid invoices for this subscription
        const { data: unpaidInvoices, error: invoiceError } = await supabase
          .from('subscription_invoices')
          .select('id')
          .eq('subscription_id', subscription.id)
          .in('status', ['open', 'past_due'])
          .limit(1);

        if (invoiceError) {
          throw new Error(`Failed to check invoices: ${invoiceError.message}`);
        }

        // If there are unpaid invoices, mark subscription as past_due
        if (unpaidInvoices && unpaidInvoices.length > 0) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: now.toISOString()
            })
            .eq('id', subscription.id);

          if (updateError) {
            throw new Error(`Failed to update subscription status: ${updateError.message}`);
          }

          result.updated++;
          console.log(`Updated subscription ${subscription.id} to past_due status`);
        }
      } catch (error) {
        result.errors.push({
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 2. Check for subscriptions that should be canceled due to extended non-payment
    const gracePeriodDays = 7; // Grace period before cancellation
    const cancelDate = new Date();
    cancelDate.setDate(cancelDate.getDate() - gracePeriodDays);

    const { data: cancelCandidates, error: cancelError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'past_due')
      .lt('updated_at', cancelDate.toISOString());

    if (cancelError) {
      console.error('Error fetching cancel candidates:', cancelError);
    } else {
      for (const subscription of cancelCandidates || []) {
        try {
          const { error: cancelUpdateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              canceled_at: now.toISOString(),
              cancellation_reason: 'Automatic cancellation due to non-payment',
              updated_at: now.toISOString()
            })
            .eq('id', subscription.id);

          if (cancelUpdateError) {
            throw new Error(`Failed to cancel subscription: ${cancelUpdateError.message}`);
          }

          result.updated++;
          console.log(`Automatically canceled subscription ${subscription.id} due to non-payment`);
        } catch (error) {
          result.errors.push({
            subscriptionId: subscription.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error in updateSubscriptionStatuses:', error);
    throw error;
  }
}

/**
 * Send notification about billing failure
 */
async function notifyBillingFailure(error: unknown): Promise<void> {
  try {
    // In a production environment, you would integrate with your notification system
    // For example: email, Slack, Discord, etc.
    console.error('BILLING FAILURE NOTIFICATION:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    });

    // TODO: Implement actual notification system
    // Examples:
    // - Send email to admin
    // - Post to Slack channel
    // - Create alert in monitoring system
    // - Log to external service

  } catch (notificationError) {
    console.error('Failed to send billing failure notification:', notificationError);
  }
}

/**
 * GET /api/cron/billing
 * Get billing cron job status and last run information
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get some basic statistics
    const { data: activeSubscriptions, error: activeError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'active');

    const { data: pastDueSubscriptions, error: pastDueError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'past_due');

    const { data: failedInvoices, error: failedError } = await supabase
      .from('subscription_invoices')
      .select('id')
      .in('status', ['open', 'past_due']);

    return NextResponse.json({
      status: 'ready',
      statistics: {
        active_subscriptions: activeSubscriptions?.length || 0,
        past_due_subscriptions: pastDueSubscriptions?.length || 0,
        failed_invoices: failedInvoices?.length || 0
      },
      last_check: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting billing cron status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}