/**
 * Multi-Platform Aggregation Integration Tests
 * 
 * Tests aggregation of data from both Meta and Google Ads platforms
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mock external dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/services/platform-aggregation');

describe('Multi-Platform Aggregation Integration', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockClientId = 'client-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unified Metrics Aggregation', () => {
    it('should aggregate metrics from both platforms correctly', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check
      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock Google Ads metrics
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00,
              google_ads_campaigns: {
                campaign_name: 'Google Campaign 1',
                status: 'ENABLED',
              },
            },
            {
              date: '2024-01-02',
              impressions: 1200,
              clicks: 60,
              conversions: 6,
              cost: 30.00,
              google_ads_campaigns: {
                campaign_name: 'Google Campaign 2',
                status: 'ENABLED',
              },
            },
          ],
          error: null,
        })
        // Mock Meta Ads metrics
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 2000,
              clicks: 100,
              conversions: 10,
              spend: 50.00,
              meta_campaigns: {
                name: 'Meta Campaign 1',
                status: 'ACTIVE',
              },
            },
            {
              date: '2024-01-02',
              impressions: 2400,
              clicks: 120,
              conversions: 12,
              spend: 60.00,
              meta_campaigns: {
                name: 'Meta Campaign 2',
                status: 'ACTIVE',
              },
            },
          ],
          error: null,
        });

      const { GET: unifiedMetricsGet } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-02');
      url.searchParams.set('platforms', 'google,meta');

      const request = new NextRequest(url);
      const response = await unifiedMetricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.aggregated).toBeDefined();
      expect(data.byPlatform).toHaveLength(2);

      // Verify aggregated totals
      expect(data.aggregated.total.impressions).toBe(6600); // 2200 + 4400
      expect(data.aggregated.total.clicks).toBe(330); // 110 + 220
      expect(data.aggregated.total.conversions).toBe(33); // 11 + 22
      expect(data.aggregated.total.spend).toBe(165.00); // 55 + 110

      // Verify platform breakdown
      const googlePlatform = data.byPlatform.find((p: any) => p.platform === 'google');
      const metaPlatform = data.byPlatform.find((p: any) => p.platform === 'meta');

      expect(googlePlatform.impressions).toBe(2200);
      expect(googlePlatform.spend).toBe(55.00);
      expect(metaPlatform.impressions).toBe(4400);
      expect(metaPlatform.spend).toBe(110.00);
    });

    it('should handle missing platform data gracefully', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock Google Ads metrics (has data)
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00,
            },
          ],
          error: null,
        })
        // Mock Meta Ads metrics (no data)
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      const { GET: unifiedMetricsGet } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('platforms', 'google,meta');

      const request = new NextRequest(url);
      const response = await unifiedMetricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.aggregated.total.impressions).toBe(1000);
      expect(data.byPlatform).toHaveLength(2);

      // Google platform should have data
      const googlePlatform = data.byPlatform.find((p: any) => p.platform === 'google');
      expect(googlePlatform.impressions).toBe(1000);

      // Meta platform should have zero values
      const metaPlatform = data.byPlatform.find((p: any) => p.platform === 'meta');
      expect(metaPlatform.impressions).toBe(0);
      expect(metaPlatform.clicks).toBe(0);
    });

    it('should calculate derived metrics correctly across platforms', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock platform data with different performance
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50, // 5% CTR
              conversions: 5, // 10% conversion rate
              cost: 25.00, // $0.50 CPC, $5.00 CPA
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 2000,
              clicks: 80, // 4% CTR
              conversions: 4, // 5% conversion rate
              spend: 40.00, // $0.50 CPC, $10.00 CPA
            },
          ],
          error: null,
        });

      const { GET: unifiedMetricsGet } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('platforms', 'google,meta');

      const request = new NextRequest(url);
      const response = await unifiedMetricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify aggregated derived metrics
      const aggregated = data.aggregated.total;
      expect(aggregated.ctr).toBeCloseTo(4.33, 2); // 130/3000 * 100
      expect(aggregated.conversionRate).toBeCloseTo(6.92, 2); // 9/130 * 100
      expect(aggregated.cpc).toBeCloseTo(0.50, 2); // 65/130
      expect(aggregated.cpa).toBeCloseTo(7.22, 2); // 65/9

      // Verify platform-specific metrics
      const googlePlatform = data.byPlatform.find((p: any) => p.platform === 'google');
      expect(googlePlatform.ctr).toBeCloseTo(5.00, 2);
      expect(googlePlatform.conversionRate).toBeCloseTo(10.00, 2);

      const metaPlatform = data.byPlatform.find((p: any) => p.platform === 'meta');
      expect(metaPlatform.ctr).toBeCloseTo(4.00, 2);
      expect(metaPlatform.conversionRate).toBeCloseTo(5.00, 2);
    });
  });

  describe('Platform Comparison', () => {
    it('should provide detailed platform comparison', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock platform data for comparison
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 10,
              cost: 25.00,
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 2000,
              clicks: 60,
              conversions: 6,
              spend: 30.00,
            },
          ],
          error: null,
        });

      const { GET: comparisonGet } = await import('@/app/api/unified/comparison/route');

      const url = new URL('http://localhost:3000/api/unified/comparison');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('metrics', 'impressions,clicks,conversions,ctr,conversionRate');

      const request = new NextRequest(url);
      const response = await comparisonGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comparison).toBeDefined();
      expect(data.winner).toBeDefined();

      // Verify comparison data structure
      expect(data.comparison.impressions.google).toBe(1000);
      expect(data.comparison.impressions.meta).toBe(2000);
      expect(data.comparison.impressions.winner).toBe('meta');

      expect(data.comparison.conversions.google).toBe(10);
      expect(data.comparison.conversions.meta).toBe(6);
      expect(data.comparison.conversions.winner).toBe('google');

      // Verify overall winner calculation
      expect(['google', 'meta']).toContain(data.winner.platform);
      expect(data.winner.score).toBeGreaterThan(0);
    });

    it('should handle time series comparison', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock time series data
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00,
            },
            {
              date: '2024-01-02',
              impressions: 1100,
              clicks: 55,
              conversions: 6,
              cost: 27.50,
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 2000,
              clicks: 80,
              conversions: 4,
              spend: 40.00,
            },
            {
              date: '2024-01-02',
              impressions: 2200,
              clicks: 88,
              conversions: 5,
              spend: 44.00,
            },
          ],
          error: null,
        });

      const { GET: timeSeriesGet } = await import('@/app/api/unified/time-series/route');

      const url = new URL('http://localhost:3000/api/unified/time-series');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-02');
      url.searchParams.set('granularity', 'daily');

      const request = new NextRequest(url);
      const response = await timeSeriesGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.timeSeries).toHaveLength(2); // 2 days
      expect(data.timeSeries[0].date).toBe('2024-01-01');
      expect(data.timeSeries[1].date).toBe('2024-01-02');

      // Verify each day has platform breakdown
      data.timeSeries.forEach((day: any) => {
        expect(day.platforms.google).toBeDefined();
        expect(day.platforms.meta).toBeDefined();
        expect(day.total).toBeDefined();
      });
    });
  });

  describe('Performance Analysis', () => {
    it('should identify best performing platform by metric', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock data where Google has better CTR, Meta has better volume
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 100, // 10% CTR
              conversions: 20, // 20% conversion rate
              cost: 50.00, // $0.50 CPC, $2.50 CPA
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 5000, // 5x more impressions
              clicks: 200, // 4% CTR
              conversions: 20, // 10% conversion rate
              spend: 100.00, // $0.50 CPC, $5.00 CPA
            },
          ],
          error: null,
        });

      const { GET: insightsGet } = await import('@/app/api/unified/insights/route');

      const url = new URL('http://localhost:3000/api/unified/insights');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');

      const request = new NextRequest(url);
      const response = await insightsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.insights).toBeDefined();
      expect(data.recommendations).toBeDefined();

      // Verify performance insights
      expect(data.insights.bestPerforming).toBeDefined();
      expect(data.insights.bestPerforming.ctr).toBe('google'); // Better CTR
      expect(data.insights.bestPerforming.impressions).toBe('meta'); // More volume
      expect(data.insights.bestPerforming.conversionRate).toBe('google'); // Better conversion rate

      // Verify recommendations are provided
      expect(data.recommendations).toBeInstanceOf(Array);
      expect(data.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate cost efficiency metrics', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock data with different cost efficiency
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 10,
              cost: 20.00, // Lower cost
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 10,
              spend: 40.00, // Higher cost
            },
          ],
          error: null,
        });

      const { GET: unifiedMetricsGet } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('platforms', 'google,meta');

      const request = new NextRequest(url);
      const response = await unifiedMetricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      const googlePlatform = data.byPlatform.find((p: any) => p.platform === 'google');
      const metaPlatform = data.byPlatform.find((p: any) => p.platform === 'meta');

      // Google should be more cost efficient
      expect(googlePlatform.cpc).toBe(0.40); // $20/50
      expect(googlePlatform.cpa).toBe(2.00); // $20/10
      expect(metaPlatform.cpc).toBe(0.80); // $40/50
      expect(metaPlatform.cpa).toBe(4.00); // $40/10

      // Verify cost efficiency comparison
      expect(googlePlatform.cpc).toBeLessThan(metaPlatform.cpc);
      expect(googlePlatform.cpa).toBeLessThan(metaPlatform.cpa);
    });
  });

  describe('Data Normalization', () => {
    it('should normalize different metric names between platforms', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock Google Ads data (uses 'cost')
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00, // Google uses 'cost'
            },
          ],
          error: null,
        })
        // Mock Meta Ads data (uses 'spend')
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 2000,
              clicks: 100,
              conversions: 10,
              spend: 50.00, // Meta uses 'spend'
            },
          ],
          error: null,
        });

      const { GET: unifiedMetricsGet } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('platforms', 'google,meta');

      const request = new NextRequest(url);
      const response = await unifiedMetricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify both platforms use normalized 'spend' field
      const googlePlatform = data.byPlatform.find((p: any) => p.platform === 'google');
      const metaPlatform = data.byPlatform.find((p: any) => p.platform === 'meta');

      expect(googlePlatform.spend).toBe(25.00); // Normalized from 'cost'
      expect(metaPlatform.spend).toBe(50.00); // Already 'spend'

      // Verify aggregated total uses normalized values
      expect(data.aggregated.total.spend).toBe(75.00);
    });

    it('should handle different date formats consistently', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock data with consistent date format
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01', // ISO date format
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00,
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01', // Same format
              impressions: 2000,
              clicks: 100,
              conversions: 10,
              spend: 50.00,
            },
          ],
          error: null,
        });

      const { GET: timeSeriesGet } = await import('@/app/api/unified/time-series/route');

      const url = new URL('http://localhost:3000/api/unified/time-series');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('granularity', 'daily');

      const request = new NextRequest(url);
      const response = await timeSeriesGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.timeSeries).toHaveLength(1);
      expect(data.timeSeries[0].date).toBe('2024-01-01');

      // Verify data is properly aggregated by date
      expect(data.timeSeries[0].total.impressions).toBe(3000);
      expect(data.timeSeries[0].total.clicks).toBe(150);
      expect(data.timeSeries[0].total.spend).toBe(75.00);
    });
  });

  describe('Error Handling', () => {
    it('should handle partial platform failures gracefully', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock Google Ads success, Meta Ads failure
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00,
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: new Error('Meta Ads API error'),
        });

      const { GET: unifiedMetricsGet } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('platforms', 'google,meta');

      const request = new NextRequest(url);
      const response = await unifiedMetricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Should return partial data with warnings
      expect(data.aggregated.total.impressions).toBe(1000); // Only Google data
      expect(data.byPlatform).toHaveLength(2);
      expect(data.warnings).toContain('Meta Ads data unavailable');

      const googlePlatform = data.byPlatform.find((p: any) => p.platform === 'google');
      const metaPlatform = data.byPlatform.find((p: any) => p.platform === 'meta');

      expect(googlePlatform.impressions).toBe(1000);
      expect(metaPlatform.impressions).toBe(0);
      expect(metaPlatform.error).toBe('Meta Ads API error');
    });

    it('should validate platform parameter', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      const { GET: unifiedMetricsGet } = await import('@/app/api/unified/metrics/route');

      const url = new URL('http://localhost:3000/api/unified/metrics');
      url.searchParams.set('clientId', mockClientId);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-01');
      url.searchParams.set('platforms', 'invalid,unknown'); // Invalid platforms

      const request = new NextRequest(url);
      const response = await unifiedMetricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Plataformas inválidas especificadas');
      expect(data.validPlatforms).toEqual(['google', 'meta']);
    });
  });
});