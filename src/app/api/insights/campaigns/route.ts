/**
 * Hybrid Data API - Campaigns List
 * GET /api/insights/campaigns
 * 
 * Retrieves campaign insights using hybrid strategy (cache + API)
 * Supports filtering by platform, date range, and metrics
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

/**
 * GET /api/insights/campaigns
 * 
 * Query Parameters:
 * - client_id: string (required) - Client ID
 * - platform: 'meta' | 'google' (optional) - Filter by platform
 * - campaign_ids: string (optional) - Comma-separated campaign IDs
 * - date_from: string (required) - Start date (ISO format)
 * - date_to: string (required) - End date (ISO format)
 * - metrics: string (optional) - Comma-separated metrics to include
 * - limit: number (optional) - Max records to return
 * - offset: number (optional) - Pagination offset
 * - force_cache: boolean (optional) - Force cache-only mode
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');
    const platform = searchParams.get('platform') as AdPlatform | null;
    const campaignIdsParam = searchParams.get('campaign_ids');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const metricsParam = searchParams.get('metrics');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const forceCacheParam = searchParams.get('force_cache');

    // Validate required parameters
    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing required parameter: client_id' },
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

    // Build query
    const query: DataQuery = {
      client_id: clientId,
      date_from: dateFromObj,
      date_to: dateToObj
    };

    // Add optional filters
    if (platform) {
      if (platform !== AdPlatform.META && platform !== AdPlatform.GOOGLE) {
        return NextResponse.json(
          { error: 'Invalid platform. Must be "meta" or "google"' },
          { status: 400 }
        );
      }
      query.platform = platform;
    }

    if (campaignIdsParam) {
      query.campaign_ids = campaignIdsParam.split(',').map(id => id.trim());
    }

    if (metricsParam) {
      query.metrics = metricsParam.split(',').map(m => m.trim());
    }

    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        query.limit = Math.min(limit, 1000); // Max 1000 records
      }
    }

    if (offsetParam) {
      const offset = parseInt(offsetParam, 10);
      if (!isNaN(offset) && offset >= 0) {
        query.offset = offset;
      }
    }

    // Get sync adapter if needed (not in force_cache mode)
    const forceCache = forceCacheParam === 'true';
    let adapter: BaseSyncAdapter | undefined = undefined;

    if (!forceCache && platform) {
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

    // Return response with metadata
    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: {
        source: result.source,
        api_status: result.api_status,
        cache_hit_rate: result.cache_hit_rate,
        fallback_used: result.fallback_used,
        emergency_cache: result.emergency_cache,
        cached_at: result.cached_at,
        error_message: result.error_message,
        total_records: result.data.length,
        query: {
          client_id: clientId,
          platform: platform || 'all',
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
