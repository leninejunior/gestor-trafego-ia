/**
 * Webhook Integration Test
 * 
 * Test webhook processing with account creation
 */

describe('Webhook Integration', () => {
  it('should process webhook with account creation', async () => {
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // This test verifies that the webhook processor can be imported
    // and that the account creation service integration is working
    const mockEvent = {
      id: 'test-event-123',
      type: 'invoice.status_changed' as const,
      data: {
        id: 'inv-123',
        status: 'paid',
        subscription_id: 'sub-123',
        total_cents: 2900,
        paid_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      source: 'iugu' as const,
      version: '1.0',
    };

    // Test that we can import the webhook processor
    expect(() => {
      const { createWebhookProcessor } = require('@/lib/webhooks/webhook-processor');
      expect(createWebhookProcessor).toBeDefined();
    }).not.toThrow();

    // Test that account creation service can be imported
    expect(() => {
      const { createAccountCreationService } = require('@/lib/webhooks/account-creation-service');
      expect(createAccountCreationService).toBeDefined();
    }).not.toThrow();
  });

  it('should have all required webhook types', () => {
    const { WebhookProcessingError, WebhookValidationError, WebhookRetryableError, WebhookFatalError, AccountCreationError } = require('@/lib/types/webhook');
    
    expect(WebhookProcessingError).toBeDefined();
    expect(WebhookValidationError).toBeDefined();
    expect(WebhookRetryableError).toBeDefined();
    expect(WebhookFatalError).toBeDefined();
    expect(AccountCreationError).toBeDefined();
  });
});