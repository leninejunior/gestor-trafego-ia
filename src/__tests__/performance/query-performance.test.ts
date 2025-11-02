/**
 * Performance Tests for Query Operations
 * Tests query performance with large datasets (90+ days, 100+ campaigns)
 */

import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { AdPlatform, DataQuery, CampaignInsight } from '@/lib/types/sync';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(),
            })),
          })),
        })),
        in: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(),
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe('Query Performance Tests', () => {
  let repository: HistoricalDataRepository;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new HistoricalDataRepository();
    
    const { createClient } = require('@/lib/supabase/server');
    mockSupabase = createClient();
  });

  /**
   * Helper to generate mock insights for performance testing
   */
  const generateMockInsights = (
    count: number,
    startDate: Date,
    campaignCount: number = 1
  ): CampaignInsight[] => {
    const insights: CampaignInsight[] = [];
    const daysSpan = Math.ceil(count / campaignCount);

    for (let i = 0; i < count; i++) {
      const campaignIndex = i % campaignCount;
      const dayOffset = Math.floor(i / campaignCount);
      
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayOffset);

      insights.push({
        id: `insight-${i}`,
        platform: AdPlatform.META,
        client_id: 'client-1',
        campaign_id: `campaign-${campaignIndex}`,
        campaign_name: `Campaign ${campaignIndex}`,
        date,
        impressions: Math.floor(Math.random() * 10000),
        clicks: Math.floor(Math.random() * 500),
        spend: Math.random() * 1000,
        conversions: Math.floor(Math.random() * 50),
        ctr: Math.random() * 10,
        cpc: Math.random() * 5,
        cpm: Math.random() * 50,
        conversion_rate: Math.random() * 20,
        is_deleted: false,
        synced_at: new Date(),
      });
    }

    return insights;
  };

  describe('Query Performance with 90+ Days', () => {
    it('should query 90 days of data in under 2 seconds', async () => {
      const startDate = new Date('2024-10-27');
      const endDate = new Date('2025-01-27'); // 92 days
      
      // Generate 92 days * 10 campaigns = 920 records
      const mockData = generateMockInsights(920, startDate, 10);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(results).toHaveLength(920);
      expect(executionTime).toBeLessThan(2000); // Less than 2 seconds
      
      console.log(`Query 90+ days: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });

    it('should handle 180 days of data efficiently', async () => {
      const startDate = new Date('2024-07-30');
      const endDate = new Date('2025-01-27'); // ~180 days
      
      // Generate 180 days * 10 campaigns = 1800 records
      const mockData = generateMockInsights(1800, startDate, 10);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(results).toHaveLength(1800);
      expect(executionTime).toBeLessThan(3000); // Less than 3 seconds for larger dataset
      
      console.log(`Query 180 days: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });

    it('should filter by specific campaigns efficiently', async () => {
      const startDate = new Date('2024-10-27');
      const endDate = new Date('2025-01-27');
      
      // Generate data for 100 campaigns
      const mockData = generateMockInsights(9200, startDate, 100);
      
      // Filter to only 5 campaigns
      const filteredData = mockData.filter(d => 
        ['campaign-0', 'campaign-1', 'campaign-2', 'campaign-3', 'campaign-4'].includes(d.campaign_id)
      );

      mockSupabase.from().select().in().gte().lte().order.mockResolvedValue({
        data: filteredData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
        campaign_ids: ['campaign-0', 'campaign-1', 'campaign-2', 'campaign-3', 'campaign-4'],
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(results.length).toBeLessThan(mockData.length);
      expect(executionTime).toBeLessThan(1500); // Should be faster with filtering
      
      console.log(`Query with campaign filter: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });
  });

  describe('Query Performance with 100+ Campaigns', () => {
    it('should handle 100 campaigns over 30 days', async () => {
      const startDate = new Date('2024-12-28');
      const endDate = new Date('2025-01-27'); // 30 days
      
      // Generate 30 days * 100 campaigns = 3000 records
      const mockData = generateMockInsights(3000, startDate, 100);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(results).toHaveLength(3000);
      expect(executionTime).toBeLessThan(2500);
      
      console.log(`Query 100 campaigns: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });

    it('should handle 200 campaigns over 7 days', async () => {
      const startDate = new Date('2025-01-20');
      const endDate = new Date('2025-01-27'); // 7 days
      
      // Generate 7 days * 200 campaigns = 1400 records
      const mockData = generateMockInsights(1400, startDate, 200);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(results).toHaveLength(1400);
      expect(executionTime).toBeLessThan(2000);
      
      console.log(`Query 200 campaigns: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });
  });

  describe('Aggregation Performance', () => {
    it('should aggregate metrics efficiently', async () => {
      const startDate = new Date('2024-10-27');
      const endDate = new Date('2025-01-27');
      
      const mockData = generateMockInsights(920, startDate, 10);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      
      // Perform aggregations
      const totalImpressions = results.reduce((sum, r) => sum + r.impressions, 0);
      const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
      const totalSpend = results.reduce((sum, r) => sum + r.spend, 0);
      const avgCTR = results.reduce((sum, r) => sum + r.ctr, 0) / results.length;
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(totalImpressions).toBeGreaterThan(0);
      expect(totalClicks).toBeGreaterThan(0);
      expect(totalSpend).toBeGreaterThan(0);
      expect(avgCTR).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(2500);
      
      console.log(`Aggregation: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });

    it('should group by campaign efficiently', async () => {
      const startDate = new Date('2024-10-27');
      const endDate = new Date('2025-01-27');
      
      const mockData = generateMockInsights(920, startDate, 10);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      
      // Group by campaign
      const byCampaign = results.reduce((acc, r) => {
        if (!acc[r.campaign_id]) {
          acc[r.campaign_id] = {
            campaign_id: r.campaign_id,
            campaign_name: r.campaign_name,
            total_impressions: 0,
            total_clicks: 0,
            total_spend: 0,
            total_conversions: 0,
          };
        }
        acc[r.campaign_id].total_impressions += r.impressions;
        acc[r.campaign_id].total_clicks += r.clicks;
        acc[r.campaign_id].total_spend += r.spend;
        acc[r.campaign_id].total_conversions += r.conversions;
        return acc;
      }, {} as Record<string, any>);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(Object.keys(byCampaign)).toHaveLength(10);
      expect(executionTime).toBeLessThan(2500);
      
      console.log(`Group by campaign: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle large result sets without memory issues', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2025-01-27'); // ~1 year
      
      // Generate 365 days * 50 campaigns = 18,250 records
      const mockData = generateMockInsights(18250, startDate, 50);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const memBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      const results = await repository.queryInsights(query);
      
      const endTime = performance.now();
      const memAfter = process.memoryUsage().heapUsed;
      
      const executionTime = endTime - startTime;
      const memUsed = (memAfter - memBefore) / 1024 / 1024; // MB

      expect(results).toHaveLength(18250);
      expect(memUsed).toBeLessThan(100); // Less than 100MB
      
      console.log(`Large dataset: ${executionTime.toFixed(2)}ms, Memory: ${memUsed.toFixed(2)}MB`);
    });
  });

  describe('Concurrent Query Performance', () => {
    it('should handle multiple concurrent queries', async () => {
      const startDate = new Date('2024-10-27');
      const endDate = new Date('2025-01-27');
      
      const mockData = generateMockInsights(920, startDate, 10);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const queries: DataQuery[] = [
        {
          client_id: 'client-1',
          platform: AdPlatform.META,
          date_from: startDate,
          date_to: endDate,
        },
        {
          client_id: 'client-2',
          platform: AdPlatform.GOOGLE,
          date_from: startDate,
          date_to: endDate,
        },
        {
          client_id: 'client-3',
          platform: AdPlatform.META,
          date_from: startDate,
          date_to: endDate,
        },
      ];

      const startTime = performance.now();
      
      const results = await Promise.all(
        queries.map(q => repository.queryInsights(q))
      );
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(3);
      results.forEach(r => expect(r).toHaveLength(920));
      expect(executionTime).toBeLessThan(3000); // Should be faster than sequential
      
      console.log(`Concurrent queries: ${executionTime.toFixed(2)}ms for 3 queries`);
    });
  });

  describe('Date Range Performance', () => {
    it('should perform well with narrow date ranges', async () => {
      const startDate = new Date('2025-01-26');
      const endDate = new Date('2025-01-27'); // 1 day
      
      const mockData = generateMockInsights(100, startDate, 100);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(executionTime).toBeLessThan(500); // Very fast for small range
      
      console.log(`Narrow date range: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });

    it('should handle maximum retention period (365 days)', async () => {
      const startDate = new Date('2024-01-27');
      const endDate = new Date('2025-01-27'); // 365 days
      
      // Generate 365 days * 25 campaigns = 9,125 records
      const mockData = generateMockInsights(9125, startDate, 25);

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: startDate,
        date_to: endDate,
      };

      const startTime = performance.now();
      const results = await repository.queryInsights(query);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(results).toHaveLength(9125);
      expect(executionTime).toBeLessThan(4000); // Allow more time for full year
      
      console.log(`365 days: ${executionTime.toFixed(2)}ms for ${results.length} records`);
    });
  });
});
