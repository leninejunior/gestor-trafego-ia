/**
 * Integration Tests for Historical Data Sync
 * Tests complete sync flow from API to cache
 */

import { MultiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { HistoricalDataRepository } from '@/lib/repositories/historical-data-repository';
import { AdPlatform } from '@/lib/types/sync';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn(),
          })),
        })),
        in: jest.fn(() => ({
          order: jest.fn(),
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        lt: jest.fn(),
      })),
    })),
  })),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Historical Data Sync Integration', () => {
  let syncEngine: MultiPlatformSyncEngine;
  let repository: HistoricalDataRepository;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    syncEngine = new MultiPlatformSyncEngine();
    repository = new HistoricalDataRepository();
    
    const { createClient } = require('@/lib/supabase/server');
    mockSupabase = createClient();
  });

  describe('Complete Sync Flow', () => {
    it('should sync Meta Ads data from API to cache', async () => {
      const clientId = 'client-1';
      const platform = AdPlatform.META;

      // Mock sync configuration
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform,
          account_id: 'act_123',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      });

      // Mock Meta API responses
      (global.fetch as jest.Mock)
        // Campaigns fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'campaign-1',
                name: 'Test Campaign',
                status: 'ACTIVE',
              },
            ],
          }),
        })
        // Insights fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                campaign_id: 'campaign-1',
                campaign_name: 'Test Campaign',
                date_start: '2025-01-15',
                impressions: '1000',
                clicks: '50',
                spend: '100',
                actions: [{ action_type: 'purchase', value: '5' }],
              },
            ],
          }),
        });

      // Mock insert
      mockSupabase.from().insert().select.mockResolvedValue({
        data: [{ id: 'insight-1' }],
        error: null,
      });

      // Mock update sync config
      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { id: 'config-1', sync_status: 'completed' },
        error: null,
      });

      const result = await syncEngine.syncClient(clientId, platform);

      expect(result.success).toBe(true);
      expect(result.records_synced).toBeGreaterThan(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('campaign_insights_history');
    });

    it('should handle sync errors gracefully', async () => {
      const clientId = 'client-1';
      const platform = AdPlatform.META;

      // Mock sync configuration
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform,
          account_id: 'act_123',
          access_token: 'invalid-token',
          sync_status: 'active',
        },
        error: null,
      });

      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid token' } }),
      });

      const result = await syncEngine.syncClient(clientId, platform);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Data Retention and Cleanup', () => {
    it('should delete expired data based on retention period', async () => {
      const retentionDays = 90;

      mockSupabase.from().delete().lt.mockResolvedValue({
        count: 150,
        error: null,
      });

      const deletedCount = await repository.deleteExpiredData(retentionDays);

      expect(deletedCount).toBe(150);
      expect(mockSupabase.from).toHaveBeenCalledWith('campaign_insights_history');
    });

    it('should preserve data within retention period', async () => {
      const clientId = 'client-1';
      const platform = AdPlatform.META;

      // Mock recent data
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago

      mockSupabase.from().select().eq().gte().lte().order.mockResolvedValue({
        data: [
          {
            id: 'insight-1',
            client_id: clientId,
            platform,
            date: recentDate,
            impressions: 1000,
          },
        ],
        error: null,
      });

      const insights = await repository.queryInsights({
        client_id: clientId,
        platform,
        date_from: recentDate,
        date_to: new Date(),
      });

      expect(insights).toHaveLength(1);
      expect(insights[0].date).toEqual(recentDate);
    });
  });

  describe('Multi-Platform Sync', () => {
    it('should sync data from multiple platforms', async () => {
      const clientId = 'client-1';

      // Mock Meta sync config
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'config-meta',
            client_id: clientId,
            platform: AdPlatform.META,
            account_id: 'act_123',
            access_token: 'meta-token',
            sync_status: 'active',
          },
          error: null,
        })
        // Mock Google sync config
        .mockResolvedValueOnce({
          data: {
            id: 'config-google',
            client_id: clientId,
            platform: AdPlatform.GOOGLE,
            account_id: '123-456-7890',
            access_token: 'google-token',
            sync_status: 'active',
          },
          error: null,
        });

      // Mock API responses for both platforms
      (global.fetch as jest.Mock)
        // Meta campaigns
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: 'meta-campaign-1', name: 'Meta Campaign' }] }),
        })
        // Meta insights
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        // Google campaigns
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ campaign: { id: 'google-campaign-1', name: 'Google Campaign' } }] }),
        })
        // Google insights
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        });

      mockSupabase.from().insert().select.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: {},
        error: null,
      });

      const metaResult = await syncEngine.syncClient(clientId, AdPlatform.META);
      const googleResult = await syncEngine.syncClient(clientId, AdPlatform.GOOGLE);

      expect(metaResult.success).toBe(true);
      expect(googleResult.success).toBe(true);
    });
  });

  describe('Sync Scheduling', () => {
    it('should schedule next sync based on plan limits', async () => {
      const clientId = 'client-1';

      // Mock user plan limits
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { user_id: 'user-1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { plan_id: 'plan-1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { sync_interval_hours: 24 },
          error: null,
        });

      const nextSyncTime = await syncEngine.getNextSyncTime(clientId);

      expect(nextSyncTime).toBeInstanceOf(Date);
      
      const now = new Date();
      const expectedTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(nextSyncTime.getTime() - expectedTime.getTime());
      
      // Allow 1 second tolerance
      expect(timeDiff).toBeLessThan(1000);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed syncs with exponential backoff', async () => {
      const clientId = 'client-1';
      const platform = AdPlatform.META;

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform,
          account_id: 'act_123',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      });

      // First two attempts fail, third succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Server error' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Server error' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      mockSupabase.from().insert().select.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await syncEngine.syncClient(clientId, platform);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should log sync failures', async () => {
      const clientId = 'client-1';
      const platform = AdPlatform.META;

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform,
          account_id: 'act_123',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Mock sync log insert
      mockSupabase.from().insert().select.mockResolvedValue({
        data: [{ id: 'log-1', status: 'failed' }],
        error: null,
      });

      const result = await syncEngine.syncClient(clientId, platform);

      expect(result.success).toBe(false);
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_logs');
    });
  });

  describe('Concurrent Sync Operations', () => {
    it('should handle concurrent syncs for different clients', async () => {
      const client1 = 'client-1';
      const client2 = 'client-2';

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'config-1',
            client_id: client1,
            platform: AdPlatform.META,
            account_id: 'act_123',
            access_token: 'token-1',
            sync_status: 'active',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'config-2',
            client_id: client2,
            platform: AdPlatform.META,
            account_id: 'act_456',
            access_token: 'token-2',
            sync_status: 'active',
          },
          error: null,
        });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      mockSupabase.from().insert().select.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: {},
        error: null,
      });

      const [result1, result2] = await Promise.all([
        syncEngine.syncClient(client1, AdPlatform.META),
        syncEngine.syncClient(client2, AdPlatform.META),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});
