import { createClient } from '@/lib/supabase/server';
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from 'date-fns';

export interface SubscriptionMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  conversionRate: number;
  customerLifetimeValue: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  trialSubscriptions: number;
}

export interface RevenueMetrics {
  currentMrr: number;
  previousMrr: number;
  mrrGrowth: number;
  arr: number;
  totalRevenue: number;
  averageRevenuePerUser: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  averageLifetimeValue: number;
  averageSubscriptionLength: number;
}

export interface ConversionMetrics {
  trialToSubscription: number;
  visitorToTrial: number;
  visitorToSubscription: number;
  upgradeRate: number;
  downgradeRate: number;
}

export class SubscriptionAnalyticsService {
  private async getSupabase() {
    return await createClient();
  }

  /**
   * Calculate Monthly Recurring Revenue (MRR)
   */
  async calculateMRR(date: Date = new Date()): Promise<number> {
    const startDate = startOfMonth(date);
    const endDate = endOfMonth(date);

    const supabase = await this.getSupabase();
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        billing_cycle,
        subscription_plans!inner(monthly_price, annual_price)
      `)
      .eq('status', 'active')
      .lte('created_at', endDate.toISOString())
      .gte('current_period_end', startDate.toISOString());

    if (error) throw error;

    let mrr = 0;
    subscriptions?.forEach((sub: any) => {
      const plan = sub.subscription_plans;
      if (sub.billing_cycle === 'monthly') {
        mrr += plan.monthly_price;
      } else if (sub.billing_cycle === 'annual') {
        // Convert annual to monthly
        mrr += plan.annual_price / 12;
      }
    });

    return mrr;
  }

  /**
   * Calculate Annual Recurring Revenue (ARR)
   */
  async calculateARR(date: Date = new Date()): Promise<number> {
    const mrr = await this.calculateMRR(date);
    return mrr * 12;
  }

  /**
   * Calculate churn rate for a given period
   */
  async calculateChurnRate(startDate: Date, endDate: Date): Promise<number> {
    const supabase = await this.getSupabase();
    
    // Get customers at start of period
    const { data: startCustomers, error: startError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'active')
      .lte('created_at', startDate.toISOString());

    if (startError) throw startError;

    // Get customers who churned during period
    const { data: churnedCustomers, error: churnError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'canceled')
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString());

    if (churnError) throw churnError;

    const startCount = startCustomers?.length || 0;
    const churnedCount = churnedCustomers?.length || 0;

    return startCount > 0 ? (churnedCount / startCount) * 100 : 0;
  }

  /**
   * Calculate conversion rate from trial to paid subscription
   */
  async calculateConversionRate(startDate: Date, endDate: Date): Promise<number> {
    const supabase = await this.getSupabase();
    
    // Get trials that started in period
    const { data: trials, error: trialsError } = await supabase
      .from('subscriptions')
      .select('id, trial_end')
      .not('trial_end', 'is', null)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (trialsError) throw trialsError;

    // Get conversions from those trials
    const { data: conversions, error: conversionsError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'active')
      .not('trial_end', 'is', null)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (conversionsError) throw conversionsError;

    const trialsCount = trials?.length || 0;
    const conversionsCount = conversions?.length || 0;

    return trialsCount > 0 ? (conversionsCount / trialsCount) * 100 : 0;
  }

  /**
   * Calculate Customer Lifetime Value (CLV)
   */
  async calculateCustomerLifetimeValue(): Promise<number> {
    const supabase = await this.getSupabase();
    
    // Get average subscription length and revenue
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        created_at,
        updated_at,
        status,
        billing_cycle,
        subscription_plans!inner(monthly_price, annual_price)
      `)
      .in('status', ['active', 'canceled']);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) return 0;

    let totalRevenue = 0;
    let totalLifetimeDays = 0;
    let customerCount = 0;

    subscriptions.forEach((sub: any) => {
      const plan = sub.subscription_plans;
      const createdAt = new Date(sub.created_at);
      const endAt = sub.status === 'canceled' ? new Date(sub.updated_at) : new Date();
      
      const lifetimeDays = differenceInDays(endAt, createdAt);
      const monthlyRevenue = sub.billing_cycle === 'monthly' 
        ? plan.monthly_price 
        : plan.annual_price / 12;
      
      const customerRevenue = (monthlyRevenue * lifetimeDays) / 30; // Convert to monthly
      
      totalRevenue += customerRevenue;
      totalLifetimeDays += lifetimeDays;
      customerCount++;
    });

    return customerCount > 0 ? totalRevenue / customerCount : 0;
  }

  /**
   * Get comprehensive subscription metrics
   */
  async getSubscriptionMetrics(date: Date = new Date()): Promise<SubscriptionMetrics> {
    const startDate = startOfMonth(date);
    const endDate = endOfMonth(date);
    const previousMonthStart = startOfMonth(subMonths(date, 1));
    const previousMonthEnd = endOfMonth(subMonths(date, 1));

    const [
      mrr,
      arr,
      churnRate,
      conversionRate,
      customerLifetimeValue,
      subscriptionCounts
    ] = await Promise.all([
      this.calculateMRR(date),
      this.calculateARR(date),
      this.calculateChurnRate(previousMonthStart, previousMonthEnd),
      this.calculateConversionRate(startDate, endDate),
      this.calculateCustomerLifetimeValue(),
      this.getSubscriptionCounts()
    ]);

    return {
      mrr,
      arr,
      churnRate,
      conversionRate,
      customerLifetimeValue,
      ...subscriptionCounts
    };
  }

  /**
   * Get subscription counts by status
   */
  async getSubscriptionCounts() {
    const supabase = await this.getSupabase();
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('status');

    if (error) throw error;

    const counts = {
      totalSubscriptions: subscriptions?.length || 0,
      activeSubscriptions: 0,
      canceledSubscriptions: 0,
      trialSubscriptions: 0
    };

    subscriptions?.forEach((sub: any) => {
      switch (sub.status) {
        case 'active':
          counts.activeSubscriptions++;
          break;
        case 'canceled':
          counts.canceledSubscriptions++;
          break;
        case 'trialing':
          counts.trialSubscriptions++;
          break;
      }
    });

    return counts;
  }

  /**
   * Get revenue metrics with growth calculations
   */
  async getRevenueMetrics(date: Date = new Date()): Promise<RevenueMetrics> {
    const currentMrr = await this.calculateMRR(date);
    const previousMrr = await this.calculateMRR(subMonths(date, 1));
    const mrrGrowth = previousMrr > 0 ? ((currentMrr - previousMrr) / previousMrr) * 100 : 0;
    const arr = currentMrr * 12;

    const supabase = await this.getSupabase();
    
    // Calculate total revenue from invoices
    const { data: invoices, error } = await supabase
      .from('subscription_invoices')
      .select('amount')
      .eq('status', 'paid');

    if (error) throw error;

    const totalRevenue = invoices?.reduce((sum: number, invoice: any) => sum + invoice.amount, 0) || 0;
    
    // Get active subscription count for ARPU
    const { data: activeSubscriptions, error: activeError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('status', 'active');

    if (activeError) throw activeError;

    const activeCount = activeSubscriptions?.length || 0;
    const averageRevenuePerUser = activeCount > 0 ? currentMrr / activeCount : 0;

    return {
      currentMrr,
      previousMrr,
      mrrGrowth,
      arr,
      totalRevenue,
      averageRevenuePerUser
    };
  }

  /**
   * Get customer analytics
   */
  async getCustomerMetrics(startDate: Date, endDate: Date): Promise<CustomerMetrics> {
    const supabase = await this.getSupabase();
    
    // Get total customers
    const { data: allCustomers, error: allError } = await supabase
      .from('subscriptions')
      .select('organization_id')
      .lte('created_at', endDate.toISOString());

    if (allError) throw allError;

    // Get new customers in period
    const { data: newCustomers, error: newError } = await supabase
      .from('subscriptions')
      .select('organization_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (newError) throw newError;

    // Get churned customers in period
    const { data: churnedCustomers, error: churnError } = await supabase
      .from('subscriptions')
      .select('organization_id')
      .eq('status', 'canceled')
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString());

    if (churnError) throw churnError;

    const averageLifetimeValue = await this.calculateCustomerLifetimeValue();

    // Calculate average subscription length
    const { data: completedSubs, error: completedError } = await supabase
      .from('subscriptions')
      .select('created_at, updated_at')
      .eq('status', 'canceled');

    if (completedError) throw completedError;

    let totalDays = 0;
    let completedCount = 0;

    completedSubs?.forEach((sub: any) => {
      const days = differenceInDays(new Date(sub.updated_at), new Date(sub.created_at));
      totalDays += days;
      completedCount++;
    });

    const averageSubscriptionLength = completedCount > 0 ? totalDays / completedCount : 0;

    return {
      totalCustomers: allCustomers?.length || 0,
      newCustomers: newCustomers?.length || 0,
      churnedCustomers: churnedCustomers?.length || 0,
      averageLifetimeValue,
      averageSubscriptionLength
    };
  }

  /**
   * Get conversion funnel metrics
   */
  async getConversionMetrics(startDate: Date, endDate: Date): Promise<ConversionMetrics> {
    const trialToSubscription = await this.calculateConversionRate(startDate, endDate);

    const supabase = await this.getSupabase();
    
    // Get plan changes for upgrade/downgrade rates
    const { data: planChanges, error: changesError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan_id,
        subscription_plans!inner(monthly_price)
      `)
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString());

    if (changesError) throw changesError;

    // For now, return basic metrics - upgrade/downgrade tracking would need additional schema
    return {
      trialToSubscription,
      visitorToTrial: 0, // Would need website analytics integration
      visitorToSubscription: 0, // Would need website analytics integration
      upgradeRate: 0, // Would need plan change history tracking
      downgradeRate: 0 // Would need plan change history tracking
    };
  }

  /**
   * Get MRR trend data for charts
   */
  async getMRRTrend(months: number = 12): Promise<Array<{ month: string; mrr: number }>> {
    const trends = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(currentDate, i);
      const mrr = await this.calculateMRR(date);
      trends.push({
        month: format(date, 'MMM yyyy'),
        mrr
      });
    }

    return trends;
  }

  /**
   * Get subscription status distribution
   */
  async getSubscriptionDistribution(): Promise<Array<{ status: string; count: number; percentage: number }>> {
    const counts = await this.getSubscriptionCounts();
    const total = counts.totalSubscriptions;

    return [
      {
        status: 'Active',
        count: counts.activeSubscriptions,
        percentage: total > 0 ? (counts.activeSubscriptions / total) * 100 : 0
      },
      {
        status: 'Trial',
        count: counts.trialSubscriptions,
        percentage: total > 0 ? (counts.trialSubscriptions / total) * 100 : 0
      },
      {
        status: 'Canceled',
        count: counts.canceledSubscriptions,
        percentage: total > 0 ? (counts.canceledSubscriptions / total) * 100 : 0
      }
    ];
  }
}