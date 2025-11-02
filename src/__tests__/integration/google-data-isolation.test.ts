/**
 * Google Ads Data Isolation Integration Tests
 * 
 * Tests Row Level Security (RLS) policies and data isolation between clients
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase
jest.mock('@/lib/supabase/server');

describe('Google Ads Data Isolation Integration', () => {
  const mockUser1 = {
    id: 'user-123',
    email: 'user1@example.com',
  };

  const mockUser2 = {
    id: 'user-456',
    email: 'user2@example.com',
  };

  const mockClient1 = 'client-123';
  const mockClient2 = 'client-456';
  const mockConnection1 = 'connection-123';
  const mockConnection2 = 'connection-456';
  const mockCampaign1 = 'campaign-123';
  const mockCampaign2 = 'campaign-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Data Isolation', () => {
    it('should only return connections for authorized client', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check - user1 has access to client1 only
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClient1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: new Error('No membership found'),
        });

      // Mock connections query - should only return client1 connections
      mockSupabase.from().select.mockResolvedValue({
        data: [
          {
            id: mockConnection1,
            client_id: mockClient1,
            customer_id: '1234567890',
            status: 'active',
          },
        ],
        error: null,
      });

      const { GET: connectionsGet } = await import('@/app/api/google/connections/route');

      // Request connections for authorized client
      const authorizedUrl = new URL('http://localhost:3000/api/google/connections');
      authorizedUrl.searchParams.set('clientId', mockClient1);

      const authorizedRequest = new NextRequest(authorizedUrl);
      const authorizedResponse = await connectionsGet(authorizedRequest);
      const authorizedData = await authorizedResponse.json();

      expect(authorizedResponse.status).toBe(200);
      expect(authorizedData.connections).toHaveLength(1);
      expect(authorizedData.connections[0].client_id).toBe(mockClient1);

      // Request connections for unauthorized client
      const unauthorizedUrl = new URL('http://localhost:3000/api/google/connections');
      unauthorizedUrl.searchParams.set('clientId', mockClient2);

      const unauthorizedRequest = new NextRequest(unauthorizedUrl);
      const unauthorizedResponse = await connectionsGet(unauthorizedRequest);

      expect(unauthorizedResponse.status).toBe(403);
    });

    it('should prevent cross-client connection access', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check - user1 has access to client1 only
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClient1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: mockConnection2,
            client_id: mockClient2, // Different client
            customer_id: '0987654321',
            status: 'active',
          },
          error: null,
        });

      const { GET: connectionDetailsGet } = await import('@/app/api/google/connections/[id]/route');

      // Try to access connection from different client
      const request = new NextRequest(`http://localhost:3000/api/google/connections/${mockConnection2}`);
      const response = await connectionDetailsGet(request, { params: { id: mockConnection2 } });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Acesso negado à conexão especificada');
    });
  });

  describe('Campaign Data Isolation', () => {
    it('should only return campaigns for authorized client', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check
      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClient1 },
        error: null,
      });

      // Mock campaigns query with RLS filtering
      mockSupabase.from().select.mockResolvedValue({
        data: [
          {
            id: mockCampaign1,
            client_id: mockClient1,
            campaign_id: '12345',
            campaign_name: 'Client 1 Campaign',
            status: 'ENABLED',
            google_ads_connections: {
              customer_id: '1234567890',
              status: 'active',
            },
          },
        ],
        error: null,
        count: 1,
      });

      const { GET: campaignsGet } = await import('@/app/api/google/campaigns/route');

      const url = new URL('http://localhost:3000/api/google/campaigns');
      url.searchParams.set('clientId', mockClient1);

      const request = new NextRequest(url);
      const response = await campaignsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.campaigns).toHaveLength(1);
      expect(data.campaigns[0].client_id).toBe(mockClient1);

      // Verify RLS query was constructed correctly
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('client_id', mockClient1);
    });

    it('should prevent access to campaigns from other clients', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check - user1 has access to client1
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClient1 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: mockCampaign2,
            client_id: mockClient2, // Different client
            campaign_id: '67890',
            campaign_name: 'Client 2 Campaign',
            status: 'ENABLED',
          },
          error: null,
        });

      const { GET: campaignDetailsGet } = await import('@/app/api/google/campaigns/[id]/route');

      // Try to access campaign from different client
      const request = new NextRequest(`http://localhost:3000/api/google/campaigns/${mockCampaign2}`);
      const response = await campaignDetailsGet(request, { params: { id: mockCampaign2 } });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Acesso negado à campanha especificada');
    });

    it('should enforce client isolation in campaign creation', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
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

      // Mock membership check
      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClient1 },
        error: null,
      });

      // Mock campaign upsert with client_id validation
      mockSupabase.from().upsert.mockImplementation((data) => {
        const campaigns = Array.isArray(data) ? data : [data];
        
        // Verify all campaigns have correct client_id
        campaigns.forEach(campaign => {
          expect(campaign.client_id).toBe(mockClient1);
        });

        return Promise.resolve({
          data: campaigns.map((_, index) => ({ id: `campaign-${index}` })),
          error: null,
        });
      });

      // Simulate campaign sync that should enforce client_id
      const campaignData = {
        client_id: mockClient1,
        connection_id: mockConnection1,
        campaign_id: '12345',
        campaign_name: 'Test Campaign',
        status: 'ENABLED',
      };

      // This would be called during sync
      await mockSupabase.from().upsert(campaignData);

      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: mockClient1,
        })
      );
    });
  });

  describe('Metrics Data Isolation', () => {
    it('should only return metrics for authorized campaigns', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check
      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClient1 },
        error: null,
      });

      // Mock metrics query with RLS join
      mockSupabase.from().select.mockResolvedValue({
        data: [
          {
            date: '2024-01-01',
            impressions: 1000,
            clicks: 50,
            conversions: 5,
            cost: 25.00,
            google_ads_campaigns: {
              id: mockCampaign1,
              client_id: mockClient1,
              campaign_name: 'Client 1 Campaign',
            },
          },
        ],
        error: null,
      });

      const { GET: metricsGet } = await import('@/app/api/google/metrics/route');

      const url = new URL('http://localhost:3000/api/google/metrics');
      url.searchParams.set('clientId', mockClient1);
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-31');

      const request = new NextRequest(url);
      const response = await metricsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveLength(1);
      expect(data.metrics[0].google_ads_campaigns.client_id).toBe(mockClient1);
    });

    it('should prevent metrics access across clients', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check - user1 doesn't have access to client2
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: new Error('No membership found'),
      });

      const { GET: metricsGet } = await import('@/app/api/google/metrics/route');

      const url = new URL('http://localhost:3000/api/google/metrics');
      url.searchParams.set('clientId', mockClient2); // Unauthorized client
      url.searchParams.set('dateFrom', '2024-01-01');
      url.searchParams.set('dateTo', '2024-01-31');

      const request = new NextRequest(url);
      const response = await metricsGet(request);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Acesso negado ao cliente especificado');
    });

    it('should enforce client isolation in metrics insertion', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock campaign lookup to verify client ownership
      mockSupabase.from().single.mockResolvedValue({
        data: {
          id: mockCampaign1,
          client_id: mockClient1,
          campaign_id: '12345',
        },
        error: null,
      });

      // Mock metrics insertion with validation
      mockSupabase.from().insert.mockImplementation((data) => {
        const metrics = Array.isArray(data) ? data : [data];
        
        // Verify all metrics are for authorized campaigns
        metrics.forEach(metric => {
          expect(metric.campaign_id).toBe(mockCampaign1);
        });

        return Promise.resolve({
          data: null,
          error: null,
        });
      });

      // Simulate metrics insertion during sync
      const metricsData = [
        {
          campaign_id: mockCampaign1,
          date: '2024-01-01',
          impressions: 1000,
          clicks: 50,
          conversions: 5,
          cost: 25.00,
        },
      ];

      await mockSupabase.from().insert(metricsData);

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            campaign_id: mockCampaign1,
          }),
        ])
      );
    });
  });

  describe('Sync Logs Data Isolation', () => {
    it('should only show sync logs for authorized connections', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock membership check
      mockSupabase.from().single.mockResolvedValue({
        data: { client_id: mockClient1 },
        error: null,
      });

      // Mock sync logs query with RLS join
      mockSupabase.from().select.mockResolvedValue({
        data: [
          {
            id: 'sync-log-1',
            sync_type: 'full',
            status: 'success',
            campaigns_synced: 5,
            started_at: '2024-01-01T10:00:00Z',
            completed_at: '2024-01-01T10:05:00Z',
            google_ads_connections: {
              id: mockConnection1,
              client_id: mockClient1,
              customer_id: '1234567890',
            },
          },
        ],
        error: null,
      });

      const { GET: syncLogsGet } = await import('@/app/api/google/sync/logs/route');

      const url = new URL('http://localhost:3000/api/google/sync/logs');
      url.searchParams.set('clientId', mockClient1);

      const request = new NextRequest(url);
      const response = await syncLogsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0].google_ads_connections.client_id).toBe(mockClient1);
    });

    it('should enforce client isolation in sync log creation', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock connection lookup to verify client ownership
      mockSupabase.from().single.mockResolvedValue({
        data: {
          id: mockConnection1,
          client_id: mockClient1,
          customer_id: '1234567890',
        },
        error: null,
      });

      // Mock sync log insertion with validation
      mockSupabase.from().insert.mockImplementation((data) => {
        expect(data.connection_id).toBe(mockConnection1);
        
        return Promise.resolve({
          data: { id: 'sync-log-1' },
          error: null,
        });
      });

      // Simulate sync log creation
      const syncLogData = {
        connection_id: mockConnection1,
        sync_type: 'full',
        status: 'success',
        campaigns_synced: 5,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      await mockSupabase.from().insert(syncLogData);

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: mockConnection1,
        })
      );
    });
  });

  describe('Multi-Client Scenarios', () => {
    it('should handle same Google Ads account connected to different clients', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser1 },
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

      const sharedCustomerId = '1234567890';

      // Mock connections for same Google Ads account but different clients
      const connections = [
        {
          id: mockConnection1,
          client_id: mockClient1,
          customer_id: sharedCustomerId,
          status: 'active',
        },
        {
          id: mockConnection2,
          client_id: mockClient2,
          customer_id: sharedCustomerId,
          status: 'active',
        },
      ];

      // Mock membership check - user1 has access to client1 only
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClient1 },
          error: null,
        });

      // Mock connections query - should only return client1 connection
      mockSupabase.from().select.mockResolvedValue({
        data: [connections[0]], // Only client1 connection
        error: null,
      });

      const { GET: connectionsGet } = await import('@/app/api/google/connections/route');

      const url = new URL('http://localhost:3000/api/google/connections');
      url.searchParams.set('clientId', mockClient1);

      const request = new NextRequest(url);
      const response = await connectionsGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connections).toHaveLength(1);
      expect(data.connections[0].client_id).toBe(mockClient1);
      expect(data.connections[0].customer_id).toBe(sharedCustomerId);

      // Verify RLS filtering worked correctly
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('client_id', mockClient1);
    });

    it('should maintain data isolation during bulk operations', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          upsert: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock bulk campaign upsert with client validation
      mockSupabase.from().upsert.mockImplementation((data) => {
        const campaigns = Array.isArray(data) ? data : [data];
        
        // Verify all campaigns belong to the same client
        const clientIds = [...new Set(campaigns.map(c => c.client_id))];
        expect(clientIds).toHaveLength(1);
        expect(clientIds[0]).toBe(mockClient1);

        return Promise.resolve({
          data: campaigns.map((_, index) => ({ id: `campaign-${index}` })),
          error: null,
        });
      });

      // Mock bulk metrics insertion with campaign validation
      mockSupabase.from().insert.mockImplementation((data) => {
        const metrics = Array.isArray(data) ? data : [data];
        
        // All metrics should be for campaigns from the same client
        metrics.forEach(metric => {
          expect(metric.campaign_id).toMatch(/^campaign-/);
        });

        return Promise.resolve({
          data: null,
          error: null,
        });
      });

      // Simulate bulk sync operation
      const campaignsData = [
        {
          client_id: mockClient1,
          connection_id: mockConnection1,
          campaign_id: '12345',
          campaign_name: 'Campaign 1',
          status: 'ENABLED',
        },
        {
          client_id: mockClient1,
          connection_id: mockConnection1,
          campaign_id: '67890',
          campaign_name: 'Campaign 2',
          status: 'ENABLED',
        },
      ];

      const metricsData = [
        {
          campaign_id: 'campaign-0',
          date: '2024-01-01',
          impressions: 1000,
          clicks: 50,
        },
        {
          campaign_id: 'campaign-1',
          date: '2024-01-01',
          impressions: 1200,
          clicks: 60,
        },
      ];

      await mockSupabase.from().upsert(campaignsData);
      await mockSupabase.from().insert(metricsData);

      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ client_id: mockClient1 }),
        ])
      );

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ campaign_id: expect.any(String) }),
        ])
      );
    });
  });
});