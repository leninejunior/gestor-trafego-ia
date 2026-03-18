/**
 * Performance Tests for Sync Operations
 * Tests sync performance with 100+ campaigns and concurrent operations
 */

import { MultiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { GoogleAdsSyncAdapter } from '@/lib/sync/google-ads-sync-adapter';
import { AdPlatform, SyncConfig } from '@/lib/types/sync';

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
      })),
      insert: jest.fn(() => ({
        onConflict: jest.fn(() => ({
          select: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Sync Performance Tests', () => {
  let syncEngine: MultiPlatformSyncEngine;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    syncEngine = new MultiPlatformSyncEngine();
    
    const { createClient } = require('@/lib/supabase/server');
    mockSupabase = createClient();
  });

  /**
   * Helper to generate mock campaigns
   */
  const generateMockCampaigns = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      campaign: {
        id: `campaign-${i}`,
        name: `Campaign ${i}`,
        status: 'ENABLED',
      },
    }));
  };

  /**
   * Helper to generate mock insights
   */
  const generateMockInsights = (campaignId: string, days: number) => {
    return Array.from({ length: days }, (_, i) => {
      const date = new Date('2025-01-27');
      date.setDate(date.getDate() - i);
      
      return {
        campaign: {
          id: campaignId,
          name: `Campaign ${campaignId}`,
        },
        segments: {
          date: date.toISOString().split('T')[0],
        },
        metrics: {
          impressions: String(Math.floor(Math.random() * 10000)),
          clicks: String(Math.floor(Math.random() * 500)),
          costMicros: String(Math.floor(Math.random() * 1000000000)),
          conversions: Math.floor(Math.random() * 50),
        },
      };
    });
  };

  describe('Sync 100+ Campaigns', () => {
    it('should sync 100 campaigns efficiently', async () => {
      const clientId = 'client-1';
      const campaignCount = 100;
      const daysPerCampaign = 7;

      // Mock sync config
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform: AdPlatform.GOOGLE,
          account_id: '123-456-7890',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      });

      // Mock campaigns fetch
      const mockCampaigns = generateMockCampaigns(campaignCount);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockCampaigns }),
      });

      // Mock insights fetch for each campaign
      for (let i = 0; i < campaignCount; i++) {
        const mockInsights = generateMockInsights(`campaign-${i}`, daysPerCampaign);
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: mockInsights }),
        });
      }

      // Mock insert
      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: Array(campaignCount * daysPerCampaign).fill({ id: 'insight-1' }),
        error: null,
      });

      // Mock update
      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { id: 'config-1', sync_status: 'completed' },
        error: null,
      });

      const startTime = performance.now();
      const result = await syncEngine.syncClient(clientId, AdPlatform.GOOGLE);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      const expectedRecords = campaignCount * daysPerCampaign;

      expect(result.success).toBe(true);
      expect(result.records_synced).toBe(expectedRecords);
      expect(executionTime).toBeLessThan(30000); // Less than 30 seconds
      
      console.log(`Sync 100 campaigns: ${executionTime.toFixed(2)}ms, ${result.records_synced} records`);
    }, 35000); // Increase timeout for this test

    it('should sync 200 campaigns with rate limiting', async () => {
      const clientId = 'client-1';
      const campaignCount = 200;
      const daysPerCampaign = 3;

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform: AdPlatform.GOOGLE,
          account_id: '123-456-7890',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      });

      const mockCampaigns = generateMockCampaigns(campaignCount);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockCampaigns }),
      });

      for (let i = 0; i < campaignCount; i++) {
        const mockInsights = generateMockInsights(`campaign-${i}`, daysPerCampaign);
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: mockInsights }),
        });
      }

      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: Array(campaignCount * daysPerCampaign).fill({ id: 'insight-1' }),
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { id: 'config-1', sync_status: 'completed' },
        error: null,
      });

      const startTime = performance.now();
      const result = await syncEngine.syncClient(clientId, AdPlatform.GOOGLE);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(60000); // Less than 60 seconds
      
      console.log(`Sync 200 campaigns: ${executionTime.toFixed(2)}ms, ${result.records_synced} records`);
    }, 65000);
  });

  describe('Batch Insert Performance', () => {
    it('should insert 1000 records efficiently', async () => {
      const recordCount = 1000;
      const mockRecords = Array(recordCount).fill({ id: 'insight-1' });

      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: mockRecords,
        error: null,
      });

      const startTime = performance.now();
      
      // Simulate batch insert
      const result = await mockSupabase
        .from('campaign_insights_history')
        .insert(mockRecords)
        .onConflict()
        .select();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.data).toHaveLength(recordCount);
      expect(executionTime).toBeLessThan(1000); // Less than 1 second
      
      console.log(`Batch insert 1000 records: ${executionTime.toFixed(2)}ms`);
    });

    it('should handle 5000 records in batches', async () => {
      const totalRecords = 5000;
      const batchSize = 1000;
      const batches = Math.ceil(totalRecords / batchSize);

      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: Array(batchSize).fill({ id: 'insight-1' }),
        error: null,
      });

      const startTime = performance.now();
      
      const results = [];
      for (let i = 0; i < batches; i++) {
        const batch = Array(batchSize).fill({ id: `insight-${i}` });
        const result = await mockSupabase
          .from('campaign_insights_history')
          .insert(batch)
          .onConflict()
          .select();
        results.push(result);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(batches);
      expect(executionTime).toBeLessThan(5000); // Less than 5 seconds
      
      console.log(`Batch insert 5000 records: ${executionTime.toFixed(2)}ms in ${batches} batches`);
    });
  });

  describe('Concurrent Sync Performance', () => {
    it('should handle 5 concurrent client syncs', async () => {
      const clientCount = 5;
      const campaignsPerClient = 20;
      const daysPerCampaign = 7;

      // Mock configs for all clients
      mockSupabase.from().select().eq().single.mockImplementation(async () => ({
        data: {
          id: 'config-1',
          client_id: 'client-1',
          platform: AdPlatform.GOOGLE,
          account_id: '123-456-7890',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      }));

      // Mock API responses
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        if (url.includes('googleAds:search')) {
          const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
          
          if (body.query.includes('FROM campaign')) {
            // Campaigns query
            return {
              ok: true,
              json: async () => ({ results: generateMockCampaigns(campaignsPerClient) }),
            };
          } else {
            // Insights query
            return {
              ok: true,
              json: async () => ({ results: generateMockInsights('campaign-1', daysPerCampaign) }),
            };
          }
        }
        return { ok: false };
      });

      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: Array(campaignsPerClient * daysPerCampaign).fill({ id: 'insight-1' }),
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { id: 'config-1', sync_status: 'completed' },
        error: null,
      });

      const startTime = performance.now();
      
      const syncPromises = Array.from({ length: clientCount }, (_, i) =>
        syncEngine.syncClient(`client-${i}`, AdPlatform.GOOGLE)
      );
      
      const results = await Promise.all(syncPromises);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(clientCount);
      results.forEach(r => expect(r.success).toBe(true));
      expect(executionTime).toBeLessThan(40000); // Should be faster than sequential
      
      console.log(`5 concurrent syncs: ${executionTime.toFixed(2)}ms`);
    }, 45000);

    it('should handle 10 concurrent syncs with queue management', async () => {
      const clientCount = 10;
      const campaignsPerClient = 10;
      const daysPerCampaign = 3;

      mockSupabase.from().select().eq().single.mockImplementation(async () => ({
        data: {
          id: 'config-1',
          client_id: 'client-1',
          platform: AdPlatform.GOOGLE,
          account_id: '123-456-7890',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      }));

      (global.fetch as jest.Mock).mockImplementation(async () => ({
        ok: true,
        json: async () => ({ results: [] }),
      }));

      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { id: 'config-1', sync_status: 'completed' },
        error: null,
      });

      const startTime = performance.now();
      
      const syncPromises = Array.from({ length: clientCount }, (_, i) =>
        syncEngine.syncClient(`client-${i}`, AdPlatform.GOOGLE)
      );
      
      const results = await Promise.all(syncPromises);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(clientCount);
      expect(executionTime).toBeLessThan(60000);
      
      console.log(`10 concurrent syncs: ${executionTime.toFixed(2)}ms`);
    }, 65000);
  });

  describe('Rate Limiting Performance', () => {
    it('should respect rate limits without significant slowdown', async () => {
      const clientId = 'client-1';
      const campaignCount = 50;
      const daysPerCampaign = 7;

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform: AdPlatform.GOOGLE,
          account_id: '123-456-7890',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      });

      const mockCampaigns = generateMockCampaigns(campaignCount);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockCampaigns }),
      });

      for (let i = 0; i < campaignCount; i++) {
        const mockInsights = generateMockInsights(`campaign-${i}`, daysPerCampaign);
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: mockInsights }),
        });
      }

      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: Array(campaignCount * daysPerCampaign).fill({ id: 'insight-1' }),
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { id: 'config-1', sync_status: 'completed' },
        error: null,
      });

      const startTime = performance.now();
      const result = await syncEngine.syncClient(clientId, AdPlatform.GOOGLE);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // With rate limiting (200ms per request), 50 campaigns should take at least 10 seconds
      // But should complete within 20 seconds
      expect(executionTime).toBeGreaterThan(10000);
      expect(executionTime).toBeLessThan(20000);
      expect(result.success).toBe(true);
      
      console.log(`Rate limited sync: ${executionTime.toFixed(2)}ms for ${campaignCount} campaigns`);
    }, 25000);
  });

  describe('Memory Efficiency During Sync', () => {
    it('should maintain reasonable memory usage during large sync', async () => {
      const clientId = 'client-1';
      const campaignCount = 100;
      const daysPerCampaign = 30;

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'config-1',
          client_id: clientId,
          platform: AdPlatform.GOOGLE,
          account_id: '123-456-7890',
          access_token: 'test-token',
          sync_status: 'active',
        },
        error: null,
      });

      const mockCampaigns = generateMockCampaigns(campaignCount);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: mockCampaigns }),
      });

      for (let i = 0; i < campaignCount; i++) {
        const mockInsights = generateMockInsights(`campaign-${i}`, daysPerCampaign);
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: mockInsights }),
        });
      }

      mockSupabase.from().insert().onConflict().select.mockResolvedValue({
        data: Array(campaignCount * daysPerCampaign).fill({ id: 'insight-1' }),
        error: null,
      });

      mockSupabase.from().update().eq().select().single.mockResolvedValue({
        data: { id: 'config-1', sync_status: 'completed' },
        error: null,
      });

      const memBefore = process.memoryUsage().heapUsed;
      
      const result = await syncEngine.syncClient(clientId, AdPlatform.GOOGLE);
      
      const memAfter = process.memoryUsage().heapUsed;
      const memUsed = (memAfter - memBefore) / 1024 / 1024; // MB

      expect(result.success).toBe(true);
      expect(memUsed).toBeLessThan(150); // Less than 150MB
      
      console.log(`Memory usage: ${memUsed.toFixed(2)}MB for ${result.records_synced} records`);
    }, 35000);
  });
});
