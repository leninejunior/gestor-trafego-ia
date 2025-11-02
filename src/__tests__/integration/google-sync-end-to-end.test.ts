/**
 * Google Ads Sync End-to-End Integration Tests
 * 
 * Tests complete synchronization flow from API calls to database storage
 * Requirements: 3.1, 2.1
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mock external dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/google/client');
jest.mock('@/lib/google/sync-service');
jest.mock('@/lib/google/token-manager');

describe('Google Ads Sync End-to-End Integration', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockClientId = 'client-123';
  const mockConnectionId = 'connection-123';
  const mockCustomerId = '1234567890';
  const mockCampaignId = 'campaign-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Sync Flow', () => {
    it('should sync campaigns and metrics successfully', async () => {
      // Mock Supabase client
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          upsert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock Google Ads client
      const { getGoogleAdsClient } = require('@/lib/google/client');
      const mockGoogleClient = {
        getCampaigns: jest.fn().mockResolvedValue([
          {
            id: '12345',
            name: 'Test Campaign',
            status: 'ENABLED',
            budget: {
              amountMicros: '100000000', // $100
              currency: 'USD',
            },
            startDate: '2024-01-01',
            endDate: '2024-12-31',
          },
        ]),
        getCampaignMetrics: jest.fn().mockResolvedValue([
          {
            campaignId: '12345',
            date: '2024-01-01',
            impressions: '1000',
            clicks: '50',
            conversions: '5',
            costMicros: '25000000', // $25
          },
        ]),
      };
      getGoogleAdsClient.mockReturnValue(mockGoogleClient);

      // Mock token manager
      const { getGoogleTokenManager } = require('@/lib/google/token-manager');
      const mockTokenManager = {
        ensureValidToken: jest.fn().mockResolvedValue('valid-access-token'),
      };
      getGoogleTokenManager.mockReturnValue(mockTokenManager);

      // Mock sync service
      const { getGoogleSyncService } = require('@/lib/google/sync-service');
      const mockSyncService = {
        syncCampaigns: jest.fn().mockResolvedValue({
          success: true,
          campaignsSynced: 1,
          metricsUpdated: 1,
          errors: [],
        }),
      };
      getGoogleSyncService.mockReturnValue(mockSyncService);

      // Setup database mocks
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClientId },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: mockConnectionId,
            client_id: mockClientId,
            customer_id: mockCustomerId,
            status: 'active',
          },
          error: null,
        });

      mockSupabase.from().select.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase.from().upsert.mockResolvedValue({
        data: [{ id: mockCampaignId }],
        error: null,
      });

      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: null,
      });

      // Execute sync
      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      const syncRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: true,
        }),
      });

      const syncResponse = await syncPost(syncRequest);
      const syncData = await syncResponse.json();

      expect(syncResponse.status).toBe(200);
      expect(syncData.success).toBe(true);
      expect(syncData.results).toBeDefined();

      // Verify Google client was called
      expect(mockGoogleClient.getCampaigns).toHaveBeenCalledWith(mockCustomerId);
      expect(mockGoogleClient.getCampaignMetrics).toHaveBeenCalled();

      // Verify database operations
      expect(mockSupabase.from().upsert).toHaveBeenCalled(); // Campaigns upserted
      expect(mockSupabase.from().insert).toHaveBeenCalled(); // Metrics inserted
    });

    it('should handle incremental sync correctly', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock last sync time
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClientId },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: mockConnectionId,
            client_id: mockClientId,
            customer_id: mockCustomerId,
            status: 'active',
            last_sync_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
          },
          error: null,
        });

      // Mock existing campaigns
      mockSupabase.from().select.mockResolvedValue({
        data: [
          {
            id: mockCampaignId,
            campaign_id: '12345',
            updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12h ago
          },
        ],
        error: null,
      });

      const { getGoogleSyncService } = require('@/lib/google/sync-service');
      const mockSyncService = {
        syncCampaigns: jest.fn().mockResolvedValue({
          success: true,
          campaignsSynced: 0, // No new campaigns
          metricsUpdated: 1,
          errors: [],
        }),
      };
      getGoogleSyncService.mockReturnValue(mockSyncService);

      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      const syncRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: false, // Incremental sync
        }),
      });

      const syncResponse = await syncPost(syncRequest);
      const syncData = await syncResponse.json();

      expect(syncResponse.status).toBe(200);
      expect(syncData.success).toBe(true);

      // Verify incremental sync was performed
      expect(mockSyncService.syncCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({
          incremental: true,
          since: expect.any(String),
        })
      );
    });

    it('should handle sync errors gracefully', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClientId },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: mockConnectionId,
            client_id: mockClientId,
            customer_id: mockCustomerId,
            status: 'active',
          },
          error: null,
        });

      // Mock Google API error
      const { getGoogleAdsClient } = require('@/lib/google/client');
      const mockGoogleClient = {
        getCampaigns: jest.fn().mockRejectedValue(new Error('API rate limit exceeded')),
      };
      getGoogleAdsClient.mockReturnValue(mockGoogleClient);

      const { getGoogleSyncService } = require('@/lib/google/sync-service');
      const mockSyncService = {
        syncCampaigns: jest.fn().mockResolvedValue({
          success: false,
          campaignsSynced: 0,
          metricsUpdated: 0,
          errors: ['API rate limit exceeded'],
        }),
      };
      getGoogleSyncService.mockReturnValue(mockSyncService);

      // Mock sync log insertion
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: null,
      });

      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      const syncRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: true,
        }),
      });

      const syncResponse = await syncPost(syncRequest);
      const syncData = await syncResponse.json();

      expect(syncResponse.status).toBe(200);
      expect(syncData.success).toBe(false);
      expect(syncData.errors).toContain('API rate limit exceeded');

      // Verify error was logged
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: expect.stringContaining('API rate limit exceeded'),
        })
      );
    });
  });

  describe('Data Isolation Testing', () => {
    it('should enforce client data isolation during sync', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          upsert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check - user has access to client-123 but not client-456
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClientId }, // Valid membership
          error: null,
        })
        .mockResolvedValueOnce({
          data: null, // No membership for other client
          error: new Error('No membership found'),
        });

      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      // Valid sync request
      const validRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: true,
        }),
      });

      const validResponse = await syncPost(validRequest);
      expect(validResponse.status).toBe(200);

      // Invalid sync request for unauthorized client
      const invalidRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 'client-456', // Unauthorized
          fullSync: true,
        }),
      });

      const invalidResponse = await syncPost(invalidRequest);
      expect(invalidResponse.status).toBe(403);

      const invalidData = await invalidResponse.json();
      expect(invalidData.error).toBe('Acesso negado ao cliente especificado');
    });

    it('should only sync campaigns for authorized client', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          upsert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClientId },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: mockConnectionId,
            client_id: mockClientId,
            customer_id: mockCustomerId,
            status: 'active',
          },
          error: null,
        });

      // Mock campaigns upsert with client_id validation
      mockSupabase.from().upsert.mockImplementation((data) => {
        // Verify all campaigns have correct client_id
        const campaigns = Array.isArray(data) ? data : [data];
        campaigns.forEach(campaign => {
          expect(campaign.client_id).toBe(mockClientId);
        });

        return Promise.resolve({
          data: campaigns.map((_, index) => ({ id: `campaign-${index}` })),
          error: null,
        });
      });

      const { getGoogleSyncService } = require('@/lib/google/sync-service');
      const mockSyncService = {
        syncCampaigns: jest.fn().mockResolvedValue({
          success: true,
          campaignsSynced: 2,
          metricsUpdated: 0,
          errors: [],
        }),
      };
      getGoogleSyncService.mockReturnValue(mockSyncService);

      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      const syncRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: true,
        }),
      });

      const syncResponse = await syncPost(syncRequest);
      expect(syncResponse.status).toBe(200);

      // Verify upsert was called and client_id was validated
      expect(mockSupabase.from().upsert).toHaveBeenCalled();
    });
  });

  describe('Sync Queue Integration', () => {
    it('should handle concurrent sync requests', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single
        .mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

      // Mock active sync check
      mockSupabase.from().select
        .mockResolvedValueOnce({
          data: [], // No active syncs
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'active-sync-1' }], // Active sync found
          error: null,
        });

      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      // First request should succeed
      const firstRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: true,
        }),
      });

      const firstResponse = await syncPost(firstRequest);
      expect(firstResponse.status).toBe(200);

      // Second concurrent request should be rejected
      const secondRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: true,
        }),
      });

      const secondResponse = await syncPost(secondRequest);
      expect(secondResponse.status).toBe(409);

      const secondData = await secondResponse.json();
      expect(secondData.error).toBe('Sincronização já em andamento para este cliente');
    });

    it('should queue sync requests when rate limited', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      // Mock rate limit check
      const rateLimitMap = new Map();
      const checkRateLimit = (clientId: string) => {
        const key = `sync_${clientId}`;
        const current = rateLimitMap.get(key) || { count: 0, resetTime: Date.now() + 5 * 60 * 1000 };
        
        if (current.count >= 3) {
          return { allowed: false, resetTime: current.resetTime };
        }
        
        current.count += 1;
        rateLimitMap.set(key, current);
        return { allowed: true };
      };

      // Mock sync queue insertion
      mockSupabase.from().insert.mockResolvedValue({
        data: { id: 'queued-sync-1' },
        error: null,
      });

      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      // Make multiple requests to trigger rate limiting
      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/google/sync', {
          method: 'POST',
          body: JSON.stringify({
            clientId: mockClientId,
            fullSync: true,
          }),
        })
      );

      const responses = await Promise.all(
        requests.map(req => syncPost(req))
      );

      // Some requests should be rate limited and queued
      const rateLimited = responses.filter(res => res.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Aggregation Integration', () => {
    it('should aggregate metrics correctly during sync', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock raw metrics from Google Ads API
      const rawMetrics = [
        {
          campaignId: '12345',
          date: '2024-01-01',
          impressions: '1000',
          clicks: '50',
          conversions: '5',
          costMicros: '25000000',
        },
        {
          campaignId: '12345',
          date: '2024-01-02',
          impressions: '1200',
          clicks: '60',
          conversions: '6',
          costMicros: '30000000',
        },
      ];

      // Mock processed metrics for database insertion
      const processedMetrics = rawMetrics.map(metric => ({
        campaign_id: mockCampaignId,
        date: metric.date,
        impressions: parseInt(metric.impressions),
        clicks: parseInt(metric.clicks),
        conversions: parseFloat(metric.conversions),
        cost: parseFloat(metric.costMicros) / 1000000, // Convert micros to currency
        ctr: (parseInt(metric.clicks) / parseInt(metric.impressions)) * 100,
        conversion_rate: (parseFloat(metric.conversions) / parseInt(metric.clicks)) * 100,
        cpc: parseFloat(metric.costMicros) / 1000000 / parseInt(metric.clicks),
        cpa: parseFloat(metric.costMicros) / 1000000 / parseFloat(metric.conversions),
      }));

      mockSupabase.from().insert.mockImplementation((data) => {
        // Verify metrics are properly processed
        const metrics = Array.isArray(data) ? data : [data];
        metrics.forEach(metric => {
          expect(metric.ctr).toBeCloseTo(5.0, 1); // 50/1000 * 100 or 60/1200 * 100
          expect(metric.conversion_rate).toBeCloseTo(10.0, 1); // 5/50 * 100 or 6/60 * 100
          expect(metric.cost).toBeGreaterThan(0);
        });

        return Promise.resolve({
          data: null,
          error: null,
        });
      });

      const { getGoogleSyncService } = require('@/lib/google/sync-service');
      const mockSyncService = {
        syncCampaigns: jest.fn().mockResolvedValue({
          success: true,
          campaignsSynced: 1,
          metricsUpdated: 2,
          errors: [],
        }),
      };
      getGoogleSyncService.mockReturnValue(mockSyncService);

      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClientId },
        error: null,
      });

      const { POST: syncPost } = await import('@/app/api/google/sync/route');

      const syncRequest = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          fullSync: true,
        }),
      });

      const syncResponse = await syncPost(syncRequest);
      expect(syncResponse.status).toBe(200);

      // Verify metrics were processed and inserted
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });
  });
});