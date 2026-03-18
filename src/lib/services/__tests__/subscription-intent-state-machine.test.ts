/**
 * Subscription Intent State Machine Tests
 * 
 * Tests for state machine logic, transitions, validation, and audit logging.
 * 
 * Requirements: 2.1, 4.1
 */

import { SubscriptionIntentStateMachine } from '../subscription-intent-state-machine';
import {
  SubscriptionIntentStatus,
  SubscriptionIntentError,
  InvalidStateTransitionError,
} from '@/lib/types/subscription-intent';

// =============================================
// MOCKS
// =============================================

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// =============================================
// TEST DATA
// =============================================

const mockTransitionContext = {
  intentId: 'intent-123',
  fromStatus: 'pending' as SubscriptionIntentStatus,
  toStatus: 'processing' as SubscriptionIntentStatus,
  reason: 'Payment initiated',
  metadata: { iugu_customer_id: 'customer-123' },
  triggeredBy: 'user-123',
  timestamp: '2024-01-01T00:00:00Z',
};

const mockTransitionHistory = [
  {
    id: 'transition-1',
    intent_id: 'intent-123',
    from_status: 'pending',
    to_status: 'processing',
    reason: 'Payment initiated',
    metadata: {},
    success: true,
    triggered_by: 'user-123',
    created_at: '2024-01-01T00:00:00Z',
  },
];

// =============================================
// TEST SUITE
// =============================================

