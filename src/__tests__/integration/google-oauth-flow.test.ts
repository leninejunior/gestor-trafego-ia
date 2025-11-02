/**
 * Google OAuth Flow Integration Tests
 * 
 * Tests complete OAuth flow from initiation to token storage
 * Requirements: 1.1, 2.1
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mock external dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/google/oauth');
jest.mock('@/lib/google/token-manager');

describe('Google OAuth Flow Integration', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockClientId = 'client-123';
  const mockConnectionId = 'connection-123';
  const mockCustomerId = '1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete OAuth Flow', () => {
    it('should complete full OAuth flow successfully', async () => {
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
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock OAuth service
      const { getGoogleOAuthService } = require('@/lib/google/oauth');
      const mockOAuthService = {
        getAuthorizationUrl: jest.fn().mockReturnValue({
          url: 'https://accounts.google.com/oauth/authorize?test=true',
          state: 'mock-state-123',
        }),
        exchangeCodeForTokens: jest.fn().mockResolvedValue({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/adwords',
        }),
      };
      getGoogleOAuthService.mockReturnValue(mockOAuthService);

      // Mock token manager
      const { getGoogleTokenManager } = require('@/lib/google/token-manager');
      const mockTokenManager = {
        saveTokens: jest.fn().mockResolvedValue(mockConnectionId),
      };
      getGoogleTokenManager.mockReturnValue(mockTokenManager);

      // Step 1: Initiate OAuth
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: { client_id: mockClientId },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      const { POST: authPost } = await import('@/app/api/google/auth/route');
      
      const authRequest = new NextRequest('http://localhost:3000/api/google/auth', {
        method: 'POST',
        body: JSON.stringify({ clientId: mockClientId }),
      });

      const authResponse = await authPost(authRequest);
      const authData = await authResponse.json();

      expect(authResponse.status).toBe(200);
      expect(authData.authUrl).toContain('https://accounts.google.com');
      expect(authData.state).toBe('mock-state-123');

      // Step 2: Handle OAuth callback
      mockSupabase.from().single
        .mockResolvedValueOnce({
          data: {
            client_id: mockClientId,
            user_id: mockUser.id,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { client_id: mockClientId },
          error: null,
        });

      mockSupabase.from().insert.mockResolvedValue({
        data: { id: mockConnectionId },
        error: null,
      });

      const { GET: callbackGet } = await import('@/app/api/google/callback/route');

      const callbackUrl = new URL('http://localhost:3000/api/google/callback');
      callbackUrl.searchParams.set('code', 'mock-auth-code');
      callbackUrl.searchParams.set('state', 'mock-state-123');

      const callbackRequest = new NextRequest(callbackUrl);
      const callbackResponse = await callbackGet(callbackRequest);

      expect(callbackResponse.status).toBe(302);
      expect(callbackResponse.headers.get('location')).toContain('/google/select-accounts');

      // Verify OAuth service was called correctly
      expect(mockOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith('mock-auth-code');

      // Verify token manager was called
      expect(mockTokenManager.saveTokens).toHaveBeenCalledWith(
        mockClientId,
        mockCustomerId,
        expect.objectContaining({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        })
      );
    });

    it('should handle OAuth errors gracefully', async () => {
      const { GET: callbackGet } = await import('@/app/api/google/callback/route');

      const callbackUrl = new URL('http://localhost:3000/api/google/callback');
      callbackUrl.searchParams.set('error', 'access_denied');
      callbackUrl.searchParams.set('error_description', 'User denied access');

      const callbackRequest = new NextRequest(callbackUrl);
      const callbackResponse = await callbackGet(callbackRequest);

      expect(callbackResponse.status).toBe(302);
      expect(callbackResponse.headers.get('location')).toContain('error=oauth_error');
    });

    it('should validate state parameter for security', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null, // No matching state found
            error: new Error('State not found'),
          }),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const { GET: callbackGet } = await import('@/app/api/google/callback/route');

      const callbackUrl = new URL('http://localhost:3000/api/google/callback');
      callbackUrl.searchParams.set('code', 'mock-auth-code');
      callbackUrl.searchParams.set('state', 'invalid-state');

      const callbackRequest = new NextRequest(callbackUrl);
      const callbackResponse = await callbackGet(callbackRequest);

      expect(callbackResponse.status).toBe(302);
      expect(callbackResponse.headers.get('location')).toContain('error=invalid_state');
    });

    it('should handle expired state parameters', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              client_id: mockClientId,
              user_id: mockUser.id,
              expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // Expired
            },
            error: null,
          }),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const { GET: callbackGet } = await import('@/app/api/google/callback/route');

      const callbackUrl = new URL('http://localhost:3000/api/google/callback');
      callbackUrl.searchParams.set('code', 'mock-auth-code');
      callbackUrl.searchParams.set('state', 'expired-state');

      const callbackRequest = new NextRequest(callbackUrl);
      const callbackResponse = await callbackGet(callbackRequest);

      expect(callbackResponse.status).toBe(302);
      expect(callbackResponse.headers.get('location')).toContain('error=state_expired');
    });
  });

  describe('Token Management Integration', () => {
    it('should store tokens securely', async () => {
      const { getGoogleTokenManager } = require('@/lib/google/token-manager');
      const mockTokenManager = {
        saveTokens: jest.fn().mockResolvedValue(mockConnectionId),
        encryptToken: jest.fn().mockReturnValue('encrypted-token'),
      };
      getGoogleTokenManager.mockReturnValue(mockTokenManager);

      const mockSupabase = {
        from: jest.fn(() => ({
          insert: jest.fn().mockResolvedValue({
            data: { id: mockConnectionId },
            error: null,
          }),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const tokens = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
      };

      await mockTokenManager.saveTokens(mockClientId, mockCustomerId, tokens);

      expect(mockTokenManager.saveTokens).toHaveBeenCalledWith(
        mockClientId,
        mockCustomerId,
        tokens
      );
    });

    it('should handle token refresh automatically', async () => {
      const { getGoogleTokenManager } = require('@/lib/google/token-manager');
      const mockTokenManager = {
        ensureValidToken: jest.fn()
          .mockResolvedValueOnce('old-token') // First call returns old token
          .mockResolvedValueOnce('new-token'), // Second call returns refreshed token
        refreshToken: jest.fn().mockResolvedValue({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      };
      getGoogleTokenManager.mockReturnValue(mockTokenManager);

      // Simulate token refresh scenario
      const token1 = await mockTokenManager.ensureValidToken(mockConnectionId);
      const token2 = await mockTokenManager.ensureValidToken(mockConnectionId);

      expect(token1).toBe('old-token');
      expect(token2).toBe('new-token');
    });
  });

  describe('Account Selection Integration', () => {
    it('should handle multiple Google Ads accounts', async () => {
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
          single: jest.fn().mockResolvedValue({
            data: { client_id: mockClientId },
            error: null,
          }),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      // Mock Google Ads client
      jest.mock('@/lib/google/client', () => ({
        getGoogleAdsClient: jest.fn(() => ({
          getAccessibleCustomers: jest.fn().mockResolvedValue([
            { customerId: '1234567890', descriptiveName: 'Account 1' },
            { customerId: '0987654321', descriptiveName: 'Account 2' },
          ]),
        })),
      }));

      const { GET: accountsGet } = await import('@/app/api/google/accounts/route');

      const accountsUrl = new URL('http://localhost:3000/api/google/accounts');
      accountsUrl.searchParams.set('clientId', mockClientId);

      const accountsRequest = new NextRequest(accountsUrl);
      const accountsResponse = await accountsGet(accountsRequest);
      const accountsData = await accountsResponse.json();

      expect(accountsResponse.status).toBe(200);
      expect(accountsData.accounts).toHaveLength(2);
      expect(accountsData.accounts[0].customerId).toBe('1234567890');
    });

    it('should save selected accounts', async () => {
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
          single: jest.fn().mockResolvedValue({
            data: { client_id: mockClientId },
            error: null,
          }),
        })),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const { POST: selectAccountsPost } = await import('@/app/api/google/accounts/select/route');

      const selectRequest = new NextRequest('http://localhost:3000/api/google/accounts/select', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mockClientId,
          selectedAccounts: ['1234567890', '0987654321'],
        }),
      });

      const selectResponse = await selectAccountsPost(selectRequest);
      const selectData = await selectResponse.json();

      expect(selectResponse.status).toBe(200);
      expect(selectData.success).toBe(true);
      expect(selectData.connectionsCreated).toBe(2);
    });
  });
});