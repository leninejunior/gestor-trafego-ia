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
    const months = parseInt(searchParams.get('months') || '12');

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
      case 'ytd':
        startDate = new Date(new Date().getFullYear(), 0, 1);
        endDate = new Date();
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
      revenueMetrics,
      mrrTrend,
      subscriptionMetrics
    ] = await Promise.all([
      analyticsService.getRevenueMetrics(endDate),
      analyticsService.getMRRTrend(months),
      analyticsService.getSubscriptionMetrics(endDate)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: period
        },
        revenue: revenueMetrics,
        trends: {
          mrr: mrrTrend
        },
        summary: {
          mrr: subscriptionMetrics.mrr,
          arr: subscriptionMetrics.arr,
          totalRevenue: revenueMetrics.totalRevenue,
          averageRevenuePerUser: revenueMetrics.averageRevenuePerUser,
          mrrGrowth: revenueMetrics.mrrGrowth
        }
      }
    });

  } catch (error) {
    console.error('Revenue analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue analytics' },
      { status: 500 }
    );
  }
}