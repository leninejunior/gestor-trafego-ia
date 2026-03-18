/**
 * Google OAuth flow integration tests (contract-aligned with current routes)
 */

import { NextRequest } from 'next/server';

const VALID_CLIENT_ID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_CONNECTION_ID = '123e4567-e89b-12d3-a456-426614174001';

type SetupResult = {
  flowManagerMock: {
    initiateOAuthFlow: jest.Mock;
    processOAuthCallback: jest.Mock;
    listAvailableAccounts: jest.Mock;
    saveSelectedAccounts: jest.Mock;
  };
  createClientMock: jest.Mock;
  authRoute: typeof import('@/app/api/google/auth/route');
  callbackRoute: typeof import('@/app/api/google/callback/route');
  accountsRoute: typeof import('@/app/api/google/accounts/route');
  selectRoute: typeof import('@/app/api/google/accounts/select/route');
};

const setup = async (options?: {
  user?: { id: string; email: string } | null;
}) => {
  jest.resetModules();

  const flowManagerMock = {
    initiateOAuthFlow: jest.fn(),
    processOAuthCallback: jest.fn(),
    listAvailableAccounts: jest.fn(),
    saveSelectedAccounts: jest.fn(),
  };

  const createClientMock = jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: options?.user === undefined ? { id: 'user-1', email: 'user@example.com' } : options.user },
        error: options?.user === null ? { message: 'Not authenticated' } : null,
      })),
    },
  }));

  jest.doMock('@/lib/google/oauth-flow-manager', () => ({
    getGoogleOAuthFlowManager: () => flowManagerMock,
  }));

  jest.doMock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
  }));

  const authRoute = await import('@/app/api/google/auth/route');
  const callbackRoute = await import('@/app/api/google/callback/route');
  const accountsRoute = await import('@/app/api/google/accounts/route');
  const selectRoute = await import('@/app/api/google/accounts/select/route');

  return {
    flowManagerMock,
    createClientMock,
    authRoute,
    callbackRoute,
    accountsRoute,
    selectRoute,
  } as SetupResult;
};

