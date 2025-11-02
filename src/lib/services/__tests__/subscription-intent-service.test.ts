/**
 * Subscription Intent Service Tests
 * 
 * Comprehensive unit and integration tests for the SubscriptionIntentService.
 * Tests CRUD operations, state management, validation, and error handling.
 * 
 * Requirements: 1.3, 2.1
 */

import { SubscriptionIntentService } from '../subscription-intent-service';
import {
  SubscriptionIntent,
  CreateSubscriptionIntentRequest,
  UpdateSubscriptionIntentRequest,
  SubscriptionIntentStatus,
  SubscriptionIntentError,
  SubscriptionIntentValidationError,
  SubscriptionIntentNotFoundError,
  InvalidStateTransitionError,
} from '@/lib/types/subscription-intent';

// =============================================
// MOCKS
// =============================================

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

// Mock state machine
const mockStateMachine = {
  isValidTransition: jest.fn(),
  getNextStates: jest.fn(),
  isFinalState: jest.fn(),
  getTransitionHistory: jest.fn(),
  executeTransition: jest.fn(),
  createTransitionContext: jest.fn(),
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Mock state machine
jest.mock('../subscription-intent-state-machine', () => ({
  SubscriptionIntentStateMachine: jest.fn(() => mockStateMachine),
  createSubscriptionIntentStateMachine: jest.fn(() => mockStateMachine),
}));

// =============================================
// TEST DATA
// =============================================

const mockPlan = {
  id: 'plan-123',
  name: 'Pro Plan',
  monthly_price: 99.99,
  annual_price: 999.99,
  is_active: true,
};

const mockSubscriptionIntent: SubscriptionIntent = {
  id: 'intent-123',
  plan_id: 'plan-123',
  billing_cycle: 'monthly',
  status: 'pending',
  user_email: 'test@example.com',
  user_name: 'Test User',
  organization_name: 'Test Org',
  cpf_cnpj: '12345678901',
  phone: '11999999999',
  iugu_customer_id: null,
  iugu_subscription_id: null,
  checkout_url: null,
  user_id: null,
  metadata: {},
  expires_at: '2024-01-08T00:00:00Z',
  completed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const validCreateRequest: CreateSubscriptionIntentRequest = {
  plan_id: 'plan-123',
  billing_cycle: 'monthly',
  user_email: 'test@example.com',
  user_name: 'Test User',
  organization_name: 'Test Org',
  cpf_cnpj: '12345678901',
  phone: '11999999999',
  metadata: { source: 'test' },
};

// =============================================
// TEST SUITE
// =============================================

describe('SubscriptionIntentService', () => {
  let service: SubscriptionIntentService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.app.com';

    service = new SubscriptionIntentService(
      'https://test.supabase.co',
      'test-service-key'
    );
  });

  // =============================================
  // CRUD OPERATIONS TESTS
  // =============================================

  describe('createIntent', () => {
    it('should create a subscription intent successfully', async () => {
      // Mock plan validation
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPlan,
          error: null,
        }),
      });

      // Mock intent creation
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: 'intent-123',
        error: null,
      });

      const result = await service.createIntent(validCreateRequest);

      expect(result.success).toBe(true);
      expect(result.intent_id).toBe('intent-123');
      expect(result.status_url).toContain('/checkout/status/intent-123');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'create_subscription_intent',
        expect.objectContaining({
          plan_id_param: 'plan-123',
          billing_cycle_param: 'monthly',
          user_email_param: 'test@example.com',
        })
      );
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        user_email: '',
      };

      await expect(service.createIntent(invalidRequest)).rejects.toThrow(
        SubscriptionIntentValidationError
      );
    });

    it('should validate email format', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        user_email: 'invalid-email',
      };

      await expect(service.createIntent(invalidRequest)).rejects.toThrow(
        SubscriptionIntentValidationError
      );
    });

    it('should validate billing cycle', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        billing_cycle: 'invalid' as any,
      };

      await expect(service.createIntent(invalidRequest)).rejects.toThrow(
        SubscriptionIntentValidationError
      );
    });

    it('should handle inactive plan error', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Plan not found' },
        }),
      });

      await expect(service.createIntent(validCreateRequest)).rejects.toThrow(
        SubscriptionIntentError
      );
    });
  });

  describe('getIntent', () => {
    it('should get subscription intent successfully', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockSubscriptionIntent,
            plan: mockPlan,
          },
          error: null,
        }),
      });

      const result = await service.getIntent('intent-123');

      expect(result.id).toBe('intent-123');
      expect(result.plan).toEqual(mockPlan);
    });

    it('should throw error for non-existent intent', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      });

      await expect(service.getIntent('non-existent')).rejects.toThrow(
        SubscriptionIntentNotFoundError
      );
    });

    it('should use cache when available', async () => {
      // First call - should hit database
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockSubscriptionIntent,
            plan: mockPlan,
          },
          error: null,
        }),
      });

      const result1 = await service.getIntent('intent-123');

      // Second call - should use cache (no database call)
      const result2 = await service.getIntent('intent-123');

      expect(result1).toEqual(result2);
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateIntent', () => {
    beforeEach(() => {
      // Mock getIntent for current state
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockSubscriptionIntent,
            plan: mockPlan,
          },
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      });
    });

    it('should update non-status fields successfully', async () => {
      const updates: UpdateSubscriptionIntentRequest = {
        checkout_url: 'https://checkout.example.com',
        iugu_customer_id: 'customer-123',
      };

      mockSupabaseClient.from().update.mockResolvedValueOnce({
        error: null,
      });

      const result = await service.updateIntent('intent-123', updates);

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          checkout_url: 'https://checkout.example.com',
          iugu_customer_id: 'customer-123',
        })
      );
    });

    it('should handle status updates through state machine', async () => {
      const updates: UpdateSubscriptionIntentRequest = {
        status: 'processing',
      };

      mockStateMachine.createTransitionContext.mockReturnValue({
        intentId: 'intent-123',
        fromStatus: 'pending',
        toStatus: 'processing',
        timestamp: '2024-01-01T00:00:00Z',
      });

      mockStateMachine.executeTransition.mockResolvedValue(true);

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        error: null,
      });

      await service.updateIntent('intent-123', updates, {
        reason: 'Payment started',
        triggeredBy: 'user-123',
      });

      expect(mockStateMachine.executeTransition).toHaveBeenCalled();
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'update_subscription_intent_status',
        expect.objectContaining({
          intent_id_param: 'intent-123',
          new_status_param: 'processing',
        })
      );
    });
  });

  describe('deleteIntent', () => {
    it('should soft delete by marking as expired', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        error: null,
      });

      const result = await service.deleteIntent('intent-123');

      expect(result).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'update_subscription_intent_status',
        expect.objectContaining({
          intent_id_param: 'intent-123',
          new_status_param: 'expired',
        })
      );
    });
  });

  // =============================================
  // SEARCH AND FILTERING TESTS
  // =============================================

  describe('searchIntents', () => {
    it('should search with filters and pagination', async () => {
      const mockResults = [
        { ...mockSubscriptionIntent, plan: mockPlan },
      ];

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockResults,
          error: null,
          count: 1,
        }),
      });

      const result = await service.searchIntents({
        filters: {
          status: ['pending'],
          plan_id: 'plan-123',
        },
        pagination: {
          page: 1,
          limit: 10,
        },
      });

      expect(result.intents).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getIntentByIdentifier', () => {
    it('should find intent by email', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [{ id: 'intent-123' }],
        error: null,
      });

      // Mock getIntent call
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockSubscriptionIntent,
            plan: mockPlan,
          },
          error: null,
        }),
      });

      const result = await service.getIntentByIdentifier('test@example.com');

      expect(result).toBeTruthy();
      expect(result?.id).toBe('intent-123');
    });

    it('should return null when no intent found', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await service.getIntentByIdentifier('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  // =============================================
  // STATE MANAGEMENT TESTS
  // =============================================

  describe('State Management', () => {
    it('should validate state transitions', () => {
      mockStateMachine.isValidTransition.mockReturnValue(true);

      const isValid = service.isValidStateTransition('pending', 'processing');

      expect(isValid).toBe(true);
      expect(mockStateMachine.isValidTransition).toHaveBeenCalledWith('pending', 'processing');
    });

    it('should get next states', () => {
      mockStateMachine.getNextStates.mockReturnValue(['processing', 'expired']);

      const nextStates = service.getNextStates('pending');

      expect(nextStates).toEqual(['processing', 'expired']);
    });

    it('should check final states', () => {
      mockStateMachine.isFinalState.mockReturnValue(true);

      const isFinal = service.isFinalState('completed');

      expect(isFinal).toBe(true);
    });

    it('should get transition history', async () => {
      const mockHistory = [
        {
          id: 'transition-1',
          from_status: 'pending',
          to_status: 'processing',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockStateMachine.getTransitionHistory.mockResolvedValue(mockHistory);

      const history = await service.getTransitionHistory('intent-123');

      expect(history).toEqual(mockHistory);
    });

    it('should execute state transition', async () => {
      // Mock getIntent
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockSubscriptionIntent,
            plan: mockPlan,
          },
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      });

      mockStateMachine.createTransitionContext.mockReturnValue({
        intentId: 'intent-123',
        fromStatus: 'pending',
        toStatus: 'processing',
        timestamp: '2024-01-01T00:00:00Z',
      });

      mockStateMachine.executeTransition.mockResolvedValue(true);
      mockSupabaseClient.rpc.mockResolvedValue({ error: null });

      const result = await service.executeStateTransition('intent-123', 'processing', {
        reason: 'Payment started',
        triggeredBy: 'user-123',
      });

      expect(result.status).toBe('pending'); // Returns current state from mock
      expect(mockStateMachine.executeTransition).toHaveBeenCalled();
    });
  });

  // =============================================
  // VALIDATION TESTS
  // =============================================

  describe('Validation', () => {
    it('should validate email format', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        user_email: 'invalid-email',
      };

      await expect(service.createIntent(invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Invalid email format'),
        })
      );
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        user_name: '',
      };

      await expect(service.createIntent(invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('User name must be at least 2 characters'),
        })
      );
    });

    it('should validate billing cycle', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        billing_cycle: 'invalid' as any,
      };

      await expect(service.createIntent(invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Billing cycle must be monthly or annual'),
        })
      );
    });

    it('should validate phone format when provided', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        phone: 'invalid-phone',
      };

      // Mock plan validation to pass
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPlan,
          error: null,
        }),
      });

      await expect(service.createIntent(invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Invalid phone format'),
        })
      );
    });
  });

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      });

      await expect(service.createIntent(validCreateRequest)).rejects.toThrow(
        SubscriptionIntentError
      );
    });

    it('should handle unexpected errors', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      await expect(service.createIntent(validCreateRequest)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Unexpected error'),
        })
      );
    });
  });

  // =============================================
  // CACHE TESTS
  // =============================================

  describe('Cache Management', () => {
    it('should cache results after first fetch', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockSubscriptionIntent,
            plan: mockPlan,
          },
          error: null,
        }),
      });

      // First call
      await service.getIntent('intent-123');

      // Second call should use cache
      const result = await service.getIntent('intent-123');

      expect(result.id).toBe('intent-123');
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    });

    it('should clear cache after updates', async () => {
      // Mock initial getIntent
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...mockSubscriptionIntent,
            plan: mockPlan,
          },
          error: null,
        }),
        update: jest.fn().mockResolvedValue({ error: null }),
      });

      // First get to populate cache
      await service.getIntent('intent-123');

      // Update should clear cache
      await service.updateIntent('intent-123', { checkout_url: 'new-url' });

      // Next get should hit database again
      await service.getIntent('intent-123');

      // Should have been called 3 times (initial get, update get, final get)
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(3);
    });
  });
});