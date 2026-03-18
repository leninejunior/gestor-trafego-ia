import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface UsageStat {
  used: number;
  limit: number;
}

interface StatisticsResponse {
  clients: UsageStat;
  campaigns: UsageStat;
  reports: UsageStat;
  storage: UsageStat;
}

const DEFAULT_LIMITS = {
  clients: 10,
  campaigns: 100,
  reports: 50,
  storage: 1000,
};

function buildEmptyStats(limits = DEFAULT_LIMITS): StatisticsResponse {
  return {
    clients: { used: 0, limit: limits.clients },
    campaigns: { used: 0, limit: limits.campaigns },
    reports: { used: 0, limit: limits.reports },
    storage: { used: 0, limit: limits.storage },
  };
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership?.organization_id) {
      return NextResponse.json(buildEmptyStats());
    }

    const organizationId = membership.organization_id;

    // Resolve dynamic limits from active plan when available
    let limits = { ...DEFAULT_LIMITS };

    const { data: activeSubscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSubscription?.plan_id) {
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('max_clients,max_campaigns')
        .eq('id', activeSubscription.plan_id)
        .maybeSingle();

      if (plan) {
        limits = {
          ...limits,
          clients: typeof plan.max_clients === 'number' && plan.max_clients > 0 ? plan.max_clients : limits.clients,
          campaigns: typeof plan.max_campaigns === 'number' && plan.max_campaigns > 0 ? plan.max_campaigns : limits.campaigns,
        };
      }
    }

    // Count clients for the organization
    const { data: clients, error: clientsError, count: clientsCount } = await supabase
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('org_id', organizationId);

    if (clientsError) {
      throw clientsError;
    }

    const clientIds = (clients || []).map((c: { id: string }) => c.id);

    // Count campaigns from Meta + Google for those clients
    let metaCampaignCount = 0;
    let googleCampaignCount = 0;

    if (clientIds.length > 0) {
      const [{ count: metaCount }, { count: googleCount }] = await Promise.all([
        supabase
          .from('meta_campaigns')
          .select('id', { count: 'exact', head: true })
          .in('client_id', clientIds),
        supabase
          .from('google_ads_campaigns')
          .select('id', { count: 'exact', head: true })
          .in('client_id', clientIds),
      ]);

      metaCampaignCount = metaCount || 0;
      googleCampaignCount = googleCount || 0;
    }

    // Count reports if table exists; otherwise keep zero
    let reportCount = 0;
    const { count: exportJobsCount, error: exportJobsError } = await supabase
      .from('export_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id);

    if (!exportJobsError) {
      reportCount = exportJobsCount || 0;
    }

    // Storage usage kept at zero unless dedicated stats are available
    const statistics: StatisticsResponse = {
      clients: {
        used: clientsCount || 0,
        limit: limits.clients,
      },
      campaigns: {
        used: metaCampaignCount + googleCampaignCount,
        limit: limits.campaigns,
      },
      reports: {
        used: reportCount,
        limit: limits.reports,
      },
      storage: {
        used: 0,
        limit: limits.storage,
      },
    };

    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error getting usage statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
