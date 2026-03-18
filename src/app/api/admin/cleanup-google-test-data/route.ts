import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete test sync logs
    const { error: syncLogsError } = await supabase
      .from('google_ads_sync_logs')
      .delete()
      .in(
        'connection_id',
        (
          await supabase
            .from('google_ads_connections')
            .select('id')
            .or(
              `customer_id.ilike.%test%,customer_id.ilike.%mock%,customer_id.ilike.%fake%,customer_id.ilike.%demo%,customer_id.ilike.%sandbox%,customer_id.ilike.%ficticio%,customer_id.ilike.%simulado%`
            )
        ).data?.map((c: any) => c.id) || []
      );

    if (syncLogsError) throw syncLogsError;

    // Delete test metrics
    const testConnections = await supabase
      .from('google_ads_connections')
      .select('id')
      .or(
        `customer_id.ilike.%test%,customer_id.ilike.%mock%,customer_id.ilike.%fake%,customer_id.ilike.%demo%,customer_id.ilike.%sandbox%,customer_id.ilike.%ficticio%,customer_id.ilike.%simulado%`
      );

    const testCampaigns = await supabase
      .from('google_ads_campaigns')
      .select('id')
      .in(
        'connection_id',
        testConnections.data?.map((c: any) => c.id) || []
      );

    if (testCampaigns.data && testCampaigns.data.length > 0) {
      const { error: metricsError } = await supabase
        .from('google_ads_metrics')
        .delete()
        .in(
          'campaign_id',
          testCampaigns.data.map((c: any) => c.id)
        );

      if (metricsError) throw metricsError;
    }

    // Delete test campaigns
    const { error: campaignsError } = await supabase
      .from('google_ads_campaigns')
      .delete()
      .in(
        'connection_id',
        testConnections.data?.map((c: any) => c.id) || []
      );

    if (campaignsError) throw campaignsError;

    // Delete test connections
    const { error: connectionsError } = await supabase
      .from('google_ads_connections')
      .delete()
      .or(
        `customer_id.ilike.%test%,customer_id.ilike.%mock%,customer_id.ilike.%fake%,customer_id.ilike.%demo%,customer_id.ilike.%sandbox%,customer_id.ilike.%ficticio%,customer_id.ilike.%simulado%`
      );

    if (connectionsError) throw connectionsError;

    // Get remaining data
    const { data: remainingConnections } = await supabase
      .from('google_ads_connections')
      .select('id, customer_id, status, created_at');

    const { data: remainingCampaigns } = await supabase
      .from('google_ads_campaigns')
      .select('id, campaign_id, campaign_name, status');

    const { data: remainingMetrics } = await supabase
      .from('google_ads_metrics')
      .select('id', { count: 'exact' });

    return NextResponse.json({
      success: true,
      message: 'All test/mock Google Ads data has been cleaned up',
      summary: {
        remaining_connections: remainingConnections?.length || 0,
        remaining_campaigns: remainingCampaigns?.length || 0,
        remaining_metrics: remainingMetrics?.length || 0,
      },
      remaining_data: {
        connections: remainingConnections,
        campaigns: remainingCampaigns,
      },
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup test data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
