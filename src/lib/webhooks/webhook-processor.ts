/**
 * Robust Webhook Processor
 * 
 * Core webhook processing system with pattern matching, validation,
 * retry logic, and comprehensive error handling.
 * 
 * Requirements: 2.1, 4.1, 8.1
 */

import { createClient } from '@supabase/supabase-js';
import { SubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { WebhookValidator } from './webhook-validator';
import { WebhookLogger } from './webhook-logger';
import { WebhookCircuitBreaker, getCircuitBreakerManager } from './circuit-breaker';
import { WebhookRetryManager } from './retry-manager';
import { AccountCreationService } from './account-creation-service';
import {
  WebhookEvent,
  WebhookProcessingResult,
  WebhookProcessingContext,
  WebhookEventType,
  WebhookProcessingError,
  WebhookValidationError,
  WebhookRetryableError,
  WebhookFatalError,
  WebhookProcessorConfig,
  EventPattern,
  ProcessorMetrics,
  AccountCreationResult,
  AccountCreationContext,
  RetryContext,
} from '@/lib/types/webhook';

/**
 * Main webhook processor with robust error handling and retry logic
 */
export class WebhookProcessor {
  private supabase;
  private subscriptionIntentService: SubscriptionIntentService;
  private validator: WebhookValidator;
  private logger: WebhookLogger;
  private circuitBreaker: WebhookCircuitBreaker;
  private retryManager: WebhookRetryManager;
  private accountCreationService: AccountCreationService;
  private config: WebhookProcessorConfig;
  private eventPatterns: Map<WebhookEventType, EventPattern> = new Map();
  private metrics: ProcessorMetrics = {
    events_received: 0,
    events_processed: 0,
    events_failed: 0,
    events_retried: 0,
    processing_time_total: 0,
    last_reset: Date.now(),
  };

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config?: Partial<WebhookProcessorConfig>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.subscriptionIntentService = new SubscriptionIntentService(supabaseUrl, supabaseKey);
    this.validator = new WebhookValidator(config?.validation);
    this.logger = new WebhookLogger(supabaseUrl, supabaseKey, config?.logging);
    this.accountCreationService = new AccountCreationService(supabaseUrl, supabaseKey);
    
    this.config = {
      processing: {
        timeout: 30000, // 30 seconds
        maxConcurrency: 10,
        enableDeduplication: true,
        deduplicationWindow: 300, // 5 minutes
      },
      retry: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true,
      },
      validation: {
        validateSignature: true,
        signatureHeader: 'x-iugu-signature',
        signatureSecret: process.env.IUGU_WEBHOOK_SECRET || '',
        allowedSources: ['iugu', 'stripe'],
        maxPayloadSize: 1024 * 1024, // 1MB
      },
      logging: {
        logLevel: 'info',
        logPayloads: true,
        logResponses: true,
        retentionDays: 30,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 300000,
      },
      ...config,
    };

    // Initialize circuit breaker and retry manager
    this.circuitBreaker = getCircuitBreakerManager().getCircuitBreaker(
      'webhook-processor',
      this.config.circuitBreaker
    );
    this.retryManager = new WebhookRetryManager(supabaseUrl, supabaseKey, this.config.retry);

    this.initializeEventPatterns();
  }

  // =============================================
  // MAIN PROCESSING METHODS
  // =============================================

  /**
   * Process webhook event with full error handling and retry logic
   */
  async processEvent(event: WebhookEvent): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    const context = this.createProcessingContext(event);

    try {
      // Log event received
      await this.logger.logEventReceived(event, context);
      this.updateMetrics('events_received');

      // Validate event structure and signature
      const validationResult = await this.validator.validateEvent(event);
      if (!validationResult.isValid) {
        throw new WebhookValidationError(
          `Event validation failed: ${validationResult.errors.join(', ')}`,
          validationResult.errors
        );
      }

      // Check for duplicate events
      if (this.config.processing.enableDeduplication) {
        const isDuplicate = await this.checkDuplicateEvent(event);
        if (isDuplicate) {
          await this.logger.logEventDuplicate(event, context);
          return {
            success: true,
            status: 'duplicate',
            message: 'Event already processed',
            processingTime: Date.now() - startTime,
            context,
          };
        }
      }

      // Execute processing with timeout
      const result = await this.executeWithTimeout(
        () => this.executeEventProcessing(event, context),
        this.config.processing.timeout
      );

      // Log successful processing
      await this.logger.logEventProcessed(event, context, result);
      this.updateMetrics('events_processed');

      return {
        success: true,
        status: 'processed',
        message: 'Event processed successfully',
        processingTime: Date.now() - startTime,
        context,
        result,
      };

    } catch (error) {
      return await this.handleProcessingError(error as Error, event, context, startTime);
    }
  }

  /**
   * Process event with automatic retry on failure using retry manager and circuit breaker
   */
  async processEventWithRetry(event: WebhookEvent): Promise<WebhookProcessingResult> {
    const context = this.createProcessingContext(event);
    
    // Check circuit breaker before processing
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        status: 'circuit_breaker_open',
        message: 'Circuit breaker is open - processing rejected',
        processingTime: 0,
        context,
        retryable: false,
      };
    }

    const retryContext: RetryContext = {
      eventId: event.id,
      eventType: event.type,
      attempt: 1,
    };

    // Use circuit breaker to execute the retry operation
    try {
      const retryResult = await this.circuitBreaker.execute(async () => {
        return await this.retryManager.executeWithRetry(
          () => this.processEvent(event),
          retryContext
        );
      });

      if (retryResult.success) {
        return {
          success: true,
          status: 'processed',
          message: 'Event processed successfully',
          processingTime: retryResult.totalTime,
          context,
          result: retryResult.result,
        };
      } else {
        this.updateMetrics('events_failed');
        return {
          success: false,
          status: 'failed_after_retries',
          message: retryResult.error?.message || 'Processing failed after all retries',
          processingTime: retryResult.totalTime,
          context,
          error: {
            type: 'retry_exhausted',
            code: 'MAX_RETRIES_EXCEEDED',
            details: {
              attempts: retryResult.attempts,
              originalError: retryResult.error?.message,
            },
          },
          retryable: false,
        };
      }
    } catch (circuitBreakerError) {
      // Circuit breaker rejected the operation
      return {
        success: false,
        status: 'circuit_breaker_rejected',
        message: (circuitBreakerError as Error).message,
        processingTime: 0,
        context,
        retryable: false,
      };
    }
  }

  /**
   * Batch process multiple events
   */
  async processBatch(events: WebhookEvent[]): Promise<WebhookProcessingResult[]> {
    const results: WebhookProcessingResult[] = [];
    const semaphore = new Semaphore(this.config.processing.maxConcurrency);

    const promises = events.map(async (event) => {
      await semaphore.acquire();
      try {
        const result = await this.processEventWithRetry(event);
        results.push(result);
        return result;
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results;
  }

  // =============================================
  // EVENT PROCESSING LOGIC
  // =============================================

  /**
   * Execute the actual event processing based on event type
   */
  private async executeEventProcessing(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<any> {
    const pattern = this.eventPatterns.get(event.type);
    if (!pattern) {
      throw new WebhookProcessingError(
        `No processor found for event type: ${event.type}`,
        'UNKNOWN_EVENT_TYPE',
        { eventType: event.type }
      );
    }

    // Match event data against pattern
    const matchResult = this.matchEventPattern(event, pattern);
    if (!matchResult.matches) {
      throw new WebhookProcessingError(
        `Event data does not match expected pattern: ${matchResult.reason}`,
        'PATTERN_MISMATCH',
        { pattern: pattern.name, reason: matchResult.reason }
      );
    }

    // Execute the appropriate processor
    switch (event.type) {
      case 'invoice.status_changed':
        return await this.processInvoiceStatusChanged(event, context);
      
      case 'subscription.activated':
        return await this.processSubscriptionActivated(event, context);
      
      case 'subscription.suspended':
        return await this.processSubscriptionSuspended(event, context);
      
      case 'subscription.expired':
        return await this.processSubscriptionExpired(event, context);
      
      case 'subscription.canceled':
        return await this.processSubscriptionCanceled(event, context);
      
      case 'customer.created':
        return await this.processCustomerCreated(event, context);
      
      default:
        throw new WebhookProcessingError(
          `Unhandled event type: ${event.type}`,
          'UNHANDLED_EVENT_TYPE',
          { eventType: event.type }
        );
    }
  }

  /**
   * Process invoice status changed event
   */
  private async processInvoiceStatusChanged(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<any> {
    const { data } = event;
    const invoiceId = data.id;
    const status = data.status;
    const subscriptionId = data.subscription_id;

    await this.logger.logProcessingStep(
      event,
      context,
      'processing_invoice_status',
      { invoiceId, status, subscriptionId }
    );

    // Find subscription intent by Iugu subscription ID
    const { data: intents, error } = await this.supabase
      .from('subscription_intents')
      .select('*')
      .eq('iugu_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new WebhookRetryableError(
        `Database error finding subscription intent: ${error.message}`,
        'DATABASE_ERROR',
        { subscriptionId, error: error.message }
      );
    }

    if (!intents || intents.length === 0) {
      await this.logger.logProcessingStep(
        event,
        context,
        'subscription_intent_not_found',
        { subscriptionId }
      );
      
      // This might be a subscription not created through our system
      // Log but don't fail
      return { processed: false, reason: 'subscription_intent_not_found' };
    }

    const intent = intents[0];

    // Log webhook event in database
    await this.logger.logWebhookEvent(event, intent.id);

    // Process based on invoice status
    switch (status) {
      case 'paid':
        return await this.handleInvoicePaid(event, context, intent, data);
      
      case 'canceled':
      case 'expired':
        return await this.handleInvoiceFailed(event, context, intent, data);
      
      case 'pending':
        return await this.handleInvoicePending(event, context, intent, data);
      
      default:
        await this.logger.logProcessingStep(
          event,
          context,
          'unhandled_invoice_status',
          { status }
        );
        return { processed: false, reason: 'unhandled_status' };
    }
  }

  /**
   * Handle paid invoice - activate subscription and create account
   */
  private async handleInvoicePaid(
    event: WebhookEvent,
    context: WebhookProcessingContext,
    intent: any,
    invoiceData: any
  ): Promise<any> {
    try {
      // Update subscription intent to completed
      await this.subscriptionIntentService.executeStateTransition(
        intent.id,
        'completed',
        {
          reason: 'invoice_paid',
          metadata: {
            invoice_id: invoiceData.id,
            paid_at: invoiceData.paid_at || new Date().toISOString(),
            amount: invoiceData.total_cents / 100,
          },
          triggeredBy: 'webhook_processor',
        }
      );

      // Create user account and organization if not exists
      if (!intent.user_id) {
        const accountResult = await this.accountCreationService.createAccountFromIntent(
          intent,
          {
            source: 'webhook_payment',
            invoice_id: invoiceData.id,
            payment_method: invoiceData.payment_method,
          }
        );

        await this.logger.logProcessingStep(
          event,
          context,
          'account_created',
          {
            user_id: accountResult.user_id,
            organization_id: accountResult.organization_id,
            welcome_email_sent: accountResult.welcome_email_sent,
            existing_user: accountResult.existing_user,
          }
        );

        return {
          processed: true,
          action: accountResult.existing_user ? 'invoice_paid_existing_account' : 'invoice_paid_account_created',
          user_id: accountResult.user_id,
          organization_id: accountResult.organization_id,
          welcome_email_sent: accountResult.welcome_email_sent,
        };
      } else {
        return {
          processed: true,
          action: 'invoice_paid_existing_account',
          user_id: intent.user_id,
        };
      }
    } catch (error) {
      // If account creation fails, we should retry
      throw new WebhookRetryableError(
        `Failed to process paid invoice: ${(error as Error).message}`,
        'ACCOUNT_CREATION_FAILED',
        { intent_id: intent.id, error: (error as Error).message }
      );
    }
  }

  /**
   * Handle failed/expired invoice
   */
  private async handleInvoiceFailed(
    event: WebhookEvent,
    context: WebhookProcessingContext,
    intent: any,
    invoiceData: any
  ): Promise<any> {
    await this.subscriptionIntentService.executeStateTransition(
      intent.id,
      'failed',
      {
        reason: 'invoice_failed',
        metadata: {
          invoice_id: invoiceData.id,
          failure_reason: invoiceData.status,
          failed_at: new Date().toISOString(),
        },
        triggeredBy: 'webhook_processor',
      }
    );

    return {
      processed: true,
      action: 'invoice_failed',
      status: invoiceData.status,
    };
  }

  /**
   * Handle pending invoice
   */
  private async handleInvoicePending(
    event: WebhookEvent,
    context: WebhookProcessingContext,
    intent: any,
    invoiceData: any
  ): Promise<any> {
    // Update metadata but keep status as processing
    await this.subscriptionIntentService.updateIntent(
      intent.id,
      {
        metadata: {
          ...intent.metadata,
          invoice_id: invoiceData.id,
          invoice_status: 'pending',
          last_updated: new Date().toISOString(),
        },
      }
    );

    return {
      processed: true,
      action: 'invoice_pending',
    };
  }

  /**
   * Process subscription activated event
   */
  private async processSubscriptionActivated(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<any> {
    const { data } = event;
    const subscriptionId = data.id;

    // Find and update subscription intent
    const { data: intents } = await this.supabase
      .from('subscription_intents')
      .select('*')
      .eq('iugu_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (intents && intents.length > 0) {
      const intent = intents[0];
      
      await this.subscriptionIntentService.executeStateTransition(
        intent.id,
        'completed',
        {
          reason: 'subscription_activated',
          metadata: {
            activated_at: data.activated_at || new Date().toISOString(),
          },
          triggeredBy: 'webhook_processor',
        }
      );

      return { processed: true, action: 'subscription_activated' };
    }

    return { processed: false, reason: 'subscription_intent_not_found' };
  }

  /**
   * Process subscription suspended event
   */
  private async processSubscriptionSuspended(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<any> {
    const { data } = event;
    const subscriptionId = data.id;

    // Find and update subscription intent
    const { data: intents } = await this.supabase
      .from('subscription_intents')
      .select('*')
      .eq('iugu_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (intents && intents.length > 0) {
      const intent = intents[0];
      
      await this.subscriptionIntentService.executeStateTransition(
        intent.id,
        'failed',
        {
          reason: 'subscription_suspended',
          metadata: {
            suspended_at: data.suspended_at || new Date().toISOString(),
            suspension_reason: data.reason,
          },
          triggeredBy: 'webhook_processor',
        }
      );

      return { processed: true, action: 'subscription_suspended' };
    }

    return { processed: false, reason: 'subscription_intent_not_found' };
  }

  /**
   * Process subscription expired event
   */
  private async processSubscriptionExpired(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<any> {
    const { data } = event;
    const subscriptionId = data.id;

    // Find and update subscription intent
    const { data: intents } = await this.supabase
      .from('subscription_intents')
      .select('*')
      .eq('iugu_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (intents && intents.length > 0) {
      const intent = intents[0];
      
      await this.subscriptionIntentService.executeStateTransition(
        intent.id,
        'expired',
        {
          reason: 'subscription_expired',
          metadata: {
            expired_at: data.expired_at || new Date().toISOString(),
          },
          triggeredBy: 'webhook_processor',
        }
      );

      return { processed: true, action: 'subscription_expired' };
    }

    return { processed: false, reason: 'subscription_intent_not_found' };
  }

  /**
   * Process subscription canceled event
   */
  private async processSubscriptionCanceled(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<any> {
    const { data } = event;
    const subscriptionId = data.id;

    // Find and update subscription intent
    const { data: intents } = await this.supabase
      .from('subscription_intents')
      .select('*')
      .eq('iugu_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (intents && intents.length > 0) {
      const intent = intents[0];
      
      await this.subscriptionIntentService.executeStateTransition(
        intent.id,
        'expired',
        {
          reason: 'subscription_canceled',
          metadata: {
            canceled_at: data.canceled_at || new Date().toISOString(),
            cancellation_reason: data.reason,
          },
          triggeredBy: 'webhook_processor',
        }
      );

      return { processed: true, action: 'subscription_canceled' };
    }

    return { processed: false, reason: 'subscription_intent_not_found' };
  }

  /**
   * Process customer created event
   */
  private async processCustomerCreated(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<any> {
    // This is mainly for logging purposes
    // Customer creation is handled during checkout process
    await this.logger.logProcessingStep(
      event,
      context,
      'customer_created',
      { customer_id: event.data.id }
    );

    return { processed: true, action: 'customer_created_logged' };
  }

  // =============================================
  // ACCOUNT CREATION
  // =============================================
  
  // Account creation is now handled by AccountCreationService

  // =============================================
  // ERROR HANDLING
  // =============================================

  /**
   * Handle processing errors with appropriate retry logic
   */
  private async handleProcessingError(
    error: Error,
    event: WebhookEvent,
    context: WebhookProcessingContext,
    startTime: number
  ): Promise<WebhookProcessingResult> {
    const processingTime = Date.now() - startTime;

    // Log the error
    await this.logger.logEventError(event, context, error);
    this.updateMetrics('events_failed');

    // Determine error type and appropriate response
    if (error instanceof WebhookValidationError) {
      // Validation errors are not retryable
      return {
        success: false,
        status: 'validation_failed',
        message: error.message,
        error: {
          type: 'validation',
          code: error.code,
          details: error.details,
        },
        processingTime,
        context,
        retryable: false,
      };
    }

    if (error instanceof WebhookFatalError) {
      // Fatal errors are not retryable
      return {
        success: false,
        status: 'fatal_error',
        message: error.message,
        error: {
          type: 'fatal',
          code: error.code,
          details: error.details,
        },
        processingTime,
        context,
        retryable: false,
      };
    }

    if (error instanceof WebhookRetryableError) {
      // Retryable errors should be retried
      return {
        success: false,
        status: 'retryable_error',
        message: error.message,
        error: {
          type: 'retryable',
          code: error.code,
          details: error.details,
        },
        processingTime,
        context,
        retryable: true,
      };
    }

    // Unknown errors are treated as retryable by default
    return {
      success: false,
      status: 'unknown_error',
      message: error.message,
      error: {
        type: 'unknown',
        code: 'UNKNOWN_ERROR',
        details: { originalError: error.message },
      },
      processingTime,
      context,
      retryable: true,
    };
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const { baseDelay, maxDelay, backoffMultiplier, jitter } = this.config.retry;
    
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
   * Create processing context for an event
   */
  private createProcessingContext(event: WebhookEvent): WebhookProcessingContext {
    return {
      eventId: event.id,
      eventType: event.type,
      processingId: `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      attempt: 1,
      metadata: {},
    };
  }

  /**
   * Check if event is duplicate within deduplication window
   */
  private async checkDuplicateEvent(event: WebhookEvent): Promise<boolean> {
    const windowStart = new Date(Date.now() - (this.config.processing.deduplicationWindow * 1000));
    
    const { data, error } = await this.supabase
      .from('webhook_logs')
      .select('id')
      .eq('event_id', event.id)
      .eq('event_type', event.type)
      .gte('created_at', windowStart.toISOString())
      .limit(1);

    if (error) {
      // If we can't check for duplicates, assume it's not a duplicate
      // and log the error
      await this.logger.logError('duplicate_check_failed', error.message, { event_id: event.id });
      return false;
    }

    return data && data.length > 0;
  }

  /**
   * Initialize event patterns for validation
   */
  private initializeEventPatterns(): void {
    this.eventPatterns = new Map([
      ['invoice.status_changed', {
        name: 'invoice_status_changed',
        requiredFields: ['id', 'status', 'subscription_id'],
        optionalFields: ['total_cents', 'due_date', 'paid_at', 'payment_method'],
        validation: (data: any) => {
          return data.id && data.status && data.subscription_id;
        },
      }],
      ['subscription.activated', {
        name: 'subscription_activated',
        requiredFields: ['id'],
        optionalFields: ['activated_at', 'plan_id'],
        validation: (data: any) => {
          return data.id;
        },
      }],
      ['subscription.suspended', {
        name: 'subscription_suspended',
        requiredFields: ['id'],
        optionalFields: ['suspended_at', 'reason'],
        validation: (data: any) => {
          return data.id;
        },
      }],
      ['subscription.expired', {
        name: 'subscription_expired',
        requiredFields: ['id'],
        optionalFields: ['expired_at'],
        validation: (data: any) => {
          return data.id;
        },
      }],
      ['subscription.canceled', {
        name: 'subscription_canceled',
        requiredFields: ['id'],
        optionalFields: ['canceled_at', 'reason'],
        validation: (data: any) => {
          return data.id;
        },
      }],
      ['customer.created', {
        name: 'customer_created',
        requiredFields: ['id'],
        optionalFields: ['email', 'name'],
        validation: (data: any) => {
          return data.id;
        },
      }],
    ]);
  }

  /**
   * Match event against pattern
   */
  private matchEventPattern(event: WebhookEvent, pattern: EventPattern): { matches: boolean; reason?: string } {
    if (!event.data) {
      return { matches: false, reason: 'Missing event data' };
    }

    // Check required fields
    for (const field of pattern.requiredFields) {
      if (!(field in event.data) || event.data[field] === null || event.data[field] === undefined) {
        return { matches: false, reason: `Missing required field: ${field}` };
      }
    }

    // Run custom validation if provided
    if (pattern.validation && !pattern.validation(event.data)) {
      return { matches: false, reason: 'Custom validation failed' };
    }

    return { matches: true };
  }



  /**
   * Update metrics
   */
  private updateMetrics(metric: keyof ProcessorMetrics, value: number = 1): void {
    if (metric in this.metrics) {
      (this.metrics[metric] as number) += value;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProcessorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      events_received: 0,
      events_processed: 0,
      events_failed: 0,
      events_retried: 0,
      processing_time_total: 0,
      last_reset: Date.now(),
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Force open circuit breaker
   */
  forceOpenCircuitBreaker(): void {
    this.circuitBreaker.forceOpen();
  }

  /**
   * Get dead letter queue statistics
   */
  async getDeadLetterQueueStats() {
    return await this.retryManager.getDeadLetterQueueStats();
  }

  /**
   * Process dead letter queue items
   */
  async processDeadLetterQueue(batchSize: number = 10) {
    return await this.retryManager.processDeadLetterQueue(batchSize);
  }

  /**
   * Cleanup old dead letter queue items
   */
  async cleanupDeadLetterQueue(olderThanDays: number = 30) {
    return await this.retryManager.cleanupDeadLetterQueue(olderThanDays);
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift();
      if (resolve) {
        this.permits--;
        resolve();
      }
    }
  }
}

// =============================================
// FACTORY FUNCTIONS
// =============================================

/**
 * Create a new WebhookProcessor instance
 */
export function createWebhookProcessor(
  config?: Partial<WebhookProcessorConfig>
): WebhookProcessor {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return new WebhookProcessor(supabaseUrl, supabaseKey, config);
}

// =============================================
// SINGLETON INSTANCE
// =============================================

let webhookProcessorInstance: WebhookProcessor | null = null;

/**
 * Get singleton instance of WebhookProcessor
 */
export function getWebhookProcessor(): WebhookProcessor {
  if (!webhookProcessorInstance) {
    webhookProcessorInstance = createWebhookProcessor();
  }
  return webhookProcessorInstance;
}