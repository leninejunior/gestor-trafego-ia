import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type MockProcessorResult = {
  success: boolean;
  status: string;
  message: string;
  processingTime: number;
  context: Record<string, any>;
  retryable?: boolean;
};

const buildRequest = (
  body: string,
  headers: Record<string, string> = {}
): { text: () => Promise<string>; headers: { forEach: (cb: (value: string, key: string) => void) => void } } => ({
  text: async () => body,
  headers: {
    forEach: (cb: (value: string, key: string) => void) => {
      Object.entries(headers).forEach(([key, value]) => cb(value, key));
    },
  },
});

const loadRoute = async (result: MockProcessorResult) => {
  const processEventWithRetry = jest.fn(async () => result);

  jest.resetModules();
  jest.doMock('@/lib/webhooks/webhook-processor', () => ({
    getWebhookProcessor: () => ({ processEventWithRetry }),
  }));

  const route = await import('@/app/api/webhooks/iugu/route');
  return {
    POST: route.POST,
    processEventWithRetry,
  };
};

describe('Iugu Webhook Route Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('processes valid webhook payload and forwards normalized event to processor', async () => {
    const { POST, processEventWithRetry } = await loadRoute({
      success: true,
      status: 'processed',
      message: 'ok',
      processingTime: 10,
      context: {},
    });

    const payload = {
      event: 'invoice.status_changed',
      data: {
        id: 'invoice-123',
        subscription_id: 'sub-123',
        status: 'paid',
      },
    };

    const request = buildRequest(JSON.stringify(payload), {
      'user-agent': 'jest-test',
      'x-forwarded-for': '127.0.0.1',
    });

    const response = await POST(request as any);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.processed).toBe(true);
    expect(responseBody.status).toBe('processed');

    expect(processEventWithRetry).toHaveBeenCalledTimes(1);
    expect(processEventWithRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'invoice-123',
        type: 'invoice.status_changed',
        source: 'iugu',
        data: payload.data,
        metadata: expect.objectContaining({
          original_event: 'invoice.status_changed',
          user_agent: 'jest-test',
          ip_address: '127.0.0.1',
        }),
      })
    );
  });

  it('returns 200 when processor fails with non-retryable error', async () => {
    const { POST } = await loadRoute({
      success: false,
      status: 'validation_failed',
      message: 'invalid payload',
      processingTime: 5,
      context: {},
      retryable: false,
    });

    const request = buildRequest(
      JSON.stringify({
        event: 'invoice.status_changed',
        data: { id: 'invoice-200' },
      })
    );

    const response = await POST(request as any);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.processed).toBe(false);
    expect(responseBody.retryable).toBe(false);
    expect(responseBody.error).toBe('invalid payload');
  });

  it('returns 500 when processor fails with retryable error', async () => {
    const { POST } = await loadRoute({
      success: false,
      status: 'retryable_error',
      message: 'temporary database issue',
      processingTime: 20,
      context: {},
      retryable: true,
    });

    const request = buildRequest(
      JSON.stringify({
        event: 'invoice.status_changed',
        data: { id: 'invoice-500' },
      })
    );

    const response = await POST(request as any);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody.processed).toBe(false);
    expect(responseBody.retryable).toBe(true);
    expect(responseBody.error).toBe('temporary database issue');
  });

  it('generates a fallback event id when payload does not provide data.id', async () => {
    const { POST, processEventWithRetry } = await loadRoute({
      success: true,
      status: 'processed',
      message: 'ok',
      processingTime: 4,
      context: {},
    });

    const request = buildRequest(
      JSON.stringify({
        event: 'subscription.activated',
        data: { subscription_id: 'sub-without-id' },
      })
    );

    const response = await POST(request as any);
    expect(response.status).toBe(200);

    const eventArg = processEventWithRetry.mock.calls[0][0];
    expect(eventArg.id).toMatch(/^iugu_\d+_/);
  });

  it('returns 500 when body is not valid JSON', async () => {
    const { POST, processEventWithRetry } = await loadRoute({
      success: true,
      status: 'processed',
      message: 'ok',
      processingTime: 1,
      context: {},
    });

    const request = buildRequest('{invalid_json');

    const response = await POST(request as any);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody.processed).toBe(false);
    expect(responseBody.error).toBe('Internal server error');
    expect(processEventWithRetry).not.toHaveBeenCalled();
  });
});
