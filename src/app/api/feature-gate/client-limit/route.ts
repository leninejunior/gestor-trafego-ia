import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';

/**
 * GET /api/feature-gate/client-limit
 * 
 * Valida se o usuário pode adicionar mais clientes.
 * Requisitos: 7.1, 7.2, 7.3, 7.4
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

    // Check client limit
    const result = await cacheGate.checkClientLimit(user.id);

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
    console.error('Error checking client limit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
