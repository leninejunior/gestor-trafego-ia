/**
 * Time Series Data API Route
 * 
 * Provides time series data for trend analysis across platforms
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PlatformAggregationService } from '@/lib/services/platform-aggregation';
import { DateRange } from '@/lib/types/platform-aggregation';

// ============================================================================
// GET /api/unified/time-series
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract and validate parameters
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const granularity = searchParams.get('granularity') as 'day' | 'week' | 'month' | null;

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

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Validate granularity
    const validGranularities = ['day', 'week', 'month'];
    const selectedGranularity = granularity || 'day';
    if (!validGranularities.includes(selectedGranularity)) {
      return NextResponse.json(
        { error: 'Granularity must be "day", "week", or "month"' },
        { status: 400 }
      );
    }

    // Check date range limits based on granularity
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (selectedGranularity === 'day' && daysDiff > 90) {
      return NextResponse.json(
        { error: 'Daily granularity is limited to 90 days maximum' },
        { status: 400 }
      );
    }
    
    if (selectedGranularity === 'week' && daysDiff > 365) {
      return NextResponse.json(
        { error: 'Weekly granularity is limited to 365 days maximum' },
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

    // Prepare date range
    const dateRange: DateRange = {
      startDate,
      endDate,
    };

    // Get time series data
    const aggregationService = new PlatformAggregationService();
    const result = await aggregationService.getTimeSeriesData(
      clientId,
      dateRange,
      selectedGranularity
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to generate time series data',
          details: result.errors,
          warnings: result.warnings,
        },
        { status: 500 }
      );
    }

    // Calculate summary statistics
    const summary = calculateTimeSeriesSummary(result.data!);

    // Return successful response
    return NextResponse.json({
      success: true,
      data: result.data,
      summary,
      meta: {
        clientId,
        dateRange,
        granularity: selectedGranularity,
        dataPoints: result.data?.dataPoints.length || 0,
        partialData: result.partialData,
        errors: result.errors,
        warnings: result.warnings,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Time series API error:', error);
    
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
// POST /api/unified/time-series (for complex time series queries)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const {
      clientId,
      dateRange,
      granularity = 'day',
      metrics = ['spend', 'conversions', 'impressions', 'clicks'],
      platforms = ['meta', 'google'],
      includeComparison = false,
      comparisonDateRange,
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

    // Get time series data
    const aggregationService = new PlatformAggregationService();
    const result = await aggregationService.getTimeSeriesData(
      clientId,
      dateRange,
      granularity
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to generate time series data',
          details: result.errors,
          warnings: result.warnings,
        },
        { status: 500 }
      );
    }

    // Get comparison data if requested
    let comparisonData = null;
    if (includeComparison && comparisonDateRange) {
      const comparisonResult = await aggregationService.getTimeSeriesData(
        clientId,
        comparisonDateRange,
        granularity
      );
      
      if (comparisonResult.success) {
        comparisonData = comparisonResult.data;
      }
    }

    // Calculate summary statistics
    const summary = calculateTimeSeriesSummary(result.data!);
    const comparisonSummary = comparisonData ? calculateTimeSeriesSummary(comparisonData) : null;

    // Return successful response
    return NextResponse.json({
      success: true,
      data: result.data,
      comparisonData,
      summary,
      comparisonSummary,
      meta: {
        clientId,
        dateRange,
        comparisonDateRange,
        granularity,
        metrics,
        platforms,
        dataPoints: result.data?.dataPoints.length || 0,
        partialData: result.partialData,
        errors: result.errors,
        warnings: result.warnings,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Time series POST API error:', error);
    
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
// Utility Functions
// ============================================================================

function calculateTimeSeriesSummary(timeSeriesData: any) {
  if (!timeSeriesData?.dataPoints || timeSeriesData.dataPoints.length === 0) {
    return {
      totalDataPoints: 0,
      dateRange: timeSeriesData?.dateRange || null,
      trends: {},
    };
  }

  const { dataPoints } = timeSeriesData;
  const totalDataPoints = dataPoints.length;

  // Calculate trends for key metrics
  const trends = {
    spend: calculateTrend(dataPoints, 'spend'),
    conversions: calculateTrend(dataPoints, 'conversions'),
    impressions: calculateTrend(dataPoints, 'impressions'),
    clicks: calculateTrend(dataPoints, 'clicks'),
    roas: calculateTrend(dataPoints, 'roas'),
    ctr: calculateTrend(dataPoints, 'ctr'),
  };

  // Calculate platform distribution
  const platformDistribution = {
    metaDataPoints: dataPoints.filter((dp: any) => dp.meta).length,
    googleDataPoints: dataPoints.filter((dp: any) => dp.google).length,
    bothPlatformsDataPoints: dataPoints.filter((dp: any) => dp.meta && dp.google).length,
  };

  return {
    totalDataPoints,
    dateRange: timeSeriesData.dateRange,
    trends,
    platformDistribution,
  };
}

function calculateTrend(dataPoints: any[], metric: string) {
  const values = dataPoints
    .map(dp => dp.total?.[metric] || 0)
    .filter(value => value > 0);

  if (values.length < 2) {
    return { direction: 'stable', change: 0, confidence: 'low' };
  }

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  const change = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  let direction: 'up' | 'down' | 'stable';
  let confidence: 'high' | 'medium' | 'low';

  if (Math.abs(change) < 5) {
    direction = 'stable';
    confidence = 'high';
  } else if (change > 0) {
    direction = 'up';
    confidence = Math.abs(change) > 20 ? 'high' : 'medium';
  } else {
    direction = 'down';
    confidence = Math.abs(change) > 20 ? 'high' : 'medium';
  }

  return {
    direction,
    change: Math.round(change * 100) / 100,
    confidence,
  };
}

// ============================================================================
// OPTIONS /api/unified/time-series (CORS support)
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