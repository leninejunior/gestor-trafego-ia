import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingEngine } from '@/lib/services/billing-engine';
import { BillingNotificationService } from '@/lib/services/billing-notification-service';

/**
 * POST /api/admin/billing/trigger
 * Manually trigger billing process (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (membershipError || membership?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('Manual billing process triggered by admin:', user.id);
    const startTime = Date.now();

    const billingEngine = new BillingEngine();
    const notificationService = new BillingNotificationService();
    
    // Process recurring billing
    const billingResult = await billingEngine.processRecurringBilling();
    
    // Process renewal reminders
    const reminderResult = await notificationService.processRenewalReminders();

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      success: true,
      duration_ms: duration,
      billing_process: billingResult,
      renewal_reminders: reminderResult,
      triggered_by: user.id,
      timestamp: new Date().toISOString()
    };

    console.log('Manual billing process completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in manual billing trigger:', error);
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
 * GET /api/admin/billing/trigger
 * Get billing process status and statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (membershipError || membership?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get billing statistics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Active subscriptions
    const { data: activeSubscriptions, error: activeError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'active');

    // Past due subscriptions
    const { data: pastDueSubscriptions, error: pastDueError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'past_due');

    // Subscriptions due for billing today
    const { data: dueToday, error: dueTodayError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'active')
      .gte('current_period_end', today.toISOString())
      .lt('current_period_end', tomorrow.toISOString());

    // Failed invoices
    const { data: failedInvoices, error: failedError } = await supabase
      .from('subscription_invoices')
      .select('id')
      .in('status', ['open', 'past_due']);

    // Recent invoices (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: recentInvoices, error: recentError } = await supabase
      .from('subscription_invoices')
      .select('id, status, amount')
      .gte('created_at', weekAgo.toISOString());

    // Calculate revenue from recent paid invoices
    const recentRevenue = recentInvoices
      ?.filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;

    return NextResponse.json({
      statistics: {
        active_subscriptions: activeSubscriptions?.length || 0,
        past_due_subscriptions: pastDueSubscriptions?.length || 0,
        due_for_billing_today: dueToday?.length || 0,
        failed_invoices: failedInvoices?.length || 0,
        recent_invoices: recentInvoices?.length || 0,
        recent_revenue: recentRevenue
      },
      last_check: new Date().toISOString(),
      cron_schedule: '0 2 * * * (Daily at 2:00 AM UTC)'
    });

  } catch (error) {
    console.error('Error getting billing statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}