import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionAnalyticsService } from '@/lib/services/subscription-analytics';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error } = await requireAdminAuth(request);
    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12');
    const metrics = searchParams.get('metrics')?.split(',') || ['mrr', 'customers', 'churn'];

    const analyticsService = new SubscriptionAnalyticsService();
    const trends: any = {};

    // Generate MRR trend if requested
    if (metrics.includes('mrr')) {
      trends.mrr = await analyticsService.getMRRTrend(months);
    }

    // Generate customer trends if requested
    if (metrics.includes('customers')) {
      const customerTrends = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const date = subMonths(currentDate, i);
        const startDate = startOfMonth(date);
        const endDate = endOfMonth(date);

        try {
          const customerMetrics = await analyticsService.getCustomerMetrics(startDate, endDate);
          customerTrends.push({
            month: format(date, 'MMM yyyy'),
            totalCustomers: customerMetrics.totalCustomers,
            newCustomers: customerMetrics.newCustomers,
            churnedCustomers: customerMetrics.churnedCustomers,
            netGrowth: customerMetrics.newCustomers - customerMetrics.churnedCustomers
          });
        } catch (error) {
          console.error(`Error calculating customer metrics for ${format(date, 'MMM yyyy')}:`, error);
          customerTrends.push({
            month: format(date, 'MMM yyyy'),
            totalCustomers: 0,
            newCustomers: 0,
            churnedCustomers: 0,
            netGrowth: 0
          });
        }
      }

      trends.customers = customerTrends;
    }

    // Generate churn trends if requested
    if (metrics.includes('churn')) {
      const churnTrends = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const date = subMonths(currentDate, i);
        const startDate = startOfMonth(date);
        const endDate = endOfMonth(date);

        try {
          const churnRate = await analyticsService.calculateChurnRate(startDate, endDate);
          churnTrends.push({
            month: format(date, 'MMM yyyy'),
            churnRate
          });
        } catch (error) {
          console.error(`Error calculating churn rate for ${format(date, 'MMM yyyy')}:`, error);
          churnTrends.push({
            month: format(date, 'MMM yyyy'),
            churnRate: 0
          });
        }
      }

      trends.churn = churnTrends;
    }

    // Generate conversion trends if requested
    if (metrics.includes('conversion')) {
      const conversionTrends = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const date = subMonths(currentDate, i);
        const startDate = startOfMonth(date);
        const endDate = endOfMonth(date);

        try {
          const conversionRate = await analyticsService.calculateConversionRate(startDate, endDate);
          conversionTrends.push({
            month: format(date, 'MMM yyyy'),
            conversionRate
          });
        } catch (error) {
          console.error(`Error calculating conversion rate for ${format(date, 'MMM yyyy')}:`, error);
          conversionTrends.push({
            month: format(date, 'MMM yyyy'),
            conversionRate: 0
          });
        }
      }

      trends.conversion = conversionTrends;
    }

    // Generate revenue trends if requested
    if (metrics.includes('revenue')) {
      const revenueTrends = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const date = subMonths(currentDate, i);

        try {
          const revenueMetrics = await analyticsService.getRevenueMetrics(date);
          revenueTrends.push({
            month: format(date, 'MMM yyyy'),
            mrr: revenueMetrics.currentMrr,
            arr: revenueMetrics.arr,
            arpu: revenueMetrics.averageRevenuePerUser
          });
        } catch (error) {
          console.error(`Error calculating revenue metrics for ${format(date, 'MMM yyyy')}:`, error);
          revenueTrends.push({
            month: format(date, 'MMM yyyy'),
            mrr: 0,
            arr: 0,
            arpu: 0
          });
        }
      }

      trends.revenue = revenueTrends;
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          months,
          requestedMetrics: metrics
        },
        trends
      }
    });

  } catch (error) {
    console.error('Trends analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends analytics' },
      { status: 500 }
    );
  }
}