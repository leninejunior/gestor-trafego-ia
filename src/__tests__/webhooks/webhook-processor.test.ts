/**
 * Webhook Processor Tests
 * 
 * Tests for the robust webhook processing system.
 */

import { WebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { WebhookEvent } from '@/lib/types/webhook';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    })),
    auth: {
      admin: {
        createUser: jest.fn(() => Promise.resolve({
          data: { user: { id: 'test-user-id' } },
          error: null
        }))
      }
    }
  }))
}));

// Mock SubscriptionIntentService
jest.mock('@/lib/services/subscription-intent-service', () => ({
  SubscriptionIntentService: jest.fn(() => ({
    executeStateTransition: jest.fn(() => Promise.resolve()),
    updateIntent: jest.fn(() => Promise.resolve())
  }))
}));

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  
  beforeEach(() => {
    processor = new WebhookProcessor(
      'http://localhost:54321',
      'test-key',
      {
        validation: {
          validateSignature: false, // Disable signature validation for tests
          signatureHeader: 'x-test-signature',
          signatureSecret: 'test-secret',
          allowedSources: ['iugu', 'other'],
          maxPayloadSize: 1024 * 1024,
        },
        processing: {
          timeout: 5000,
          maxConcurrency: 5,
          enableDeduplication: false, // Disable for tests
          deduplicationWindow: 60,
        }
      }
    );
  });

  describe('processEvent', () => {
    it('should process invoice.status_changed event successfully', async () => {
      const event: WebhookEvent = {
        id: 'test-event-1',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-123',
          status: 'paid',
          subscription_id: 'sub-123',
          total_cents: 5000,
          paid_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        source: 'other',
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processed');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle validation errors', async () => {
      const event: WebhookEvent = {
        id: '',
        type: 'invoice.status_changed',
        data: {},
        created_at: 'invalid-date',
        source: 'other',
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.status).toBe('validation_failed');
      expect(result.retryable).toBe(false);
    });

    it('should handle subscription.activated event', async () => {
      const event: WebhookEvent = {
        id: 'test-event-2',
        type: 'subscription.activated',
        data: {
          id: 'sub-123',
          activated_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        source: 'other',
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processed');
    });
  });

  describe('processEventWithRetry', () => {
    it('should retry failed events', async () => {
      const event: WebhookEvent = {
        id: 'test-event-retry',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-retry',
          status: 'paid',
          subscription_id: 'sub-retry',
        },
        created_at: new Date().toISOString(),
        source: 'other',
      };

      // Mock a retryable error on first attempt
      let attemptCount = 0;
      const originalProcessEvent = processor.processEvent.bind(processor);
      processor.processEvent = jest.fn().mockImplementation(async (e) => {
        attemptCount++;
        if (attemptCount === 1) {
          return {
            success: false,
            status: 'retryable_error',
            message: 'Temporary failure',
            processingTime: 100,
            context: { eventId: e.id, eventType: e.type, processingId: 'test', startTime: Date.now(), attempt: 1, metadata: {} },
            retryable: true,
          };
        }
        return originalProcessEvent(e);
      });

      const result = await processor.processEventWithRetry(event);

      expect(attemptCount).toBe(2);
      expect(result.success).toBe(true);
    });
  });

  describe('metrics', () => {
    it('should track metrics correctly', async () => {
      const event: WebhookEvent = {
        id: 'test-metrics',
        type: 'customer.created',
        data: { id: 'customer-123' },
        created_at: new Date().toISOString(),
        source: 'other',
      };

      await processor.processEvent(event);

      const metrics = processor.getMetrics();
      expect(metrics.events_received).toBe(1);
      expect(metrics.events_processed).toBe(1);
      expect(metrics.events_failed).toBe(0);
    });

    it('should reset metrics', () => {
      processor.resetMetrics();
      const metrics = processor.getMetrics();
      
      expect(metrics.events_received).toBe(0);
      expect(metrics.events_processed).toBe(0);
      expect(metrics.events_failed).toBe(0);
      expect(metrics.events_retried).toBe(0);
    });
  });
});