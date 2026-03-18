/**
 * Webhook Processor Integration Tests
 * 
 * Tests for the integrated webhook processor with retry logic and circuit breaker.
 * 
 * Requirements: 4.2, 8.1, 8.4
 */

import { WebhookProcessor, createWebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { WebhookEvent, WebhookRetryableError, WebhookFatalError } from '@/lib/types/webhook';

// Mock all dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
        gte: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    },
  })),
}));

jest.mock('@/lib/services/subscription-intent-service', () => ({
  SubscriptionIntentService: jest.fn().mockImplementation(() => ({
    executeStateTransition: jest.fn().mockResolvedValue({}),
    updateIntent: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('@/lib/webhooks/webhook-validator', () => ({
  WebhookValidator: jest.fn().mockImplementation(() => ({
    validateEvent: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
  })),
}));

jest.mock('@/lib/webhooks/webhook-logger', () => ({
  WebhookLogger: jest.fn().mockImplementation(() => ({
    logEventReceived: jest.fn().mockResolvedValue({}),
    logEventProcessed: jest.fn().mockResolvedValue({}),
    logEventError: jest.fn().mockResolvedValue({}),
    logEventDuplicate: jest.fn().mockResolvedValue({}),
    logRetryAttempt: jest.fn().mockResolvedValue({}),
    logProcessingStep: jest.fn().mockResolvedValue({}),
    logWebhookEvent: jest.fn().mockResolvedValue({}),
  })),
}));

describe('WebhookProcessor Integration', () => {
  let processor: WebhookProcessor;
  let mockEvent: WebhookEvent;

  beforeEach(() => {
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.IUGU_WEBHOOK_SECRET = 'test-secret';

    processor = createWebhookProcessor({
      retry: {
        maxAttempts: 3,
        baseDelay: 10, // Very short for testing
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      },
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 100, // Very short for testing
        monitoringWindow: 1000,
      },
    });

    mockEvent = {
      id: 'test-event-1',
      type: 'invoice.status_changed',
      data: {
        id: 'invoice-123',
        status: 'paid',
        subscription_id: 'sub-123',
        total_cents: 2900,
        paid_at: '2023-01-01T00:00:00Z',
      },
      created_at: '2023-01-01T00:00:00Z',
      source: 'iugu',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Processing', () => {
    it('should process event successfully without retries', async () => {
      const result = await processor.processEventWithRetry(mockEvent);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processed');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should track metrics for successful processing', async () => {
      await processor.processEventWithRetry(mockEvent);

      const metrics = processor.getMetrics();
      expect(metrics.events_received).toBe(1);
      expect(metrics.events_processed).toBe(1);
      expect(metrics.events_failed).toBe(0);
    });
  });

  describe('Retry Logic Integration', () => {
    it('should retry on retryable errors and eventually succeed', async () => {
      // Mock the processor to fail twice then succeed
      let callCount = 0;
      const originalProcessEvent = processor.processEvent.bind(processor);
      processor.processEvent = jest.fn().mockImplementation(async (event) => {
        callCount++;
        if (callCount <= 2) {
          throw new WebhookRetryableError('Temporary failure', 'TEMP_ERROR');
        }
        return originalProcessEvent(event);
      });

      const result = await processor.processEventWithRetry(mockEvent);

      expect(result.success).toBe(true);
      expect(processor.processEvent).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries on persistent retryable errors', async () => {
      // Mock the processor to always fail with retryable error
      processor.processEvent = jest.fn().mockRejectedValue(
        new WebhookRetryableError('Persistent failure', 'PERSISTENT_ERROR')
      );

      const result = await processor.processEventWithRetry(mockEvent);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed_after_retries');
      expect(processor.processEvent).toHaveBeenCalledTimes(3); // maxAttempts
    });

    it('should not retry fatal errors', async () => {
      processor.processEvent = jest.fn().mockRejectedValue(
        new WebhookFatalError('Fatal error', 'FATAL_ERROR')
      );

      const result = await processor.processEventWithRetry(mockEvent);

      expect(result.success).toBe(false);
      expect(processor.processEvent).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker after failure threshold', async () => {
      processor.processEvent = jest.fn().mockRejectedValue(
        new Error('Consistent failure')
      );

      // Process events to reach failure threshold
      await processor.processEventWithRetry(mockEvent);
      await processor.processEventWithRetry(mockEvent);

      // Circuit breaker should now be open
      const cbStatus = processor.getCircuitBreakerStatus();
      expect(cbStatus.state).toBe('open');
    });

    it('should reject requests when circuit breaker is open', async () => {
      processor.processEvent = jest.fn().mockRejectedValue(
        new Error('Consistent failure')
      );

      // Open the circuit breaker
      await processor.processEventWithRetry(mockEvent);
      await processor.processEventWithRetry(mockEvent);

      // Next request should be rejected immediately
      const result = await processor.processEventWithRetry(mockEvent);

      expect(result.success).toBe(false);
      expect(result.status).toBe('circuit_breaker_open');
    });

    it('should recover after circuit breaker reset timeout', async () => {
      processor.processEvent = jest.fn().mockRejectedValue(
        new Error('Consistent failure')
      );

      // Open the circuit breaker
      await processor.processEventWithRetry(mockEvent);
      await processor.processEventWithRetry(mockEvent);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Mock successful processing
      processor.processEvent = jest.fn().mockResolvedValue({
        processed: true,
        action: 'test_success',
      });

      const result = await processor.processEventWithRetry(mockEvent);

      expect(result.success).toBe(true);
      expect(processor.getCircuitBreakerStatus().state).toBe('closed');
    });
  });

  describe('Monitoring and Management', () => {
    it('should provide comprehensive monitoring data', async () => {
      await processor.processEventWithRetry(mockEvent);

      const metrics = processor.getMetrics();
      const cbStatus = processor.getCircuitBreakerStatus();

      expect(metrics).toHaveProperty('events_received');
      expect(metrics).toHaveProperty('events_processed');
      expect(metrics).toHaveProperty('events_failed');
      expect(metrics).toHaveProperty('events_retried');

      expect(cbStatus).toHaveProperty('state');
      expect(cbStatus).toHaveProperty('failures');
      expect(cbStatus).toHaveProperty('successes');
    });

    it('should allow manual circuit breaker reset', async () => {
      processor.processEvent = jest.fn().mockRejectedValue(
        new Error('Failure')
      );

      // Open circuit breaker
      await processor.processEventWithRetry(mockEvent);
      await processor.processEventWithRetry(mockEvent);

      expect(processor.getCircuitBreakerStatus().state).toBe('open');

      // Reset manually
      processor.resetCircuitBreaker();

      expect(processor.getCircuitBreakerStatus().state).toBe('closed');
    });

    it('should allow manual metrics reset', async () => {
      await processor.processEventWithRetry(mockEvent);

      let metrics = processor.getMetrics();
      expect(metrics.events_received).toBe(1);

      processor.resetMetrics();

      metrics = processor.getMetrics();
      expect(metrics.events_received).toBe(0);
    });
  });

  describe('Dead Letter Queue Integration', () => {
    it('should provide dead letter queue statistics', async () => {
      const stats = await processor.getDeadLetterQueueStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('retryable');
      expect(stats).toHaveProperty('non_retryable');
    });

    it('should allow dead letter queue processing', async () => {
      const result = await processor.processDeadLetterQueue(5);

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
    });

    it('should allow dead letter queue cleanup', async () => {
      const deletedCount = await processor.cleanupDeadLetterQueue(30);

      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const mockSupabase = (processor as any).supabase;
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection failed' },
        }),
      });

      const result = await processor.processEventWithRetry(mockEvent);

      // Should handle the error gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle validation errors correctly', async () => {
      const invalidEvent = {
        ...mockEvent,
        data: {}, // Missing required fields
      };

      const result = await processor.processEventWithRetry(invalidEvent);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false); // Validation errors are not retryable
    });
  });
});