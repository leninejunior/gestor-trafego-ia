/**
 * Unit Tests for MetaAdsSyncAdapter
 */

import { MetaAdsSyncAdapter } from '../meta-ads-sync-adapter';
import { AdPlatform, SyncConfig } from '@/lib/types/sync';
import { metaTokenManager } from '../meta-token-manager';

jest.mock('../meta-token-manager', () => ({
  metaTokenManager: {
    decryptToken: jest.fn((token?: string) => token),
    isTokenExpired: jest.fn(() => false),
    refreshAccessToken: jest.fn(),
    persistTokens: jest.fn()
  }
}));

global.fetch = jest.fn();

describe('MetaAdsSyncAdapter', () => {
  let adapter: MetaAdsSyncAdapter;
  let mockConfig: SyncConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      id: 'config-meta-1',
      platform: AdPlatform.META,
      client_id: 'client-1',
      account_id: 'act_123',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_expires_at: new Date(Date.now() + 60 * 60 * 1000),
      last_sync_at: new Date(),
      next_sync_at: new Date(),
      sync_status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    adapter = new MetaAdsSyncAdapter(mockConfig);
  });

  it('authenticates with valid token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'meta-user-1' })
    });

    await expect(
      adapter.authenticate({
        access_token: 'valid-access-token'
      })
    ).resolves.not.toThrow();

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/v22.0/me');
    expect(calledUrl).toContain('access_token=valid-access-token');
  });

  it('fetches campaigns and normalizes account id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'campaign-1', name: 'Meta Campaign 1', status: 'ACTIVE' },
          { id: 'campaign-2', name: 'Meta Campaign 2', status: 'PAUSED' }
        ]
      })
    });

    const campaigns = await adapter.fetchCampaigns('123456');

    expect(campaigns).toHaveLength(2);
    expect(campaigns[0]).toMatchObject({
      id: 'campaign-1',
      name: 'Meta Campaign 1',
      status: 'ACTIVE',
      platform: AdPlatform.META,
      account_id: 'act_123456'
    });
  });

  it('fetches insights and calculates derived metrics', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            campaign_id: 'campaign-1',
            campaign_name: 'Meta Campaign 1',
            date_start: '2025-01-15',
            date_stop: '2025-01-15',
            impressions: '1000',
            clicks: '50',
            spend: '25',
            actions: [{ action_type: 'purchase', value: '5' }]
          }
        ]
      })
    });

    const insights = await adapter.fetchInsights('campaign-1', {
      start: new Date('2025-01-15'),
      end: new Date('2025-01-15')
    });

    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({
      platform: AdPlatform.META,
      campaign_id: 'campaign-1',
      impressions: 1000,
      clicks: 50,
      spend: 25,
      conversions: 5,
      ctr: 5,
      cpc: 0.5,
      cpm: 25,
      conversion_rate: 10
    });
  });

  it('refreshes token when expired before validating', async () => {
    (metaTokenManager.isTokenExpired as jest.Mock).mockReturnValue(true);
    (metaTokenManager.refreshAccessToken as jest.Mock).mockResolvedValue({
      access_token: 'new-access-token',
      expires_in: 3600,
      expires_at: new Date(Date.now() + 3600 * 1000)
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'meta-user-1' })
    });

    await adapter.authenticate({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token'
    });

    expect(metaTokenManager.refreshAccessToken).toHaveBeenCalledWith(
      'refresh-token'
    );
    expect(metaTokenManager.persistTokens).toHaveBeenCalled();
  });
});
