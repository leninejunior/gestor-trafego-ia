/**
 * Simple Webhook Processing Tests
 * 
 * Basic tests for webhook processing functionality covering all event types,
 * retry scenarios, and account creation automation.
 * 
 * Requirements: 2.1, 2.2, 4.1
 */

import { WebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { WebhookEvent } from '@/lib/types/webhook';

// Mock all dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          gte: jest.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      })),
      delete: jest.fn(() => ({
        lt: jest.fn(() => ({
          select: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    })),
    auth: {
      admin: {
        createUser: jest.fn(() => Promise.resolve({
          data: { user: { id: 'test-user-id' } },
          error: null
        })),
        listUsers: jest.fn(() => Promise.resolve({
          data: { users: [] },
          error: null
        }))
      }
    }
  }))
}));

jest.mock('@/lib/services/subscription-intent-service', () => ({
  SubscriptionIntentService: jest.fn(() => ({
    executeStateTransition: jest.fn(() => Promise.resolve()),
    updateIntent: jest.fn(() => Promise.resolve())
  }))
}));

jest.mock('@/lib/webhooks/account-creation-service', () => ({
  AccountCreationService: jest.fn(() => ({
    createAccountFromIntent: jest.fn(() => Promise.resolve({
      success: true,
      user_id: 'user-123',
      organization_id: 'org-123',
      membership_id: 'membership-123',
      welcome_email_sent: true,
      existing_user: false
    }))
  }))
}));

jest.mock('@/lib/services/email-notification-service', () => ({
  EmailNotificationService: jest.fn(() => ({
    sendEmail: jest.fn(() => Promise.resolve(true))
  }))
}));

describe('Simple Webhook Processing Tests', () => {
  let processor: WebhookProcessor;

  beforeEach(() => {
    processor = new WebhookProcessor(
      'http://localhost:54321',
      'test-key',
      {
        validation: {
          validateSignature: false,
          signatureHeader: 'x-test-signature',
          signatureSecret: 'test-secret',
          allowedSources: ['iugu', 'other'],
          maxPayloadSize: 1024 * 1024,
        },
        processing: {
          timeout: 5000,
          maxConcurrency: 5,
          enableDeduplication: false,
          deduplicationWindow: 60,
        },
        retry: {
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          jitter: false
        }
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Type Processing', () => {
    test('should process customer.created event', async () => {
      const event: WebhookEvent = {
        id: 'customer-created-test',
        type: 'customer.created',
        data: {
          id: 'customer-123',
          email: 'customer@example.com',
          name: 'Customer Name'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processed');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    test('should handle validation errors', async () => {
      const event: WebhookEvent = {
        id: '',
        type: 'customer.created',
        data: {},
        created_at: 'invalid-date',
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.status).toBe('validation_failed');
      expect(result.retryable).toBe(false);
    });

    test('should process all supported event types', async () => {
      const eventTypes: Array<{ type: any; data: any }> = [
        {
          type: 'customer.created',
          data: { id: 'customer-123' }
        },
        {
          type: 'subscription.activated',
          data: { id: 'sub-123' }
        },
        {
          type: 'subscription.suspended',
          data: { id: 'sub-123' }
        },
        {
          type: 'subscription.expired',
          data: { id: 'sub-123' }
        },
        {
          type: 'subscription.canceled',
          data: { id: 'sub-123' }
        }
      ];

      for (const eventType of eventTypes) {
        const event: WebhookEvent = {
          id: `test-${eventType.type}`,
          type: eventType.type,
          data: eventType.data,
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Retry Logic', () => {
    test('should handle retryable errors', async () => {
      let attemptCount = 0;
      const originalProcessEvent = processor.processEvent.bind(processor);
      
      processor.processEvent = jest.fn().mockImplementation(async (event) => {
        attemptCount++;
        if (attemptCount === 1) {
          return {
            success: false,
            status: 'retryable_error',
            message: 'Temporary failure',
            processingTime: 100,
            context: {
              eventId: event.id,
              eventType: event.type,
              processingId: 'test',
              startTime: Date.now(),
              attempt: 1,
              metadata: {}
            },
            retryable: true
          };
        }
        return {
          success: true,
          status: 'processed',
          message: 'Success after retry',
          processingTime: 100,
          context: {
            eventId: event.id,
            eventType: event.type,
            processingId: 'test',
            startTime: Date.now(),
            attempt: attemptCount,
            metadata: {}
          }
        };
      });

      const event: WebhookEvent = {
        id: 'retry-test',
        type: 'customer.created',
        data: { id: 'customer-retry' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEventWithRetry(event);

      expect(attemptCount).toBe(2);
      expect(result.success).toBe(true);
    });

    test('should not retry fatal errors', async () => {
      processor.processEvent = jest.fn().mockResolvedValue({
        success: false,
        status: 'fatal_error',
        message: 'Fatal error occurred',
        processingTime: 100,
        context: {
          eventId: 'test-fatal',
          eventType: 'customer.created',
          processingId: 'test',
          startTime: Date.now(),
          attempt: 1,
          metadata: {}
        },
        retryable: false
      });

      const event: WebhookEvent = {
        id: 'test-fatal',
        type: 'customer.created',
        data: { id: 'customer-fatal' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEventWithRetry(event);

      expect(processor.processEvent).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple events', async () => {
      const events: WebhookEvent[] = [
        {
          id: 'batch-1',
          type: 'customer.created',
          data: { id: 'customer-1' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        },
        {
          id: 'batch-2',
          type: 'customer.created',
          data: { id: 'customer-2' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        }
      ];

      const results = await processor.processBatch(events);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Metrics', () => {
    test('should track basic metrics', () => {
      processor.resetMetrics();
      const metrics = processor.getMetrics();
      
      expect(metrics.events_received).toBe(0);
      expect(metrics.events_processed).toBe(0);
      expect(metrics.events_failed).toBe(0);
      expect(metrics.events_retried).toBe(0);
    });

    test('should provide circuit breaker status', () => {
      const status = processor.getCircuitBreakerStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failures');
      expect(status).toHaveProperty('successes');
    });
  });

  describe('Dead Letter Queue', () => {
    test('should provide DLQ statistics', async () => {
      const stats = await processor.getDeadLetterQueueStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('retryable');
      expect(stats).toHaveProperty('non_retryable');
    });

    test('should process DLQ items', async () => {
      const result = await processor.processDeadLetterQueue(5);
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('skipped');
    });

    test('should cleanup old DLQ items', async () => {
      const deletedCount = await processor.cleanupDeadLetterQueue(30);
      expect(typeof deletedCount).toBe('number');
    });
  });
});