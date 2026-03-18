/**
 * Unit Tests for HybridDataService
 * Tests hybrid data retrieval strategy combining cache and API
 */

import { HybridDataService, DataSource } from '../hybrid-data-service';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { BaseSyncAdapter } from '@/lib/sync/base-sync-adapter';
import { AdPlatform, CampaignInsight, DataQuery } from '@/lib/types/sync';

// Mock dependencies
jest.mock('@/lib/repositories/historical-data-repository');
jest.mock('@/lib/sync/base-sync-adapter');

describe('HybridDataService', () => {
  let service: HybridDataService;
  let mockRepository: jest.Mocked<HistoricalDataRepository>;
  let mockAdapter: jest.Mocked<BaseSyncAdapter>;

  const createMockInsight = (overrides?: Partial<CampaignInsight>): CampaignInsight => ({
    id: 'insight-1',
    platform: AdPlatform.META,
    client_id: 'client-1',
    campaign_id: 'campaign-1',
    campaign_name: 'Test Campaign',
    date: new Date('2025-01-15'),
    impressions: 1000,
    clicks: 50,
    spend: 100,
    conversions: 5,
    ctr: 5.0,
    cpc: 2.0,
    cpm: 100,
    conversion_rate: 10,
    is_deleted: false,
    synced_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    service = new HybridDataService();
    mockRepository = (service as any).repository as jest.Mocked<HistoricalDataRepository>;
    
    // Create mock adapter
    mockAdapter = {
      platform: AdPlatform.META,
      fetchCampaigns: jest.fn(),
      fetchInsights: jest.fn(),
      validateConnection: jest.fn(),
    } as any;
  });

  describe('getData - Recent Data Strategy', () => {
    it('should fetch recent data from API', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'), // Recent
        date_to: new Date('2025-01-27'),
        campaign_ids: ['campaign-1'],
      };

      const mockInsights = [createMockInsight()];
      mockAdapter.fetchInsights.mockResolvedValue(mockInsights);

      const result = await service.getData(query, mockAdapter);

      expect(result.source).toBe(DataSource.API);
      expect(result.data).toEqual(mockInsights);
      expect(result.api_status).toBe('success');
      expect(result.fallback_used).toBe(false);
      expect(mockAdapter.fetchInsights).toHaveBeenCalled();
    });

    it('should fallback to cache when API fails', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
        campaign_ids: ['campaign-1'],
      };

      const mockCachedInsights = [createMockInsight()];
      
      mockAdapter.fetchInsights.mockRejectedValue(new Error('API Error'));
      mockRepository.queryInsights.mockResolvedValue(mockCachedInsights);

      const result = await service.getData(query, mockAdapter);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.data).toEqual(mockCachedInsights);
      expect(result.api_status).toBe('failed');
      expect(result.fallback_used).toBe(true);
      expect(result.error_message).toContain('API Error');
    });
  });

  describe('getData - Historical Data Strategy', () => {
    it('should fetch historical data from cache', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-01'), // Historical
        date_to: new Date('2025-01-10'),
      };

      const mockCachedInsights = [
        createMockInsight({ date: new Date('2025-01-01') }),
        createMockInsight({ date: new Date('2025-01-02') }),
      ];
      
      mockRepository.queryInsights.mockResolvedValue(mockCachedInsights);

      const result = await service.getData(query);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.data).toEqual(mockCachedInsights);
      expect(result.cache_hit_rate).toBe(1.0);
      expect(mockRepository.queryInsights).toHaveBeenCalledWith(query);
    });
  });

  describe('getData - Hybrid Strategy', () => {
    it('should combine cache and API data', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-10'), // Spans historical and recent
        date_to: new Date('2025-01-27'),
      };

      const historicalInsights = [
        createMockInsight({ date: new Date('2025-01-10') }),
        createMockInsight({ date: new Date('2025-01-15') }),
      ];

      const recentInsights = [
        createMockInsight({ date: new Date('2025-01-25') }),
        createMockInsight({ date: new Date('2025-01-27') }),
      ];

      mockRepository.queryInsights.mockResolvedValue(historicalInsights);
      mockAdapter.fetchInsights.mockResolvedValue(recentInsights);

      const result = await service.getData(query, mockAdapter);

      expect(result.source).toBe(DataSource.HYBRID);
      expect(result.data).toHaveLength(4);
      expect(result.api_status).toBe('success');
      expect(result.cache_hit_rate).toBeCloseTo(0.5, 1); // 2 out of 4 from cache
    });

    it('should handle partial API failure in hybrid mode', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-10'),
        date_to: new Date('2025-01-27'),
      };

      const historicalInsights = [createMockInsight({ date: new Date('2025-01-10') })];
      const recentCachedInsights = [createMockInsight({ date: new Date('2025-01-25') })];

      mockRepository.queryInsights
        .mockResolvedValueOnce(historicalInsights) // Historical query
        .mockResolvedValueOnce(recentCachedInsights); // Recent fallback query

      mockAdapter.fetchInsights.mockRejectedValue(new Error('API Error'));

      const result = await service.getData(query, mockAdapter);

      expect(result.source).toBe(DataSource.HYBRID);
      expect(result.data).toHaveLength(2);
      expect(result.api_status).toBe('partial');
      expect(result.fallback_used).toBe(true);
    });
  });

  describe('refreshRecentData', () => {
    it('should refresh recent data and store in cache', async () => {
      const mockCampaigns = [
        { id: 'campaign-1', name: 'Campaign 1', status: 'ACTIVE', platform: AdPlatform.META, account_id: 'acc-1' },
        { id: 'campaign-2', name: 'Campaign 2', status: 'ACTIVE', platform: AdPlatform.META, account_id: 'acc-1' },
      ];

      const mockInsights = [
        createMockInsight({ campaign_id: 'campaign-1' }),
        createMockInsight({ campaign_id: 'campaign-2' }),
      ];

      mockAdapter.fetchCampaigns.mockResolvedValue(mockCampaigns);
      mockAdapter.fetchInsights.mockResolvedValue(mockInsights);
      mockRepository.storeInsights.mockResolvedValue(2);

      const recordsStored = await service.refreshRecentData(
        'client-1',
        AdPlatform.META,
        mockAdapter
      );

      expect(recordsStored).toBe(2);
      expect(mockAdapter.fetchCampaigns).toHaveBeenCalledWith('client-1');
      expect(mockAdapter.fetchInsights).toHaveBeenCalledTimes(2);
      expect(mockRepository.storeInsights).toHaveBeenCalled();
    });

    it('should throw error on refresh failure', async () => {
      mockAdapter.fetchCampaigns.mockRejectedValue(new Error('Fetch failed'));

      await expect(
        service.refreshRecentData('client-1', AdPlatform.META, mockAdapter)
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('validateDataFreshness', () => {
    it('should validate fresh data', async () => {
      const recentInsights = [
        createMockInsight({ synced_at: new Date() }), // Just synced
      ];

      const result = await service.validateDataFreshness(recentInsights, 24);

      expect(result.is_fresh).toBe(true);
      expect(result.needs_refresh).toBe(false);
      expect(result.age_hours).toBeLessThan(1);
    });

    it('should detect stale data', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48); // 48 hours ago

      const staleInsights = [
        createMockInsight({ synced_at: oldDate }),
      ];

      const result = await service.validateDataFreshness(staleInsights, 24);

      expect(result.is_fresh).toBe(false);
      expect(result.needs_refresh).toBe(true);
      expect(result.age_hours).toBeGreaterThan(24);
    });

    it('should handle empty data', async () => {
      const result = await service.validateDataFreshness([], 24);

      expect(result.is_fresh).toBe(false);
      expect(result.needs_refresh).toBe(true);
      expect(result.last_sync).toBeUndefined();
    });

    it('should use most recent sync time from multiple insights', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 48);

      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 1);

      const insights = [
        createMockInsight({ synced_at: oldDate }),
        createMockInsight({ synced_at: recentDate }),
      ];

      const result = await service.validateDataFreshness(insights, 24);

      expect(result.is_fresh).toBe(true);
      expect(result.last_sync).toEqual(recentDate);
    });
  });

  describe('getDataSourceRecommendation', () => {
    it('should recommend API for recent data', () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
      };

      const recommendation = service.getDataSourceRecommendation(query);

      expect(recommendation).toBe(DataSource.API);
    });

    it('should recommend CACHE for historical data', () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-01'),
        date_to: new Date('2025-01-10'),
      };

      const recommendation = service.getDataSourceRecommendation(query);

      expect(recommendation).toBe(DataSource.CACHE);
    });

    it('should recommend HYBRID for mixed data', () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-10'),
        date_to: new Date('2025-01-27'),
      };

      const recommendation = service.getDataSourceRecommendation(query);

      expect(recommendation).toBe(DataSource.HYBRID);
    });
  });

  describe('isApiHealthy', () => {
    it('should return true when API is healthy', async () => {
      mockAdapter.validateConnection.mockResolvedValue({
        valid: true,
        platform: AdPlatform.META,
      });

      const isHealthy = await service.isApiHealthy(mockAdapter);

      expect(isHealthy).toBe(true);
    });

    it('should return false when API is unhealthy', async () => {
      mockAdapter.validateConnection.mockResolvedValue({
        valid: false,
        platform: AdPlatform.META,
        error: 'Connection failed',
      });

      const isHealthy = await service.isApiHealthy(mockAdapter);

      expect(isHealthy).toBe(false);
    });

    it('should return false on validation error', async () => {
      mockAdapter.validateConnection.mockRejectedValue(new Error('Validation error'));

      const isHealthy = await service.isApiHealthy(mockAdapter);

      expect(isHealthy).toBe(false);
    });
  });

  describe('getDataWithHealthCheck', () => {
    it('should use cache when API is unhealthy', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
      };

      const mockCachedInsights = [createMockInsight()];

      mockAdapter.validateConnection.mockResolvedValue({
        valid: false,
        platform: AdPlatform.META,
        error: 'API down',
      });
      mockRepository.queryInsights.mockResolvedValue(mockCachedInsights);

      const result = await service.getDataWithHealthCheck(query, mockAdapter);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.fallback_used).toBe(true);
      expect(result.error_message).toContain('API unavailable');
    });

    it('should use API when healthy', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
        campaign_ids: ['campaign-1'],
      };

      const mockInsights = [createMockInsight()];

      mockAdapter.validateConnection.mockResolvedValue({
        valid: true,
        platform: AdPlatform.META,
      });
      mockAdapter.fetchInsights.mockResolvedValue(mockInsights);

      const result = await service.getDataWithHealthCheck(query, mockAdapter);

      expect(result.source).toBe(DataSource.API);
      expect(result.api_status).toBe('success');
    });

    it('should force cache when requested', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
      };

      const mockCachedInsights = [createMockInsight()];
      mockRepository.queryInsights.mockResolvedValue(mockCachedInsights);

      const result = await service.getDataWithHealthCheck(query, mockAdapter, true);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.fallback_used).toBe(true);
      expect(mockAdapter.validateConnection).not.toHaveBeenCalled();
    });
  });

  describe('hasCachedData', () => {
    it('should check if cache has data for range', async () => {
      mockRepository.hasDataForRange.mockResolvedValue(true);

      const hasData = await service.hasCachedData(
        'client-1',
        AdPlatform.META,
        {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-10'),
        }
      );

      expect(hasData).toBe(true);
      expect(mockRepository.hasDataForRange).toHaveBeenCalledWith(
        'client-1',
        AdPlatform.META,
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('Emergency Cache', () => {
    it('should use emergency cache on critical error', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
      };

      const mockCachedInsights = [createMockInsight()];

      // Simulate critical error in getData
      mockAdapter.fetchInsights.mockRejectedValue(new Error('Critical system error'));
      mockRepository.queryInsights.mockResolvedValue(mockCachedInsights);

      const result = await service.getData(query, mockAdapter);

      expect(result.source).toBe(DataSource.CACHE);
      expect(result.emergency_cache).toBe(true);
      expect(result.error_message).toContain('Critical system error');
    });

    it('should handle emergency cache failure', async () => {
      const query: DataQuery = {
        client_id: 'client-1',
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27'),
      };

      mockAdapter.fetchInsights.mockRejectedValue(new Error('API Error'));
      mockRepository.queryInsights.mockRejectedValue(new Error('Cache Error'));

      const result = await service.getData(query, mockAdapter);

      expect(result.data).toHaveLength(0);
      expect(result.emergency_cache).toBe(true);
      expect(result.error_message).toContain('Cache also unavailable');
    });
  });
});
