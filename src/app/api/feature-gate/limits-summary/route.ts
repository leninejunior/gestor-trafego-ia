import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';

/**
 * GET /api/feature-gate/limits-summary
 * 
 * Retorna um resumo completo de todos os limites e uso atual do usuário.
 * Requisitos: 7.1, 7.4
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

    // Get complete limits summary
    const summary = await cacheGate.getLimitsSummary(user.id);

    return NextResponse.json({
      success: true,
      data: summary,
    });

  } catch (error) {
    console.error('Error getting limits summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
