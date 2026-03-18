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
    const includeChurn = searchParams.get('includeChurn') === 'true';
    const includeConversion = searchParams.get('includeConversion') === 'true';

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
      subscriptionMetrics,
      subscriptionDistribution,
      churnRate,
      conversionMetrics
    ] = await Promise.all([
      analyticsService.getSubscriptionMetrics(endDate),
      analyticsService.getSubscriptionDistribution(),
      includeChurn ? analyticsService.calculateChurnRate(startDate, endDate) : null,
      includeConversion ? analyticsService.getConversionMetrics(startDate, endDate) : null
    ]);

    const response: any = {
      success: true,
      data: {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: period
        },
        metrics: subscriptionMetrics,
        distribution: subscriptionDistribution,
        summary: {
          totalSubscriptions: subscriptionMetrics.totalSubscriptions,
          activeSubscriptions: subscriptionMetrics.activeSubscriptions,
          trialSubscriptions: subscriptionMetrics.trialSubscriptions,
          canceledSubscriptions: subscriptionMetrics.canceledSubscriptions,
          customerLifetimeValue: subscriptionMetrics.customerLifetimeValue
        }
      }
    };

    if (includeChurn && churnRate !== null) {
      response.data.churn = {
        rate: churnRate,
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
      };
    }

    if (includeConversion && conversionMetrics) {
      response.data.conversion = conversionMetrics;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Subscription analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    );
  }
}