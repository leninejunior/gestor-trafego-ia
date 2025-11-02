/**
 * Google Ads API Routes Integration Tests
 * 
 * Tests all Google Ads API endpoints for authentication, authorization,
 * parameter validation, and error handling
 * Requirements: 1.1, 7.1, 8.1
 */

import { NextRequest } from 'next/server';
import { createMocks } from 'node-mocks-http';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      range: jest.fn().mockReturnThis(),
    })),
  })),
}));

// Mock Google services
jest.mock('@/lib/google/oauth', () => ({
  getGoogleOAuthService: jest.fn(() => ({
    getAuthorizationUrl: jest.fn(() => ({
      url: 'https://accounts.google.com/oauth/authorize?test=true',
      state: 'mock-state-123',
    })),
    exchangeCodeForTokens: jest.fn(() => Promise.resolve({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/adwords',
    })),
    getUserFriendlyError: jest.fn((error) => `Erro de autenticação: ${error.message}`),
  })),
}));

jest.mock('@/lib/google/token-manager', () => ({
  getGoogleTokenManager: jest.fn(() => ({
    saveTokens: jest.fn(() => Promise.resolve()),
    ensureValidToken: jest.fn(() => Promise.resolve('mock-access-token')),
    revokeTokens: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('@/lib/google/sync-service', () => ({
  getGoogleSyncService: jest.fn(() => ({
    startSync: jest.fn(() => Promise.resolve({
      syncId: 'mock-sync-id',
      status: 'started',
      estimatedTime: 300,
    })),
  })),
}));

// Import API handlers
import { POST as authPost, GET as authGet } from '@/app/api/google/auth/route';
import { GET as callbackGet, POST as callbackPost } from '@/app/api/google/callback/route';
import { POST as disconnectPost, GET as disconnectGet } from '@/app/api/google/disconnect/route';
import { GET as campaignsGet, POST as campaignsPost } from '@/app/api/google/campaigns/route';
import { GET as campaignDetailsGet } from '@/app/api/google/campaigns/[id]/route';
import { POST as syncPost, GET as syncGet } from '@/app/api/google/sync/route';
import { GET as syncStatusGet, POST as syncStatusPost } from '@/app/api/google/sync/status/route';
import { GET as metricsGet } from '@/app/api/google/metrics/route';

describe('Google Ads API Routes', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockClientId = 'client-123';
  const mockConnectionId = 'connection-123';
  const mockCampaignId = 'campaign-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Routes', () => {
    describe('POST /api/google/auth', () => {
      it('should initiate OAuth flow successfully', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        mockSupabase.from().insert.mockResolvedValue({
          data: null,
          error: null,
        });

        const request = new NextRequest('http://localhost:3000/api/google/auth', {
          method: 'POST',
          body: JSON.stringify({
            clientId: mockClientId,
          }),
        });

        const response = await authPost(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.authUrl).toContain('https://accounts.google.com');
        expect(data.state).toBeDefined();
      });

      it('should return 401 for unauthenticated user', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        });

        const request = new NextRequest('http://localhost:3000/api/google/auth', {
          method: 'POST',
          body: JSON.stringify({
            clientId: mockClientId,
          }),
        });

        const response = await authPost(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Não autorizado');
      });

      it('should validate request parameters', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const request = new NextRequest('http://localhost:3000/api/google/auth', {
          method: 'POST',
          body: JSON.stringify({
            clientId: 'invalid-uuid',
          }),
        });

        const response = await authPost(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Dados inválidos');
        expect(data.details).toBeDefined();
      });
    });

    describe('GET /api/google/callback', () => {
      it('should handle OAuth callback successfully', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        // Mock OAuth state validation
        mockSupabase.from().single
          .mockResolvedValueOnce({
            data: {
              client_id: mockClientId,
              user_id: mockUser.id,
              expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            },
            error: null,
          })
          // Mock membership check
          .mockResolvedValueOnce({
            data: { client_id: mockClientId },
            error: null,
          });

        // Mock connection creation
        mockSupabase.from().insert.mockResolvedValue({
          data: { id: mockConnectionId },
          error: null,
        });

        const url = new URL('http://localhost:3000/api/google/callback');
        url.searchParams.set('code', 'mock-auth-code');
        url.searchParams.set('state', 'mock-state-123');

        const request = new NextRequest(url);
        const response = await callbackGet(request);

        expect(response.status).toBe(302); // Redirect
        expect(response.headers.get('location')).toContain('/google/select-accounts');
      });

      it('should handle OAuth errors', async () => {
        const url = new URL('http://localhost:3000/api/google/callback');
        url.searchParams.set('error', 'access_denied');
        url.searchParams.set('error_description', 'User denied access');

        const request = new NextRequest(url);
        const response = await callbackGet(request);

        expect(response.status).toBe(302); // Redirect
        expect(response.headers.get('location')).toContain('error=oauth_error');
      });
    });

    describe('POST /api/google/disconnect', () => {
      it('should disconnect Google Ads connection', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        // Mock connection lookup
        mockSupabase.from().single
          .mockResolvedValueOnce({
            data: {
              id: mockConnectionId,
              client_id: mockClientId,
              customer_id: '1234567890',
              status: 'active',
            },
            error: null,
          })
          // Mock membership check
          .mockResolvedValueOnce({
            data: { client_id: mockClientId },
            error: null,
          });

        // Mock update operation
        mockSupabase.from().update.mockResolvedValue({
          data: null,
          error: null,
        });

        const request = new NextRequest('http://localhost:3000/api/google/disconnect', {
          method: 'POST',
          body: JSON.stringify({
            connectionId: mockConnectionId,
            revokeTokens: true,
            deleteData: false,
          }),
        });

        const response = await disconnectPost(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.action).toBe('revoked');
      });
    });
  });

  describe('Campaign Routes', () => {
    describe('GET /api/google/campaigns', () => {
      it('should list campaigns with metrics', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        // Mock membership check
        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        // Mock campaigns query
        mockSupabase.from().select.mockResolvedValue({
          data: [
            {
              id: mockCampaignId,
              campaign_id: '12345',
              campaign_name: 'Test Campaign',
              status: 'ENABLED',
              budget_amount: 100.00,
              google_ads_connections: {
                customer_id: '1234567890',
                status: 'active',
              },
            },
          ],
          error: null,
          count: 1,
        });

        const url = new URL('http://localhost:3000/api/google/campaigns');
        url.searchParams.set('clientId', mockClientId);
        url.searchParams.set('includeMetrics', 'true');

        const request = new NextRequest(url);
        const response = await campaignsGet(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.campaigns).toHaveLength(1);
        expect(data.pagination).toBeDefined();
      });

      it('should validate query parameters', async () => {
        const url = new URL('http://localhost:3000/api/google/campaigns');
        url.searchParams.set('clientId', 'invalid-uuid');

        const request = new NextRequest(url);
        const response = await campaignsGet(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Parâmetros inválidos');
      });
    });

    describe('GET /api/google/campaigns/[id]', () => {
      it('should get campaign details with metrics', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        // Mock campaign lookup
        mockSupabase.from().single
          .mockResolvedValueOnce({
            data: {
              id: mockCampaignId,
              campaign_id: '12345',
              campaign_name: 'Test Campaign',
              status: 'ENABLED',
              client_id: mockClientId,
              google_ads_connections: {
                customer_id: '1234567890',
                status: 'active',
              },
            },
            error: null,
          })
          // Mock membership check
          .mockResolvedValueOnce({
            data: { client_id: mockClientId },
            error: null,
          });

        // Mock metrics query
        mockSupabase.from().select.mockResolvedValue({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00,
            },
          ],
          error: null,
        });

        const request = new NextRequest(`http://localhost:3000/api/google/campaigns/${mockCampaignId}`);
        const response = await campaignDetailsGet(request, { params: { id: mockCampaignId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.campaign.id).toBe(mockCampaignId);
        expect(data.metrics).toBeDefined();
      });
    });
  });

  describe('Sync Routes', () => {
    describe('POST /api/google/sync', () => {
      it('should start manual sync', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        // Mock membership check
        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        // Mock connections query
        mockSupabase.from().select.mockResolvedValue({
          data: [
            {
              id: mockConnectionId,
              customer_id: '1234567890',
              status: 'active',
            },
          ],
          error: null,
        });

        // Mock active syncs check
        mockSupabase.from().select.mockResolvedValue({
          data: [],
          error: null,
        });

        const request = new NextRequest('http://localhost:3000/api/google/sync', {
          method: 'POST',
          body: JSON.stringify({
            clientId: mockClientId,
            fullSync: false,
          }),
        });

        const response = await syncPost(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.results).toBeDefined();
      });

      it('should enforce rate limiting', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        // Simulate multiple rapid requests
        const requests = Array(5).fill(null).map(() => 
          new NextRequest('http://localhost:3000/api/google/sync', {
            method: 'POST',
            body: JSON.stringify({
              clientId: mockClientId,
              fullSync: false,
            }),
          })
        );

        const responses = await Promise.all(
          requests.map(req => syncPost(req))
        );

        // At least one should be rate limited
        const rateLimited = responses.some(res => res.status === 429);
        expect(rateLimited).toBe(true);
      });
    });

    describe('GET /api/google/sync/status', () => {
      it('should get sync status', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        // Mock membership check
        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        // Mock connections query
        mockSupabase.from().select.mockResolvedValue({
          data: [
            {
              id: mockConnectionId,
              customer_id: '1234567890',
              status: 'active',
              last_sync_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
        });

        const url = new URL('http://localhost:3000/api/google/sync/status');
        url.searchParams.set('clientId', mockClientId);

        const request = new NextRequest(url);
        const response = await syncStatusGet(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.clientId).toBe(mockClientId);
        expect(data.connections).toBeDefined();
      });
    });
  });

  describe('Metrics Routes', () => {
    describe('GET /api/google/metrics', () => {
      it('should get campaign metrics', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        // Mock membership check
        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        // Mock metrics query
        mockSupabase.from().select.mockResolvedValue({
          data: [
            {
              date: '2024-01-01',
              impressions: 1000,
              clicks: 50,
              conversions: 5,
              cost: 25.00,
              google_ads_campaigns: {
                id: mockCampaignId,
                campaign_name: 'Test Campaign',
                status: 'ENABLED',
              },
            },
          ],
          error: null,
        });

        const url = new URL('http://localhost:3000/api/google/metrics');
        url.searchParams.set('clientId', mockClientId);
        url.searchParams.set('dateFrom', '2024-01-01');
        url.searchParams.set('dateTo', '2024-01-31');

        const request = new NextRequest(url);
        const response = await metricsGet(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.metrics).toBeDefined();
        expect(data.summary).toBeDefined();
      });

      it('should validate date range', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        const url = new URL('http://localhost:3000/api/google/metrics');
        url.searchParams.set('clientId', mockClientId);
        url.searchParams.set('dateFrom', '2024-01-31');
        url.searchParams.set('dateTo', '2024-01-01'); // Invalid: end before start

        const request = new NextRequest(url);
        const response = await metricsGet(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Data inicial deve ser anterior à data final');
      });

      it('should enforce maximum date range', async () => {
        const { createClient } = require('@/lib/supabase/server');
        const mockSupabase = createClient();
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        mockSupabase.from().single.mockResolvedValue({
          data: { client_id: mockClientId },
          error: null,
        });

        const url = new URL('http://localhost:3000/api/google/metrics');
        url.searchParams.set('clientId', mockClientId);
        url.searchParams.set('dateFrom', '2023-01-01');
        url.searchParams.set('dateTo', '2024-12-31'); // More than 1 year

        const request = new NextRequest(url);
        const response = await metricsGet(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Período máximo permitido é de 1 ano');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockSupabase = createClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock database error
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      });

      const request = new NextRequest('http://localhost:3000/api/google/auth', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
        }),
      });

      const response = await authPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Erro interno do servidor');
    });

    it('should handle malformed JSON requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/google/auth', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await authPost(request);
      expect(response.status).toBe(500);
    });
  });

  describe('Authorization', () => {
    it('should deny access to unauthorized clients', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockSupabase = createClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock no membership found
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: new Error('No membership found'),
      });

      const request = new NextRequest('http://localhost:3000/api/google/auth', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
        }),
      });

      const response = await authPost(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Acesso negado ao cliente especificado');
    });
  });
});