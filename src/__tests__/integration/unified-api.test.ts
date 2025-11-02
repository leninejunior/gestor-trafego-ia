/**
 * Unified API Integration Tests
 * 
 * Tests for unified API endpoints that aggregate data from multiple platforms
 * Requirements: 5.1, 5.2, 5.5
 */

import { NextRequest } from 'next/server';
import { GET as metricsGET, POST as metricsPOST } from '@/app/api/unified/metrics/route';
import { GET as comparisonGET, POST as comparisonPOST } from '@/app/api/unified/comparison/route';
import { GET as timeSeriesGET } from '@/app/api/unified/time-series/route';
import { GET as insightsGET } from '@/app/api/unified/insights/route';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({ data: [], error: null })),
              })),
            })),
          })),
          single: jest.fn(),
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({ data: [], error: null })),
            })),
          })),
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
      count: 0,
    })),
  })),
}));

// Mock PlatformAggregationService
jest.mock('@/lib/services/platform-aggregation', () => ({
  PlatformAggregationService: jest.fn().mockImplementation(() => ({
    getAggregatedMetrics: jest.fn(),
    comparePlatforms: jest.fn(),
    getTimeSeriesData: jest.fn(),
  })),
}));

describe('Unified API Integration Tests', () => {
  let mockSupabaseClient: any;
  let mockAggregationService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockMembership = {
    client_id: 'client-123',
    user_id: 'user-123',
  };

  const mockAggregatedData = {
    total: {
      spend: 2500,
      conversions: 110,
      impressions: 220000,
      clicks: 4400,
      averageRoas: 2.7,
      averageCtr: 2.0,
      averageCpc: 0.568,
      averageCpa: 22.7,
      averageConversionRate: 2.5,
    },
    byPlatform: [
      {
        platform: 'meta',
        spend: 1000,
        conversions: 50,
        impressions: 100000,
        clicks: 2000,
        ctr: 2.0,
        cpc: 0.5,
        cpa: 20,
        roas: 3.0,
        conversionRate: 2.5,
      },
      {
        platform: 'google',
        spend: 1500,
        conversions: 60,
        impressions: 120000,
        clicks: 2400,
        ctr: 2.0,
        cpc: 0.625,
        cpa: 25,
        roas: 2.4,
        conversionRate: 2.5,
      },
    ],
    dateRange: {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    },
    lastUpdated: new Date(),
    dataQuality: {
      metaDataAvailable: true,
      googleDataAvailable: true,
      totalCampaigns: 10,
      metaCampaigns: 5,
      googleCampaigns: 5,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockAggregationService = new (require('@/lib/services/platform-aggregation').PlatformAggregationService)();

    // Setup default mocks
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMembership,
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  describe('/api/unified/metrics', () => {
    describe('GET', () => {
      it('should return aggregated metrics successfully', async () => {
        mockAggregationService.getAggregatedMetrics.mockResolvedValue({
          success: true,
          data: mockAggregatedData,
          errors: [],
          warnings: [],
          partialData: false,
        });

        const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
        const request = new NextRequest(url);

        const response = await metricsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockAggregatedData);
        expect(data.meta.clientId).toBe('client-123');
        expect(data.meta.dateRange.startDate).toBe('2024-01-01');
        expect(data.meta.dateRange.endDate).toBe('2024-01-31');
      });

      it('should return 400 for missing required parameters', async () => {
        const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123');
        const request = new NextRequest(url);

        const response = await metricsGET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Start date and end date are required');
      });

      it('should return 400 for invalid date format', async () => {
        const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=01-01-2024&endDate=31-01-2024');
        const request = new NextRequest(url);

        const response = await metricsGET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('YYYY-MM-DD format');
      });

      it('should return 401 for unauthenticated user', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        });

        const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
        const request = new NextRequest(url);

        const response = await metricsGET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
      });

      it('should return 403 for unauthorized client access', async () => {
        mockSupabaseClient.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Not found'),
                }),
              }),
            }),
          }),
        });

        const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
        const request = new NextRequest(url);

        const response = await metricsGET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Access denied to this client');
      });

      it('should handle platform filtering', async () => {
        mockAggregationService.getAggregatedMetrics.mockResolvedValue({
          success: true,
          data: {
            ...mockAggregatedData,
            byPlatform: [mockAggregatedData.byPlatform[0]], // Only Meta
          },
          errors: [],
          warnings: [],
          partialData: false,
        });

        const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31&platforms=meta');
        const request = new NextRequest(url);

        const response = await metricsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.byPlatform).toHaveLength(1);
        expect(data.data.byPlatform[0].platform).toBe('meta');
      });
    });

    describe('POST', () => {
      it('should handle complex aggregation requests', async () => {
        mockAggregationService.getAggregatedMetrics.mockResolvedValue({
          success: true,
          data: mockAggregatedData,
          errors: [],
          warnings: [],
          partialData: false,
        });

        const requestBody = {
          clientId: 'client-123',
          dateRange: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
          platforms: ['meta', 'google'],
          includeInactive: false,
          groupBy: 'day',
          currency: 'USD',
        };

        const request = new NextRequest('http://localhost:3000/api/unified/metrics', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const response = await metricsPOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockAggregatedData);
      });
    });
  });

  describe('/api/unified/comparison', () => {
    describe('GET', () => {
      it('should return platform comparison successfully', async () => {
        const mockComparisonData = {
          dateRange: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
          platforms: {
            meta: mockAggregatedData.byPlatform[0],
            google: mockAggregatedData.byPlatform[1],
          },
          comparison: {
            betterPerformingPlatform: 'meta',
            metrics: {
              spend: {
                meta: 1000,
                google: 1500,
                difference: 50,
                winner: 'meta',
                significance: 'medium',
              },
              roas: {
                meta: 3.0,
                google: 2.4,
                difference: -20,
                winner: 'meta',
                significance: 'high',
              },
            },
          },
          insights: [
            'Meta Ads shows 25.0% better ROAS than Google Ads',
            'Google Ads has 25.0% higher cost per click',
          ],
        };

        mockAggregationService.comparePlatforms.mockResolvedValue({
          success: true,
          data: mockComparisonData,
          errors: [],
          warnings: [],
          partialData: false,
        });

        const url = new URL('http://localhost:3000/api/unified/comparison?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
        const request = new NextRequest(url);

        const response = await comparisonGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.comparison.betterPerformingPlatform).toBe('meta');
        expect(data.data.insights).toHaveLength(2);
      });

      it('should handle comparison with metrics filter', async () => {
        const url = new URL('http://localhost:3000/api/unified/comparison?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31&metrics=spend,roas,ctr');
        const request = new NextRequest(url);

        mockAggregationService.comparePlatforms.mockResolvedValue({
          success: true,
          data: {
            dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
            platforms: {},
            comparison: { betterPerformingPlatform: null, metrics: {} },
            insights: [],
          },
          errors: [],
          warnings: [],
          partialData: false,
        });

        const response = await comparisonGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.meta.metrics).toEqual(['spend', 'roas', 'ctr']);
      });
    });
  });

  describe('/api/unified/time-series', () => {
    describe('GET', () => {
      it('should return time series data successfully', async () => {
        const mockTimeSeriesData = {
          dateRange: {
            startDate: '2024-01-01',
            endDate: '2024-01-03',
          },
          granularity: 'day',
          dataPoints: [
            {
              date: '2024-01-01',
              meta: { platform: 'meta', spend: 100, conversions: 5 },
              google: { platform: 'google', spend: 150, conversions: 6 },
              total: { platform: 'meta', spend: 250, conversions: 11 },
            },
            {
              date: '2024-01-02',
              meta: { platform: 'meta', spend: 110, conversions: 6 },
              google: { platform: 'google', spend: 140, conversions: 5 },
              total: { platform: 'meta', spend: 250, conversions: 11 },
            },
            {
              date: '2024-01-03',
              meta: { platform: 'meta', spend: 90, conversions: 4 },
              google: { platform: 'google', spend: 160, conversions: 7 },
              total: { platform: 'meta', spend: 250, conversions: 11 },
            },
          ],
        };

        mockAggregationService.getTimeSeriesData.mockResolvedValue({
          success: true,
          data: mockTimeSeriesData,
          errors: [],
          warnings: [],
          partialData: false,
        });

        const url = new URL('http://localhost:3000/api/unified/time-series?clientId=client-123&startDate=2024-01-01&endDate=2024-01-03&granularity=day');
        const request = new NextRequest(url);

        const response = await timeSeriesGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.dataPoints).toHaveLength(3);
        expect(data.data.granularity).toBe('day');
        expect(data.summary.totalDataPoints).toBe(3);
      });

      it('should validate granularity limits', async () => {
        const url = new URL('http://localhost:3000/api/unified/time-series?clientId=client-123&startDate=2024-01-01&endDate=2024-04-01&granularity=day');
        const request = new NextRequest(url);

        const response = await timeSeriesGET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Daily granularity is limited to 90 days maximum');
      });

      it('should handle invalid granularity', async () => {
        const url = new URL('http://localhost:3000/api/unified/time-series?clientId=client-123&startDate=2024-01-01&endDate=2024-01-03&granularity=hour');
        const request = new NextRequest(url);

        const response = await timeSeriesGET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Granularity must be "day", "week", or "month"');
      });
    });
  });

  describe('/api/unified/insights', () => {
    describe('GET', () => {
      it('should return insights successfully', async () => {
        // Mock the aggregated metrics call that insights depend on
        mockAggregationService.getAggregatedMetrics.mockResolvedValue({
          success: true,
          data: mockAggregatedData,
          errors: [],
          warnings: [],
          partialData: false,
        });

        const url = new URL('http://localhost:3000/api/unified/insights?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
        const request = new NextRequest(url);

        const response = await insightsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.insights).toBeDefined();
        expect(data.data.summary.totalInsights).toBeGreaterThanOrEqual(0);
      });

      it('should filter insights by type', async () => {
        mockAggregationService.getAggregatedMetrics.mockResolvedValue({
          success: true,
          data: mockAggregatedData,
          errors: [],
          warnings: [],
          partialData: false,
        });

        const url = new URL('http://localhost:3000/api/unified/insights?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31&types=opportunity,warning');
        const request = new NextRequest(url);

        const response = await insightsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.meta.filters.types).toEqual(['opportunity', 'warning']);
      });

      it('should filter insights by minimum impact', async () => {
        mockAggregationService.getAggregatedMetrics.mockResolvedValue({
          success: true,
          data: mockAggregatedData,
          errors: [],
          warnings: [],
          partialData: false,
        });

        const url = new URL('http://localhost:3000/api/unified/insights?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31&minImpact=high');
        const request = new NextRequest(url);

        const response = await insightsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.meta.filters.minImpact).toBe('high');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockAggregationService.getAggregatedMetrics.mockResolvedValue({
        success: false,
        errors: [
          { platform: 'meta', error: 'Connection timeout', retryable: true },
          { platform: 'google', error: 'API rate limit exceeded', retryable: true },
        ],
        warnings: ['Partial data returned'],
        partialData: true,
      });

      const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
      const request = new NextRequest(url);

      const response = await metricsGET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to aggregate metrics');
      expect(data.details).toHaveLength(2);
    });

    it('should handle unexpected errors', async () => {
      mockAggregationService.getAggregatedMetrics.mockRejectedValue(
        new Error('Unexpected service error')
      );

      const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
      const request = new NextRequest(url);

      const response = await metricsGET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.message).toContain('Unexpected service error');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      mockAggregationService.getAggregatedMetrics.mockResolvedValue({
        success: true,
        data: mockAggregatedData,
        errors: [],
        warnings: [],
        partialData: false,
      });

      const requests = Array.from({ length: 10 }, () => {
        const url = new URL('http://localhost:3000/api/unified/metrics?clientId=client-123&startDate=2024-01-01&endDate=2024-01-31');
        return metricsGET(new NextRequest(url));
      });

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should complete within reasonable time (5 seconds for 10 concurrent requests)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});