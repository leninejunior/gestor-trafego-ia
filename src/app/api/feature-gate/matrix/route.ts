import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FeatureGateService } from '@/lib/services/feature-gate';

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const featureGate = new FeatureGateService();

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
      return NextResponse.json(
        { error: 'Active organization membership not found' },
        { status: 403 }
      );
    }

    const matrix = await featureGate.getFeatureMatrix(membership.organization_id);

    const maxClients = toNumber(matrix.maxClients, 0);
    const maxCampaigns = toNumber(matrix.maxCampaigns, 0);

    const payload = {
      features: {
        campaigns: maxCampaigns !== 0,
        analytics: toBoolean(matrix.advancedAnalytics, false),
        reports: toBoolean(matrix.customReports, false),
        clients: maxClients !== 0,
        meta_ads: true,
        dashboard: true,
        admin_panel: true,
        billing: true,
        team_management: true,
      },
      limits: {
        campaigns: maxCampaigns,
        clients: maxClients,
        reports: toBoolean(matrix.customReports, false) ? 1 : 0,
        api_calls: toNumber(matrix.apiAccess, 0),
        team_members: 0,
      },
      usage: {
        campaigns: toNumber(matrix.maxCampaignsUsage, 0),
        clients: toNumber(matrix.maxClientsUsage, 0),
        reports: 0,
        api_calls: 0,
        team_members: 0,
      },
      plan: 'subscription',
      planName: 'Subscription Plan',
      isUnlimited: maxClients < 0 || maxCampaigns < 0,
    };

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error('Error getting feature matrix:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature matrix' },
      { status: 500 }
    );
  }
}
