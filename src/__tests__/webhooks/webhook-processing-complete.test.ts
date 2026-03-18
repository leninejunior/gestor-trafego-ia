/**
 * Complete Webhook Processing Tests
 * 
 * Comprehensive test suite covering all webhook event types, retry scenarios,
 * error handling patterns, and account creation automation.
 * 
 * Requirements: 2.1, 2.2, 4.1
 */

import { WebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { AccountCreationService } from '@/lib/webhooks/account-creation-service';
import { SubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { 
  WebhookEvent,
  WebhookRetryableError,
  WebhookFatalError,
  WebhookValidationError,
  WebhookProcessingResult
} from '@/lib/types/webhook';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@/lib/services/subscription-intent-service');
jest.mock('@/lib/webhooks/account-creation-service');
jest.mock('@/lib/services/email-notification-service');

describe('Complete Webhook Processing', () => {
  let processor: WebhookProcessor;
  let mockSupabase: any;
  let mockSubscriptionIntentService: jest.Mocked<SubscriptionIntentService>;
  let mockAccountCreationService: jest.Mocked<AccountCreationService>;

  beforeEach(() => {
    // Setup Supabase mock
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: null, error: null })
              }))
            })),
            gte: jest.fn().mockResolvedValue({ data: [], error: null })
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null })
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null })
        }))
      })),
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null
          }),
          listUsers: jest.fn().mockResolvedValue({
            data: { users: [] },
            error: null
          })
        }
      }
    };
    createClient.mockReturnValue(mockSupabase);

    // Setup service mocks
    const { SubscriptionIntentService } = require('@/lib/services/subscription-intent-service');
    mockSubscriptionIntentService = {
      executeStateTransition: jest.fn().mockResolvedValue(undefined),
      updateIntent: jest.fn().mockResolvedValue(undefined),
      createIntent: jest.fn().mockResolvedValue({ id: 'intent-123' }),
      getIntent: jest.fn().mockResolvedValue(null)
    } as any;
    SubscriptionIntentService.mockImplementation(() => mockSubscriptionIntentService);

    const { AccountCreationService } = require('@/lib/webhooks/account-creation-service');
    mockAccountCreationService = {
      createAccountFromIntent: jest.fn().mockResolvedValue({
        success: true,
        user_id: 'user-123',
        organization_id: 'org-123',
        membership_id: 'membership-123',
        welcome_email_sent: true,
        existing_user: false
      })
    } as any;
    AccountCreationService.mockImplementation(() => mockAccountCreationService);

    // Create processor instance
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

  describe('All Event Types Processing', () => {
    it('should process invoice.status_changed with paid status', async () => {
      // Mock subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-123',
                  user_email: 'test@example.com',
                  user_name: 'Test User',
                  organization_name: 'Test Org',
                  user_id: null
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'invoice-paid-event',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-123',
          status: 'paid',
          subscription_id: 'sub-123',
          total_cents: 5000,
          paid_at: new Date().toISOString(),
          payment_method: 'credit_card'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.status).toBe('processed');
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-123',
        'completed',
        expect.objectContaining({
          reason: 'invoice_paid',
          triggeredBy: 'webhook_processor'
        })
      );
      expect(mockAccountCreationService.createAccountFromIntent).toHaveBeenCalled();
    });

    it('should process invoice.status_changed with failed status', async () => {
      // Mock subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-failed',
                  user_email: 'failed@example.com',
                  user_id: 'user-123'
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'invoice-failed-event',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-failed',
          status: 'canceled',
          subscription_id: 'sub-failed'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-failed',
        'failed',
        expect.objectContaining({
          reason: 'invoice_failed',
          triggeredBy: 'webhook_processor'
        })
      );
    });

    it('should process subscription.activated event', async () => {
      // Mock subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-activated',
                  user_id: 'user-123'
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'subscription-activated-event',
        type: 'subscription.activated',
        data: {
          id: 'sub-activated',
          activated_at: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-activated',
        'completed',
        expect.objectContaining({
          reason: 'subscription_activated',
          triggeredBy: 'webhook_processor'
        })
      );
    });

    it('should process subscription.suspended event', async () => {
      // Mock subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-suspended',
                  user_id: 'user-123'
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'subscription-suspended-event',
        type: 'subscription.suspended',
        data: {
          id: 'sub-suspended',
          suspended_at: new Date().toISOString(),
          reason: 'payment_failed'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-suspended',
        'failed',
        expect.objectContaining({
          reason: 'subscription_suspended',
          triggeredBy: 'webhook_processor'
        })
      );
    });

    it('should process subscription.expired event', async () => {
      // Mock subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-expired',
                  user_id: 'user-123'
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'subscription-expired-event',
        type: 'subscription.expired',
        data: {
          id: 'sub-expired',
          expired_at: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-expired',
        'expired',
        expect.objectContaining({
          reason: 'subscription_expired',
          triggeredBy: 'webhook_processor'
        })
      );
    });

    it('should process subscription.canceled event', async () => {
      // Mock subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-canceled',
                  user_id: 'user-123'
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'subscription-canceled-event',
        type: 'subscription.canceled',
        data: {
          id: 'sub-canceled',
          canceled_at: new Date().toISOString(),
          reason: 'user_request'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(mockSubscriptionIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-canceled',
        'expired',
        expect.objectContaining({
          reason: 'subscription_canceled',
          triggeredBy: 'webhook_processor'
        })
      );
    });

    it('should process customer.created event', async () => {
      const event: WebhookEvent = {
        id: 'customer-created-event',
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
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should handle validation errors as non-retryable', async () => {
      const event: WebhookEvent = {
        id: '',
        type: 'invoice.status_changed',
        data: {},
        created_at: 'invalid-date',
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.status).toBe('validation_failed');
      expect(result.retryable).toBe(false);
    });

    it('should handle missing required fields as validation error', async () => {
      const event: WebhookEvent = {
        id: 'test-missing-fields',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-123'
          // Missing status and subscription_id
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.status).toBe('validation_failed');
      expect(result.retryable).toBe(false);
    });

    it('should handle database errors as retryable', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' }
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'test-db-error',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-123',
          status: 'paid',
          subscription_id: 'sub-123'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should retry failed operations with exponential backoff', async () => {
      let attemptCount = 0;
      const originalProcessEvent = processor.processEvent.bind(processor);
      
      processor.processEvent = jest.fn().mockImplementation(async (event) => {
        attemptCount++;
        if (attemptCount <= 2) {
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
              attempt: attemptCount,
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
        id: 'test-retry',
        type: 'customer.created',
        data: { id: 'customer-retry' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEventWithRetry(event);

      expect(attemptCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should stop retrying after max attempts', async () => {
      let attemptCount = 0;
      processor.processEvent = jest.fn().mockImplementation(async (event) => {
        attemptCount++;
        return {
          success: false,
          status: 'retryable_error',
          message: 'Persistent failure',
          processingTime: 100,
          context: {
            eventId: event.id,
            eventType: event.type,
            processingId: 'test',
            startTime: Date.now(),
            attempt: attemptCount,
            metadata: {}
          },
          retryable: true
        };
      });

      const event: WebhookEvent = {
        id: 'test-max-retry',
        type: 'customer.created',
        data: { id: 'customer-max-retry' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEventWithRetry(event);

      expect(attemptCount).toBe(3); // maxAttempts from config
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed_after_retries');
    });

    it('should not retry fatal errors', async () => {
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

  describe('Account Creation Automation', () => {
    it('should create account automatically for paid invoice without existing user', async () => {
      // Mock subscription intent without user_id
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-new-user',
                  user_email: 'newuser@example.com',
                  user_name: 'New User',
                  organization_name: 'New Organization',
                  user_id: null // No existing user
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'invoice-paid-new-user',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-new-user',
          status: 'paid',
          subscription_id: 'sub-new-user',
          total_cents: 5000,
          paid_at: new Date().toISOString(),
          payment_method: 'credit_card'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(mockAccountCreationService.createAccountFromIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'intent-new-user',
          user_email: 'newuser@example.com',
          user_name: 'New User',
          organization_name: 'New Organization'
        }),
        expect.objectContaining({
          source: 'webhook_payment',
          invoice_id: 'invoice-new-user',
          payment_method: 'credit_card'
        })
      );
    });

    it('should skip account creation for existing user', async () => {
      // Mock subscription intent with existing user_id
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-existing-user',
                  user_email: 'existing@example.com',
                  user_id: 'existing-user-123' // Existing user
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'invoice-paid-existing-user',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-existing-user',
          status: 'paid',
          subscription_id: 'sub-existing-user'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(mockAccountCreationService.createAccountFromIntent).not.toHaveBeenCalled();
    });

    it('should handle account creation failures gracefully', async () => {
      // Mock subscription intent without user_id
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-creation-fail',
                  user_email: 'fail@example.com',
                  user_name: 'Fail User',
                  organization_name: 'Fail Organization',
                  user_id: null
                }],
                error: null
              })
            })
          })
        })
      });

      // Mock account creation failure
      mockAccountCreationService.createAccountFromIntent.mockRejectedValue(
        new Error('Account creation failed')
      );

      const event: WebhookEvent = {
        id: 'invoice-paid-creation-fail',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-creation-fail',
          status: 'paid',
          subscription_id: 'sub-creation-fail'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(mockAccountCreationService.createAccountFromIntent).toHaveBeenCalled();
    });
  });

  describe('Event Pattern Matching', () => {
    it('should reject events with invalid patterns', async () => {
      const event: WebhookEvent = {
        id: 'test-invalid-pattern',
        type: 'invoice.status_changed',
        data: {
          // Missing required fields: id, status, subscription_id
          some_other_field: 'value'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.status).toBe('validation_failed');
    });

    it('should accept events with valid patterns', async () => {
      // Mock subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{
                  id: 'intent-valid',
                  user_id: 'user-123'
                }],
                error: null
              })
            })
          })
        })
      });

      const event: WebhookEvent = {
        id: 'test-valid-pattern',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-123',
          status: 'paid',
          subscription_id: 'sub-123',
          // Optional fields
          total_cents: 5000,
          due_date: new Date().toISOString(),
          paid_at: new Date().toISOString(),
          payment_method: 'credit_card'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple events in batch', async () => {
      const events: WebhookEvent[] = [
        {
          id: 'batch-event-1',
          type: 'customer.created',
          data: { id: 'customer-1' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        },
        {
          id: 'batch-event-2',
          type: 'customer.created',
          data: { id: 'customer-2' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        },
        {
          id: 'batch-event-3',
          type: 'customer.created',
          data: { id: 'customer-3' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        }
      ];

      const results = await processor.processBatch(events);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle mixed success and failure in batch', async () => {
      let eventCount = 0;
      processor.processEventWithRetry = jest.fn().mockImplementation(async (event) => {
        eventCount++;
        if (eventCount === 2) {
          return {
            success: false,
            status: 'retryable_error',
            message: 'Failed event',
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
          message: 'Success',
          processingTime: 100,
          context: {
            eventId: event.id,
            eventType: event.type,
            processingId: 'test',
            startTime: Date.now(),
            attempt: 1,
            metadata: {}
          }
        };
      });

      const events: WebhookEvent[] = [
        {
          id: 'batch-success-1',
          type: 'customer.created',
          data: { id: 'customer-1' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        },
        {
          id: 'batch-failure',
          type: 'customer.created',
          data: { id: 'customer-2' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        },
        {
          id: 'batch-success-2',
          type: 'customer.created',
          data: { id: 'customer-3' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        }
      ];

      const results = await processor.processBatch(events);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track processing metrics correctly', async () => {
      processor.resetMetrics();

      const successEvent: WebhookEvent = {
        id: 'metrics-success',
        type: 'customer.created',
        data: { id: 'customer-success' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const failEvent: WebhookEvent = {
        id: '',
        type: 'customer.created',
        data: {},
        created_at: 'invalid',
        source: 'iugu'
      };

      await processor.processEvent(successEvent);
      await processor.processEvent(failEvent);

      const metrics = processor.getMetrics();
      expect(metrics.events_received).toBe(2);
      expect(metrics.events_processed).toBe(1);
      expect(metrics.events_failed).toBe(1);
    });

    it('should provide circuit breaker status', () => {
      const status = processor.getCircuitBreakerStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failures');
      expect(status).toHaveProperty('successes');
    });

    it('should allow circuit breaker reset', () => {
      processor.resetCircuitBreaker();
      const status = processor.getCircuitBreakerStatus();
      expect(status.state).toBe('closed');
    });
  });

  describe('Dead Letter Queue Integration', () => {
    it('should provide dead letter queue statistics', async () => {
      const stats = await processor.getDeadLetterQueueStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('retryable');
      expect(stats).toHaveProperty('non_retryable');
    });

    it('should process dead letter queue items', async () => {
      const result = await processor.processDeadLetterQueue(5);
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('skipped');
    });

    it('should cleanup old dead letter queue items', async () => {
      const deletedCount = await processor.cleanupDeadLetterQueue(30);
      expect(typeof deletedCount).toBe('number');
    });
  });
});