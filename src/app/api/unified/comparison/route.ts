/**
 * Platform Comparison API Route
 * 
 * Provides comparative analysis between Meta and Google Ads platforms
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlatformAggregationService } from '@/lib/services/platform-aggregation';
import { ComparisonOptions } from '@/lib/types/platform-aggregation';

// ============================================================================
// GET /api/unified/comparison
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract and validate parameters
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const comparisonStartDate = searchParams.get('comparisonStartDate');
    const comparisonEndDate = searchParams.get('comparisonEndDate');
    const metricsParam = searchParams.get('metrics');
    const includeInsights = searchParams.get('includeInsights') !== 'false'; // Default true

    // Validate required parameters
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Validate comparison dates if provided
    if (comparisonStartDate && comparisonEndDate) {
      if (!dateRegex.test(comparisonStartDate) || !dateRegex.test(comparisonEndDate)) {
        return NextResponse.json(
          { error: 'Comparison dates must be in YYYY-MM-DD format' },
          { status: 400 }
        );
      }
    }

    // Validate date ranges
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    if (comparisonStartDate && comparisonEndDate) {
      const compStart = new Date(comparisonStartDate);
      const compEnd = new Date(comparisonEndDate);
      if (compStart > compEnd) {
        return NextResponse.json(
          { error: 'Comparison start date must be before comparison end date' },
          { status: 400 }
        );
      }
    }

    // Parse metrics filter
    let metrics: string[] | undefined;
    if (metricsParam) {
      metrics = metricsParam.split(',').map(m => m.trim());
      const validMetrics = ['spend', 'conversions', 'impressions', 'clicks', 'ctr', 'cpc', 'cpa', 'roas', 'conversionRate'];
      const invalidMetrics = metrics.filter(m => !validMetrics.includes(m));
      
      if (invalidMetrics.length > 0) {
        return NextResponse.json(
          { error: `Invalid metrics: ${invalidMetrics.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user has access to the client
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this client' },
        { status: 403 }
      );
    }

    // Prepare comparison options
    const options: ComparisonOptions = {
      clientId,
      dateRange: {
        startDate,
        endDate,
      },
      ...(comparisonStartDate && comparisonEndDate && {
        comparisonDateRange: {
          startDate: comparisonStartDate,
          endDate: comparisonEndDate,
        },
      }),
      metrics,
      includeInsights,
    };

    // Get platform comparison
    const aggregationService = new PlatformAggregationService();
    const result = await aggregationService.comparePlatforms(options);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to compare platforms',
          details: result.errors,
          warnings: result.warnings,
        },
        { status: 500 }
      );
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        clientId,
        dateRange: { startDate, endDate },
        comparisonDateRange: comparisonStartDate && comparisonEndDate ? {
          startDate: comparisonStartDate,
          endDate: comparisonEndDate,
        } : null,
        metrics: metrics || ['spend', 'conversions', 'roas', 'ctr', 'cpc', 'cpa'],
        includeInsights,
        partialData: result.partialData,
        errors: result.errors,
        warnings: result.warnings,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Platform comparison API error:', error);
    
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
// POST /api/unified/comparison (for complex comparison queries)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const {
      clientId,
      dateRange,
      comparisonDateRange,
      metrics,
      includeInsights = true,
      filters = {},
      groupBy,
    } = body;

    // Validate required fields
    if (!clientId || !dateRange?.startDate || !dateRange?.endDate) {
      return NextResponse.json(
        { error: 'Client ID and date range are required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user has access to the client
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Access denied to this client' },
        { status: 403 }
      );
    }

    // Prepare comparison options
    const options: ComparisonOptions = {
      clientId,
      dateRange,
      comparisonDateRange,
      metrics,
      includeInsights,
    };

    // Get platform comparison
    const aggregationService = new PlatformAggregationService();
    const result = await aggregationService.comparePlatforms(options);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to compare platforms',
          details: result.errors,
          warnings: result.warnings,
        },
        { status: 500 }
      );
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        clientId,
        dateRange,
        comparisonDateRange,
        metrics: metrics || ['spend', 'conversions', 'roas', 'ctr', 'cpc', 'cpa'],
        includeInsights,
        partialData: result.partialData,
        errors: result.errors,
        warnings: result.warnings,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Platform comparison POST API error:', error);
    
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
// OPTIONS /api/unified/comparison (CORS support)
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