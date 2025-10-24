import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionAnalyticsService } from '@/lib/services/subscription-analytics';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error } = await requireAdminAuth(request);
    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'current';
    const includeSegmentation = searchParams.get('includeSegmentation') === 'true';

    const analyticsService = new SubscriptionAnalyticsService();

    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'current':
        startDate = startOfMonth(new Date());
        endDate = endOfMonth(new Date());
        break;
      case 'previous':
        startDate = startOfMonth(subMonths(new Date(), 1));
        endDate = endOfMonth(subMonths(new Date(), 1));
        break;
      case 'last3months':
        startDate = startOfMonth(subMonths(new Date(), 3));
        endDate = endOfMonth(new Date());
        break;
      case 'last6months':
        startDate = startOfMonth(subMonths(new Date(), 6));
        endDate = endOfMonth(new Date());
        break;
      case 'last12months':
        startDate = startOfMonth(subMonths(new Date(), 12));
        endDate = endOfMonth(new Date());
        break;
      case 'custom':
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        if (!start || !end) {
          return NextResponse.json(
            { error: 'Start and end dates required for custom period' },
            { status: 400 }
          );
        }
        startDate = new Date(start);
        endDate = new Date(end);
        break;
      default:
        startDate = startOfMonth(new Date());
        endDate = endOfMonth(new Date());
    }

    const [
      customerMetrics,
      revenueMetrics
    ] = await Promise.all([
      analyticsService.getCustomerMetrics(startDate, endDate),
      analyticsService.getRevenueMetrics(endDate)
    ]);

    const response: any = {
      success: true,
      data: {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: period
        },
        customers: customerMetrics,
        revenue: {
          averageRevenuePerUser: revenueMetrics.averageRevenuePerUser,
          customerLifetimeValue: customerMetrics.averageLifetimeValue
        },
        summary: {
          totalCustomers: customerMetrics.totalCustomers,
          newCustomers: customerMetrics.newCustomers,
          churnedCustomers: customerMetrics.churnedCustomers,
          netCustomerGrowth: customerMetrics.newCustomers - customerMetrics.churnedCustomers,
          averageSubscriptionLength: customerMetrics.averageSubscriptionLength,
          lifetimeValue: customerMetrics.averageLifetimeValue
        }
      }
    };

    // Add customer segmentation if requested
    if (includeSegmentation) {
      try {
        // Get customer segmentation by plan
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();

        const { data: planSegmentation, error } = await supabase
          .from('subscriptions')
          .select(`
            subscription_plans!inner(name, monthly_price),
            status
          `)
          .eq('status', 'active');

        if (!error && planSegmentation) {
          const segmentation = planSegmentation.reduce((acc: any, sub: any) => {
            const planName = sub.subscription_plans.name;
            if (!acc[planName]) {
              acc[planName] = {
                count: 0,
                revenue: 0,
                planPrice: sub.subscription_plans.monthly_price
              };
            }
            acc[planName].count++;
            acc[planName].revenue += sub.subscription_plans.monthly_price;
            return acc;
          }, {});

          response.data.segmentation = {
            byPlan: Object.entries(segmentation).map(([plan, data]: [string, any]) => ({
              plan,
              customers: data.count,
              monthlyRevenue: data.revenue,
              averageRevenue: data.count > 0 ? data.revenue / data.count : 0
            }))
          };
        }
      } catch (segmentationError) {
        console.error('Customer segmentation error:', segmentationError);
        // Continue without segmentation data
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Customer analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer analytics' },
      { status: 500 }
    );
  }
}