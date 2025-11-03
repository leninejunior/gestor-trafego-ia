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

    // Verify client exists and user has access via organization
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, org_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this client's organization
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', client.org_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Unauthorized access to client' },
        { status: 403 }
      );
    }

    // Check campaign limit
    const result = await cacheGate.checkCampaignLimit(clientId);

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
    console.error('Error checking campaign limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
