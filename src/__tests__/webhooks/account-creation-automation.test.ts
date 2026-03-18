/**
 * Account Creation Automation Tests
 * 
 * Comprehensive tests for automated account creation triggered by webhook events.
 * Tests user creation, organization setup, membership assignment, and welcome emails.
 * 
 * Requirements: 2.2, 2.3, 2.4
 */

import { AccountCreationService } from '@/lib/webhooks/account-creation-service';
import { EmailNotificationService } from '@/lib/services/email-notification-service';
import { 
  AccountCreationContext,
  AccountCreationResult,
  AccountCreationError,
  WelcomeEmailData
} from '@/lib/types/webhook';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@/lib/services/email-notification-service');

describe('Account Creation Automation', () => {
  let service: AccountCreationService;
  let mockSupabase: any;
  let mockEmailService: jest.Mocked<EmailNotificationService>;

  beforeEach(() => {
    // Setup Supabase mock
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = {
      auth: {
        admin: {
          createUser: jest.fn(),
          listUsers: jest.fn()
        }
      },
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn()
        }))
      }))
    };
    createClient.mockReturnValue(mockSupabase);

    // Setup email service mock
    const { EmailNotificationService } = require('@/lib/services/email-notification-service');
    mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue(true)
    } as any;
    EmailNotificationService.mockImplementation(() => mockEmailService);

    // Create service instance
    service = new AccountCreationService(
      'http://localhost:54321',
      'test-key'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Account Creation Flow', () => {
    it('should create complete account for new user with all components', async () => {
      const intentData = {
        id: 'intent-complete',
        user_email: 'complete@example.com',
        user_name: 'Complete User',
        organization_name: 'Complete Organization',
        cpf_cnpj: '12345678901',
        phone: '+5511999999999',
        plan_id: 'plan-premium',
        billing_cycle: 'monthly',
        metadata: { source: 'landing_page' }
      };

      const context: AccountCreationContext = {
        source: 'webhook_payment',
        invoice_id: 'inv-complete',
        payment_method: 'credit_card'
      };

      // Mock no existing user
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null
      });

      // Mock successful user creation
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'user-complete' } },
        error: null
      });

      // Mock successful organization creation
      const mockOrgInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'org-complete', name: 'Complete Organization' },
            error: null
          })
        })
      });

      // Mock successful membership creation
      const mockMembershipInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'membership-complete' },
            error: null
          })
        })
      });

      // Mock successful intent update
      const mockIntentUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      mockSupabase.from.mockImplementation((table: string) => {
        switch (table) {
          case 'organizations':
            return { insert: mockOrgInsert };
          case 'organization_memberships':
            return { insert: mockMembershipInsert };
          case 'subscription_intents':
            return { update: mockIntentUpdate };
          default:
            return {};
        }
      });

      const result = await service.createAccountFromIntent(intentData, context);

      expect(result.success).toBe(true);
      expect(result.user_id).toBe('user-complete');
      expect(result.organization_id).toBe('org-complete');
      expect(result.membership_id).toBe('membership-complete');
      expect(result.welcome_email_sent).toBe(true);
      expect(result.existing_user).toBe(false);

      // Verify user creation
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'complete@example.com',
        password: expect.any(String),
        email_confirm: true,
        user_metadata: expect.objectContaining({
          name: 'Complete User',
          organization_name: 'Complete Organization',
          cpf_cnpj: '12345678901',
          phone: '+5511999999999',
          created_via: 'webhook_payment'
        })
      });

      // Verify organization creation
      expect(mockOrgInsert).toHaveBeenCalledWith({
        name: 'Complete Organization',
        slug: expect.stringMatching(/^complete-organization-\d{6}$/),
        created_by: 'user-complete'
      });

      // Verify membership creation
      expect(mockMembershipInsert).toHaveBeenCalledWith({
        user_id: 'user-complete',
        organization_id: 'org-complete',
        role: 'owner'
      });

      // Verify welcome email sent
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'complete@example.com',
        expect.objectContaining({
          subject: expect.stringContaining('Welcome to Ads Manager'),
          html: expect.stringContaining('Complete User'),
          text: expect.stringContaining('Complete User')
        })
      );
    });

    it('should handle existing user scenario correctly', async () => {
      const intentData = {
        id: 'intent-existing',
        user_email: 'existing@example.com',
        user_name: 'Existing User',
        organization_name: 'Existing Organization',
        metadata: {}
      };

      const context: AccountCreationContext = {
        source: 'webhook_payment',
        invoice_id: 'inv-existing'
      };

      // Mock existing user
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{ id: 'existing-user-123', email: 'existing@example.com' }]
        },
        error: null
      });

      // Mock existing membership
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organization_memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'existing-membership-123',
                    organization_id: 'existing-org-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'subscription_intents') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        return {};
      });

      const result = await service.createAccountFromIntent(intentData, context);

      expect(result.success).toBe(true);
      expect(result.user_id).toBe('existing-user-123');
      expect(result.organization_id).toBe('existing-org-123');
      expect(result.membership_id).toBe('existing-membership-123');
      expect(result.welcome_email_sent).toBe(false);
      expect(result.existing_user).toBe(true);

      // Verify no new user was created
      expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling in Account Creation', () => {
    it('should handle user creation failures', async () => {
      const intentData = {
        id: 'intent-user-fail',
        user_email: 'userfail@example.com',
        user_name: 'User Fail',
        organization_name: 'Fail Organization',
        metadata: {}
      };

      const context: AccountCreationContext = {
        source: 'webhook_payment',
        invoice_id: 'inv-user-fail'
      };

      // Mock user creation failure
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'User creation failed' }
      });

      await expect(
        service.createAccountFromIntent(intentData, context)
      ).rejects.toThrow('Account creation failed');

      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalled();
    });

    it('should handle organization creation failures', async () => {
      const intentData = {
        id: 'intent-org-fail',
        user_email: 'orgfail@example.com',
        user_name: 'Org Fail',
        organization_name: 'Fail Organization',
        metadata: {}
      };

      const context: AccountCreationContext = {
        source: 'webhook_payment',
        invoice_id: 'inv-org-fail'
      };

      // Mock no existing user
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null
      });

      // Mock successful user creation
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'user-org-fail' } },
        error: null
      });

      // Mock organization creation failure
      const mockOrgInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Organization creation failed' }
          })
        })
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'organizations') {
          return { insert: mockOrgInsert };
        }
        return {};
      });

      await expect(
        service.createAccountFromIntent(intentData, context)
      ).rejects.toThrow('Account creation failed');
    });

    it('should handle email sending failures gracefully', async () => {
      const intentData = {
        id: 'intent-email-fail',
        user_email: 'emailfail@example.com',
        user_name: 'Email Fail',
        organization_name: 'Email Fail Organization',
        metadata: {}
      };

      const context: AccountCreationContext = {
        source: 'webhook_payment',
        invoice_id: 'inv-email-fail'
      };

      // Mock no existing user
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null
      });

      // Mock successful user creation
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'user-email-fail' } },
        error: null
      });

      // Mock successful organization creation
      const mockOrgInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'org-email-fail', name: 'Email Fail Organization' },
            error: null
          })
        })
      });

      // Mock successful membership creation
      const mockMembershipInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'membership-email-fail' },
            error: null
          })
        })
      });

      // Mock successful intent update
      const mockIntentUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      mockSupabase.from.mockImplementation((table: string) => {
        switch (table) {
          case 'organizations':
            return { insert: mockOrgInsert };
          case 'organization_memberships':
            return { insert: mockMembershipInsert };
          case 'subscription_intents':
            return { update: mockIntentUpdate };
          default:
            return {};
        }
      });

      // Mock email service failure
      mockEmailService.sendEmail.mockResolvedValue(false);

      const result = await service.createAccountFromIntent(intentData, context);

      expect(result.success).toBe(true);
      expect(result.welcome_email_sent).toBe(false);
      expect(result.user_id).toBe('user-email-fail');
    });
  });
});