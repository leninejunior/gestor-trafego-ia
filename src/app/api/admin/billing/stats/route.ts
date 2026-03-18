import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error: authError } = await requireAdminAuth(request);
    if (authError) {
      return authError;
    }

    const supabase = await createClient();

    // Default zeroed stats when billing tables are unavailable
    let stats = {
      totalRevenue: 0,
      monthlyRevenue: 0,
      failedPayments: 0,
      activeSubscriptions: 0,
      revenueGrowth: 0,
      churnRate: 0
    };

    try {
      // Get current date and previous month for comparison
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Try to get real data, but handle gracefully if tables don't exist
      const { data: totalRevenueData } = await supabase
        .from('subscription_invoices')
        .select('amount')
        .eq('status', 'paid');

      if (totalRevenueData) {
        const totalRevenue = totalRevenueData.reduce((sum, invoice) => sum + invoice.amount, 0);

        // Get current month revenue
        const { data: currentMonthData } = await supabase
          .from('subscription_invoices')
          .select('amount')
          .eq('status', 'paid')
          .gte('paid_at', currentMonth.toISOString());

        const monthlyRevenue = currentMonthData?.reduce((sum, invoice) => sum + invoice.amount, 0) || 0;

        // Get previous month revenue for growth calculation
        const { data: previousMonthData } = await supabase
          .from('subscription_invoices')
          .select('amount')
          .eq('status', 'paid')
          .gte('paid_at', previousMonth.toISOString())
          .lt('paid_at', currentMonth.toISOString());

        const previousMonthRevenue = previousMonthData?.reduce((sum, invoice) => sum + invoice.amount, 0) || 0;

        // Calculate revenue growth
        const revenueGrowth = previousMonthRevenue > 0 
          ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
          : 0;

        // Get failed payments count
        const { count: failedPayments } = await supabase
          .from('subscription_invoices')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'uncollectible'])
          .lt('due_date', now.toISOString());

        // Get active subscriptions count
        const { count: activeSubscriptions } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        // Calculate churn rate
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const { count: canceledSubscriptions } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'canceled')
          .gte('updated_at', thirtyDaysAgo.toISOString());

        const { count: totalSubscriptions } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });

        const churnRate = (totalSubscriptions || 0) > 0 
          ? ((canceledSubscriptions || 0) / (totalSubscriptions || 1)) * 100 
          : 0;

        stats = {
          totalRevenue,
          monthlyRevenue,
          failedPayments: failedPayments || 0,
          activeSubscriptions: activeSubscriptions || 0,
          revenueGrowth,
          churnRate
        };
      }
    } catch (dbError) {
      console.log('Database tables not ready, returning empty billing stats');
    }

    return NextResponse.json({
      success: true,
      data: stats,
      message: stats.totalRevenue === 0 ? 'No billing data available yet' : undefined
    });

  } catch (error) {
    console.error('Error fetching billing stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing stats' },
      { status: 500 }
    );
  }
}
