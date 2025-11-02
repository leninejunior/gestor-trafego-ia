import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract parameters
    const clientId = searchParams.get('clientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Quick validation
    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Return mock data that matches the expected structure
    const mockResponse = {
      success: true,
      data: {
        total: {
          spend: 1250.50,
          conversions: 45,
          impressions: 45000,
          clicks: 890,
          averageRoas: 2.5,
          averageCtr: 1.98,
          averageCpc: 1.40,
          averageCpa: 27.79,
          averageConversionRate: 5.06,
        },
        byPlatform: [
          {
            platform: 'meta',
            spend: 1250.50,
            conversions: 45,
            impressions: 45000,
            clicks: 890,
            roas: 2.5,
            ctr: 1.98,
            cpc: 1.40,
            cpa: 27.79,
            conversionRate: 5.06,
          }
        ],
        dateRange: { startDate, endDate },
        lastUpdated: new Date(),
        dataQuality: {
          metaDataAvailable: true,
          googleDataAvailable: false,
          totalCampaigns: 1,
          metaCampaigns: 1,
          googleCampaigns: 0,
        },
      },
      meta: {
        clientId,
        dateRange: { startDate, endDate },
        platforms: ['meta'],
        partialData: false,
        errors: [],
        warnings: [],
        generatedAt: new Date().toISOString(),
      },
      cached: false
    };

    return NextResponse.json(mockResponse);

  } catch (error) {
    console.error('Unified metrics test API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}