import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';

/**
 * GET /api/feature-gate/campaign-limit
 * 
 * Valida se um cliente pode adicionar mais campanhas.
 * Requisitos: 7.1, 7.2, 7.3, 7.4
 * 
 * Query params:
 * - clientId: ID do cliente para verificar limite de campanhas
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const cacheGate = new CacheFeatureGate();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get clientId from query params
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing required parameter: clientId' },
        { status: 400 }
      );
    }

    console.log(`[campaign-limit] Checking limit for client: ${clientId}, user: ${user.id}`);

    // Verify client exists and user has access via organization
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (clientError) {
      console.error(`[campaign-limit] Client query error:`, clientError);
      return NextResponse.json(
        { error: 'Error fetching client' },
        { status: 500 }
      );
    }

    if (!client) {
      console.warn(`[campaign-limit] Client not found: ${clientId}`);
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    console.log(`[campaign-limit] Client found with org_id: ${client.org_id}`);

    // Verify user has access to this client's organization
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', client.org_id);

    if (membershipError) {
      console.error('[campaign-limit] Membership query error:', membershipError);
      return NextResponse.json(
        { error: 'Error verifying access' },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      console.warn(`[campaign-limit] User ${user.id} has no membership in organization ${client.org_id}`);
      
      // Try to check if user is super admin or has other access
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return NextResponse.json(
          { error: 'Unauthorized access to client' },
          { status: 403 }
        );
      }
    }

    console.log(`[campaign-limit] User has access, checking campaign limit...`);

    // Check campaign limit
    const result = await cacheGate.checkCampaignLimit(clientId);

    console.log(`[campaign-limit] Campaign limit result:`, result);

    return NextResponse.json({
      allowed: result.allowed,
      current: result.current,
      limit: result.limit,
      remaining: result.remaining,
      isUnlimited: result.isUnlimited,
      reason: result.reason,
      upgradeRequired: !result.allowed,
    });

  } catch (error) {
    console.error('[campaign-limit] Error checking campaign limit:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
