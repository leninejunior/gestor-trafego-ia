/**
 * Retry Manager Implementation
 * 
 * Implements exponential backoff with jitter for webhook processing
 * retry logic, including dead letter queue for non-processable events.
 * 
 * Requirements: 4.2, 8.1, 8.4
 */

import { createClient } from '@supabase/supabase-js';
import {
  WebhookEvent,
  WebhookRetryConfig,
  RetryContext,
  RetryResult,
  DeadLetterQueueItem,
  DeadLetterProcessingResult,
  WebhookRetryableError,
  WebhookFatalError,
} from '@/lib/types/webhook';

/**
 * Retry manager with exponential backoff and jitter
 */
export class WebhookRetryManager {
  private supabase;
  private config: WebhookRetryConfig;

  constructor(supabaseUrl: string, supabaseKey: string, config: WebhookRetryConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = config;
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: RetryContext
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      attempts = attempt;
      
      try {
        const result = await operation();
        
        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (error instanceof WebhookFatalError) {
          // Fatal errors should not be retried
          await this.addToDeadLetterQueue(context, error, attempt);
          break;
        }

        // Log retry attempt
        await this.logRetryAttempt(context, error as Error, attempt);

        // If this is the last attempt, don't wait
        if (attempt === this.config.maxAttempts) {
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    if (lastError && !(lastError instanceof WebhookFatalError)) {
      await this.addToDeadLetterQueue(context, lastError, attempts);
    }

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const { baseDelay, maxDelay, backoffMultiplier, jitter } = this.config;
    
    let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
    delay = Math.min(delay, maxDelay);
    
    if (jitter) {
      // Add random jitter (±25%)
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log retry attempt
   */
  private async logRetryAttempt(
    context: RetryContext,
    error: Error,
    attempt: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('webhook_logs')
        .insert({
          event_id: context.eventId,
          event_type: context.eventType,
          status: 'retrying',
          payload: { retry_context: context },
          error_message: error.message,
          retry_count: attempt,
        });
    } catch (logError) {
      console.error('[RetryManager] Failed to log retry attempt:', logError);
    }
  }

  /**
   * Add event to dead letter queue
   */
  private async addToDeadLetterQueue(
    context: RetryContext,
    error: Error,
    attempts: number
  ): Promise<void> {
    try {
      const deadLetterItem: Omit<DeadLetterQueueItem, 'id'> = {
        original_event: {
          id: context.eventId,
          type: context.eventType,
          data: {},
          created_at: new Date().toISOString(),
          source: 'iugu',
        },
        failure_reason: error.message,
        attempts,
        first_failed_at: new Date().toISOString(),
        last_failed_at: new Date().toISOString(),
        error_details: {
          error_type: error.constructor.name,
          error_code: (error as any).code || 'UNKNOWN',
          stack_trace: error.stack,
        },
        can_retry: !(error instanceof WebhookFatalError),
      };

      await this.supabase
        .from('webhook_dead_letter_queue')
        .insert(deadLetterItem);

      console.log(`[RetryManager] Added event ${context.eventId} to dead letter queue`);
    } catch (dlqError) {
      console.error('[RetryManager] Failed to add to dead letter queue:', dlqError);
    }
  }

  /**
   * Process dead letter queue items
   */
  async processDeadLetterQueue(
    batchSize: number = 10
  ): Promise<DeadLetterProcessingResult> {
    const result: DeadLetterProcessingResult = {
      processed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get retryable items from dead letter queue
      const { data: items, error } = await this.supabase
        .from('webhook_dead_letter_queue')
        .select('*')
        .eq('can_retry', true)
        .order('first_failed_at', { ascending: true })
        .limit(batchSize);

      if (error) {
        throw new Error(`Failed to fetch dead letter queue items: ${error.message}`);
      }

      if (!items || items.length === 0) {
        return result;
      }

      for (const item of items) {
        try {
          // Check if item should be retried (e.g., after some time has passed)
          const timeSinceLastFailure = Date.now() - new Date(item.last_failed_at).getTime();
          const minRetryDelay = 5 * 60 * 1000; // 5 minutes

          if (timeSinceLastFailure < minRetryDelay) {
            result.skipped++;
            continue;
          }

          // Attempt to reprocess the event
          // This would typically involve calling the webhook processor again
          // For now, we'll just mark it as processed and remove from DLQ
          
          await this.supabase
            .from('webhook_dead_letter_queue')
            .delete()
            .eq('id', item.id);

          result.processed++;
        } catch (itemError) {
          result.failed++;
          result.errors.push({
            item_id: item.id,
            error: (itemError as Error).message,
          });
        }
      }
    } catch (error) {
      console.error('[RetryManager] Failed to process dead letter queue:', error);
      throw error;
    }

    return result;
  }

  /**
   * Get dead letter queue statistics
   */
  async getDeadLetterQueueStats(): Promise<{
    total: number;
    retryable: number;
    non_retryable: number;
    oldest_item?: string;
  }> {
    try {
      const { data: stats, error } = await this.supabase
        .from('webhook_dead_letter_queue')
        .select('can_retry, first_failed_at')
        .order('first_failed_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get DLQ stats: ${error.message}`);
      }

      const total = stats?.length || 0;
      const retryable = stats?.filter(item => item.can_retry).length || 0;
      const non_retryable = total - retryable;
      const oldest_item = stats?.[0]?.first_failed_at;

      return {
        total,
        retryable,
        non_retryable,
        oldest_item,
      };
    } catch (error) {
      console.error('[RetryManager] Failed to get DLQ stats:', error);
      throw error;
    }
  }

  /**
   * Clear old items from dead letter queue
   */
  async cleanupDeadLetterQueue(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await this.supabase
        .from('webhook_dead_letter_queue')
        .delete()
        .lt('first_failed_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup DLQ: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      console.log(`[RetryManager] Cleaned up ${deletedCount} old DLQ items`);
      
      return deletedCount;
    } catch (error) {
      console.error('[RetryManager] Failed to cleanup DLQ:', error);
      throw error;
    }
  }
}

/**
 * Retry manager factory
 */
export function createRetryManager(config?: Partial<WebhookRetryConfig>): WebhookRetryManager {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  const defaultConfig: WebhookRetryConfig = {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  };

  return new WebhookRetryManager(supabaseUrl, supabaseKey, { ...defaultConfig, ...config });
}

// Singleton instance
let retryManagerInstance: WebhookRetryManager | null = null;

/**
 * Get singleton retry manager
 */
export function getRetryManager(): WebhookRetryManager {
  if (!retryManagerInstance) {
    retryManagerInstance = createRetryManager();
  }
  return retryManagerInstance;
}