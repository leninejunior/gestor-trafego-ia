import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const mockOAuthFlowManager = {
  initiateOAuthFlow: jest.fn(),
  processOAuthCallback: jest.fn(),
};

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/google/oauth-flow-manager', () => ({
  getGoogleOAuthFlowManager: () => mockOAuthFlowManager,
}));

describe('Google Ads API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'google-ads-developer-token';
    process.env.GOOGLE_DEVELOPER_TOKEN = 'google-developer-token';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('POST /api/google/auth', () => {
    it('returns 400 for invalid clientId format', async () => {
      const { POST } = await import('@/app/api/google/auth/route');

      const request = new NextRequest('http://localhost:3000/api/google/auth', {
        method: 'POST',
        body: JSON.stringify({ clientId: 'invalid-id' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Dados inválidos');
    });

    it('returns 401 when user is not authenticated', async () => {
      (createClient as jest.Mock).mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'unauthorized' },
          }),
        },
      });

      const { POST } = await import('@/app/api/google/auth/route');

      const request = new NextRequest('http://localhost:3000/api/google/auth', {
        method: 'POST',
        body: JSON.stringify({ clientId: '11111111-1111-1111-1111-111111111111' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Não autorizado');
    });

    it('starts oauth flow successfully when authenticated', async () => {
      (createClient as jest.Mock).mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
      });

      mockOAuthFlowManager.initiateOAuthFlow.mockResolvedValue({
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
        state: 'abc',
      });

      const { POST } = await import('@/app/api/google/auth/route');

      const request = new NextRequest('http://localhost:3000/api/google/auth', {
        method: 'POST',
        body: JSON.stringify({ clientId: '11111111-1111-1111-1111-111111111111' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.authUrl).toContain('https://accounts.google.com');
      expect(body.state).toBe('abc');
      expect(mockOAuthFlowManager.initiateOAuthFlow).toHaveBeenCalledWith(
        'user-123',
        '11111111-1111-1111-1111-111111111111'
      );
    });
  });

  describe('GET /api/google/callback', () => {
    it('redirects with oauth error when error query param is provided', async () => {
      const { GET } = await import('@/app/api/google/callback/route');

      const request = new NextRequest(
        'http://localhost:3000/api/google/callback?error=access_denied'
      );

      const response = await GET(request);
      const location = String(response.headers.get('location'));

      expect(response.status).toBe(302);
      expect(location).toContain('/dashboard/google');
      expect(location).toContain('error=oauth_error');
    });

    it('redirects to account selection on successful callback', async () => {
      mockOAuthFlowManager.processOAuthCallback.mockResolvedValue({
        success: true,
        connectionId: 'conn-123',
        clientId: '11111111-1111-1111-1111-111111111111',
      });

      const { GET } = await import('@/app/api/google/callback/route');

      const request = new NextRequest(
        'http://localhost:3000/api/google/callback?code=code123&state=state123'
      );

      const response = await GET(request);
      const location = String(response.headers.get('location'));

      expect(response.status).toBe(302);
      expect(location).toContain('/google/select-accounts');
      expect(location).toContain('connectionId=conn-123');
      expect(location).toContain('clientId=11111111-1111-1111-1111-111111111111');
    });
  });

  describe('POST /api/google/disconnect', () => {
    it('returns 400 for invalid payload', async () => {
      const { POST } = await import('@/app/api/google/disconnect/route');

      const request = new NextRequest('http://localhost:3000/api/google/disconnect', {
        method: 'POST',
        body: JSON.stringify({ connectionId: 'invalid-id' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Dados inválidos');
    });
  });

  describe('GET /api/google/campaigns', () => {
    it('returns 400 when clientId is missing', async () => {
      const { GET } = await import('@/app/api/google/campaigns/route');

      const request = new NextRequest('http://localhost:3000/api/google/campaigns');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Client ID é obrigatório');
    });
  });

  describe('POST /api/google/sync', () => {
    it('returns 400 for invalid UUIDs', async () => {
      const { POST } = await import('@/app/api/google/sync/route');

      const request = new NextRequest('http://localhost:3000/api/google/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 'invalid-client-id',
          fullSync: false,
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Dados inválidos');
    });
  });

  describe('GET /api/google/metrics', () => {
    it('returns 400 for invalid query validation', async () => {
      const { GET } = await import('@/app/api/google/metrics/route');

      const url = new URL('http://localhost:3000/api/google/metrics');
      url.searchParams.set('clientId', 'invalid-id');
      url.searchParams.set('dateFrom', '2026-02-01');
      url.searchParams.set('dateTo', '2026-02-10');

      const request = new NextRequest(url);
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Parâmetros inválidos');
    });
  });
});
