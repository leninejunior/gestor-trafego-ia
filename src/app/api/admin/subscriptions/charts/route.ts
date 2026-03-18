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
    const period = parseInt(searchParams.get('period') || '90'); // days

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get all necessary data
    const [
      { data: subscriptions },
      { data: invoices },
      { data: plans }
    ] = await Promise.all([
      // All subscriptions with plan and organization info
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
      
      // All invoices in period
      supabase
        .from('subscription_invoices')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      
      // All active plans
      supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
    ]);

    if (!subscriptions || !invoices || !plans) {
      throw new Error('Failed to fetch chart data');
    }

    // Generate revenue trend data (daily)
    const revenueTrend = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Get invoices for this date
      const dayInvoices = invoices.filter(invoice => 
        invoice.created_at.startsWith(dateStr) && invoice.status === 'paid'
      );
      
      // Get subscriptions created on this date
      const daySubscriptions = subscriptions.filter(sub => 
        sub.created_at.startsWith(dateStr)
      );
      
      revenueTrend.push({
        date: dateStr,
        revenue: dayInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        subscriptions: daySubscriptions.length
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Plan revenue distribution
    const planRevenue = plans.map(plan => {
      const planSubscriptions = subscriptions.filter(sub => 
        sub.plan_id === plan.id && sub.status === 'active'
      );
      
      const revenue = planSubscriptions.reduce((sum, sub) => {
        const price = sub.billing_cycle === 'annual' ? plan.annual_price : plan.monthly_price;
        return sum + price;
      }, 0);
      
      return {
        plan_name: plan.name,
        revenue,
        count: planSubscriptions.length
      };
    }).filter(item => item.count > 0);

    // Status distribution
    const statusCounts = subscriptions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalSubscriptions = subscriptions.length;
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count: count as number,
      percentage: Math.round(((count as number) / totalSubscriptions) * 100)
    }));

    // Billing cycle revenue
    const billingCycleRevenue = ['monthly', 'annual'].map(cycle => {
      const cycleSubscriptions = subscriptions.filter(sub => 
        sub.billing_cycle === cycle && sub.status === 'active'
      );
      
      const revenue = cycleSubscriptions.reduce((sum, sub) => {
        const plan = sub.subscription_plans;
        if (!plan) return sum;
        
        const price = cycle === 'annual' ? plan.annual_price : plan.monthly_price;
        return sum + price;
      }, 0);
      
      return {
        cycle,
        revenue,
        count: cycleSubscriptions.length
      };
    });

    // Churn trend (weekly aggregation for better visualization)
    const churnTrend = [];
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7)); // Start from Monday
    
    while (weekStart <= endDate) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      
      // Get subscriptions created and canceled in this week
      const weekNewSubs = subscriptions.filter(sub => 
        sub.created_at >= weekStart.toISOString() && 
        sub.created_at <= weekEnd.toISOString()
      );
      
      const weekCanceledSubs = subscriptions.filter(sub => 
        sub.status === 'canceled' &&
        sub.updated_at >= weekStart.toISOString() && 
        sub.updated_at <= weekEnd.toISOString()
      );
      
      // Calculate churn rate for this week
      const totalAtWeekStart = subscriptions.filter(sub => 
        new Date(sub.created_at) <= weekStart
      ).length;
      
      const churnRate = totalAtWeekStart > 0 
        ? (weekCanceledSubs.length / totalAtWeekStart) * 100 
        : 0;
      
      churnTrend.push({
        date: weekStartStr,
        churn_rate: Math.round(churnRate * 100) / 100,
        new_subscriptions: weekNewSubs.length,
        canceled_subscriptions: weekCanceledSubs.length
      });
      
      weekStart.setDate(weekStart.getDate() + 7);
    }

    const chartData = {
      revenue_trend: revenueTrend,
      plan_revenue: planRevenue,
      status_distribution: statusDistribution,
      billing_cycle_revenue: billingCycleRevenue,
      churn_trend: churnTrend,
      period_days: period,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      generated_at: new Date().toISOString()
    };

    return NextResponse.json(chartData);

  } catch (error) {
    console.error('Admin subscription charts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}