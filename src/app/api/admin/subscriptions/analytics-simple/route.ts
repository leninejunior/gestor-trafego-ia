import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[Analytics Simple] Request received');
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30';

    // Return mock data
    const mockAnalytics = {
      mrr: 0,
      arr: 0,
      active_subscriptions: 0,
      total_subscriptions: 0,
      churn_rate: 0,
      conversion_rate: 0,
      period_revenue: 0,
      customer_lifetime_value: 0,
      status_breakdown: {},
      plan_distribution: {},
      billing_cycle_distribution: {},
      recent_subscriptions: [],
      period_days: parseInt(period),
      period_start: new Date().toISOString(),
      period_end: new Date().toISOString(),
      generated_at: new Date().toISOString()
    };

    console.log('[Analytics Simple] Returning mock data');
    return NextResponse.json(mockAnalytics);

  } catch (error) {
    console.error('[Analytics Simple] ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
