import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error } = await requireAdminAuth(request);
    if (error) {
      return error;
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get subscription analytics
    const [
      { data: subscriptions },
      { data: invoices },
      { data: organizations },
      { data: plans }
    ] = await Promise.all([
      // All subscriptions with plan info
      supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans!subscriptions_plan_id_fkey (
            name,
            monthly_price,
            annual_price
          ),
          organizations!subscriptions_organization_id_fkey (
            name
          )
        `),
      
      // Paid invoices in period
      supabase
        .from('subscription_invoices')
        .select('*')
        .eq('status', 'paid')
        .gte('paid_at', startDate.toISOString())
        .lte('paid_at', endDate.toISOString()),
      
      // Total organizations
      supabase
        .from('organizations')
        .select('id, created_at'),
      
      // All plans
      supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
    ]);

    if (!subscriptions || !invoices || !organizations || !plans) {
      throw new Error('Failed to fetch analytics data');
    }

    // Calculate MRR (Monthly Recurring Revenue)
    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
    const mrr = activeSubscriptions.reduce((total, sub) => {
      const plan = sub.subscription_plans;
      if (!plan) return total;
      
      const monthlyPrice = sub.billing_cycle === 'annual' 
        ? plan.annual_price / 12 
        : plan.monthly_price;
      
      return total + monthlyPrice;
    }, 0);

    // Calculate ARR (Annual Recurring Revenue)
    const arr = mrr * 12;

    // Calculate churn rate
    const totalSubscriptions = subscriptions.length;
    const canceledSubscriptions = subscriptions.filter(sub => sub.status === 'canceled').length;
    const churnRate = totalSubscriptions > 0 ? (canceledSubscriptions / totalSubscriptions) * 100 : 0;

    // Calculate conversion rate (organizations with subscriptions vs total)
    const subscriptionCount = subscriptions.length;
    const organizationCount = organizations.length;
    const conversionRate = organizationCount > 0 ? (subscriptionCount / organizationCount) * 100 : 0;

    // Revenue in period
    const periodRevenue = invoices.reduce((total, invoice) => total + invoice.amount, 0);

    // Subscription status breakdown
    const statusBreakdown = subscriptions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Plan distribution
    const planDistribution = activeSubscriptions.reduce((acc, sub) => {
      const planName = sub.subscription_plans?.name || 'Unknown';
      acc[planName] = (acc[planName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Billing cycle distribution
    const billingCycleDistribution = activeSubscriptions.reduce((acc, sub) => {
      acc[sub.billing_cycle] = (acc[sub.billing_cycle] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent subscriptions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSubscriptions = subscriptions
      .filter(sub => new Date(sub.created_at) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    // Calculate Customer Lifetime Value (simplified)
    const avgMonthlyRevenue = mrr / Math.max(activeSubscriptions.length, 1);
    const avgCustomerLifespan = 24; // months (assumption)
    const clv = avgMonthlyRevenue * avgCustomerLifespan;

    const analytics = {
      // Core metrics
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      active_subscriptions: activeSubscriptions.length,
      total_subscriptions: totalSubscriptions,
      churn_rate: Math.round(churnRate * 100) / 100,
      conversion_rate: Math.round(conversionRate * 100) / 100,
      period_revenue: Math.round(periodRevenue * 100) / 100,
      customer_lifetime_value: Math.round(clv * 100) / 100,
      
      // Breakdowns
      status_breakdown: statusBreakdown,
      plan_distribution: planDistribution,
      billing_cycle_distribution: billingCycleDistribution,
      
      // Recent activity
      recent_subscriptions: recentSubscriptions.map(sub => ({
        id: sub.id,
        organization_name: sub.organizations?.name || 'Unknown',
        plan_name: sub.subscription_plans?.name || 'Unknown',
        status: sub.status,
        billing_cycle: sub.billing_cycle,
        created_at: sub.created_at
      })),
      
      // Period info
      period_days: parseInt(period),
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      generated_at: new Date().toISOString()
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Admin subscription analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    );
  }
}