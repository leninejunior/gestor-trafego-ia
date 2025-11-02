/**
 * Comprehensive Webhook Processing Tests
 * 
 * Complete test suite for webhook processing covering all event types,
 * retry logic, error handling, and account creation automation.
 * 
 * Requirements: 2.1, 2.2, 4.1
 */

import { WebhookProcessor, createWebhookProcessor } from '@/lib/webhooks/webhook-processor';
import { WebhookRetryManager } from '@/lib/webhooks/retry-manager';
import { AccountCreationService } from '@/lib/webhooks/account-creation-service';
import { 
  WebhookEvent, 
  WebhookEventType,
  WebhookProcessingResult,
  WebhookValidationError,
  WebhookRetryableError,
  WebhookFatalError,
  AccountCreationContext
} from '@/lib/types/webhook';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@/lib/services/subscription-intent-service');
jest.mock('@/lib/webhooks/webhook-validator');
jest.mock('@/lib/webhooks/webhook-logger');
jest.mock('@/lib/webhooks/circuit-breaker');
jest.mock('@/lib/webhooks/retry-manager');
jest.mock('@/lib/webhooks/account-creation-service');
jest.mock('@/lib/services/email-notification-service');

describe('Comprehensive Webhook Processing Tests', () => {
  let processor: WebhookProcessor;
  let mockSupabase: any;
  let mockRetryManager: jest.Mocked<WebhookRetryManager>;
  let mockAccountCreationService: jest.Mocked<AccountCreationService>;

  beforeEach(() => {
    // Setup mocks
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        })),
        insert: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: null }))
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
    };
    createClient.mockReturnValue(mockSupabase);

    // Create processor with test configuration
    processor = createWebhookProcessor({
      validation: {
        validateSignature: false,
        signatureHeader: 'x-test-signature',
        signatureSecret: 'test-secret',
        allowedSources: ['iugu', 'test'],
        maxPayloadSize: 1024 * 1024,
      },
      processing: {
        timeout: 5000,
        maxConcurrency: 5,
        enableDeduplication: false,
        deduplicationWindow: 60,
      }
    });

    // Setup service mocks
    mockRetryManager = processor['retryManager'] as jest.Mocked<WebhookRetryManager>;
    mockAccountCreationService = processor['accountCreationService'] as jest.Mocked<AccountCreationService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });  describ
