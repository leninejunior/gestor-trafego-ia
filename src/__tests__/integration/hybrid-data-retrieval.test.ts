/**
 * Hybrid data retrieval integration tests (contract-aligned)
 */

import { HybridDataService, DataSource } from '@/lib/services/hybrid-data-service';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { AdPlatform, CampaignInsight, DataQuery } from '@/lib/types/sync';

function createInsight(id: string, date: Date): CampaignInsight {
  return {
    id,
    platform: AdPlatform.GOOGLE,
    client_id: 'client-1',
    campaign_id: 'campaign-1',
    campaign_name: 'Test Campaign',
    date,
    impressions: 1000,
    clicks: 50,
    spend: 100,
    conversions: 5,
    ctr: 5,
    cpc: 2,
    cpm: 100,
    conversion_rate: 10,
    is_deleted: false,
    synced_at: new Date(),
  };
}

function createAdapterMock(overrides: Partial<any> = {}) {
  return {
    fetchCampaigns: jest.fn(),
    fetchInsights: jest.fn(),
    validateConnection: jest.fn().mockResolvedValue({ valid: true }),
    ...overrides,
  };
}

describe('Hybrid Data Retrieval Integration', () => {
  let service: HybridDataService;
  let queryInsightsSpy: jest.SpyInstance;
  let storeInsightsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HybridDataService();
    queryInsightsSpy = jest
      .spyOn(HistoricalDataRepository.prototype, 'queryInsights')
      .mockResolvedValue([]);
    storeInsightsSpy = jest
      .spyOn(HistoricalDataRepository.prototype, 'storeInsights')
      .mockResolvedValue(0);
  });

  afterEach(() => {
    queryInsightsSpy.mockRestore();
    storeInsightsSpy.mockRestore();
  });

  it('uses cache for historical ranges', async () => {
    const historicalDate = new Date();
    historicalDate.setDate(historicalDate.getDate() - 20);

    const query: DataQuery = {
      client_id: 'client-1',
      platform: AdPlatform.GOOGLE,
      date_from: new Date(historicalDate),
      date_to: new Date(historicalDate),
    };

    queryInsightsSpy.mockResolvedValue([createInsight('cached-1', historicalDate)]);

    const result = await service.getData(query);

    expect(result.source).toBe(DataSource.CACHE);
    expect(result.data).toHaveLength(1);
    expect(result.cache_hit_rate).toBe(1);
  });

  it('uses API for recent ranges when adapter succeeds', async () => {
    const today = new Date();
    const query: DataQuery = {
      client_id: 'client-1',
      platform: AdPlatform.GOOGLE,
      date_from: new Date(today),
      date_to: new Date(today),
    };

    const adapter = createAdapterMock({
      fetchCampaigns: jest.fn().mockResolvedValue([
        {
          id: 'campaign-1',
          name: 'Test Campaign',
          status: 'ENABLED',
          platform: AdPlatform.GOOGLE,
          account_id: 'account-1',
        },
      ]),
      fetchInsights: jest.fn().mockResolvedValue([createInsight('api-1', today)]),
    });

    const result = await service.getData(query, adapter as any);

    expect(result.source).toBe(DataSource.API);
    expect(result.api_status).toBe('success');
    expect(result.fallback_used).toBe(false);
    expect(result.data).toHaveLength(1);
  });

  it('falls back to cache when recent API call fails', async () => {
    const today = new Date();
    const query: DataQuery = {
      client_id: 'client-1',
      platform: AdPlatform.GOOGLE,
      date_from: new Date(today),
      date_to: new Date(today),
    };

    queryInsightsSpy.mockResolvedValue([createInsight('cached-fallback', today)]);

    const adapter = createAdapterMock({
      fetchCampaigns: jest.fn().mockRejectedValue(new Error('API unavailable')),
    });

    const result = await service.getData(query, adapter as any);

    expect(result.source).toBe(DataSource.CACHE);
    expect(result.api_status).toBe('failed');
    expect(result.fallback_used).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.error_message).toContain('API unavailable');
  });

  it('combines historical cache and recent API data for hybrid ranges', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const recentDate = new Date();

    const query: DataQuery = {
      client_id: 'client-1',
      platform: AdPlatform.GOOGLE,
      date_from: new Date(oldDate),
      date_to: new Date(recentDate),
    };

    queryInsightsSpy.mockResolvedValueOnce([createInsight('cached-old', oldDate)]);

    const adapter = createAdapterMock({
      fetchCampaigns: jest.fn().mockResolvedValue([
        {
          id: 'campaign-1',
          name: 'Test Campaign',
          status: 'ENABLED',
          platform: AdPlatform.GOOGLE,
          account_id: 'account-1',
        },
      ]),
      fetchInsights: jest.fn().mockResolvedValue([createInsight('api-recent', recentDate)]),
    });

    const result = await service.getData(query, adapter as any);

    expect(result.source).toBe(DataSource.HYBRID);
    expect(result.api_status).toBe('success');
    expect(result.data).toHaveLength(2);
  });

  it('uses hybrid partial response when recent API fails', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 1);

    const query: DataQuery = {
      client_id: 'client-1',
      platform: AdPlatform.GOOGLE,
      date_from: new Date(oldDate),
      date_to: new Date(recentDate),
    };

    queryInsightsSpy
      .mockResolvedValueOnce([createInsight('cached-old', oldDate)])
      .mockResolvedValueOnce([createInsight('cached-recent', recentDate)]);

    const adapter = createAdapterMock({
      fetchCampaigns: jest.fn().mockRejectedValue(new Error('API error')),
    });

    const result = await service.getData(query, adapter as any);

    expect(result.source).toBe(DataSource.HYBRID);
    expect(result.api_status).toBe('partial');
    expect(result.fallback_used).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('validates freshness for fresh and stale records', async () => {
    const fresh = await service.validateDataFreshness([createInsight('fresh', new Date())], 24);
    expect(fresh.is_fresh).toBe(true);
    expect(fresh.needs_refresh).toBe(false);

    const staleSyncedAt = new Date();
    staleSyncedAt.setHours(staleSyncedAt.getHours() - 48);
    const staleRecord = { ...createInsight('stale', new Date()), synced_at: staleSyncedAt };
    const stale = await service.validateDataFreshness([staleRecord], 24);

    expect(stale.is_fresh).toBe(false);
    expect(stale.needs_refresh).toBe(true);
    expect(stale.age_hours).toBeGreaterThan(24);
  });

  it('recommends API at exact threshold boundary', () => {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 7);
    thresholdDate.setHours(0, 0, 0, 0);

    const recommendation = service.getDataSourceRecommendation({
      client_id: 'client-1',
      platform: AdPlatform.GOOGLE,
      date_from: thresholdDate,
      date_to: thresholdDate,
    });

    expect(recommendation).toBe(DataSource.API);
  });

  it('refreshes recent data and persists through repository', async () => {
    const now = new Date();
    const adapter = createAdapterMock({
      fetchCampaigns: jest.fn().mockResolvedValue([
        {
          id: 'campaign-1',
          name: 'Test Campaign',
          status: 'ENABLED',
          platform: AdPlatform.GOOGLE,
          account_id: 'account-1',
        },
      ]),
      fetchInsights: jest.fn().mockResolvedValue([createInsight('to-store', now)]),
    });

    storeInsightsSpy.mockResolvedValue(1);

    const stored = await service.refreshRecentData('client-1', AdPlatform.GOOGLE, adapter as any);

    expect(stored).toBe(1);
    expect(storeInsightsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'to-store' })])
    );
  });

  it('proactively uses cache when adapter health check fails', async () => {
    const today = new Date();
    const query: DataQuery = {
      client_id: 'client-1',
      platform: AdPlatform.GOOGLE,
      date_from: new Date(today),
      date_to: new Date(today),
    };

    queryInsightsSpy.mockResolvedValue([createInsight('cached-health', today)]);

    const adapter = createAdapterMock({
      validateConnection: jest.fn().mockResolvedValue({
        valid: false,
        errors: ['service unavailable'],
      }),
    });

    const result = await service.getDataWithHealthCheck(query, adapter as any);

    expect(result.source).toBe(DataSource.CACHE);
    expect(result.fallback_used).toBe(true);
    expect(result.error_message).toContain('API unavailable');
  });
});
