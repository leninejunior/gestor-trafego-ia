/**
 * Simple Account Creation Service Test
 */

describe('Account Creation Service', () => {
  it('should be importable', async () => {
    const { AccountCreationService } = await import('@/lib/webhooks/account-creation-service');
    expect(AccountCreationService).toBeDefined();
    expect(typeof AccountCreationService).toBe('function');
  });

  it('should create instance with factory function', async () => {
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const { createAccountCreationService } = await import('@/lib/webhooks/account-creation-service');
    
    expect(() => createAccountCreationService()).not.toThrow();
  });

  it('should have required methods', async () => {
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const { AccountCreationService } = await import('@/lib/webhooks/account-creation-service');
    const service = new AccountCreationService('http://localhost:54321', 'test-key');

    expect(service.createAccountFromIntent).toBeDefined();
    expect(typeof service.createAccountFromIntent).toBe('function');
  });
});