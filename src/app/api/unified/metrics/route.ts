/**
 * Unified Metrics API Route
 *
 * Provides aggregated metrics from Meta and Google Ads using real data only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlatformAggregationService } from '@/lib/services/platform-aggregation';
import { AggregatedMetrics, DateRange } from '@/lib/types/platform-aggregation';

const aggregationService = new PlatformAggregationService();

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function buildEmptyMetrics(dateRange: DateRange): AggregatedMetrics {
  return {
    total: {
      spend: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
      averageRoas: 0,
      averageCtr: 0,
      averageCpc: 0,
      averageCpa: 0,
      averageConversionRate: 0,
    },
    byPlatform: [],
    dateRange,
    lastUpdated: new Date(),
    dataQuality: {
      metaDataAvailable: false,
      googleDataAvailable: false,
      totalCampaigns: 0,
      metaCampaigns: 0,
      googleCampaigns: 0,
    },
  };
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true as const };
}

function buildResponse(
  clientId: string,
  dateRange: DateRange,
  data: AggregatedMetrics,
  partialData: boolean,
  errors: Array<{ platform: 'meta' | 'google'; error: string; code?: string; retryable: boolean }>,
  warnings: string[]
) {
  const platforms = [
    ...(data.dataQuality.metaDataAvailable ? ['meta'] : []),
    ...(data.dataQuality.googleDataAvailable ? ['google'] : []),
  ];

  return NextResponse.json({
    success: true,
    data,
    meta: {
      clientId,
      dateRange,
      platforms,
      partialData,
      errors,
      warnings,
      generatedAt: new Date().toISOString(),
    },
    cached: false,
  });
}

// ============================================================================
// GET /api/unified/metrics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: clientId, startDate, endDate' },
        { status: 400 }
      );
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: 'startDate must be before or equal to endDate' },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    if (!auth.ok) {
      return auth.response;
    }

    const dateRange: DateRange = { startDate, endDate };

    const result = await aggregationService.getAggregatedMetrics({
      clientId,
      dateRange,
      platforms: ['meta', 'google'],
    });

    const data = result.success && result.data ? result.data : buildEmptyMetrics(dateRange);

    return buildResponse(
      clientId,
      dateRange,
      data,
      result.partialData || !result.success,
      result.errors,
      result.warnings
    );
  } catch (error) {
    console.error('Unified metrics API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/unified/metrics (for complex queries)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, dateRange } = body;

    if (!clientId || !dateRange?.startDate || !dateRange?.endDate) {
      return NextResponse.json(
        { error: 'Client ID and date range are required' },
        { status: 400 }
      );
    }

    if (!isValidDate(dateRange.startDate) || !isValidDate(dateRange.endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (new Date(dateRange.startDate) > new Date(dateRange.endDate)) {
      return NextResponse.json(
        { error: 'startDate must be before or equal to endDate' },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    if (!auth.ok) {
      return auth.response;
    }

    const normalizedDateRange: DateRange = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };

    const result = await aggregationService.getAggregatedMetrics({
      clientId,
      dateRange: normalizedDateRange,
      platforms: ['meta', 'google'],
    });

    const data = result.success && result.data ? result.data : buildEmptyMetrics(normalizedDateRange);

    return buildResponse(
      clientId,
      normalizedDateRange,
      data,
      result.partialData || !result.success,
      result.errors,
      result.warnings
    );
  } catch (error) {
    console.error('Unified metrics POST API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS /api/unified/metrics (CORS support)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
