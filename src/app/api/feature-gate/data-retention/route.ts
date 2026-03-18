import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';

/**
 * GET /api/feature-gate/data-retention
 * 
 * Valida se o usuário pode acessar dados históricos no período solicitado.
 * Requisitos: 7.1, 7.2, 7.3, 7.4
 * 
 * Query params:
 * - days: número de dias de dados históricos solicitados
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

    // Get requested days from query params
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');

    if (!daysParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: days' },
        { status: 400 }
      );
    }

    const requestedDays = parseInt(daysParam, 10);

    if (isNaN(requestedDays) || requestedDays < 1) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be a positive integer.' },
        { status: 400 }
      );
    }

    // Check data retention
    const result = await cacheGate.checkDataRetention(user.id, requestedDays);

    return NextResponse.json({
      allowed: result.allowed,
      requestedDays: result.requestedDays,
      allowedDays: result.allowedDays,
      reason: result.reason,
      upgradeRequired: !result.allowed,
    });

  } catch (error) {
    console.error('Error checking data retention:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
