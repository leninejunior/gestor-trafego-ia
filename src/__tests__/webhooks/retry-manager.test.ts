/**
 * Retry Manager Tests
 * 
 * Tests for webhook retry logic including exponential backoff,
 * jitter, dead letter queue management, and error handling.
 * 
 * Requirements: 4.2, 8.1, 8.4
 */

import { WebhookRetryManager, createRetryManager } from '@/lib/webhooks/retry-manager';
import { 
  WebhookRetryConfig, 
  RetryContext, 
  WebhookFatalError, 
  WebhookRetryableError 
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

describe('WebhookRetryManager', () => {
  let retryManager: WebhookRetryManager;
  let config: WebhookRetryConfig;
  let mockSupabase: any;

  beforeEach(() => {
    config = {
      maxAttempts: 3,
      baseDelay: 100, // Short delays for testing
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: false, // Disable jitter for predictable testing
    };

    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    retryManager = new WebhookRetryManager(
      'http://localhost:54321',
      'test-key',
      config
    );

    // Get the mocked supabase instance
    mockSupabase = (retryManager as any).supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Operations', () => {
    it('should execute successful operation without retries', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: RetryContext = {
        eventId: 'test-event-1',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should succeed after some failures', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('Temporary error', 'TEMP_ERROR'))
        .mockRejectedValueOnce(new WebhookRetryableError('Another temp error', 'TEMP_ERROR'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-event-2',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Retry Logic', () => {
    it('should retry retryable errors up to max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(
        new WebhookRetryableError('Retryable error', 'RETRYABLE_ERROR')
      );

      const context: RetryContext = {
        eventId: 'test-event-3',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(config.maxAttempts);
      expect(operation).toHaveBeenCalledTimes(config.maxAttempts);
      expect(result.error).toBeInstanceOf(WebhookRetryableError);
    });

    it('should not retry fatal errors', async () => {
      const operation = jest.fn().mockRejectedValue(
        new WebhookFatalError('Fatal error', 'FATAL_ERROR')
      );

      const context: RetryContext = {
        eventId: 'test-event-4',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      const result = await retryManager.executeWithRetry(operation, context);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(result.error).toBeInstanceOf(WebhookFatalError);
    });

    it('should calculate exponential backoff delays correctly', () => {
      const calculateDelay = (retryManager as any).calculateRetryDelay.bind(retryManager);

      const delay1 = calculateDelay(1);
      const delay2 = calculateDelay(2);
      const delay3 = calculateDelay(3);

      expect(delay1).toBe(100); // baseDelay * 2^0
      expect(delay2).toBe(200); // baseDelay * 2^1
      expect(delay3).toBe(400); // baseDelay * 2^2
    });

    it('should respect max delay limit', () => {
      const calculateDelay = (retryManager as any).calculateRetryDelay.bind(retryManager);

      // Test with a high attempt number that would exceed maxDelay
      const delay = calculateDelay(10);
      expect(delay).toBeLessThanOrEqual(config.maxDelay);
    });

    it('should add jitter when enabled', () => {
      const jitterConfig = { ...config, jitter: true };
      const jitterRetryManager = new WebhookRetryManager(
        'http://localhost:54321',
        'test-key',
        jitterConfig
      );

      const calculateDelay = (jitterRetryManager as any).calculateRetryDelay.bind(jitterRetryManager);

      // Calculate multiple delays for the same attempt to see jitter variation
      const delays = Array.from({ length: 10 }, () => calculateDelay(2));
      
      // With jitter, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
      
      // All delays should be within reasonable bounds (±25% of base delay)
      const baseDelay = 200; // baseDelay * 2^1
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(baseDelay * 0.75);
        expect(delay).toBeLessThanOrEqual(baseDelay * 1.25);
      });
    });
  });

  describe('Dead Letter Queue', () => {
    it('should add failed items to dead letter queue', async () => {
      const operation = jest.fn().mockRejectedValue(
        new WebhookRetryableError('Persistent error', 'PERSISTENT_ERROR')
      );

      const context: RetryContext = {
        eventId: 'test-event-5',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      await retryManager.executeWithRetry(operation, context);

      // Verify that insert was called on the dead letter queue table
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_dead_letter_queue');
    });

    it('should add fatal errors to dead letter queue immediately', async () => {
      const operation = jest.fn().mockRejectedValue(
        new WebhookFatalError('Fatal error', 'FATAL_ERROR')
      );

      const context: RetryContext = {
        eventId: 'test-event-6',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      await retryManager.executeWithRetry(operation, context);

      // Verify that insert was called on the dead letter queue table
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_dead_letter_queue');
    });

    it('should get dead letter queue statistics', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              { can_retry: true, first_failed_at: '2023-01-01T00:00:00Z' },
              { can_retry: false, first_failed_at: '2023-01-02T00:00:00Z' },
              { can_retry: true, first_failed_at: '2023-01-03T00:00:00Z' },
            ],
            error: null,
          }),
        }),
      });

      const stats = await retryManager.getDeadLetterQueueStats();

      expect(stats.total).toBe(3);
      expect(stats.retryable).toBe(2);
      expect(stats.non_retryable).toBe(1);
      expect(stats.oldest_item).toBe('2023-01-01T00:00:00Z');
    });

    it('should process dead letter queue items', async () => {
      const mockItems = [
        {
          id: 'dlq-1',
          can_retry: true,
          last_failed_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
          original_event: { id: 'event-1', type: 'invoice.status_changed' },
        },
        {
          id: 'dlq-2',
          can_retry: true,
          last_failed_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago (too recent)
          original_event: { id: 'event-2', type: 'invoice.status_changed' },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: mockItems,
                error: null,
              }),
            }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ id: 'dlq-1' }],
            error: null,
          }),
        }),
      });

      const result = await retryManager.processDeadLetterQueue(10);

      expect(result.processed).toBe(1); // Only the old enough item
      expect(result.skipped).toBe(1); // The too recent item
      expect(result.failed).toBe(0);
    });

    it('should cleanup old dead letter queue items', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'old-1' }, { id: 'old-2' }],
              error: null,
            }),
          }),
        }),
      });

      const deletedCount = await retryManager.cleanupDeadLetterQueue(30);

      expect(deletedCount).toBe(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_dead_letter_queue');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const operation = jest.fn().mockRejectedValue(
        new WebhookRetryableError('Test error', 'TEST_ERROR')
      );

      const context: RetryContext = {
        eventId: 'test-event-7',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      // Should not throw even if logging fails
      const result = await retryManager.executeWithRetry(operation, context);
      expect(result.success).toBe(false);
    });

    it('should log retry attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new WebhookRetryableError('First failure', 'TEMP_ERROR'))
        .mockResolvedValue('success');

      const context: RetryContext = {
        eventId: 'test-event-8',
        eventType: 'invoice.status_changed',
        attempt: 1,
      };

      await retryManager.executeWithRetry(operation, context);

      // Verify that retry attempt was logged
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_logs');
    });
  });

  describe('Factory Functions', () => {
    it('should create retry manager with default config', () => {
      const manager = createRetryManager();
      expect(manager).toBeInstanceOf(WebhookRetryManager);
    });

    it('should create retry manager with custom config', () => {
      const customConfig = { maxAttempts: 10 };
      const manager = createRetryManager(customConfig);
      expect(manager).toBeInstanceOf(WebhookRetryManager);
    });

    it('should throw error if Supabase config is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => createRetryManager()).toThrow('Missing Supabase configuration');
    });
  });
});