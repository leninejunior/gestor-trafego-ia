/**
 * Subscription Intent Expiration Service Tests
 * 
 * Tests for expiration processing, cleanup, notifications, and metrics.
 * 
 * Requirements: 5.1, 6.3
 */

import { SubscriptionIntentExpirationService } from '../subscription-intent-expiration-service';
import { SubscriptionIntentService } from '../subscription-intent-service';
import {
  SubscriptionIntent,
  SubscriptionIntentError,
} from '@/lib/types/subscription-intent';

// =============================================
// MOCKS
// =============================================

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockIntentService = {
  executeStateTransition: jest.fn(),
  updateIntent: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('../subscription-intent-service', () => ({
  SubscriptionIntentService: jest.fn(() => mockIntentService),
  createSubscriptionIntentService: jest.fn(() => mockIntentService),
}));

// =============================================
// TEST DATA
// =============================================

const mockExpiredIntent: SubscriptionIntent = {
  id: 'intent-123',
  plan_id: 'plan-123',
  billing_cycle: 'monthly',
  status: 'pending',
  user_email: 'test@example.com',
  user_name: 'Test User',
  organization_name: 'Test Org',
  cpf_cnpj: null,
  phone: null,
  iugu_customer_id: null,
  iugu_subscription_id: null,
  checkout_url: 'https://checkout.example.com',
  user_id: null,
  metadata: {},
  expires_at: '2024-01-01T00:00:00Z', // Past date
  completed_at: null,
  created_at: '2023-12-25T00:00:00Z',
  updated_at: '2023-12-25T00:00:00Z',
};

const mockExpiringSoonIntent: SubscriptionIntent = {
  ...mockExpiredIntent,
  id: 'intent-456',
  expires_at: '2024-01-02T00:00:00Z', // Tomorrow
  metadata: {}, // No warning sent yet
};

// =============================================
// TEST SUITE
// =============================================

describe('SubscriptionIntentExpirationService', () => {
  let expirationService: SubscriptionIntentExpirationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock current date to 2024-01-01
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    expirationService = new SubscriptionIntentExpirationService(
      'https://test.supabase.co',
      'test-service-key',
      {
        defaultExpirationDays: 7,
        warningDays: 1,
        batchSize: 100,
        notificationEnabled: true,
        cleanupRetentionDays: 30,
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =============================================
  // EXPIRATION PROCESSING TESTS
  // =============================================

  describe('processExpiredIntents', () => {
    beforeEach(() => {
      // Mock database queries
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockExpiredIntent],
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      // Mock intent service
      mockIntentService.executeStateTransition.mockResolvedValue({
        ...mockExpiredIntent,
        status: 'expired',
      });
    });

    it('should process expired intents successfully', async () => {
      const result = await expirationService.processExpiredIntents();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(1);
      expect(result.error_count).toBe(0);
      expect(mockIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-123',
        'expired',
        expect.objectContaining({
          reason: 'Automatic expiration due to timeout',
          triggeredBy: 'expiration_service',
        })
      );
    });

    it('should handle errors during processing', async () => {
      mockIntentService.executeStateTransition.mockRejectedValueOnce(
        new Error('State transition failed')
      );

      const result = await expirationService.processExpiredIntents();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(0);
      expect(result.error_count).toBe(1);
    });

    it('should send expiration notifications', async () => {
      await expirationService.processExpiredIntents();

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'notification.expiration_expired',
          payload: expect.objectContaining({
            intent_id: 'intent-123',
            user_email: 'test@example.com',
            notification_type: 'expired',
          }),
        })
      );
    });

    it('should handle database query errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const result = await expirationService.processExpiredIntents();

      expect(result.status).toBe('failed');
      expect(result.error_message).toContain('Database error');
    });

    it('should log job execution', async () => {
      await expirationService.processExpiredIntents();

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'expiration.job_expire',
          payload: expect.objectContaining({
            status: 'completed',
            processed_count: 1,
            error_count: 0,
          }),
        })
      );
    });
  });

  // =============================================
  // WARNING NOTIFICATIONS TESTS
  // =============================================

  describe('processExpirationWarnings', () => {
    beforeEach(() => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockExpiringSoonIntent],
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      mockIntentService.updateIntent.mockResolvedValue({
        ...mockExpiringSoonIntent,
        metadata: { expiration_warning_sent: true },
      });
    });

    it('should process expiration warnings successfully', async () => {
      const result = await expirationService.processExpirationWarnings();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(1);
      expect(result.error_count).toBe(0);
    });

    it('should send warning notifications', async () => {
      await expirationService.processExpirationWarnings();

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'notification.expiration_warning',
          payload: expect.objectContaining({
            intent_id: 'intent-456',
            user_email: 'test@example.com',
            notification_type: 'warning',
            days_until_expiration: 1,
          }),
        })
      );
    });

    it('should mark intents as warned', async () => {
      await expirationService.processExpirationWarnings();

      expect(mockIntentService.updateIntent).toHaveBeenCalledWith(
        'intent-456',
        expect.objectContaining({
          metadata: expect.objectContaining({
            expiration_warning_sent: true,
            expiration_warning_sent_at: expect.any(String),
          }),
        })
      );
    });

    it('should skip when notifications are disabled', async () => {
      const serviceWithoutNotifications = new SubscriptionIntentExpirationService(
        'https://test.supabase.co',
        'test-service-key',
        { notificationEnabled: false }
      );

      const result = await serviceWithoutNotifications.processExpirationWarnings();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(0);
      expect(mockSupabaseClient.from().insert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'notification.expiration_warning',
        })
      );
    });

    it('should handle errors during warning processing', async () => {
      mockIntentService.updateIntent.mockRejectedValueOnce(
        new Error('Update failed')
      );

      const result = await expirationService.processExpirationWarnings();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(0);
      expect(result.error_count).toBe(1);
    });
  });

  // =============================================
  // CLEANUP TESTS
  // =============================================

  describe('processExpiredIntentCleanup', () => {
    it('should process cleanup successfully', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: 5, // 5 intents cleaned up
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const result = await expirationService.processExpiredIntentCleanup();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(5);
      expect(result.error_count).toBe(0);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('cleanup_expired_subscription_intents');
    });

    it('should handle cleanup database errors', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Cleanup failed' },
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const result = await expirationService.processExpiredIntentCleanup();

      expect(result.status).toBe('failed');
      expect(result.error_message).toContain('Cleanup failed');
    });
  });

  // =============================================
  // METRICS TESTS
  // =============================================

  describe('getExpirationMetrics', () => {
    beforeEach(() => {
      // Mock multiple database queries for metrics
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ count: 10 }), // total expired
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ count: 2 }), // expired today
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          gt: jest.fn().mockResolvedValue({ count: 3 }), // expiring soon
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lt: jest.fn().mockResolvedValue({ count: 1 }), // cleanup candidates
        })
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({ count: 50 }), // total intents
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [
              {
                created_at: '2023-12-25T00:00:00Z',
                expires_at: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
    });

    it('should calculate metrics correctly', async () => {
      const metrics = await expirationService.getExpirationMetrics();

      expect(metrics).toEqual({
        total_expired: 10,
        expired_today: 2,
        expiring_soon: 3,
        cleanup_candidates: 1,
        abandonment_rate: 20, // 10/50 * 100
        average_time_to_expiration: 168, // 7 days in hours
      });
    });

    it('should handle empty data gracefully', async () => {
      // Mock all queries returning 0 or empty
      mockSupabaseClient.from
        .mockReturnValue({
          select: jest.fn().mockResolvedValue({ count: 0 }),
        });

      const metrics = await expirationService.getExpirationMetrics();

      expect(metrics.total_expired).toBe(0);
      expect(metrics.abandonment_rate).toBe(0);
      expect(metrics.average_time_to_expiration).toBe(0);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(expirationService.getExpirationMetrics()).rejects.toThrow(
        SubscriptionIntentError
      );
    });
  });

  // =============================================
  // CONFIGURATION TESTS
  // =============================================

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = expirationService.getConfig();

      expect(config).toEqual({
        defaultExpirationDays: 7,
        warningDays: 1,
        batchSize: 100,
        notificationEnabled: true,
        cleanupRetentionDays: 30,
      });
    });

    it('should update configuration', () => {
      expirationService.updateConfig({
        warningDays: 2,
        batchSize: 50,
      });

      const config = expirationService.getConfig();

      expect(config.warningDays).toBe(2);
      expect(config.batchSize).toBe(50);
      expect(config.defaultExpirationDays).toBe(7); // Unchanged
    });
  });

  // =============================================
  // INTEGRATION TESTS
  // =============================================

  describe('Integration Tests', () => {
    it('should handle complete expiration workflow', async () => {
      // Mock expired intents query
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockExpiredIntent],
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      mockIntentService.executeStateTransition.mockResolvedValue({
        ...mockExpiredIntent,
        status: 'expired',
      });

      const result = await expirationService.processExpiredIntents();

      // Should execute state transition
      expect(mockIntentService.executeStateTransition).toHaveBeenCalledWith(
        'intent-123',
        'expired',
        expect.objectContaining({
          reason: 'Automatic expiration due to timeout',
          triggeredBy: 'expiration_service',
          metadata: expect.objectContaining({
            expired_at: expect.any(String),
            original_expires_at: '2024-01-01T00:00:00Z',
          }),
        })
      );

      // Should send notification
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'notification.expiration_expired',
        })
      );

      // Should log job execution
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'expiration.job_expire',
        })
      );

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(1);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock multiple intents, one fails
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [
            mockExpiredIntent,
            { ...mockExpiredIntent, id: 'intent-456' },
          ],
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      mockIntentService.executeStateTransition
        .mockResolvedValueOnce({ ...mockExpiredIntent, status: 'expired' })
        .mockRejectedValueOnce(new Error('Failed to expire'));

      const result = await expirationService.processExpiredIntents();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(1);
      expect(result.error_count).toBe(1);
    });
  });

  // =============================================
  // ERROR HANDLING TESTS
  // =============================================

  describe('Error Handling', () => {
    it('should handle unexpected errors in processExpiredIntents', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const result = await expirationService.processExpiredIntents();

      expect(result.status).toBe('failed');
      expect(result.error_message).toContain('Unexpected database error');
    });

    it('should handle notification failures gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [mockExpiredIntent],
          error: null,
        }),
        insert: jest.fn().mockRejectedValue(new Error('Notification failed')),
      });

      mockIntentService.executeStateTransition.mockResolvedValue({
        ...mockExpiredIntent,
        status: 'expired',
      });

      // Should not throw even if notification fails
      const result = await expirationService.processExpiredIntents();

      expect(result.status).toBe('completed');
      expect(result.processed_count).toBe(1);
    });
  });
});