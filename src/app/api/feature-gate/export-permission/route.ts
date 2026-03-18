import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CacheFeatureGate } from '@/lib/services/cache-feature-gate';

/**
 * GET /api/feature-gate/export-permission
 * 
 * Valida se o usuário tem permissão para exportar dados no formato especificado.
 * Requisitos: 8.3
 * 
 * Query params:
 * - format: 'csv' ou 'json'
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

    // Get format from query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (!format) {
      return NextResponse.json(
        { error: 'Missing required parameter: format' },
        { status: 400 }
      );
    }

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        { error: 'Invalid format. Must be "csv" or "json".' },
        { status: 400 }
      );
    }

    // Check export permission
    const result = await cacheGate.checkExportPermission(user.id, format);

    return NextResponse.json({
      allowed: result.allowed,
      format: result.format,
      reason: result.reason,
      upgradeRequired: !result.allowed,
    });

  } catch (error) {
    console.error('Error checking export permission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
