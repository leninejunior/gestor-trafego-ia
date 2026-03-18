/**
 * Integration tests for historical data sync (contract-aligned, deterministic)
 */

import { MultiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { AdPlatform } from '@/lib/types/sync';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

describe('Historical Data Sync Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('syncs client data successfully from adapter to repository cache', async () => {
    const engine = new MultiPlatformSyncEngine();

    const config = {
      id: 'config-1',
      platform: AdPlatform.META,
      client_id: 'client-1',
      account_id: 'act_123',
      access_token: 'token',
      sync_status: 'active',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    };

    const adapter = {
      authenticate: jest.fn(async () => undefined),
      fetchCampaigns: jest.fn(async () => [
        {
          id: 'campaign-1',
          name: 'Campaign One',
          status: 'ACTIVE',
          platform: AdPlatform.META,
          account_id: 'act_123',
        },
      ]),
      fetchInsights: jest.fn(async () => [
        {
          id: 'insight-1',
          platform: AdPlatform.META,
          client_id: 'client-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Campaign One',
          date: new Date('2026-01-10T00:00:00.000Z'),
          impressions: 1000,
          clicks: 50,
          spend: 100,
          conversions: 10,
          ctr: 5,
          cpc: 2,
          cpm: 100,
          conversion_rate: 20,
          is_deleted: false,
          synced_at: new Date('2026-01-10T10:00:00.000Z'),
        },
      ]),
    };

    engine.registerAdapter(AdPlatform.META, () => adapter as any);

    const storeInsightsMock = jest.fn(async () => 1);
    (engine as any).repository = {
      storeInsights: storeInsightsMock,
    };

    (engine as any).planService = {
      getUserPlanLimits: jest.fn(async () => ({ data_retention_days: 90 })),
    };

    jest.spyOn(engine as any, 'getSyncConfig').mockResolvedValue(config);
    jest.spyOn(engine as any, 'updateSyncConfig').mockResolvedValue(undefined);
    jest.spyOn(engine as any, 'logSyncCompletion').mockResolvedValue(undefined);
    jest.spyOn(engine, 'getNextSyncTime').mockResolvedValue(new Date('2026-01-11T10:00:00.000Z'));

    createClientMock.mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: { user_id: 'user-1' },
              error: null,
            })),
          })),
        })),
      })),
    } as any);

    const result = await engine.syncClient('client-1', AdPlatform.META);

    expect(result.success).toBe(true);
    expect(result.records_synced).toBe(1);
    expect(adapter.authenticate).toHaveBeenCalled();
    expect(adapter.fetchCampaigns).toHaveBeenCalledWith('act_123');
    expect(adapter.fetchInsights).toHaveBeenCalledWith(
      'campaign-1',
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) })
    );
    expect(storeInsightsMock).toHaveBeenCalledTimes(1);
  });

  it('returns failed result and logs error when adapter sync fails', async () => {
    const engine = new MultiPlatformSyncEngine();

    const config = {
      id: 'config-1',
      platform: AdPlatform.META,
      client_id: 'client-1',
      account_id: 'act_123',
      access_token: 'token',
      sync_status: 'active',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    };

    const adapter = {
      authenticate: jest.fn(async () => undefined),
      fetchCampaigns: jest.fn(async () => {
        throw new Error('Provider unavailable');
      }),
      fetchInsights: jest.fn(async () => []),
    };

    engine.registerAdapter(AdPlatform.META, () => adapter as any);

    const getSyncConfigSpy = jest
      .spyOn(engine as any, 'getSyncConfig')
      .mockResolvedValue(config);
    const updateSyncConfigSpy = jest
      .spyOn(engine as any, 'updateSyncConfig')
      .mockResolvedValue(undefined);
    jest.spyOn(engine as any, 'logSyncCompletion').mockResolvedValue(undefined);

    createClientMock.mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: { user_id: 'user-1' },
              error: null,
            })),
          })),
        })),
      })),
    } as any);

    const result = await engine.syncClient('client-1', AdPlatform.META);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Provider unavailable');
    expect(getSyncConfigSpy).toHaveBeenCalled();
    expect(updateSyncConfigSpy).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({ sync_status: 'error' })
    );
  });

  it('calculates next sync time based on plan sync interval', async () => {
    const engine = new MultiPlatformSyncEngine();

    (engine as any).planService = {
      getUserPlanLimits: jest.fn(async () => ({ sync_interval_hours: 12 })),
    };

    createClientMock.mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: { user_id: 'user-1' },
              error: null,
            })),
          })),
        })),
      })),
    } as any);

    const before = Date.now();
    const nextSync = await engine.getNextSyncTime('client-1', AdPlatform.META);
    const after = Date.now();

    const minExpected = before + 12 * 60 * 60 * 1000;
    const maxExpected = after + 12 * 60 * 60 * 1000 + 2000;

    expect(nextSync.getTime()).toBeGreaterThanOrEqual(minExpected);
    expect(nextSync.getTime()).toBeLessThanOrEqual(maxExpected);
  });

  it('deletes expired data for a client using retention period', async () => {
    const repository = new HistoricalDataRepository();

    const selectMock = jest.fn(async () => ({
      data: [{ id: 'old-1' }, { id: 'old-2' }],
      error: null,
    }));

    createClientMock.mockResolvedValue({
      from: jest.fn(() => ({
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            lt: jest.fn(() => ({
              select: selectMock,
            })),
          })),
        })),
      })),
    } as any);

    const deleted = await repository.deleteExpiredData('client-1', 90);

    expect(deleted).toBe(2);
    expect(selectMock).toHaveBeenCalledWith('id');
  });

  it('queries insights with date and campaign filters', async () => {
    const repository = new HistoricalDataRepository();

    const dbRows = [
      {
        id: 'insight-1',
        platform: AdPlatform.META,
        client_id: 'client-1',
        campaign_id: 'campaign-1',
        campaign_name: 'Campaign One',
        date: '2026-01-10',
        impressions: 1000,
        clicks: 50,
        spend: '100',
        conversions: 10,
        ctr: '5',
        cpc: '2',
        cpm: '100',
        conversion_rate: '20',
        is_deleted: false,
        synced_at: '2026-01-10T10:00:00.000Z',
      },
    ];

    const query: any = {};
    query.eq = jest.fn(() => query);
    query.gte = jest.fn(() => query);
    query.lte = jest.fn(() => query);
    query.order = jest.fn(() => query);
    query.in = jest.fn(() => query);
    query.limit = jest.fn(() => query);
    query.range = jest.fn(() => query);
    query.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: dbRows, error: null }).then(resolve, reject);

    createClientMock.mockResolvedValue({
      from: jest.fn(() => ({
        select: jest.fn(() => query),
      })),
    } as any);

    const insights = await repository.queryInsights({
      client_id: 'client-1',
      platform: AdPlatform.META,
      campaign_ids: ['campaign-1'],
      date_from: new Date('2026-01-01T00:00:00.000Z'),
      date_to: new Date('2026-01-31T00:00:00.000Z'),
      limit: 50,
    });

    expect(insights).toHaveLength(1);
    expect(insights[0].campaign_id).toBe('campaign-1');
    expect(insights[0].date).toBeInstanceOf(Date);
    expect(query.eq).toHaveBeenCalledWith('platform', AdPlatform.META);
    expect(query.in).toHaveBeenCalledWith('campaign_id', ['campaign-1']);
  });
});
