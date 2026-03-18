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
    const trendMonths = parseInt(searchParams.get('trendMonths') || '6');

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
      default:
        startDate = startOfMonth(new Date());
        endDate = endOfMonth(new Date());
    }

    // Fetch all analytics data in parallel
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
      analyticsService.getMRRTrend(trendMonths),
      analyticsService.getSubscriptionDistribution(),
      analyticsService.calculateChurnRate(startDate, endDate),
      analyticsService.getConversionMetrics(startDate, endDate)
    ]);

    // Calculate key performance indicators
    const kpis = {
      mrr: {
        current: revenueMetrics.currentMrr,
        previous: revenueMetrics.previousMrr,
        growth: revenueMetrics.mrrGrowth,
        trend: revenueMetrics.mrrGrowth > 0 ? 'up' : revenueMetrics.mrrGrowth < 0 ? 'down' : 'stable'
      },
      arr: {
        current: revenueMetrics.arr,
        growth: revenueMetrics.mrrGrowth // ARR growth follows MRR growth
      },
      customers: {
        total: customerMetrics.totalCustomers,
        new: customerMetrics.newCustomers,
        churned: customerMetrics.churnedCustomers,
        netGrowth: customerMetrics.newCustomers - customerMetrics.churnedCustomers
      },
      churn: {
        rate: churnRate,
        trend: churnRate < 5 ? 'good' : churnRate < 10 ? 'warning' : 'critical'
      },
      conversion: {
        trialToSubscription: conversionMetrics.trialToSubscription,
        trend: conversionMetrics.trialToSubscription > 20 ? 'good' : 
               conversionMetrics.trialToSubscription > 10 ? 'warning' : 'critical'
      },
      ltv: {
        value: customerMetrics.averageLifetimeValue,
        arpu: revenueMetrics.averageRevenuePerUser,
        ratio: revenueMetrics.averageRevenuePerUser > 0 ? 
               customerMetrics.averageLifetimeValue / revenueMetrics.averageRevenuePerUser : 0
      }
    };

    // Health score calculation (0-100)
    let healthScore = 0;
    
    // MRR Growth (25 points)
    if (revenueMetrics.mrrGrowth > 10) healthScore += 25;
    else if (revenueMetrics.mrrGrowth > 5) healthScore += 20;
    else if (revenueMetrics.mrrGrowth > 0) healthScore += 15;
    else if (revenueMetrics.mrrGrowth > -5) healthScore += 10;
    
    // Churn Rate (25 points)
    if (churnRate < 2) healthScore += 25;
    else if (churnRate < 5) healthScore += 20;
    else if (churnRate < 10) healthScore += 15;
    else if (churnRate < 15) healthScore += 10;
    
    // Conversion Rate (25 points)
    if (conversionMetrics.trialToSubscription > 25) healthScore += 25;
    else if (conversionMetrics.trialToSubscription > 20) healthScore += 20;
    else if (conversionMetrics.trialToSubscription > 15) healthScore += 15;
    else if (conversionMetrics.trialToSubscription > 10) healthScore += 10;
    
    // Customer Growth (25 points)
    const customerGrowthRate = customerMetrics.totalCustomers > 0 ? 
      (customerMetrics.newCustomers / customerMetrics.totalCustomers) * 100 : 0;
    if (customerGrowthRate > 10) healthScore += 25;
    else if (customerGrowthRate > 5) healthScore += 20;
    else if (customerGrowthRate > 2) healthScore += 15;
    else if (customerGrowthRate > 0) healthScore += 10;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: period
        },
        kpis,
        healthScore,
        metrics: {
          subscription: subscriptionMetrics,
          revenue: revenueMetrics,
          customer: customerMetrics,
          conversion: conversionMetrics
        },
        charts: {
          mrrTrend,
          subscriptionDistribution
        },
        summary: {
          totalRevenue: revenueMetrics.totalRevenue,
          activeSubscriptions: subscriptionMetrics.activeSubscriptions,
          averageRevenuePerUser: revenueMetrics.averageRevenuePerUser,
          customerLifetimeValue: customerMetrics.averageLifetimeValue,
          churnRate,
          conversionRate: conversionMetrics.trialToSubscription
        }
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard analytics' },
      { status: 500 }
    );
  }
}