/**
 * Webhook Retry Scenarios Tests
 * 
 * Comprehensive tests for webhook retry logic, error handling patterns,
 * and dead letter queue management.
 * 
 * Requirements: 4.1, 4.2, 8.1
 */

import { WebhookRetryManager } from '@/lib/webhooks/retry-manager';
import { WebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { 
  WebhookEvent,
  WebhookRetryableError,
  WebhookFatalError,
  RetryContext,
  DeadLetterQueueItem
} from '@/lib/types/webhook';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
        lt: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
        order: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
  })),
}));

describe('Webhook Retry Scenarios', () => {
  let retryManager: WebhookRetryManager;
  let mockSupabase: any;

  beforeEach(() => {
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = createClient();

    retryManager = new WebhookRetryManager(
      'http://localhost:54321',
      'test-key',
      {
        maxAttempts: 5,
        baseDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: false
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Exponential Backoff Patterns', () => {
    it('should implement exponential backoff correctly', async () => {
      const delays: number[] = [];
      const originalSleep = (retryManager as any).sleep;
      (retryManager as any).sleep = jest.fn((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('Error 1', 'ERR1'))
        .mockRejectedValueOnce(new WebhookRetryableError('Error 2', 'ERR2'))
        .mockRejectedValueOnce(new WebhookRetryableError('Error 3', 'ERR3'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-backoff',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(delays).toEqual([100, 200, 400]); // 100 * 2^0, 100 * 2^1, 100 * 2^2
    });

    it('should respect maximum delay limit', async () => {
      const delays: number[] = [];
      (retryManager as any).sleep = jest.fn((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      // Create retry manager with low max delay
      const limitedRetryManager = new WebhookRetryManager(
        'http://localhost:54321',
        'test-key',
        {
          maxAttempts: 10,
          baseDelay: 1000,
          maxDelay: 2000, // Low max delay
          backoffMultiplier: 2,
          jitter: false
        }
      );

      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('Error 1', 'ERR1'))
        .mockRejectedValueOnce(new WebhookRetryableError('Error 2', 'ERR2'))
        .mockRejectedValueOnce(new WebhookRetryableError('Error 3', 'ERR3'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-max-delay',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      await limitedRetryManager.executeWithRetry(operation, context);

      // All delays should be capped at maxDelay
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(2000);
      });
    });

    it('should add jitter when enabled', async () => {
      const jitterRetryManager = new WebhookRetryManager(
        'http://localhost:54321',
        'test-key',
        {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: true
        }
      );

      const delays: number[] = [];
      (jitterRetryManager as any).sleep = jest.fn((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('Error 1', 'ERR1'))
        .mockRejectedValueOnce(new WebhookRetryableError('Error 2', 'ERR2'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-jitter',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      await jitterRetryManager.executeWithRetry(operation, context);

      // With jitter, delays should vary from base values
      expect(delays[0]).toBeGreaterThanOrEqual(750); // 1000 * 0.75
      expect(delays[0]).toBeLessThanOrEqual(1250); // 1000 * 1.25
      expect(delays[1]).toBeGreaterThanOrEqual(1500); // 2000 * 0.75
      expect(delays[1]).toBeLessThanOrEqual(2500); // 2000 * 1.25
    });
  });

  describe('Error Classification and Handling', () => {
    it('should handle different types of retryable errors', async () => {
      const errorTypes = [
        new WebhookRetryableError('Database timeout', 'DB_TIMEOUT'),
        new WebhookRetryableError('Network error', 'NETWORK_ERROR'),
        new WebhookRetryableError('Service unavailable', 'SERVICE_UNAVAILABLE'),
        new WebhookRetryableError('Rate limit exceeded', 'RATE_LIMIT')
      ];

      for (const error of errorTypes) {
        const operation = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValue('success');

        const context: RetryContext = {
          eventId: `test-${error.code}`,
          eventType: 'invoice.status_changed',
          attempt: 1
        };

        const result = await retryManager.executeWithRetry(operation, context);

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
      }
    });

    it('should not retry fatal errors', async () => {
      const fatalErrors = [
        new WebhookFatalError('Invalid signature', 'INVALID_SIGNATURE'),
        new WebhookFatalError('Malformed payload', 'MALFORMED_PAYLOAD'),
        new WebhookFatalError('Unauthorized', 'UNAUTHORIZED'),
        new WebhookFatalError('Invalid event type', 'INVALID_EVENT_TYPE')
      ];

      for (const error of fatalErrors) {
        const operation = jest.fn().mockRejectedValue(error);

        const context: RetryContext = {
          eventId: `test-fatal-${error.code}`,
          eventType: 'invoice.status_changed',
          attempt: 1
        };

        const result = await retryManager.executeWithRetry(operation, context);

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(1);
        expect(operation).toHaveBeenCalledTimes(1);
      }
    });

    it('should handle mixed error types in sequence', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('Retryable 1', 'RETRY1'))
        .mockRejectedValueOnce(new WebhookRetryableError('Retryable 2', 'RETRY2'))
        .mockRejectedValueOnce(new WebhookFatalError('Fatal error', 'FATAL'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-mixed-errors',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error).toBeInstanceOf(WebhookFatalError);
    });
  });

  describe('Dead Letter Queue Management', () => {
    it('should add failed items to dead letter queue', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      });

      const operation = jest.fn().mockRejectedValue(
        new WebhookRetryableError('Persistent failure', 'PERSISTENT_ERROR')
      );

      const context: RetryContext = {
        eventId: 'test-dlq-add',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      await retryManager.executeWithRetry(operation, context);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          original_event: expect.objectContaining({
            id: 'test-dlq-add',
            type: 'invoice.status_changed'
          }),
          failure_reason: 'Persistent failure',
          attempts: 5,
          can_retry: true
        })
      );
    });

    it('should mark fatal errors as non-retryable in DLQ', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      });

      const operation = jest.fn().mockRejectedValue(
        new WebhookFatalError('Fatal error', 'FATAL_ERROR')
      );

      const context: RetryContext = {
        eventId: 'test-dlq-fatal',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      await retryManager.executeWithRetry(operation, context);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          can_retry: false,
          failure_reason: 'Fatal error'
        })
      );
    });

    it('should process retryable items from dead letter queue', async () => {
      const oldItem = {
        id: 'dlq-old',
        can_retry: true,
        last_failed_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        original_event: { id: 'event-old', type: 'invoice.status_changed' }
      };

      const recentItem = {
        id: 'dlq-recent',
        can_retry: true,
        last_failed_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        original_event: { id: 'event-recent', type: 'invoice.status_changed' }
      };

      const mockDelete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ id: 'dlq-old' }],
          error: null
        })
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [oldItem, recentItem],
                error: null
              })
            })
          })
        }),
        delete: mockDelete
      });

      const result = await retryManager.processDeadLetterQueue(10);

      expect(result.processed).toBe(1); // Only the old item
      expect(result.skipped).toBe(1); // The recent item
      expect(result.failed).toBe(0);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should cleanup old dead letter queue items', async () => {
      const mockItems = [
        { id: 'old-1' },
        { id: 'old-2' },
        { id: 'old-3' }
      ];

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: mockItems,
              error: null
            })
          })
        })
      });

      const deletedCount = await retryManager.cleanupDeadLetterQueue(30);

      expect(deletedCount).toBe(3);
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_dead_letter_queue');
    });

    it('should get accurate dead letter queue statistics', async () => {
      const mockStats = [
        { can_retry: true, first_failed_at: '2023-01-01T00:00:00Z' },
        { can_retry: false, first_failed_at: '2023-01-02T00:00:00Z' },
        { can_retry: true, first_failed_at: '2023-01-03T00:00:00Z' },
        { can_retry: true, first_failed_at: '2023-01-04T00:00:00Z' },
        { can_retry: false, first_failed_at: '2023-01-05T00:00:00Z' }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockStats,
            error: null
          })
        })
      });

      const stats = await retryManager.getDeadLetterQueueStats();

      expect(stats.total).toBe(5);
      expect(stats.retryable).toBe(3);
      expect(stats.non_retryable).toBe(2);
      expect(stats.oldest_item).toBe('2023-01-01T00:00:00Z');
    });
  });

  describe('Concurrency and Performance', () => {
    it('should handle concurrent retry operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        jest.fn()
          .mockRejectedValueOnce(new WebhookRetryableError(`Error ${i}`, 'CONCURRENT_ERROR'))
          .mockResolvedValue(`success-${i}`)
      );

      const contexts = operations.map((_, i) => ({
        eventId: `concurrent-${i}`,
        eventType: 'invoice.status_changed' as const,
        attempt: 1
      }));

      const promises = operations.map((operation, i) =>
        retryManager.executeWithRetry(operation, contexts[i])
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.attempts === 2)).toBe(true);
    });

    it('should handle high-frequency retry scenarios', async () => {
      const startTime = Date.now();
      const operations = Array.from({ length: 100 }, () => 
        jest.fn().mockResolvedValue('success')
      );

      const contexts = operations.map((_, i) => ({
        eventId: `high-freq-${i}`,
        eventType: 'customer.created' as const,
        attempt: 1
      }));

      const promises = operations.map((operation, i) =>
        retryManager.executeWithRetry(operation, contexts[i])
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Recovery Patterns', () => {
    it('should recover from transient database errors', async () => {
      let dbCallCount = 0;
      const operation = jest.fn().mockImplementation(async () => {
        dbCallCount++;
        if (dbCallCount <= 2) {
          throw new WebhookRetryableError('Database connection lost', 'DB_CONNECTION_LOST');
        }
        return 'database-recovered';
      });

      const context: RetryContext = {
        eventId: 'test-db-recovery',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('database-recovered');
      expect(result.attempts).toBe(3);
    });

    it('should recover from API rate limiting', async () => {
      let apiCallCount = 0;
      const operation = jest.fn().mockImplementation(async () => {
        apiCallCount++;
        if (apiCallCount <= 3) {
          throw new WebhookRetryableError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
        }
        return 'api-call-successful';
      });

      const context: RetryContext = {
        eventId: 'test-rate-limit-recovery',
        eventType: 'subscription.activated',
        attempt: 1
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('api-call-successful');
      expect(result.attempts).toBe(4);
    });

    it('should handle intermittent network failures', async () => {
      let networkCallCount = 0;
      const operation = jest.fn().mockImplementation(async () => {
        networkCallCount++;
        if (networkCallCount === 1 || networkCallCount === 3) {
          throw new WebhookRetryableError('Network timeout', 'NETWORK_TIMEOUT');
        }
        return 'network-success';
      });

      const context: RetryContext = {
        eventId: 'test-network-recovery',
        eventType: 'customer.created',
        attempt: 1
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('network-success');
      expect(result.attempts).toBe(4);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log retry attempts', async () => {
      const mockLogInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'webhook_logs') {
          return { insert: mockLogInsert };
        }
        return {
          insert: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('First failure', 'FIRST_FAILURE'))
        .mockRejectedValueOnce(new WebhookRetryableError('Second failure', 'SECOND_FAILURE'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-retry-logging',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      await retryManager.executeWithRetry(operation, context);

      expect(mockLogInsert).toHaveBeenCalledTimes(2); // Two retry attempts logged
      expect(mockLogInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'test-retry-logging',
          event_type: 'invoice.status_changed',
          status: 'retrying',
          error_message: 'First failure',
          retry_count: 1
        })
      );
    });

    it('should handle logging failures gracefully', async () => {
      // Mock logging failure
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'webhook_logs') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Logging failed' }
            })
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ data: null, error: null })
        };
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('Test error', 'TEST_ERROR'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-logging-failure',
        eventType: 'invoice.status_changed',
        attempt: 1
      };

      // Should not throw even if logging fails
      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });
  });
});