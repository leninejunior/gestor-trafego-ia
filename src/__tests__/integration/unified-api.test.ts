/**
 * Unified API integration tests (contract-aligned)
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GET as metricsGET, POST as metricsPOST } from '@/app/api/unified/metrics/route';
import { GET as comparisonGET } from '@/app/api/unified/comparison/route';
import { GET as timeSeriesGET } from '@/app/api/unified/time-series/route';
import { GET as insightsGET } from '@/app/api/unified/insights/route';

const mockAggregationService = {
  comparePlatforms: jest.fn(),
  getTimeSeriesData: jest.fn(),
  getAggregatedMetrics: jest.fn(),
};

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/services/platform-aggregation', () => ({
  PlatformAggregationService: jest.fn(() => mockAggregationService),
}));

type QueryResult = { data: any; error: any };

function createThenableQuery(result: QueryResult) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    single: jest.fn(async () => result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };

  return chain;
}

function buildSupabaseMock({
  user = { id: 'user-123', email: 'test@example.com' },
  authError = null,
  membership = true,
  metaConnections = [],
  googleConnections = [],
}: {
  user?: any;
  authError?: any;
  membership?: boolean;
  metaConnections?: any[];
  googleConnections?: any[];
}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === 'client_meta_connections') {
        return createThenableQuery({ data: metaConnections, error: null });
      }
      if (table === 'google_ads_connections') {
        return createThenableQuery({ data: googleConnections, error: null });
      }
      if (table === 'organization_memberships') {
        return createThenableQuery({
          data: membership ? { client_id: 'client-123' } : null,
          error: membership ? null : { code: 'PGRST116', message: 'Not found' },
        });
      }
      return createThenableQuery({ data: [], error: null });
    }),
  };
}

describe('Unified API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/unified/metrics', () => {
    it('returns 400 when required query params are missing', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({}));

      const response = await metricsGET(
        new NextRequest('http://localhost:3000/api/unified/metrics?clientId=client-123')
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Missing required parameters');
    });

    it('returns data for both platforms when both are connected', async () => {
      (createClient as jest.Mock).mockResolvedValue(
        buildSupabaseMock({
          metaConnections: [{ id: 'meta-1', is_active: true }],
          googleConnections: [{ id: 'google-1', status: 'active' }],
        })
      );

      const response = await metricsGET(
        new NextRequest(
          'http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.byPlatform).toHaveLength(2);
      expect(body.meta.partialData).toBe(false);
    });

    it('returns partial data and warning when one platform is disconnected', async () => {
      (createClient as jest.Mock).mockResolvedValue(
        buildSupabaseMock({
          metaConnections: [{ id: 'meta-1', is_active: true }],
          googleConnections: [],
        })
      );

      const response = await metricsGET(
        new NextRequest(
          'http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.byPlatform).toHaveLength(1);
      expect(body.data.byPlatform[0].platform).toBe('meta');
      expect(body.meta.partialData).toBe(true);
      expect(body.meta.warnings).toContain('Google Ads não está conectado para este cliente');
    });

    it('supports complex aggregation POST payload', async () => {
      (createClient as jest.Mock).mockResolvedValue(
        buildSupabaseMock({
          metaConnections: [],
          googleConnections: [{ id: 'google-1', status: 'active' }],
        })
      );

      const response = await metricsPOST(
        new NextRequest('http://localhost:3000/api/unified/metrics', {
          method: 'POST',
          body: JSON.stringify({
            clientId: 'client-123',
            dateRange: {
              startDate: '2024-01-01',
              endDate: '2024-01-31',
            },
          }),
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.byPlatform).toHaveLength(1);
      expect(body.data.byPlatform[0].platform).toBe('google');
    });
  });

  describe('/api/unified/comparison', () => {
    it('validates metrics query param', async () => {
      const response = await comparisonGET(
        new NextRequest(
          'http://localhost:3000/api/unified/comparison?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31&metrics=invalid_metric'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Invalid metrics');
    });

    it('returns 401 when user is unauthenticated', async () => {
      (createClient as jest.Mock).mockResolvedValue(
        buildSupabaseMock({
          user: null,
          authError: { message: 'Unauthorized' },
        })
      );

      const response = await comparisonGET(
        new NextRequest(
          'http://localhost:3000/api/unified/comparison?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Authentication required');
    });

    it('returns comparison payload when authorized', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({ membership: true }));

      mockAggregationService.comparePlatforms.mockResolvedValue({
        success: true,
        data: {
          dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
          comparison: { betterPerformingPlatform: 'meta', metrics: {} },
          insights: [],
          platforms: {},
        },
        partialData: false,
        errors: [],
        warnings: [],
      });

      const response = await comparisonGET(
        new NextRequest(
          'http://localhost:3000/api/unified/comparison?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31&metrics=spend,roas'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.meta.metrics).toEqual(['spend', 'roas']);
      expect(mockAggregationService.comparePlatforms).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-123',
          dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
          metrics: ['spend', 'roas'],
        })
      );
    });
  });

  describe('/api/unified/time-series', () => {
    it('returns 400 for invalid granularity', async () => {
      const response = await timeSeriesGET(
        new NextRequest(
          'http://localhost:3000/api/unified/time-series?clientId=client-123&startDate=2024-01-01&endDate=2024-01-10&granularity=hour'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Granularity must be');
    });

    it('returns summarized time-series payload', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({ membership: true }));

      mockAggregationService.getTimeSeriesData.mockResolvedValue({
        success: true,
        data: {
          dateRange: { startDate: '2024-01-01', endDate: '2024-01-02' },
          dataPoints: [
            {
              date: '2024-01-01',
              total: { spend: 10, conversions: 1, impressions: 100, clicks: 10, roas: 2, ctr: 10 },
              meta: { spend: 6 },
              google: { spend: 4 },
            },
            {
              date: '2024-01-02',
              total: { spend: 20, conversions: 2, impressions: 200, clicks: 20, roas: 2.2, ctr: 10 },
              meta: { spend: 12 },
              google: { spend: 8 },
            },
          ],
        },
        partialData: false,
        errors: [],
        warnings: [],
      });

      const response = await timeSeriesGET(
        new NextRequest(
          'http://localhost:3000/api/unified/time-series?clientId=client-123&startDate=2024-01-01&endDate=2024-01-02&granularity=day'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.summary.totalDataPoints).toBe(2);
      expect(body.meta.dataPoints).toBe(2);
    });
  });

  describe('/api/unified/insights', () => {
    it('returns 403 when user has no access to client', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({ membership: false }));

      const response = await insightsGET(
        new NextRequest(
          'http://localhost:3000/api/unified/insights?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe('Access denied to this client');
    });

    it('returns insights report with requested filters', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({ membership: true }));

      mockAggregationService.getAggregatedMetrics.mockResolvedValue({
        success: true,
        data: {
          total: {
            spend: 300,
            conversions: 5,
            impressions: 1000,
            clicks: 50,
            averageRoas: 1.2,
            averageCtr: 5,
            averageCpc: 6,
            averageCpa: 60,
            averageConversionRate: 10,
          },
          byPlatform: [
            { platform: 'meta', roas: 1.1, cpc: 7, ctr: 4 },
            { platform: 'google', roas: 1.3, cpc: 5, ctr: 6 },
          ],
          dataQuality: {
            metaDataAvailable: true,
            googleDataAvailable: true,
            totalCampaigns: 2,
            metaCampaigns: 1,
            googleCampaigns: 1,
          },
        },
        partialData: false,
        errors: [],
        warnings: [],
      });

      const response = await insightsGET(
        new NextRequest(
          'http://localhost:3000/api/unified/insights?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31&types=opportunity,warning&minImpact=high'
        )
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.meta.filters.types).toEqual(['opportunity', 'warning']);
      expect(body.meta.filters.minImpact).toBe('high');
      expect(body.data.summary.totalInsights).toBeGreaterThanOrEqual(0);
    });
  });
});
