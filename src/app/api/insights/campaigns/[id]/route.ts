/**
 * Hybrid Data API - Single Campaign
 * GET /api/insights/campaigns/:id
 * 
 * Retrieves insights for a specific campaign using hybrid strategy
 * Supports filtering by platform and date range
 * 
 * Requirements: 5.1, 5.2, 5.3, 2.1, 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HybridDataService } from '@/lib/services/hybrid-data-service';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';
import { AdPlatform, DataQuery } from '@/lib/types/sync';
// Import sync adapters (will be used when available)
// import { MetaAdsSyncAdapter } from '@/lib/sync/meta-ads-sync-adapter';
// import { GoogleAdsSyncAdapter } from '@/lib/sync/google-ads-sync-adapter';
import { BaseSyncAdapter } from '@/lib/sync/base-sync-adapter';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/insights/campaigns/:id
 * 
 * Path Parameters:
 * - id: string (required) - Campaign ID
 * 
 * Query Parameters:
 * - client_id: string (required) - Client ID
 * - platform: 'meta' | 'google' (required) - Platform
 * - date_from: string (required) - Start date (ISO format)
 * - date_to: string (required) - End date (ISO format)
 * - metrics: string (optional) - Comma-separated metrics to include
 * - force_cache: boolean (optional) - Force cache-only mode
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get campaign ID from path
    const campaignId = params.id;

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');
    const platform = searchParams.get('platform') as AdPlatform | null;
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const metricsParam = searchParams.get('metrics');
    const forceCacheParam = searchParams.get('force_cache');

    // Validate required parameters
    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing required parameter: client_id' },
        { status: 400 }
      );
    }

    if (!platform) {
      return NextResponse.json(
        { error: 'Missing required parameter: platform' },
        { status: 400 }
      );
    }

    if (platform !== AdPlatform.META && platform !== AdPlatform.GOOGLE) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be "meta" or "google"' },
        { status: 400 }
      );
    }

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'Missing required parameters: date_from and date_to' },
        { status: 400 }
      );
    }

    // Parse dates
    const dateFromObj = new Date(dateFrom);
    const dateToObj = new Date(dateTo);

    if (isNaN(dateFromObj.getTime()) || isNaN(dateToObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO format (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Validate date range
    if (dateFromObj > dateToObj) {
      return NextResponse.json(
        { error: 'date_from must be before or equal to date_to' },
        { status: 400 }
      );
    }

    // Verify user has access to client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, organization_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Check if user is member of client's organization
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('organization_id', client.organization_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this client' },
        { status: 403 }
      );
    }

    // Check data retention limits (Requirement 2.1, 2.2)
    const featureGate = new CacheFeatureGate();
    const requestedDays = Math.ceil(
      (dateToObj.getTime() - dateFromObj.getTime()) / (1000 * 60 * 60 * 24)
    );

    const retentionCheck = await featureGate.checkDataRetention(
      user.id,
      requestedDays
    );

    if (!retentionCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Data retention limit exceeded',
          details: {
            requested_days: requestedDays,
            allowed_days: retentionCheck.allowedDays,
            message: `Your plan allows access to ${retentionCheck.allowedDays} days of historical data. Please upgrade to access more.`
          }
        },
        { status: 403 }
      );
    }

    // Build query for specific campaign
    const query: DataQuery = {
      client_id: clientId,
      platform: platform,
      campaign_ids: [campaignId],
      date_from: dateFromObj,
      date_to: dateToObj
    };

    if (metricsParam) {
      query.metrics = metricsParam.split(',').map(m => m.trim());
    }

    // Get sync adapter if needed (not in force_cache mode)
    const forceCache = forceCacheParam === 'true';
    let adapter: BaseSyncAdapter | undefined = undefined;

    if (!forceCache) {
      // Get sync configuration for the platform
      const { data: syncConfig } = await supabase
        .from('sync_configurations')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', platform)
        .eq('sync_status', 'active')
        .single();

      if (syncConfig) {
        // TODO: Create appropriate adapter when Meta/Google adapters are implemented
        // For now, we'll use cache-only mode
        console.log('Sync adapter not yet implemented, using cache-only mode');
        
        // Future implementation:
        // if (platform === AdPlatform.META) {
        //   adapter = new MetaAdsSyncAdapter();
        //   await adapter.authenticate({
        //     access_token: syncConfig.access_token,
        //     account_id: syncConfig.account_id
        //   });
        // } else if (platform === AdPlatform.GOOGLE) {
        //   adapter = new GoogleAdsSyncAdapter();
        //   await adapter.authenticate({
        //     access_token: syncConfig.access_token,
        //     refresh_token: syncConfig.refresh_token,
        //     customer_id: syncConfig.account_id
        //   });
        // }
      }
    }

    // Fetch data using hybrid service (Requirement 5.1, 5.2, 5.3)
    const hybridService = new HybridDataService();
    const result = await hybridService.getDataWithHealthCheck(
      query,
      adapter,
      forceCache
    );

    // Check if campaign was found
    if (result.data.length === 0) {
      return NextResponse.json(
        {
          error: 'Campaign not found',
          details: {
            campaign_id: campaignId,
            platform: platform,
            message: 'No data found for this campaign in the specified date range'
          }
        },
        { status: 404 }
      );
    }

    // Get campaign summary
    const campaignData = result.data[0];
    const totalImpressions = result.data.reduce((sum, d) => sum + d.impressions, 0);
    const totalClicks = result.data.reduce((sum, d) => sum + d.clicks, 0);
    const totalSpend = result.data.reduce((sum, d) => sum + d.spend, 0);
    const totalConversions = result.data.reduce((sum, d) => sum + d.conversions, 0);

    // Calculate aggregated metrics
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    // Return response with campaign details and daily breakdown
    return NextResponse.json({
      success: true,
      campaign: {
        id: campaignId,
        name: campaignData.campaign_name,
        platform: platform,
        is_deleted: campaignData.is_deleted,
        summary: {
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          total_spend: totalSpend,
          total_conversions: totalConversions,
          avg_ctr: Number(avgCtr.toFixed(2)),
          avg_cpc: Number(avgCpc.toFixed(2)),
          avg_cpm: Number(avgCpm.toFixed(2)),
          conversion_rate: Number(conversionRate.toFixed(2))
        },
        daily_breakdown: result.data.map(d => ({
          date: d.date,
          impressions: d.impressions,
          clicks: d.clicks,
          spend: d.spend,
          conversions: d.conversions,
          ctr: d.ctr,
          cpc: d.cpc,
          cpm: d.cpm,
          conversion_rate: d.conversion_rate
        }))
      },
      metadata: {
        source: result.source,
        api_status: result.api_status,
        cache_hit_rate: result.cache_hit_rate,
        fallback_used: result.fallback_used,
        emergency_cache: result.emergency_cache,
        cached_at: result.cached_at,
        error_message: result.error_message,
        total_days: result.data.length,
        query: {
          client_id: clientId,
          campaign_id: campaignId,
          platform: platform,
          date_from: dateFrom,
          date_to: dateTo,
          requested_days: requestedDays
        }
      }
    });

  } catch (error) {
    console.error('Error fetching campaign insights:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