e('Event Type Processing', () => {
    describe('Invoice Status Changed Events', () => {
      it('should process paid invoice and create account', async () => {
        const mockIntent = {
          id: 'intent-123',
          user_email: 'test@example.com',
          user_name: 'Test User',
          organization_name: 'Test Org',
          iugu_subscription_id: 'sub-123',
          user_id: null,
          metadata: {}
        };

        // Mock finding subscription intent
        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        // Mock account creation
        mockAccountCreationService.createAccountFromIntent.mockResolvedValue({
          success: true,
          user_id: 'user-123',
          organization_id: 'org-123',
          membership_id: 'membership-123',
          welcome_email_sent: true,
          existing_user: false
        });

        const event: WebhookEvent = {
          id: 'event-paid-invoice',
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
        expect(mockAccountCreationService.createAccountFromIntent).toHaveBeenCalledWith(
          mockIntent,
          expect.objectContaining({
            source: 'webhook_payment',
            invoice_id: 'invoice-123',
            payment_method: 'credit_card'
          })
        );
      });

      it('should handle failed/expired invoice', async () => {
        const mockIntent = {
          id: 'intent-failed',
          iugu_subscription_id: 'sub-failed',
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        const event: WebhookEvent = {
          id: 'event-failed-invoice',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-failed',
            status: 'expired',
            subscription_id: 'sub-failed'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(true);
        expect(result.status).toBe('processed');
        // Should not create account for failed payments
        expect(mockAccountCreationService.createAccountFromIntent).not.toHaveBeenCalled();
      });

      it('should handle pending invoice', async () => {
        const mockIntent = {
          id: 'intent-pending',
          iugu_subscription_id: 'sub-pending',
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        const event: WebhookEvent = {
          id: 'event-pending-invoice',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-pending',
            status: 'pending',
            subscription_id: 'sub-pending'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(true);
        expect(result.status).toBe('processed');
        // Should not create account for pending payments
        expect(mockAccountCreationService.createAccountFromIntent).not.toHaveBeenCalled();
      });
    });

    describe('Subscription Events', () => {
      it('should process subscription.activated event', async () => {
        const mockIntent = {
          id: 'intent-activated',
          iugu_subscription_id: 'sub-activated'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        const event: WebhookEvent = {
          id: 'event-sub-activated',
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
        expect(result.status).toBe('processed');
      });

      it('should process subscription.suspended event', async () => {
        const mockIntent = {
          id: 'intent-suspended',
          iugu_subscription_id: 'sub-suspended'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        const event: WebhookEvent = {
          id: 'event-sub-suspended',
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
        expect(result.status).toBe('processed');
      });

      it('should process subscription.expired event', async () => {
        const mockIntent = {
          id: 'intent-expired',
          iugu_subscription_id: 'sub-expired'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        const event: WebhookEvent = {
          id: 'event-sub-expired',
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
        expect(result.status).toBe('processed');
      });

      it('should process subscription.canceled event', async () => {
        const mockIntent = {
          id: 'intent-canceled',
          iugu_subscription_id: 'sub-canceled'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        const event: WebhookEvent = {
          id: 'event-sub-canceled',
          type: 'subscription.canceled',
          data: {
            id: 'sub-canceled',
            canceled_at: new Date().toISOString(),
            reason: 'user_requested'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(true);
        expect(result.status).toBe('processed');
      });
    });

    describe('Customer Events', () => {
      it('should process customer.created event', async () => {
        const event: WebhookEvent = {
          id: 'event-customer-created',
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
  });  descri
be('Error Handling and Retry Logic', () => {
    describe('Validation Errors', () => {
      it('should handle missing required fields', async () => {
        const event: WebhookEvent = {
          id: 'event-invalid',
          type: 'invoice.status_changed',
          data: {
            // Missing required fields: id, status, subscription_id
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(false);
        expect(result.status).toBe('validation_failed');
        expect(result.retryable).toBe(false);
      });

      it('should handle invalid event structure', async () => {
        const event: WebhookEvent = {
          id: '',
          type: 'invoice.status_changed',
          data: null as any,
          created_at: 'invalid-date',
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(false);
        expect(result.status).toBe('validation_failed');
        expect(result.retryable).toBe(false);
      });
    });

    describe('Retryable Errors', () => {
      it('should retry database connection errors', async () => {
        // Mock database error on first attempt
        let attemptCount = 0;
        mockSupabase.from.mockImplementation(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => {
                  attemptCount++;
                  if (attemptCount === 1) {
                    return Promise.resolve({ 
                      data: null, 
                      error: { message: 'Connection timeout' } 
                    });
                  }
                  return Promise.resolve({ 
                    data: [{ id: 'intent-retry', iugu_subscription_id: 'sub-retry' }], 
                    error: null 
                  });
                })
              }))
            }))
          }))
        }));

        const event: WebhookEvent = {
          id: 'event-db-error',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-retry',
            status: 'paid',
            subscription_id: 'sub-retry'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEventWithRetry(event);

        expect(result.success).toBe(true);
        expect(attemptCount).toBeGreaterThan(1);
      });

      it('should retry account creation failures', async () => {
        const mockIntent = {
          id: 'intent-account-fail',
          user_email: 'test@example.com',
          user_name: 'Test User',
          organization_name: 'Test Org',
          iugu_subscription_id: 'sub-account-fail',
          user_id: null,
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        // Mock account creation failure then success
        let accountCreationAttempts = 0;
        mockAccountCreationService.createAccountFromIntent.mockImplementation(async () => {
          accountCreationAttempts++;
          if (accountCreationAttempts === 1) {
            throw new WebhookRetryableError('Temporary account creation failure', 'TEMP_FAILURE');
          }
          return {
            success: true,
            user_id: 'user-retry',
            organization_id: 'org-retry',
            membership_id: 'membership-retry',
            welcome_email_sent: true,
            existing_user: false
          };
        });

        const event: WebhookEvent = {
          id: 'event-account-creation-retry',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-account-fail',
            status: 'paid',
            subscription_id: 'sub-account-fail'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEventWithRetry(event);

        expect(result.success).toBe(true);
        expect(accountCreationAttempts).toBe(2);
      });
    });

    describe('Fatal Errors', () => {
      it('should not retry fatal errors', async () => {
        const mockIntent = {
          id: 'intent-fatal',
          iugu_subscription_id: 'sub-fatal'
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        // Mock fatal error in account creation
        mockAccountCreationService.createAccountFromIntent.mockRejectedValue(
          new WebhookFatalError('Invalid user data format', 'INVALID_DATA')
        );

        const event: WebhookEvent = {
          id: 'event-fatal-error',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-fatal',
            status: 'paid',
            subscription_id: 'sub-fatal'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEventWithRetry(event);

        expect(result.success).toBe(false);
        expect(result.retryable).toBe(false);
        expect(mockAccountCreationService.createAccountFromIntent).toHaveBeenCalledTimes(1);
      });
    });

    describe('Circuit Breaker', () => {
      it('should open circuit breaker after consecutive failures', async () => {
        // Mock circuit breaker behavior
        const mockCircuitBreaker = processor['circuitBreaker'];
        mockCircuitBreaker.canExecute = jest.fn().mockReturnValue(false);

        const event: WebhookEvent = {
          id: 'event-circuit-breaker',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-cb',
            status: 'paid',
            subscription_id: 'sub-cb'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEventWithRetry(event);

        expect(result.success).toBe(false);
        expect(result.status).toBe('circuit_breaker_open');
        expect(result.retryable).toBe(false);
      });
    });
  });  describe
('Account Creation Automation', () => {
    describe('New User Creation', () => {
      it('should create complete account for new user', async () => {
        const mockIntent = {
          id: 'intent-new-user',
          user_email: 'newuser@example.com',
          user_name: 'New User',
          organization_name: 'New Organization',
          cpf_cnpj: '12345678901',
          phone: '+5511999999999',
          iugu_subscription_id: 'sub-new-user',
          user_id: null,
          plan_id: 'plan-premium',
          billing_cycle: 'monthly',
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        mockAccountCreationService.createAccountFromIntent.mockResolvedValue({
          success: true,
          user_id: 'user-new',
          organization_id: 'org-new',
          membership_id: 'membership-new',
          welcome_email_sent: true,
          existing_user: false
        });

        const event: WebhookEvent = {
          id: 'event-new-user-payment',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-new-user',
            status: 'paid',
            subscription_id: 'sub-new-user',
            total_cents: 9900,
            paid_at: new Date().toISOString(),
            payment_method: 'credit_card'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(true);
        expect(mockAccountCreationService.createAccountFromIntent).toHaveBeenCalledWith(
          mockIntent,
          expect.objectContaining({
            source: 'webhook_payment',
            invoice_id: 'invoice-new-user',
            payment_method: 'credit_card'
          })
        );
      });

      it('should handle existing user with paid invoice', async () => {
        const mockIntent = {
          id: 'intent-existing-user',
          user_email: 'existing@example.com',
          user_name: 'Existing User',
          organization_name: 'Existing Organization',
          iugu_subscription_id: 'sub-existing-user',
          user_id: 'existing-user-123', // User already exists
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        const event: WebhookEvent = {
          id: 'event-existing-user-payment',
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
        // Should not create account for existing user
        expect(mockAccountCreationService.createAccountFromIntent).not.toHaveBeenCalled();
      });

      it('should handle account creation for existing email', async () => {
        const mockIntent = {
          id: 'intent-existing-email',
          user_email: 'existing@example.com',
          user_name: 'User Name',
          organization_name: 'Organization Name',
          iugu_subscription_id: 'sub-existing-email',
          user_id: null,
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        // Mock account creation service finding existing user
        mockAccountCreationService.createAccountFromIntent.mockResolvedValue({
          success: true,
          user_id: 'existing-user-456',
          organization_id: 'existing-org-456',
          membership_id: 'existing-membership-456',
          welcome_email_sent: false,
          existing_user: true
        });

        const event: WebhookEvent = {
          id: 'event-existing-email-payment',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-existing-email',
            status: 'paid',
            subscription_id: 'sub-existing-email'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(true);
        expect(mockAccountCreationService.createAccountFromIntent).toHaveBeenCalled();
      });
    });

    describe('Welcome Email Automation', () => {
      it('should send welcome email for new accounts', async () => {
        const mockIntent = {
          id: 'intent-welcome-email',
          user_email: 'welcome@example.com',
          user_name: 'Welcome User',
          organization_name: 'Welcome Organization',
          iugu_subscription_id: 'sub-welcome',
          user_id: null,
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        mockAccountCreationService.createAccountFromIntent.mockResolvedValue({
          success: true,
          user_id: 'user-welcome',
          organization_id: 'org-welcome',
          membership_id: 'membership-welcome',
          welcome_email_sent: true,
          existing_user: false
        });

        const event: WebhookEvent = {
          id: 'event-welcome-email',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-welcome',
            status: 'paid',
            subscription_id: 'sub-welcome'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(true);
        expect(result.result.welcome_email_sent).toBe(true);
      });

      it('should not send welcome email for existing users', async () => {
        const mockIntent = {
          id: 'intent-no-welcome',
          user_email: 'existing@example.com',
          user_name: 'Existing User',
          organization_name: 'Existing Organization',
          iugu_subscription_id: 'sub-no-welcome',
          user_id: null,
          metadata: {}
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ 
                  data: [mockIntent], 
                  error: null 
                }))
              }))
            }))
          }))
        });

        mockAccountCreationService.createAccountFromIntent.mockResolvedValue({
          success: true,
          user_id: 'existing-user-789',
          organization_id: 'existing-org-789',
          membership_id: 'existing-membership-789',
          welcome_email_sent: false,
          existing_user: true
        });

        const event: WebhookEvent = {
          id: 'event-no-welcome-email',
          type: 'invoice.status_changed',
          data: {
            id: 'invoice-no-welcome',
            status: 'paid',
            subscription_id: 'sub-no-welcome'
          },
          created_at: new Date().toISOString(),
          source: 'iugu'
        };

        const result = await processor.processEvent(event);

        expect(result.success).toBe(true);
        expect(result.result.welcome_email_sent).toBe(false);
        expect(result.result.existing_user).toBe(true);
      });
    });
  });  des
cribe('Batch Processing', () => {
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
      expect(results.every(r => r.status === 'processed')).toBe(true);
    });

    it('should handle mixed success and failure in batch', async () => {
      const events: WebhookEvent[] = [
        {
          id: 'batch-success',
          type: 'customer.created',
          data: { id: 'customer-success' },
          created_at: new Date().toISOString(),
          source: 'iugu'
        },
        {
          id: 'batch-failure',
          type: 'invoice.status_changed',
          data: {}, // Invalid data
          created_at: new Date().toISOString(),
          source: 'iugu'
        }
      ];

      const results = await processor.processBatch(events);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track processing metrics', async () => {
      processor.resetMetrics();

      const successEvent: WebhookEvent = {
        id: 'metrics-success',
        type: 'customer.created',
        data: { id: 'customer-metrics' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const failureEvent: WebhookEvent = {
        id: 'metrics-failure',
        type: 'invoice.status_changed',
        data: {}, // Invalid data
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      await processor.processEvent(successEvent);
      await processor.processEvent(failureEvent);

      const metrics = processor.getMetrics();

      expect(metrics.events_received).toBe(2);
      expect(metrics.events_processed).toBe(1);
      expect(metrics.events_failed).toBe(1);
    });

    it('should provide circuit breaker status', () => {
      const status = processor.getCircuitBreakerStatus();
      expect(status).toBeDefined();
      expect(status.state).toBeDefined();
    });

    it('should provide dead letter queue statistics', async () => {
      mockRetryManager.getDeadLetterQueueStats.mockResolvedValue({
        total: 5,
        retryable: 3,
        non_retryable: 2,
        oldest_item: '2023-01-01T00:00:00Z'
      });

      const stats = await processor.getDeadLetterQueueStats();

      expect(stats.total).toBe(5);
      expect(stats.retryable).toBe(3);
      expect(stats.non_retryable).toBe(2);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle subscription intent not found', async () => {
      // Mock no subscription intent found
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ 
                data: [], 
                error: null 
              }))
            }))
          }))
        }))
      });

      const event: WebhookEvent = {
        id: 'event-no-intent',
        type: 'invoice.status_changed',
        data: {
          id: 'invoice-no-intent',
          status: 'paid',
          subscription_id: 'sub-not-found'
        },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.result.processed).toBe(false);
      expect(result.result.reason).toBe('subscription_intent_not_found');
    });

    it('should handle unknown event types', async () => {
      const event: WebhookEvent = {
        id: 'event-unknown',
        type: 'unknown.event' as WebhookEventType,
        data: { id: 'unknown-data' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await processor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_EVENT_TYPE');
    });

    it('should handle processing timeout', async () => {
      // Create processor with very short timeout
      const timeoutProcessor = createWebhookProcessor({
        processing: {
          timeout: 1, // 1ms timeout
          maxConcurrency: 5,
          enableDeduplication: false,
          deduplicationWindow: 60,
        },
        validation: {
          validateSignature: false,
          signatureHeader: 'x-test-signature',
          signatureSecret: 'test-secret',
          allowedSources: ['iugu', 'test'],
          maxPayloadSize: 1024 * 1024,
        }
      });

      // Mock slow database operation
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => new Promise(resolve => 
                setTimeout(() => resolve({ data: [], error: null }), 100)
              ))
            }))
          }))
        }))
      });

      const event: WebhookEvent = {
        id: 'event-timeout',
        type: 'customer.created',
        data: { id: 'customer-timeout' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await timeoutProcessor.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.error?.details.originalError).toContain('timed out');
    });

    it('should handle duplicate events when deduplication is enabled', async () => {
      // Create processor with deduplication enabled
      const dedupProcessor = createWebhookProcessor({
        processing: {
          timeout: 5000,
          maxConcurrency: 5,
          enableDeduplication: true,
          deduplicationWindow: 300,
        },
        validation: {
          validateSignature: false,
          signatureHeader: 'x-test-signature',
          signatureSecret: 'test-secret',
          allowedSources: ['iugu', 'test'],
          maxPayloadSize: 1024 * 1024,
        }
      });

      // Mock duplicate event found
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ 
                data: [{ id: 'existing-log' }], 
                error: null 
              }))
            }))
          }))
        }))
      });

      const event: WebhookEvent = {
        id: 'duplicate-event',
        type: 'customer.created',
        data: { id: 'customer-duplicate' },
        created_at: new Date().toISOString(),
        source: 'iugu'
      };

      const result = await dedupProcessor.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.status).toBe('duplicate');
    });
  });
});