describe('SubscriptionIntentStateMachine', () => {
  let stateMachine: SubscriptionIntentStateMachine;

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    stateMachine = new SubscriptionIntentStateMachine(
      'https://test.supabase.co',
      'test-service-key'
    );
  });

  // =============================================
  // STATE VALIDATION TESTS
  // =============================================

  describe('State Validation', () => {
    it('should validate allowed transitions', () => {
      expect(stateMachine.isValidTransition('pending', 'processing')).toBe(true);
      expect(stateMachine.isValidTransition('pending', 'expired')).toBe(true);
      expect(stateMachine.isValidTransition('pending', 'failed')).toBe(true);
      expect(stateMachine.isValidTransition('pending', 'completed')).toBe(false);
    });

    it('should validate processing state transitions', () => {
      expect(stateMachine.isValidTransition('processing', 'completed')).toBe(true);
      expect(stateMachine.isValidTransition('processing', 'failed')).toBe(true);
      expect(stateMachine.isValidTransition('processing', 'expired')).toBe(true);
      expect(stateMachine.isValidTransition('processing', 'pending')).toBe(false);
    });

    it('should validate failed state transitions', () => {
      expect(stateMachine.isValidTransition('failed', 'pending')).toBe(true);
      expect(stateMachine.isValidTransition('failed', 'expired')).toBe(true);
      expect(stateMachine.isValidTransition('failed', 'processing')).toBe(false);
      expect(stateMachine.isValidTransition('failed', 'completed')).toBe(false);
    });

    it('should not allow transitions from final states', () => {
      expect(stateMachine.isValidTransition('completed', 'pending')).toBe(false);
      expect(stateMachine.isValidTransition('completed', 'processing')).toBe(false);
      expect(stateMachine.isValidTransition('expired', 'pending')).toBe(false);
      expect(stateMachine.isValidTransition('expired', 'processing')).toBe(false);
    });

    it('should identify final states correctly', () => {
      expect(stateMachine.isFinalState('completed')).toBe(true);
      expect(stateMachine.isFinalState('expired')).toBe(true);
      expect(stateMachine.isFinalState('pending')).toBe(false);
      expect(stateMachine.isFinalState('processing')).toBe(false);
      expect(stateMachine.isFinalState('failed')).toBe(false);
    });

    it('should return correct next states', () => {
      expect(stateMachine.getNextStates('pending')).toEqual(['processing', 'expired', 'failed']);
      expect(stateMachine.getNextStates('processing')).toEqual(['completed', 'failed', 'expired']);
      expect(stateMachine.getNextStates('failed')).toEqual(['pending', 'expired']);
      expect(stateMachine.getNextStates('completed')).toEqual([]);
      expect(stateMachine.getNextStates('expired')).toEqual([]);
    });
  });

  // =============================================
  // TRANSITION EXECUTION TESTS
  // =============================================

  describe('Transition Execution', () => {
    beforeEach(() => {
      // Mock successful database operations
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_email: 'test@example.com',
            user_name: 'Test User',
            organization_name: 'Test Org',
          },
          error: null,
        }),
      });
    });

    it('should execute valid transition successfully', async () => {
      const result = await stateMachine.executeTransition(mockTransitionContext);

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_intent_transitions');
    });

    it('should reject invalid transitions', async () => {
      const invalidContext = {
        ...mockTransitionContext,
        fromStatus: 'completed' as SubscriptionIntentStatus,
        toStatus: 'pending' as SubscriptionIntentStatus,
      };

      await expect(stateMachine.executeTransition(invalidContext)).rejects.toThrow(
        InvalidStateTransitionError
      );
    });

    it('should log successful transitions', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_email: 'test@example.com',
            user_name: 'Test User',
            organization_name: 'Test Org',
          },
          error: null,
        }),
      });

      await stateMachine.executeTransition(mockTransitionContext);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          intent_id: 'intent-123',
          from_status: 'pending',
          to_status: 'processing',
          reason: 'Payment initiated',
          success: true,
        })
      );
    });

    it('should log failed transitions', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_email: 'test@example.com',
            user_name: 'Test User',
            organization_name: 'Test Org',
          },
          error: null,
        }),
      });

      const invalidContext = {
        ...mockTransitionContext,
        fromStatus: 'completed' as SubscriptionIntentStatus,
        toStatus: 'pending' as SubscriptionIntentStatus,
      };

      try {
        await stateMachine.executeTransition(invalidContext);
      } catch (error) {
        // Expected to fail
      }

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          metadata: expect.objectContaining({
            error: expect.any(String),
          }),
        })
      );
    });
  });

  // =============================================
  // TRANSITION RULES TESTS
  // =============================================

  describe('Transition Rules', () => {
    beforeEach(() => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_email: 'test@example.com',
            user_name: 'Test User',
            organization_name: 'Test Org',
          },
          error: null,
        }),
      });
    });

    it('should enforce payment data requirement for pending->processing', async () => {
      const contextWithoutPaymentData = {
        ...mockTransitionContext,
        metadata: {}, // No payment data
      };

      await expect(stateMachine.executeTransition(contextWithoutPaymentData)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Payment processing requires'),
        })
      );
    });

    it('should allow pending->processing with checkout URL', async () => {
      const contextWithCheckoutUrl = {
        ...mockTransitionContext,
        metadata: { checkout_url: 'https://checkout.example.com' },
      };

      const result = await stateMachine.executeTransition(contextWithCheckoutUrl);
      expect(result).toBe(true);
    });

    it('should enforce subscription ID requirement for processing->completed', async () => {
      const contextWithoutSubscriptionId = {
        ...mockTransitionContext,
        fromStatus: 'processing' as SubscriptionIntentStatus,
        toStatus: 'completed' as SubscriptionIntentStatus,
        metadata: {}, // No subscription ID
      };

      await expect(stateMachine.executeTransition(contextWithoutSubscriptionId)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Completion requires Iugu subscription ID'),
        })
      );
    });

    it('should allow processing->completed with subscription ID', async () => {
      const contextWithSubscriptionId = {
        ...mockTransitionContext,
        fromStatus: 'processing' as SubscriptionIntentStatus,
        toStatus: 'completed' as SubscriptionIntentStatus,
        metadata: { iugu_subscription_id: 'sub-123' },
      };

      const result = await stateMachine.executeTransition(contextWithSubscriptionId);
      expect(result).toBe(true);
    });

    it('should require reason for failed transitions', async () => {
      const contextWithoutReason = {
        ...mockTransitionContext,
        toStatus: 'failed' as SubscriptionIntentStatus,
        reason: undefined,
      };

      await expect(stateMachine.executeTransition(contextWithoutReason)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Reason is required'),
        })
      );
    });

    it('should allow failed transitions with reason', async () => {
      const contextWithReason = {
        ...mockTransitionContext,
        toStatus: 'failed' as SubscriptionIntentStatus,
        reason: 'Payment declined',
      };

      const result = await stateMachine.executeTransition(contextWithReason);
      expect(result).toBe(true);
    });
  });

  // =============================================
  // TRANSITION HISTORY TESTS
  // =============================================

  describe('Transition History', () => {
    it('should get transition history successfully', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockTransitionHistory,
          error: null,
        }),
      });

      const history = await stateMachine.getTransitionHistory('intent-123');

      expect(history).toEqual(mockTransitionHistory);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_intent_transitions');
    });

    it('should handle empty history', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const history = await stateMachine.getTransitionHistory('intent-123');

      expect(history).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(stateMachine.getTransitionHistory('intent-123')).rejects.toThrow(
        SubscriptionIntentError
      );
    });
  });

  // =============================================
  // CONTEXT CREATION TESTS
  // =============================================

  describe('Context Creation', () => {
    it('should create transition context with all fields', () => {
      const context = stateMachine.createTransitionContext(
        'intent-123',
        'pending',
        'processing',
        {
          reason: 'Payment started',
          metadata: { test: 'data' },
          triggeredBy: 'user-123',
        }
      );

      expect(context).toEqual({
        intentId: 'intent-123',
        fromStatus: 'pending',
        toStatus: 'processing',
        reason: 'Payment started',
        metadata: { test: 'data' },
        triggeredBy: 'user-123',
        timestamp: expect.any(String),
      });
    });

    it('should create context with minimal fields', () => {
      const context = stateMachine.createTransitionContext(
        'intent-123',
        'pending',
        'processing'
      );

      expect(context).toEqual({
        intentId: 'intent-123',
        fromStatus: 'pending',
        toStatus: 'processing',
        reason: undefined,
        metadata: undefined,
        triggeredBy: undefined,
        timestamp: expect.any(String),
      });
    });
  });

  // =============================================
  // CONFIGURATION TESTS
  // =============================================

  describe('Configuration', () => {
    it('should return state machine configuration', () => {
      const config = stateMachine.getConfig();

      expect(config).toHaveProperty('transitions');
      expect(config).toHaveProperty('finalStates');
      expect(config.finalStates).toEqual(['completed', 'expired']);
    });

    it('should return transition rules', () => {
      const rules = stateMachine.getTransitionRules();

      expect(rules).toBeInstanceOf(Map);
      expect(rules.has('pending->processing')).toBe(true);
      expect(rules.has('processing->completed')).toBe(true);
      expect(rules.has('failed->pending')).toBe(true);
    });
  });

  // =============================================
  // NOTIFICATION TESTS
  // =============================================

  describe('Notifications', () => {
    beforeEach(() => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_email: 'test@example.com',
            user_name: 'Test User',
            organization_name: 'Test Org',
          },
          error: null,
        }),
      });
    });

    it('should trigger notifications for completed transitions', async () => {
      const completedContext = {
        ...mockTransitionContext,
        fromStatus: 'processing' as SubscriptionIntentStatus,
        toStatus: 'completed' as SubscriptionIntentStatus,
        metadata: { iugu_subscription_id: 'sub-123' },
      };

      await stateMachine.executeTransition(completedContext);

      // Should log both transition and notification events
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'notification.payment_completed',
        })
      );
    });

    it('should trigger notifications for failed transitions', async () => {
      const failedContext = {
        ...mockTransitionContext,
        toStatus: 'failed' as SubscriptionIntentStatus,
        reason: 'Payment declined',
      };

      await stateMachine.executeTransition(failedContext);

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'notification.payment_failed',
        })
      );
    });

    it('should trigger account creation for completed transitions', async () => {
      const completedContext = {
        ...mockTransitionContext,
        fromStatus: 'processing' as SubscriptionIntentStatus,
        toStatus: 'completed' as SubscriptionIntentStatus,
        metadata: { iugu_subscription_id: 'sub-123' },
      };

      await stateMachine.executeTransition(completedContext);

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'account.creation_triggered',
        })
      );
    });
  });

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(stateMachine.executeTransition(mockTransitionContext)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle logging failures gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: { message: 'Log insert failed' } }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_email: 'test@example.com',
            user_name: 'Test User',
            organization_name: 'Test Org',
          },
          error: null,
        }),
      });

      // Should not throw even if logging fails
      const result = await stateMachine.executeTransition(mockTransitionContext);
      expect(result).toBe(true);
    });
  });
});