/**
 * Hybrid Data Service - Fallback Strategy Tests
 * Tests the fallback mechanisms when API fails
 */

import { HybridDataService, DataSource } from '../hybrid-data-service';
import { BaseSyncAdapter } from '@/lib/sync/base-sync-adapter';
import { AdPlatform, DataQuery, CampaignInsight } from '@/lib/types/sync';

// Mock adapter that can simulate failures
class MockAdapter extends BaseSyncAdapter {
  public shouldFail = false;
  public shouldFailHealthCheck = false;
  platform = AdPlatform.META;

  async authenticate(): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Mock API authentication failed');
    }
  }

  async fetchCampaigns(): Promise<any[]> {
    if (this.shouldFail) {
      throw new Error('Mock API fetch campaigns failed');
    }
    return [
      { id: 'campaign-1', name: 'Test Campaign 1' },
      { id: 'campaign-2', name: 'Test Campaign 2' }
    ];
  }

  async fetchInsights(): Promise<CampaignInsight[]> {
    if (this.shouldFail) {
      throw new Error('Mock API fetch insights failed');
    }
    
    return [
      {
        id: 'insight-1',
        platform: AdPlatform.META,
        client_id: 'client-123',
        campaign_id: 'campaign-1',
        campaign_name: 'Test Campaign 1',
        date: new Date('2025-01-27'),
        impressions: 1000,
        clicks: 50,
        spend: 100,
        conversions: 5,
        ctr: 5.0,
        cpc: 2.0,
        cpm: 100.0,
        conversion_rate: 10.0,
        is_deleted: false,
        synced_at: new Date()
      }
    ];
  }

  normalizePlatformData(rawData: any): CampaignInsight {
    return rawData;
  }

  async validateConnection() {
    if (this.shouldFailHealthCheck) {
      return { valid: false, errors: ['Health check failed'] };
    }
    return { valid: true };
  }
}

describe('HybridDataService - Fallback Strategy', () => {
  let service: HybridDataService;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    service = new HybridDataService();
    mockAdapter = new MockAdapter({
      id: 'sync-config-1',
      platform: AdPlatform.META,
      client_id: 'client-123',
      account_id: 'account-123',
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      sync_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });
  });

  describe('Automatic Fallback', () => {
    it('should fallback to cache when API fails for recent data', async () => {
      // Simulate API failure
      mockAdapter.shouldFail = true;

      const query: DataQuery = {
        client_id: 'client-123',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'), // Recent data
        date_to: new Date('2025-01-27')
      };

      const response = await service.getData(query, mockAdapter);

      // Should fallback to cache
      expect(response.source).toBe(DataSource.CACHE);
      expect(response.api_status).toBe('failed');
      expect(response.fallback_used).toBe(true);
      expect(response.error_message).toBeDefined();
    });

    it('should indicate partial failure in hybrid queries', async () => {
      // Simulate API failure
      mockAdapter.shouldFail = true;

      const query: DataQuery = {
        client_id: 'client-123',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-01'), // Historical + recent
        date_to: new Date('2025-01-27')
      };

      const response = await service.getData(query, mockAdapter);

      // Should be hybrid with partial failure
      expect(response.source).toBe(DataSource.HYBRID);
      expect(response.api_status).toBe('partial');
      expect(response.fallback_used).toBe(true);
    });
  });

  describe('Emergency Cache', () => {
    it('should use emergency cache on critical errors', async () => {
      // Simulate critical error
      mockAdapter.shouldFail = true;

      const query: DataQuery = {
        client_id: 'client-123',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27')
      };

      const response = await service.getData(query, mockAdapter);

      // Should use emergency cache
      expect(response.fallback_used).toBe(true);
      expect(response.api_status).toBe('failed');
    });
  });

  describe('API Health Checks', () => {
    it('should check API health before fetching', async () => {
      const isHealthy = await service.isApiHealthy(mockAdapter);
      expect(isHealthy).toBe(true);
    });

    it('should return false when health check fails', async () => {
      mockAdapter.shouldFailHealthCheck = true;
      const isHealthy = await service.isApiHealthy(mockAdapter);
      expect(isHealthy).toBe(false);
    });

    it('should use cache proactively when API is unhealthy', async () => {
      mockAdapter.shouldFailHealthCheck = true;

      const query: DataQuery = {
        client_id: 'client-123',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27')
      };

      const response = await service.getDataWithHealthCheck(query, mockAdapter);

      // Should use cache without attempting API
      expect(response.source).toBe(DataSource.CACHE);
      expect(response.api_status).toBe('failed');
      expect(response.fallback_used).toBe(true);
      expect(response.error_message).toContain('API unavailable');
    });
  });

  describe('Force Cache Mode', () => {
    it('should use cache only when forced', async () => {
      const query: DataQuery = {
        client_id: 'client-123',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27')
      };

      const response = await service.getDataWithHealthCheck(
        query,
        mockAdapter,
        true // forceCache
      );

      // Should use cache only
      expect(response.source).toBe(DataSource.CACHE);
      expect(response.fallback_used).toBe(true);
      expect(response.error_message).toContain('Cache-only mode');
    });
  });

  describe('Response Indicators', () => {
    it('should include all status indicators in response', async () => {
      mockAdapter.shouldFail = true;

      const query: DataQuery = {
        client_id: 'client-123',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27')
      };

      const response = await service.getData(query, mockAdapter);

      // Check all indicators are present
      expect(response).toHaveProperty('source');
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('api_status');
      expect(response).toHaveProperty('fallback_used');
      expect(response).toHaveProperty('error_message');
    });

    it('should not set fallback indicators when API succeeds', async () => {
      const query: DataQuery = {
        client_id: 'client-123',
        platform: AdPlatform.META,
        date_from: new Date('2025-01-25'),
        date_to: new Date('2025-01-27')
      };

      const response = await service.getData(query, mockAdapter);

      // Should not indicate fallback when successful
      expect(response.api_status).toBe('success');
      expect(response.fallback_used).toBe(false);
      expect(response.emergency_cache).toBeUndefined();
    });
  });
});
