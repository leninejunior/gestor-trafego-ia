/**
 * Multi-Platform Aggregation Integration Tests
 *
 * Contract-aligned tests for unified metrics/comparison/time-series/insights routes.
 */

import { createClient } from '@/lib/supabase/server';

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

function createRequest(url: URL | string) {
  return { url: typeof url === 'string' ? url : url.toString() } as any;
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

describe('Multi-Platform Aggregation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unified Metrics API', () => {
    it('returns data for both platforms when both connections are active', async () => {
      (createClient as jest.Mock).mockResolvedValue(
        buildSupabaseMock({
          metaConnections: [{ id: 'meta-1', is_active: true }],
          googleConnections: [{ id: 'google-1', status: 'active' }],
        })
      );

      const { GET } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', 'client-123');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-01-31');

      const response = await GET(createRequest(url));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.byPlatform).toHaveLength(2);
      expect(body.meta.partialData).toBe(false);
      expect(body.data.byPlatform.map((p: any) => p.platform).sort()).toEqual(['google', 'meta']);
    });

    it('returns partial data when only one platform is connected', async () => {
      (createClient as jest.Mock).mockResolvedValue(
        buildSupabaseMock({
          metaConnections: [],
          googleConnections: [{ id: 'google-1', status: 'active' }],
        })
      );

      const { GET } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', 'client-123');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-01-31');

      const response = await GET(createRequest(url));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.byPlatform).toHaveLength(1);
      expect(body.data.byPlatform[0].platform).toBe('google');
      expect(body.meta.partialData).toBe(true);
      expect(body.meta.warnings).toContain('Meta Ads não está conectado para este cliente');
    });

    it('validates required parameters', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({}));

      const { GET } = await import('@/app/api/unified/metrics/route');
      const response = await GET(createRequest('http://localhost:3000/api/unified/metrics?clientId=client-123'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Missing required parameters');
    });
  });

  describe('Comparison API', () => {
    it('returns 401 when user is unauthenticated', async () => {
      (createClient as jest.Mock).mockResolvedValue(
        buildSupabaseMock({
          user: null,
          authError: { message: 'Unauthorized' },
        })
      );

      const { GET } = await import('@/app/api/unified/comparison/route');

      const url = new URL('http://localhost:3000/api/unified/comparison');
      url.searchParams.set('clientId', 'client-123');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-01-31');

      const response = await GET(createRequest(url));
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Authentication required');
    });

    it('returns comparison payload when authenticated and authorized', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({ membership: true }));

      mockAggregationService.comparePlatforms.mockResolvedValue({
        success: true,
        data: {
          winner: 'google',
          metrics: { roas: { google: 2.3, meta: 1.8 } },
        },
        partialData: false,
        errors: [],
        warnings: [],
      });

      const { GET } = await import('@/app/api/unified/comparison/route');

      const url = new URL('http://localhost:3000/api/unified/comparison');
      url.searchParams.set('clientId', 'client-123');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-01-31');

      const response = await GET(createRequest(url));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.winner).toBe('google');
      expect(mockAggregationService.comparePlatforms).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-123',
          dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        })
      );
    });
  });

  describe('Time Series API', () => {
    it('returns summarized time-series data', async () => {
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
              total: { spend: 15, conversions: 2, impressions: 120, clicks: 12, roas: 2.5, ctr: 10 },
              meta: { spend: 9 },
              google: { spend: 6 },
            },
          ],
        },
        partialData: false,
        errors: [],
        warnings: [],
      });

      const { GET } = await import('@/app/api/unified/time-series/route');

      const url = new URL('http://localhost:3000/api/unified/time-series');
      url.searchParams.set('clientId', 'client-123');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-01-02');
      url.searchParams.set('granularity', 'day');

      const response = await GET(createRequest(url));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.summary.totalDataPoints).toBe(2);
      expect(body.meta.dataPoints).toBe(2);
      expect(mockAggregationService.getTimeSeriesData).toHaveBeenCalledWith(
        'client-123',
        { startDate: '2024-01-01', endDate: '2024-01-02' },
        'day'
      );
    });
  });

  describe('Insights API', () => {
    it('returns generated insights report', async () => {
      (createClient as jest.Mock).mockResolvedValue(buildSupabaseMock({ membership: true }));

      mockAggregationService.getAggregatedMetrics.mockResolvedValue({
        success: true,
        data: {
          total: {
            spend: 100,
            conversions: 5,
            impressions: 1000,
            clicks: 50,
            averageRoas: 1.5,
            averageCtr: 5,
            averageCpc: 2,
            averageCpa: 20,
            averageConversionRate: 10,
          },
          byPlatform: [
            { platform: 'meta', spend: 60, averageRoas: 1.2, averageCtr: 4 },
            { platform: 'google', spend: 40, averageRoas: 2.1, averageCtr: 6 },
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

      const { GET } = await import('@/app/api/unified/insights/route');

      const url = new URL('http://localhost:3000/api/unified/insights');
      url.searchParams.set('clientId', 'client-123');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-01-31');
      url.searchParams.set('platforms', 'google,meta');

      const response = await GET(createRequest(url));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.summary.totalInsights).toBeGreaterThan(0);
      expect(body.data.summary.platformSpecificInsights).toBeDefined();
      expect(mockAggregationService.getAggregatedMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-123',
          dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
          platforms: ['google', 'meta'],
        })
      );
    });
  });
});
