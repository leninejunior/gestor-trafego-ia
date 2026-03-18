/**
 * Account Creation Service Tests
 * 
 * Tests for automated account creation via webhook processing.
 * 
 * Requirements: 2.2, 2.3, 2.4
 */

import { AccountCreationService } from '@/lib/webhooks/account-creation-service';
import { AccountCreationContext } from '@/lib/types/webhook';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        createUser: jest.fn(),
        listUsers: jest.fn(),
      },
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  })),
}));

// Mock EmailNotificationService
jest.mock('@/lib/services/email-notification-service', () => ({
  EmailNotificationService: jest.fn(() => ({
    sendEmail: jest.fn(() => Promise.resolve(true)),
  })),
}));

describe('AccountCreationService', () => {
  let service: AccountCreationService;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instance
    service = new AccountCreationService(
      'http://localhost:54321',
      'test-key'
    );

    // Get mock supabase instance
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = createClient();
  });

  describe('createAccountFromIntent', () => {
    const mockIntent = {
      id: 'intent-123',
      user_email: 'test@example.com',
      user_name: 'Test User',
      organization_name: 'Test Organization',
      cpf_cnpj: '12345678901',
      phone: '+5511999999999',
      plan_id: 'plan-123',
      billing_cycle: 'monthly',
      metadata: {},
    };

    const mockContext: AccountCreationContext = {
      source: 'webhook_payment',
      invoice_id: 'inv-123',
      payment_method: 'credit_card',
    };

    it('should create new account successfully', async () => {
      // Mock user creation
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: {
          user: { id: 'user-123' },
        },
        error: null,
      });

      // Mock existing user check
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      // Mock organization creation
      const mockOrgInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'org-123', name: 'Test Organization' },
            error: null,
          }),
        }),
      });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return { insert: mockOrgInsert };
        }
        if (table === 'organization_memberships') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'membership-123' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'subscription_intents') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const result = await service.createAccountFromIntent(
        mockIntent,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.user_id).toBe('user-123');
      expect(result.organization_id).toBe('org-123');
      expect(result.membership_id).toBe('membership-123');
      expect(result.existing_user).toBe(false);
      expect(result.welcome_email_sent).toBe(true);

      // Verify user creation was called
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: expect.any(String),
        email_confirm: true,
        user_metadata: expect.objectContaining({
          name: 'Test User',
          organization_name: 'Test Organization',
          cpf_cnpj: '12345678901',
          phone: '+5511999999999',
          created_via: 'webhook_payment',
        }),
      });

      // Verify organization creation
      expect(mockOrgInsert).toHaveBeenCalledWith({
        name: 'Test Organization',
        slug: expect.stringMatching(/^test-organization-\d{6}$/),
        created_by: 'user-123',
      });
    });

    it('should handle existing user', async () => {
      // Mock existing user
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{ id: 'existing-user-123', email: 'test@example.com' }],
        },
        error: null,
      });

      // Mock membership lookup
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organization_memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'existing-membership-123',
                    organization_id: 'existing-org-123',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'subscription_intents') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const result = await service.createAccountFromIntent(
        mockIntent,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.user_id).toBe('existing-user-123');
      expect(result.organization_id).toBe('existing-org-123');
      expect(result.membership_id).toBe('existing-membership-123');
      expect(result.existing_user).toBe(true);
      expect(result.welcome_email_sent).toBe(false);

      // Verify no new user was created
      expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled();
    });

    it('should handle user creation failure', async () => {
      // Mock user creation failure
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User creation failed' },
      });

      // Mock no existing user
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      await expect(
        service.createAccountFromIntent(mockIntent, mockContext)
      ).rejects.toThrow('Account creation failed');
    });

    it('should handle organization creation failure', async () => {
      // Mock successful user creation
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: {
          user: { id: 'user-123' },
        },
        error: null,
      });

      // Mock no existing user
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      // Mock organization creation failure
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Organization creation failed' },
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.createAccountFromIntent(mockIntent, mockContext)
      ).rejects.toThrow('Account creation failed');
    });
  });

  describe('generateTempPassword', () => {
    it('should generate secure temporary password', () => {
      // Access private method through any cast for testing
      const password = (service as any).generateTempPassword();

      expect(password).toHaveLength(12);
      expect(password).toMatch(/[A-Z]/); // Has uppercase
      expect(password).toMatch(/[a-z]/); // Has lowercase
      expect(password).toMatch(/[0-9]/); // Has number
      expect(password).toMatch(/[!@#$%&*]/); // Has symbol
    });
  });

  describe('generateOrganizationSlug', () => {
    it('should generate valid organization slug', () => {
      const slug = (service as any).generateOrganizationSlug('Test Organization');

      expect(slug).toMatch(/^test-organization-\d{6}$/);
    });

    it('should handle special characters and accents', () => {
      const slug = (service as any).generateOrganizationSlug('Organização Ação & Cia');

      expect(slug).toMatch(/^organizacao-acao-cia-\d{6}$/);
    });
  });
});