describe('Google OAuth Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'google-dev-token';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('starts OAuth flow successfully on POST /api/google/auth', async () => {
    const { flowManagerMock, authRoute } = await setup();

    flowManagerMock.initiateOAuthFlow.mockResolvedValue({
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?test=true',
      state: 'oauth-state-123',
    });

    const request = new NextRequest('http://localhost:3000/api/google/auth', {
      method: 'POST',
      body: JSON.stringify({ clientId: VALID_CLIENT_ID }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await authRoute.POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authUrl).toContain('https://accounts.google.com');
    expect(body.state).toBe('oauth-state-123');
    expect(flowManagerMock.initiateOAuthFlow).toHaveBeenCalledWith('user-1', VALID_CLIENT_ID);
  });

  it('validates UUID on POST /api/google/auth', async () => {
    const { authRoute, flowManagerMock } = await setup();

    const request = new NextRequest('http://localhost:3000/api/google/auth', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'invalid-client-id' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await authRoute.POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Dados inválidos');
    expect(flowManagerMock.initiateOAuthFlow).not.toHaveBeenCalled();
  });

  it('handles OAuth provider errors on GET /api/google/callback', async () => {
    const { callbackRoute } = await setup();

    const request = new NextRequest(
      'http://localhost:3000/api/google/callback?error=access_denied'
    );

    const response = await callbackRoute.GET(request);

    expect(response.status).toBe(302);
    const location = String(response.headers.get('location') ?? '');
    expect(location).toContain('error=oauth_error');
  });

  it('redirects to account selection when callback succeeds', async () => {
    const { callbackRoute, flowManagerMock } = await setup();

    flowManagerMock.processOAuthCallback.mockResolvedValue({
      success: true,
      connectionId: VALID_CONNECTION_ID,
      clientId: VALID_CLIENT_ID,
    });

    const request = new NextRequest(
      `http://localhost:3000/api/google/callback?code=auth-code-123&state=oauth-state-123`
    );

    const response = await callbackRoute.GET(request);

    expect(response.status).toBe(302);
    const location = String(response.headers.get('location') ?? '');
    expect(location).toContain('/google/select-accounts');
    expect(location).toContain(`connectionId=${VALID_CONNECTION_ID}`);
    expect(location).toContain(`clientId=${VALID_CLIENT_ID}`);
  });

  it('redirects with callback error code when flow manager fails', async () => {
    const { callbackRoute, flowManagerMock } = await setup();

    flowManagerMock.processOAuthCallback.mockResolvedValue({
      success: false,
      error: 'State OAuth inválido ou expirado',
      errorCode: 'INVALID_STATE',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/google/callback?code=auth-code-123&state=bad-state`
    );

    const response = await callbackRoute.GET(request);

    expect(response.status).toBe(302);
    const location = String(response.headers.get('location') ?? '');
    expect(location).toContain('error=INVALID_STATE');
  });

  it('lists Google Ads accounts on GET /api/google/accounts', async () => {
    const { accountsRoute, flowManagerMock } = await setup();

    flowManagerMock.listAvailableAccounts.mockResolvedValue([
      {
        customerId: '1234567890',
        descriptiveName: 'Account One',
        currencyCode: 'USD',
        timeZone: 'America/New_York',
        canManageClients: false,
      },
      {
        customerId: '0987654321',
        descriptiveName: 'Account Two',
        currencyCode: 'BRL',
        timeZone: 'America/Sao_Paulo',
        canManageClients: true,
      },
    ]);

    const request = new NextRequest(
      `http://localhost:3000/api/google/accounts?connectionId=${VALID_CONNECTION_ID}&clientId=${VALID_CLIENT_ID}`
    );

    const response = await accountsRoute.GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.accounts).toHaveLength(2);
    expect(flowManagerMock.listAvailableAccounts).toHaveBeenCalledWith(
      VALID_CONNECTION_ID,
      VALID_CLIENT_ID
    );
  });

  it('returns 400 on GET /api/google/accounts when params are missing', async () => {
    const { accountsRoute, flowManagerMock } = await setup();

    const request = new NextRequest('http://localhost:3000/api/google/accounts?clientId=' + VALID_CLIENT_ID);

    const response = await accountsRoute.GET(request);

    expect(response.status).toBe(400);
    expect(flowManagerMock.listAvailableAccounts).not.toHaveBeenCalled();
  });

  it('saves selected accounts on POST /api/google/accounts/select', async () => {
    const { selectRoute, flowManagerMock } = await setup();

    flowManagerMock.saveSelectedAccounts.mockResolvedValue({
      success: true,
      connectionIds: [VALID_CONNECTION_ID, '123e4567-e89b-12d3-a456-426614174002'],
      primaryCustomerId: '1234567890',
    });

    const request = new NextRequest('http://localhost:3000/api/google/accounts/select', {
      method: 'POST',
      body: JSON.stringify({
        connectionId: VALID_CONNECTION_ID,
        clientId: VALID_CLIENT_ID,
        selectedAccounts: ['1234567890', '0987654321'],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await selectRoute.POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.totalConnections).toBe(2);
    expect(flowManagerMock.saveSelectedAccounts).toHaveBeenCalledWith(
      VALID_CONNECTION_ID,
      VALID_CLIENT_ID,
      ['1234567890', '0987654321']
    );
  });

  it('returns 400 on invalid payload in POST /api/google/accounts/select', async () => {
    const { selectRoute, flowManagerMock } = await setup();

    const request = new NextRequest('http://localhost:3000/api/google/accounts/select', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'not-uuid',
        selectedAccounts: [],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await selectRoute.POST(request);

    expect(response.status).toBe(400);
    expect(flowManagerMock.saveSelectedAccounts).not.toHaveBeenCalled();
  });

  it('returns 500 when account selection fails in flow manager', async () => {
    const { selectRoute, flowManagerMock } = await setup();

    flowManagerMock.saveSelectedAccounts.mockResolvedValue({
      success: false,
      connectionIds: [],
      primaryCustomerId: '',
      error: 'Erro ao salvar contas',
    });

    const request = new NextRequest('http://localhost:3000/api/google/accounts/select', {
      method: 'POST',
      body: JSON.stringify({
        connectionId: VALID_CONNECTION_ID,
        clientId: VALID_CLIENT_ID,
        selectedAccounts: ['1234567890'],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await selectRoute.POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erro ao salvar contas');
  });
});
