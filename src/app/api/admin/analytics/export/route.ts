import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionAnalyticsService } from '@/lib/services/subscription-analytics';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const { user, error } = await requireAdminAuth(request);
    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'csv';
    const period = searchParams.get('period') || 'last12months';
    const includeDetails = searchParams.get('includeDetails') === 'true';

    const analyticsService = new SubscriptionAnalyticsService();

    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'current':
        startDate = startOfMonth(new Date());
        endDate = endOfMonth(new Date());
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
        startDate = startOfMonth(subMonths(new Date(), 12));
        endDate = endOfMonth(new Date());
    }

    // Fetch comprehensive analytics data
    const [
      subscriptionMetrics,
      revenueMetrics,
      customerMetrics,
      mrrTrend,
      subscriptionDistribution,
      churnRate,
      conversionMetrics
    ] = await Promise.all([
      analyticsService.getSubscriptionMetrics(endDate),
      analyticsService.getRevenueMetrics(endDate),
      analyticsService.getCustomerMetrics(startDate, endDate),
      analyticsService.getMRRTrend(12),
      analyticsService.getSubscriptionDistribution(),
      analyticsService.calculateChurnRate(startDate, endDate),
      analyticsService.getConversionMetrics(startDate, endDate)
    ]);

    const exportData = {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        type: period
      },
      summary: {
        mrr: revenueMetrics.currentMrr,
        arr: revenueMetrics.arr,
        totalRevenue: revenueMetrics.totalRevenue,
        activeSubscriptions: subscriptionMetrics.activeSubscriptions,
        totalCustomers: customerMetrics.totalCustomers,
        churnRate,
        conversionRate: conversionMetrics.trialToSubscription,
        customerLifetimeValue: customerMetrics.averageLifetimeValue,
        averageRevenuePerUser: revenueMetrics.averageRevenuePerUser
      }
    };

    if (includeDetails) {
      Object.assign(exportData, {
        metrics: {
          subscription: subscriptionMetrics,
          revenue: revenueMetrics,
          customer: customerMetrics,
          conversion: conversionMetrics
        },
        trends: {
          mrr: mrrTrend
        },
        distribution: subscriptionDistribution
      });
    }

    if (exportType === 'csv') {
      // Generate CSV format
      const csvHeaders = [
        'Metric',
        'Value',
        'Period',
        'Generated At'
      ];

      const csvRows = [
        ['MRR', revenueMetrics.currentMrr.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['ARR', revenueMetrics.arr.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['Total Revenue', revenueMetrics.totalRevenue.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['Active Subscriptions', subscriptionMetrics.activeSubscriptions.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['Total Customers', customerMetrics.totalCustomers.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['Churn Rate (%)', churnRate.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['Conversion Rate (%)', conversionMetrics.trialToSubscription.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['Customer LTV', customerMetrics.averageLifetimeValue.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()],
        ['ARPU', revenueMetrics.averageRevenuePerUser.toString(), `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`, new Date().toISOString()]
      ];

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="subscription-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv"`
        }
      });
    }

    // Default to JSON export
    return NextResponse.json({
      success: true,
      data: exportData
    }, {
      headers: {
        'Content-Disposition': `attachment; filename="subscription-analytics-${format(new Date(), 'yyyy-MM-dd')}.json"`
      }
    });

  } catch (error) {
    console.error('Export analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to export analytics data' },
      { status: 500 }
    );
  }
}