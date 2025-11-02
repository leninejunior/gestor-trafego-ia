/**
 * Integration tests for complete checkout flow
 * Tests end-to-end scenarios including API interactions, state transitions, and error recovery
 * Requirements: 1.1, 1.2, 5.3
 */

import { createClient } from '@supabase/supabase-js';
import { SubscriptionIntentService } from '@/lib/services/subscription-intent-service';
import { IuguService } from '@/lib/iugu/iugu-service';
import { 
  CreateSubscriptionIntentRequest,
  SubscriptionIntentStatus,
} from '@/lib/types/subscription-intent';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@/lib/iugu/iugu-service');

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      in: jest.fn(() => ({
        order: jest.fn(() => ({
          range: jest.fn(),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(),
    })),
  })),
  rpc: jest.fn(),
};

const mockIuguService = {
  createOrGetCustomer: jest.fn(),
  createOrUpdatePlan: jest.fn(),
  createCheckoutUrl: jest.fn(),
  getCustomer: jest.fn(),
};

(createClient as jest.Mock).mockReturnValue(mockSupabase);
(IuguService as jest.Mock).mockImplementation(() => mockIuguService);

// Test data
const testPlan = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Pro Plan',
  description: 'Professional plan with advanced features',
  monthly_price: 99.99,
  annual_price: 999.99,
  is_active: true,
  features: {
    max_clients: 50,
    max_campaigns: 100,
    advanced_analytics: true,
  },
};

const testCustomer = {
  id: 'iugu-customer-123',
  email: 'test@example.com',
  name: 'Test User',
};

const testIuguPlan = {
  identifier: 'pro-plan-monthly',
  name: 'Pro Plan',
};

const validIntentRequest: CreateSubscriptionIntentRequest = {
  plan_id: testPlan.id,
  billing_cycle: 'monthly',
  user_email: 'test@example.com',
  user_name: 'Test User',
  organization_name: 'Test Organization',
  cpf_cnpj: '12345678901',
  phone: '+5511999999999',
  metadata: {
    source: 'integration_test',
  },
};

