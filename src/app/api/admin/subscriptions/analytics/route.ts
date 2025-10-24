import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

export async function GET(request: NextRequest) {
  try {
    console.log('[Analytics] Starting request...');
    
    // Check admin authentication
    const { error: authError } = await requireAdminAuth(request);
    if (authError) {
      console.log('[Analytics] Auth error:', authError);
      return authError;
    }

    console.log('[Analytics] Auth passed');

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days

    console.log('[Analytics] Period:', period);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    console.log('[Analytics] Date range:', startDate.toISOString(), 'to', endDate.toISOString());

    console.log('[Analytics] Fetching data from Supabase...');

    // Get subscription analytics - fetch data separately to avoid join issues
    const [
      { data: subscriptions, error: subsError },
      { data: organizations, error: orgsError },
      { data: plans, error: plansError }
    ] = await Promise.all([
      // All subscriptions
      supabase
        .from('subscriptions')
        .select('*'),
      
      // Total organizations
      supabase
        .from('organizations')
        .select('id, name, created_at'),
      
      // All plans
      supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
    ]);

    // TODO: Add invoices table later
    const invoices: any[] = [];
    const invoicesError = null;

    console.log('[Analytics] Data fetched');
    console.log('[Analytics] Subscriptions:', subscriptions?.length || 0);
    console.log('[Analytics] Invoices:', invoices?.length || 0);
    console.log('[Analytics] Organizations:', organizations?.length || 0);
    console.log('[Analytics] Plans:', plans?.length || 0);

    // Check for errors
    if (subsError) {
      console.error('[Analytics] Subscriptions query error:', subsError);
      throw new Error(`Failed to fetch subscriptions: ${subsError.message}`);
    }
    if (invoicesError) {
      console.error('[Analytics] Invoices query error:', invoicesError);
      throw new Error(`Failed to fetch invoices: ${invoicesError.message}`);
    }
    if (orgsError) {
      console.error('[Analytics] Organizations query error:', orgsError);
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }
    if (plansError) {
      console.error('[Analytics] Plans query error:', plansError);
      throw new Error(`Failed to fetch plans: ${plansError.message}`);
    }

    // Ensure data is not null
    const safeSubscriptions = subscriptions || [];
    const safeInvoices = invoices || [];
    const safeOrganizations = organizations || [];
    const safePlans = plans || [];

    console.log('[Analytics] Processing data...');

    // Create lookup maps for efficient joins
    const plansMap = new Map(safePlans.map(p => [p.id, p]));
    const orgsMap = new Map(safeOrganizations.map(o => [o.id, o]));

    // Enrich subscriptions with plan and org data
    const enrichedSubscriptions = safeSubscriptions.map(sub => ({
      ...sub,
      subscription_plans: plansMap.get(sub.plan_id),
      organizations: orgsMap.get(sub.organization_id)
    }));



    // Calculate MRR (Monthly Recurring Revenue)
    const activeSubscriptions = enrichedSubscriptions.filter(sub => sub.status === 'active');
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
    const totalSubscriptions = enrichedSubscriptions.length;
    const canceledSubscriptions = enrichedSubscriptions.filter(sub => sub.status === 'canceled').length;
    const churnRate = totalSubscriptions > 0 ? (canceledSubscriptions / totalSubscriptions) * 100 : 0;

    // Calculate conversion rate (organizations with subscriptions vs total)
    const subscriptionCount = enrichedSubscriptions.length;
    const organizationCount = safeOrganizations.length;
    const conversionRate = organizationCount > 0 ? (subscriptionCount / organizationCount) * 100 : 0;

    // Revenue in period
    const periodRevenue = safeInvoices.reduce((total, invoice) => total + (invoice.amount || 0), 0);

    // Subscription status breakdown
    const statusBreakdown = enrichedSubscriptions.reduce((acc, sub) => {
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
    
    const recentSubscriptions = enrichedSubscriptions
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

    console.log('[Analytics] Returning analytics:', JSON.stringify(analytics, null, 2));

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('[Analytics] ERROR:', error);
    console.error('[Analytics] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { 
        error: 'Failed to fetch subscription analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}