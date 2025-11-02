/**
 * Integration Tests for Hybrid Data Retrieval
 * Tests complete flow of fetching data from cache and API
 */

import { HybridDataService, DataSource } from '@/lib/services/hybrid-data-service';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { GoogleAdsSyncAdapter } from '@/lib/sync/google-ads-sync-adapter';
import { AdPlatform, DataQuery, SyncConfig } from '@/lib/types/sync';

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
      insert: jest.fn(() => ({
        onConflict: jest.fn(() => ({
          select: jest.fn(),
        })),
      })),
    })),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Hybrid Data Retrieval Integration', () => {
  let service: HybridDataService;
  let repository: HistoricalDataRepository;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    service = new HybridDataService();
    repository = new HistoricalDataRepository();
    
    const { createClient } = require('@/lib/supabase/server');
    mockSupabase = createClient();
  });

  describe('Cache-First Strategy', () => {
    it('should retrieve historical data from cache only', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: new Date('2025-01-01'),
        date_to: new Date('2025-01-10'),
      };

      const mockCachedData = [
        {
          id: 'insight-1',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date('2025-01-05'),
          impressions: 1000,
          clicks: 50,
          spend: 100,
          conversions: 5,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 10,
          is_deleted: false,
          synced_at: new Date('2025-01-06'),
        },
      ];

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockCachedData,
        error: null,
      });

      const result = await service.getData(query);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.data).toHaveLength(1);
      expect(result.cache_hit_rate).toBe(1.0);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('API-First Strategy', () => {
    it('should retrieve recent data from API', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
        campaign_ids: ['campaign-1'],
      };

      const mockConfig: SyncConfig = {
        id: 'config-1',
        platform: AdPlatform.GOOGLE,
        client_id: 'client-1',
        account_id: '123-456-7890',
        access_token: 'test-token',
        sync_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = new GoogleAdsSyncAdapter(mockConfig, 'dev-token');

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              campaign: { id: 'campaign-1', name: 'Test Campaign' },
              segments: { date: '2025-01-25' },
              metrics: {
                impressions: '1000',
                clicks: '50',
                costMicros: '100000000',
                conversions: 5,
              },
            },
          ],
        }),
      });

      const result = await service.getData(query, adapter);

      expect(result.source).toBe(DataSource.API);
      expect(result.data).toHaveLength(1);
      expect(result.api_status).toBe('success');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should fallback to cache when API fails', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
        campaign_ids: ['campaign-1'],
      };

      const mockConfig: SyncConfig = {
        id: 'config-1',
        platform: AdPlatform.GOOGLE,
        client_id: 'client-1',
        account_id: '123-456-7890',
        access_token: 'invalid-token',
        sync_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = new GoogleAdsSyncAdapter(mockConfig, 'dev-token');

      // Mock API failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid token' } }),
      });

      // Mock cache fallback
      const mockCachedData = [
        {
          id: 'insight-1',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date('2025-01-25'),
          impressions: 800,
          clicks: 40,
          spend: 80,
          conversions: 4,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 10,
          is_deleted: false,
          synced_at: new Date('2025-01-24'),
        },
      ];

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockCachedData,
        error: null,
      });

      const result = await service.getData(query, adapter);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.data).toHaveLength(1);
      expect(result.api_status).toBe('failed');
      expect(result.fallback_used).toBe(true);
    });
  });

  describe('Hybrid Strategy', () => {
    it('should combine cache and API data seamlessly', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: new Date('2025-01-10'),
        date_to: new Date('2025-01-27'),
      };

      const mockConfig: SyncConfig = {
        id: 'config-1',
        platform: AdPlatform.GOOGLE,
        client_id: 'client-1',
        account_id: '123-456-7890',
        access_token: 'test-token',
        sync_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = new GoogleAdsSyncAdapter(mockConfig, 'dev-token');

      // Mock historical cache data
      const mockHistoricalData = [
        {
          id: 'insight-1',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date('2025-01-10'),
          impressions: 500,
          clicks: 25,
          spend: 50,
          conversions: 2,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 8,
          is_deleted: false,
          synced_at: new Date('2025-01-11'),
        },
      ];

      mockSupabase.from().select().eq().gte().lte().order
        .mockResolvedValueOnce({
          data: mockHistoricalData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      // Mock recent API data
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { campaign: { id: 'campaign-1', name: 'Test Campaign' } },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                campaign: { id: 'campaign-1', name: 'Test Campaign' },
                segments: { date: '2025-01-25' },
                metrics: {
                  impressions: '1000',
                  clicks: '50',
                  costMicros: '100000000',
                  conversions: 5,
                },
              },
            ],
          }),
        });

      const result = await service.getData(query, adapter);

      expect(result.source).toBe(DataSource.HYBRID);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.api_status).toBe('success');
      
      // Verify data from both sources
      const historicalDates = result.data.filter(
        d => d.date < new Date('2025-01-20')
      );
      const recentDates = result.data.filter(
        d => d.date >= new Date('2025-01-20')
      );
      
      expect(historicalDates.length).toBeGreaterThan(0);
      expect(recentDates.length).toBeGreaterThan(0);
    });

    it('should handle partial API failure in hybrid mode', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: new Date('2025-01-10'),
        date_to: new Date('2025-01-27'),
      };

      const mockConfig: SyncConfig = {
        id: 'config-1',
        platform: AdPlatform.GOOGLE,
        client_id: 'client-1',
        account_id: '123-456-7890',
        access_token: 'test-token',
        sync_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = new GoogleAdsSyncAdapter(mockConfig, 'dev-token');

      // Mock historical cache data
      const mockHistoricalData = [
        {
          id: 'insight-1',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date('2025-01-10'),
          impressions: 500,
          clicks: 25,
          spend: 50,
          conversions: 2,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 8,
          is_deleted: false,
          synced_at: new Date('2025-01-11'),
        },
      ];

      // Mock recent cache data (fallback)
      const mockRecentCacheData = [
        {
          id: 'insight-2',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date('2025-01-25'),
          impressions: 800,
          clicks: 40,
          spend: 80,
          conversions: 4,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 10,
          is_deleted: false,
          synced_at: new Date('2025-01-24'),
        },
      ];

      mockSupabase.from().select().eq().gte().lte().order
        .mockResolvedValueOnce({
          data: mockHistoricalData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockRecentCacheData,
          error: null,
        });

      // Mock API failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await service.getData(query, adapter);

      expect(result.source).toBe(DataSource.HYBRID);
      expect(result.data).toHaveLength(2);
      expect(result.api_status).toBe('partial');
      expect(result.fallback_used).toBe(true);
    });
  });

  describe('Data Freshness Validation', () => {
    it('should validate fresh data correctly', async () => {
      const freshData = [
        {
          id: 'insight-1',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date(),
          impressions: 1000,
          clicks: 50,
          spend: 100,
          conversions: 5,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 10,
          is_deleted: false,
          synced_at: new Date(), // Just synced
        },
      ];

      const validation = await service.validateDataFreshness(freshData, 24);

      expect(validation.is_fresh).toBe(true);
      expect(validation.needs_refresh).toBe(false);
      expect(validation.age_hours).toBeLessThan(1);
    });

    it('should detect stale data', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48);

      const staleData = [
        {
          id: 'insight-1',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date('2025-01-10'),
          impressions: 1000,
          clicks: 50,
          spend: 100,
          conversions: 5,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 10,
          is_deleted: false,
          synced_at: oldDate,
        },
      ];

      const validation = await service.validateDataFreshness(staleData, 24);

      expect(validation.is_fresh).toBe(false);
      expect(validation.needs_refresh).toBe(true);
      expect(validation.age_hours).toBeGreaterThan(24);
    });
  });

  describe('Date Comparison Edge Cases', () => {
    it('should handle exactly threshold day correctly', async () => {
      // Test data exactly on the threshold boundary
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 7);
      thresholdDate.setHours(0, 0, 0, 0);

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: thresholdDate,
        date_to: thresholdDate,
      };

      const recommendation = service.getDataSourceRecommendation(query);
      
      // Should be considered recent (inclusive boundary)
      expect(recommendation).toBe(DataSource.API);
    });

    it('should handle midnight boundaries correctly', async () => {
      const midnightToday = new Date();
      midnightToday.setHours(0, 0, 0, 0);

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: midnightToday,
        date_to: midnightToday,
      };

      const recommendation = service.getDataSourceRecommendation(query);
      
      // Today should always be recent
      expect(recommendation).toBe(DataSource.API);
    });

    it('should handle timezone differences consistently', async () => {
      // Create dates in different timezone representations
      const utcDate = new Date('2025-01-20T00:00:00.000Z');
      const localDate = new Date('2025-01-20');

      const utcQuery: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: utcDate,
        date_to: utcDate,
      };

      const localQuery: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: localDate,
        date_to: localDate,
      };

      const utcRecommendation = service.getDataSourceRecommendation(utcQuery);
      const localRecommendation = service.getDataSourceRecommendation(localQuery);
      
      // Both should give same recommendation regardless of timezone representation
      expect(utcRecommendation).toBe(localRecommendation);
    });

    it('should handle date range spanning threshold correctly', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);

      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: oldDate,
        date_to: recentDate,
      };

      const recommendation = service.getDataSourceRecommendation(query);
      
      // Should be hybrid when spanning threshold
      expect(recommendation).toBe(DataSource.HYBRID);
    });
  });

  describe('Refresh Recent Data', () => {
    it('should refresh and store recent data', async () => {
      const mockConfig: SyncConfig = {
        id: 'config-1',
        platform: AdPlatform.GOOGLE,
        client_id: 'client-1',
        account_id: '123-456-7890',
        access_token: 'test-token',
        sync_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = new GoogleAdsSyncAdapter(mockConfig, 'dev-token');

      // Mock campaigns fetch
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { campaign: { id: 'campaign-1', name: 'Campaign 1', status: 'ENABLED' } },
            ],
          }),
        })
        // Mock insights fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                campaign: { id: 'campaign-1', name: 'Campaign 1' },
                segments: { date: '2025-01-25' },
                metrics: {
                  impressions: '1000',
                  clicks: '50',
                  costMicros: '100000000',
                  conversions: 5,
                },
              },
            ],
          }),
        });

      // Mock insert
      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: [{ id: 'insight-1' }],
        error: null,
      });

      const recordsStored = await service.refreshRecentData(
        'client-1',
        AdPlatform.GOOGLE,
        adapter
      );

      expect(recordsStored).toBeGreaterThan(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('campaign_insights_history');
    });
  });

  describe('Health Check Integration', () => {
    it('should proactively use cache when API is unhealthy', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.GOOGLE,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
      };

      const mockConfig: SyncConfig = {
        id: 'config-1',
        platform: AdPlatform.GOOGLE,
        client_id: 'client-1',
        account_id: '123-456-7890',
        access_token: 'test-token',
        sync_status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const adapter = new GoogleAdsSyncAdapter(mockConfig, 'dev-token');

      // Mock health check failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Service unavailable' } }),
      });

      // Mock cache data
      const mockCachedData = [
        {
          id: 'insight-1',
          platform: AdPlatform.GOOGLE,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Test Campaign',
          date: new Date('2025-01-25'),
          impressions: 800,
          clicks: 40,
          spend: 80,
          conversions: 4,
          ctr: 5.0,
          cpc: 2.0,
          cpm: 100,
          conversion_rate: 10,
          is_deleted: false,
          synced_at: new Date('2025-01-24'),
        },
      ];

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: mockCachedData,
        error: null,
      });

      const result = await service.getDataWithHealthCheck(query, adapter);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.fallback_used).toBe(true);
      expect(result.error_message).toContain('API unavailable');
    });
  });
});