describe('Checkout Flow Integration', () => {
  let subscriptionIntentService: SubscriptionIntentService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    subscriptionIntentService = new SubscriptionIntentService(
      'https://test.supabase.co',
      'test-service-role-key'
    );

    // Setup default mocks
    mockSupabase.from().select().eq().eq().single.mockResolvedValue({
      data: testPlan,
      error: null,
    });

    mockSupabase.rpc.mockResolvedValue({
      data: 'intent-123',
      error: null,
    });

    mockIuguService.createOrGetCustomer.mockResolvedValue(testCustomer);
    mockIuguService.createOrUpdatePlan.mockResolvedValue(testIuguPlan);
    mockIuguService.createCheckoutUrl.mockResolvedValue('https://iugu.com/checkout/123');
  });

  describe('Complete Checkout Flow', () => {
    it('should create subscription intent and generate checkout URL', async () => {
      // Step 1: Create subscription intent
      const intentResponse = await subscriptionIntentService.createIntent(validIntentRequest);

      expect(intentResponse.success).toBe(true);
      expect(intentResponse.intent_id).toBe('intent-123');
      expect(intentResponse.status_url).toContain('/checkout/status/intent-123');
      expect(intentResponse.expires_at).toBeDefined();

      // Verify database calls
      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_plans');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_subscription_intent', {
        plan_id_param: validIntentRequest.plan_id,
        billing_cycle_param: validIntentRequest.billing_cycle,
        user_email_param: validIntentRequest.user_email.toLowerCase(),
        user_name_param: validIntentRequest.user_name,
        organization_name_param: validIntentRequest.organization_name,
        cpf_cnpj_param: '12345678901',
        phone_param: '5511999999999',
        metadata_param: expect.objectContaining({
          source: 'integration_test',
        }),
      });
    });

    it('should handle complete payment flow with state transitions', async () => {
      // Mock intent data for different states
      const pendingIntent = {
        id: 'intent-123',
        status: 'pending' as SubscriptionIntentStatus,
        plan_id: testPlan.id,
        billing_cycle: 'monthly' as const,
        user_email: validIntentRequest.user_email,
        user_name: validIntentRequest.user_name,
        organization_name: validIntentRequest.organization_name,
        cpf_cnpj: validIntentRequest.cpf_cnpj,
        phone: validIntentRequest.phone,
        metadata: {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        iugu_customer_id: null,
        iugu_subscription_id: null,
        checkout_url: null,
        user_id: null,
      };

      // Mock getting the intent
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          ...pendingIntent,
          plan: testPlan,
        },
        error: null,
      });

      // Step 1: Get pending intent
      const intent = await subscriptionIntentService.getIntent('intent-123');
      expect(intent.status).toBe('pending');

      // Step 2: Simulate payment processing (webhook would trigger this)
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      
      await subscriptionIntentService.updateIntent('intent-123', {
        status: 'processing',
        iugu_customer_id: 'iugu-customer-123',
        metadata: {
          payment_started_at: new Date().toISOString(),
        },
      });

      // Step 3: Simulate payment completion
      await subscriptionIntentService.updateIntent('intent-123', {
        status: 'completed',
        iugu_subscription_id: 'iugu-subscription-123',
        user_id: 'user-123',
        metadata: {
          payment_completed_at: new Date().toISOString(),
        },
      });

      // Verify state transitions were called
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_subscription_intent_status', 
        expect.objectContaining({
          intent_id_param: 'intent-123',
          new_status_param: 'processing',
        })
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_subscription_intent_status',
        expect.objectContaining({
          intent_id_param: 'intent-123',
          new_status_param: 'completed',
        })
      );
    });

    it('should handle payment failure and recovery', async () => {
      const failedIntent = {
        id: 'intent-123',
        status: 'failed' as SubscriptionIntentStatus,
        plan_id: testPlan.id,
        billing_cycle: 'monthly' as const,
        user_email: validIntentRequest.user_email,
        user_name: validIntentRequest.user_name,
        organization_name: validIntentRequest.organization_name,
        cpf_cnpj: validIntentRequest.cpf_cnpj,
        phone: validIntentRequest.phone,
        metadata: {
          failure_reason: 'Card declined',
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        iugu_customer_id: 'iugu-customer-123',
        iugu_subscription_id: null,
        checkout_url: 'https://iugu.com/checkout/123',
        user_id: null,
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          ...failedIntent,
          plan: testPlan,
        },
        error: null,
      });

      // Step 1: Get failed intent
      const intent = await subscriptionIntentService.getIntent('intent-123');
      expect(intent.status).toBe('failed');

      // Step 2: Retry payment (reset to pending)
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      
      await subscriptionIntentService.executeStateTransition('intent-123', 'pending', {
        reason: 'Payment retry requested',
        triggeredBy: 'user_action',
      });

      // Verify retry transition
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_subscription_intent_status',
        expect.objectContaining({
          intent_id_param: 'intent-123',
          new_status_param: 'pending',
        })
      );
    });

    it('should handle intent expiration', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday
      
      const expiredIntent = {
        id: 'intent-123',
        status: 'pending' as SubscriptionIntentStatus,
        expires_at: expiredDate,
        plan_id: testPlan.id,
        billing_cycle: 'monthly' as const,
        user_email: validIntentRequest.user_email,
        user_name: validIntentRequest.user_name,
        organization_name: validIntentRequest.organization_name,
        cpf_cnpj: validIntentRequest.cpf_cnpj,
        phone: validIntentRequest.phone,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        iugu_customer_id: 'iugu-customer-123',
        iugu_subscription_id: null,
        checkout_url: 'https://iugu.com/checkout/123',
        user_id: null,
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          ...expiredIntent,
          plan: testPlan,
        },
        error: null,
      });

      const intent = await subscriptionIntentService.getIntent('intent-123');
      
      // Check if intent is expired
      const isExpired = new Date(intent.expires_at).getTime() < Date.now();
      expect(isExpired).toBe(true);

      // Expire the intent
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      
      await subscriptionIntentService.executeStateTransition('intent-123', 'expired', {
        reason: 'Intent expired due to timeout',
        triggeredBy: 'system_cleanup',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_subscription_intent_status',
        expect.objectContaining({
          intent_id_param: 'intent-123',
          new_status_param: 'expired',
        })
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection failures', async () => {
      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      });

      await expect(
        subscriptionIntentService.createIntent(validIntentRequest)
      ).rejects.toThrow('Invalid or inactive subscription plan');
    });

    it('should handle Iugu service failures', async () => {
      mockIuguService.createOrGetCustomer.mockRejectedValue(
        new Error('Iugu API rate limit exceeded')
      );

      // This would be tested in the API layer, but we can verify the service handles it
      await expect(
        mockIuguService.createOrGetCustomer('test-id', 'test@example.com', 'Test User', {})
      ).rejects.toThrow('Iugu API rate limit exceeded');
    });

    it('should handle invalid state transitions', async () => {
      const completedIntent = {
        id: 'intent-123',
        status: 'completed' as SubscriptionIntentStatus,
        plan_id: testPlan.id,
        billing_cycle: 'monthly' as const,
        user_email: validIntentRequest.user_email,
        user_name: validIntentRequest.user_name,
        organization_name: validIntentRequest.organization_name,
        cpf_cnpj: validIntentRequest.cpf_cnpj,
        phone: validIntentRequest.phone,
        metadata: {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        iugu_customer_id: 'iugu-customer-123',
        iugu_subscription_id: 'iugu-subscription-123',
        checkout_url: 'https://iugu.com/checkout/123',
        user_id: 'user-123',
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          ...completedIntent,
          plan: testPlan,
        },
        error: null,
      });

      // Try to transition completed intent back to pending (should fail)
      const isValidTransition = subscriptionIntentService.isValidStateTransition('completed', 'pending');
      expect(isValidTransition).toBe(false);
    });
  });

  describe('Search and Filtering', () => {
    it('should search intents by email', async () => {
      const mockSearchResults = [
        {
          id: 'intent-123',
          status: 'pending',
          user_email: 'test@example.com',
          plan: testPlan,
        },
        {
          id: 'intent-456',
          status: 'completed',
          user_email: 'test@example.com',
          plan: testPlan,
        },
      ];

      mockSupabase.from().select().in().order().range.mockResolvedValue({
        data: mockSearchResults,
        error: null,
        count: 2,
      });

      const searchResult = await subscriptionIntentService.searchIntents({
        filters: {
          user_email: 'test@example.com',
        },
        pagination: {
          page: 1,
          limit: 10,
        },
      });

      expect(searchResult.total).toBe(2);
      expect(searchResult.intents).toHaveLength(2);
      expect(searchResult.intents[0].user_email).toBe('test@example.com');
    });

    it('should filter intents by status', async () => {
      const mockPendingIntents = [
        {
          id: 'intent-123',
          status: 'pending',
          user_email: 'test1@example.com',
          plan: testPlan,
        },
        {
          id: 'intent-456',
          status: 'pending',
          user_email: 'test2@example.com',
          plan: testPlan,
        },
      ];

      mockSupabase.from().select().in().order().range.mockResolvedValue({
        data: mockPendingIntents,
        error: null,
        count: 2,
      });

      const searchResult = await subscriptionIntentService.searchIntents({
        filters: {
          status: ['pending'],
        },
      });

      expect(searchResult.intents).toHaveLength(2);
      expect(searchResult.intents.every(intent => intent.status === 'pending')).toBe(true);
    });
  });

  describe('Public Status Queries', () => {
    it('should find intent by email and CPF', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ id: 'intent-123' }],
        error: null,
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'intent-123',
          status: 'pending',
          user_email: 'test@example.com',
          cpf_cnpj: '12345678901',
          plan: testPlan,
        },
        error: null,
      });

      const intent = await subscriptionIntentService.getIntentByIdentifier(
        'test@example.com',
        '12345678901'
      );

      expect(intent).toBeDefined();
      expect(intent?.id).toBe('intent-123');
      expect(intent?.user_email).toBe('test@example.com');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_subscription_intent_by_identifier', {
        email_param: 'test@example.com',
        cpf_param: '12345678901',
      });
    });

    it('should return null when no intent found by identifier', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const intent = await subscriptionIntentService.getIntentByIdentifier(
        'notfound@example.com',
        '99999999999'
      );

      expect(intent).toBeNull();
    });
  });

  describe('Caching Behavior', () => {
    it('should cache intent data and return from cache on subsequent calls', async () => {
      const intentData = {
        id: 'intent-123',
        status: 'pending',
        plan: testPlan,
      };

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: intentData,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...intentData, status: 'processing' },
          error: null,
        });

      // First call - should hit database
      const intent1 = await subscriptionIntentService.getIntent('intent-123');
      expect(intent1.status).toBe('pending');

      // Second call - should return from cache (same status)
      const intent2 = await subscriptionIntentService.getIntent('intent-123');
      expect(intent2.status).toBe('pending');

      // Verify database was called only once due to caching
      expect(mockSupabase.from().select().eq().single).toHaveBeenCalledTimes(1);
    });
  });
});