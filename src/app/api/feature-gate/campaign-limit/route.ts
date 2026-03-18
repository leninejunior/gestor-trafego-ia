import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';
import { UserAccessControlService, UserType } from '@/lib/services/user-access-control';

const UNLIMITED_CAMPAIGN_LIMIT_RESPONSE = {
  allowed: true,
  current: 0,
  limit: -1,
  remaining: -1,
  isUnlimited: true,
  reason: undefined,
  upgradeRequired: false,
} as const;

async function isActiveUserInTable(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  tableName: 'super_admins' | 'master_users',
  userId: string
): Promise<boolean> {
  const { data, error } = await serviceSupabase
    .from(tableName)
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!error) {
    return !!data;
  }

  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message || '';
  const relationMissing =
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist');

  if (!relationMissing && code !== 'PGRST116') {
    console.warn(`[campaign-limit] Could not check ${tableName} for user ${userId}:`, error);
  }

  return false;
}

async function hasMasterLikeMembership(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<boolean> {
  const { data: membership, error } = await serviceSupabase
    .from('memberships')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'PGRST116') {
      console.warn(`[campaign-limit] Could not inspect memberships for user ${userId}:`, error);
    }
    return false;
  }

  if (!membership) {
    return false;
  }

  const membershipUserType = typeof membership.user_type === 'string'
    ? membership.user_type.toLowerCase()
    : '';
  const membershipRole = typeof membership.role === 'string'
    ? membership.role.toLowerCase()
    : '';

  if (membershipUserType === 'master') {
    return true;
  }

  if (membershipRole === 'super_admin' || membershipRole === 'master') {
    return true;
  }

  if (membership.role_id) {
    const { data: roleData, error: roleError } = await serviceSupabase
      .from('user_roles')
      .select('name')
      .eq('id', membership.role_id)
      .maybeSingle();

    if (!roleError && roleData?.name) {
      const roleName = roleData.name.toLowerCase();
      if (roleName === 'super_admin' || roleName === 'master') {
        return true;
      }
    }
  }

  return false;
}

function withDebug<T extends Record<string, unknown>>(
  payload: T,
  debug: Record<string, unknown>
): T & { debug?: Record<string, unknown> } {
  if (process.env.NODE_ENV !== 'development') {
    return payload;
  }

  return {
    ...payload,
    debug,
  };
}

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
    const serviceSupabase = createServiceClient();
    const cacheGate = new CacheFeatureGate();
    const accessControl = new UserAccessControlService();

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

    // Service-role checks avoid false negatives caused by RLS/cache in role detection.
    const isSuperAdmin = await isActiveUserInTable(serviceSupabase, 'super_admins', user.id);
    if (isSuperAdmin) {
      console.log(`[campaign-limit] User ${user.id} is super_admin, bypassing campaign limit`);
      return NextResponse.json(withDebug(UNLIMITED_CAMPAIGN_LIMIT_RESPONSE, {
        bypassSource: 'super_admins_table',
        userId: user.id,
      }));
    }

    const isLegacyMasterUser = await isActiveUserInTable(serviceSupabase, 'master_users', user.id);
    if (isLegacyMasterUser) {
      console.log(`[campaign-limit] User ${user.id} is master_user, bypassing campaign limit`);
      return NextResponse.json(withDebug(UNLIMITED_CAMPAIGN_LIMIT_RESPONSE, {
        bypassSource: 'master_users_table',
        userId: user.id,
      }));
    }

    const hasLegacyMasterMembership = await hasMasterLikeMembership(serviceSupabase, user.id);
    if (hasLegacyMasterMembership) {
      console.log(`[campaign-limit] User ${user.id} has master-like membership, bypassing campaign limit`);
      return NextResponse.json(withDebug(UNLIMITED_CAMPAIGN_LIMIT_RESPONSE, {
        bypassSource: 'memberships_master_like',
        userId: user.id,
      }));
    }

    const userType = await accessControl.getUserType(user.id);
    if (userType === UserType.SUPER_ADMIN) {
      console.log(`[campaign-limit] User ${user.id} detected as super_admin by access service, bypassing campaign limit`);
      return NextResponse.json(withDebug(UNLIMITED_CAMPAIGN_LIMIT_RESPONSE, {
        bypassSource: 'user_access_service',
        userId: user.id,
        userType,
      }));
    }

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
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

    const hasAccess = await accessControl.hasClientAccess(user.id, clientId);
    if (!hasAccess) {
      console.warn(`[campaign-limit] User ${user.id} has no access to client ${clientId}`);
      return NextResponse.json(
        { error: 'Unauthorized access to client' },
        { status: 403 }
      );
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
      ...(process.env.NODE_ENV === 'development'
        ? {
            debug: {
              bypassSource: null,
              userId: user.id,
              userType,
              checks: {
                superAdminsTable: isSuperAdmin,
                masterUsersTable: isLegacyMasterUser,
                membershipsMasterLike: hasLegacyMasterMembership,
              },
            },
          }
        : {}),
    });

  } catch (error) {
    console.error('[campaign-limit] Error checking campaign limit:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
