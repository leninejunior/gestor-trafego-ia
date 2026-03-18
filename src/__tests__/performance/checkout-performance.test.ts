/**
 * Performance tests for Checkout APIs
 * Tests response times, throughput, and resource usage under various load conditions
 * Requirements: 1.1, 1.2, 5.3
 */

import { NextRequest } from 'next/server';
import { POST as checkoutPost } from '@/app/api/subscriptions/checkout-iugu/route';
import { GET as statusGet } from '@/app/api/subscriptions/status/[intentId]/route';
import { POST as publicStatusPost } from '@/app/api/subscriptions/status/public/route';

// Mock dependencies for performance testing
jest.mock('@/lib/services/subscription-intent-service');
jest.mock('@/lib/iugu/iugu-service');

const mockSubscriptionIntentService = {
  createIntent: jest.fn(),
  getIntent: jest.fn(),
  updateIntent: jest.fn(),
  getIntentByIdentifier: jest.fn(),
  getTransitionHistory: jest.fn(),
  getNextStates: jest.fn(),
  isFinalState: jest.fn(),
};

const mockIuguService = {
  createOrGetCustomer: jest.fn(),
  createOrUpdatePlan: jest.fn(),
  createCheckoutUrl: jest.fn(),
};

jest.mock('@/lib/services/subscription-intent-service', () => ({
  getSubscriptionIntentService: () => mockSubscriptionIntentService,
}));

jest.mock('@/lib/iugu/iugu-service', () => ({
  IuguService: jest.fn(() => mockIuguService),
}));

// Test data
const validCheckoutData = {
  plan_id: '123e4567-e89b-12d3-a456-426614174000',
  billing_cycle: 'monthly' as const,
  user_email: 'test@example.com',
  user_name: 'Test User',
  organization_name: 'Test Organization',
  cpf_cnpj: '12345678901',
  phone: '+5511999999999',
};

const mockIntent = {
  id: 'intent-123',
  plan_id: validCheckoutData.plan_id,
  billing_cycle: validCheckoutData.billing_cycle,
  status: 'pending' as const,
  user_email: validCheckoutData.user_email,
  user_name: validCheckoutData.user_name,
  organization_name: validCheckoutData.organization_name,
  cpf_cnpj: validCheckoutData.cpf_cnpj,
  phone: validCheckoutData.phone,
  iugu_customer_id: 'iugu-customer-123',
  iugu_subscription_id: null,
  checkout_url: 'https://iugu.com/checkout/123',
  user_id: null,
  metadata: {},
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  completed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  plan: {
    id: validCheckoutData.plan_id,
    name: 'Test Plan',
    description: 'Test plan description',
    monthly_price: 99.99,
    annual_price: 999.99,
    features: {},
  },
};

// Performance test utilities
const measureExecutionTime = async (fn: () => Promise<any>): Promise<{ result: any; duration: number }> => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  return { result, duration };
};

const runConcurrentRequests = async (
  requestFactory: () => Promise<any>,
  concurrency: number,
  iterations: number = 1
): Promise<{ results: any[]; durations: number[]; avgDuration: number; maxDuration: number; minDuration: number }> => {
  const allPromises: Promise<{ result: any; duration: number }>[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const batch = Array.from({ length: concurrency }, () => 
      measureExecutionTime(requestFactory)
    );
    allPromises.push(...batch);
  }
  
  const results = await Promise.all(allPromises);
  const durations = results.map(r => r.duration);
  
  return {
    results: results.map(r => r.result),
    durations,
    avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
  };
};

describe('Checkout Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup fast mock responses for performance testing
    mockSubscriptionIntentService.createIntent.mockResolvedValue({
      success: true,
      intent_id: 'intent-123',
      status_url: 'http://localhost:3000/checkout/status/intent-123',
      expires_at: mockIntent.expires_at,
    });
    
    mockSubscriptionIntentService.getIntent.mockResolvedValue(mockIntent);
    mockSubscriptionIntentService.getIntentByIdentifier.mockResolvedValue(mockIntent);
    mockSubscriptionIntentService.getTransitionHistory.mockResolvedValue([]);
    mockSubscriptionIntentService.getNextStates.mockReturnValue(['processing', 'expired']);
    mockSubscriptionIntentService.isFinalState.mockReturnValue(false);
    
    mockIuguService.createOrGetCustomer.mockResolvedValue({
      id: 'iugu-customer-123',
      email: validCheckoutData.user_email,
      name: validCheckoutData.user_name,
    });
    
    mockIuguService.createOrUpdatePlan.mockResolvedValue({
      identifier: 'test-plan-monthly',
      name: 'Test Plan',
    });
    
    mockIuguService.createCheckoutUrl.mockResolvedValue('https://iugu.com/checkout/123');
  });

  describe('Checkout API Performance', () => {
    it('should complete checkout request within acceptable time limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const { result, duration } = await measureExecutionTime(() => checkoutPost(request));
      
      expect(result.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      const data = await result.json();
      expect(data.success).toBe(true);
      expect(data.metadata.processing_time_ms).toBeLessThan(1000);
    });

    it('should handle concurrent checkout requests efficiently', async () => {
      const createRequest = () => {
        const uniqueEmail = `test${Math.random()}@example.com`;
        return checkoutPost(new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
          method: 'POST',
          body: JSON.stringify({
            ...validCheckoutData,
            user_email: uniqueEmail,
          }),
          headers: {
            'content-type': 'application/json',
          },
        }));
      };

      const { results, durations, avgDuration, maxDuration } = await runConcurrentRequests(
        createRequest,
        10, // 10 concurrent requests
        1
      );

      // All requests should succeed
      for (const result of results) {
        expect(result.status).toBe(200);
        const data = await result.json();
        expect(data.success).toBe(true);
      }

      // Performance assertions
      expect(avgDuration).toBeLessThan(2000); // Average under 2 seconds
      expect(maxDuration).toBeLessThan(5000); // Max under 5 seconds
      
      console.log(`Concurrent checkout performance:
        - Average duration: ${avgDuration.toFixed(2)}ms
        - Max duration: ${maxDuration.toFixed(2)}ms
        - Requests processed: ${results.length}`);
    });

    it('should maintain performance under sustained load', async () => {
      const createRequest = () => {
        const uniqueEmail = `load-test-${Math.random()}@example.com`;
        return checkoutPost(new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
          method: 'POST',
          body: JSON.stringify({
            ...validCheckoutData,
            user_email: uniqueEmail,
          }),
          headers: {
            'content-type': 'application/json',
          },
        }));
      };

      const { results, durations, avgDuration } = await runConcurrentRequests(
        createRequest,
        5, // 5 concurrent requests
        10 // 10 iterations = 50 total requests
      );

      // All requests should succeed
      expect(results.every(async (result) => {
        const data = await result.json();
        return result.status === 200 && data.success === true;
      })).toBeTruthy();

      // Performance should remain consistent
      expect(avgDuration).toBeLessThan(3000); // Average under 3 seconds under load
      
      console.log(`Sustained load performance:
        - Total requests: ${results.length}
        - Average duration: ${avgDuration.toFixed(2)}ms
        - Success rate: 100%`);
    });
  });

  describe('Status API Performance', () => {
    it('should retrieve status quickly', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/intent-123');
      
      const { result, duration } = await measureExecutionTime(() => 
        statusGet(request, { params: { intentId: 'intent-123' } })
      );

      expect(result.status).toBe(200);
      expect(duration).toBeLessThan(500); // Should be very fast for status queries
      
      const data = await result.json();
      expect(data.success).toBe(true);
      expect(data.intent_id).toBe('intent-123');
    });

    it('should handle concurrent status queries efficiently', async () => {
      const createStatusRequest = () => {
        const request = new NextRequest('http://localhost:3000/api/subscriptions/status/intent-123');
        return statusGet(request, { params: { intentId: 'intent-123' } });
      };

      const { results, avgDuration, maxDuration } = await runConcurrentRequests(
        createStatusRequest,
        20, // 20 concurrent status queries
        1
      );

      // All requests should succeed
      for (const result of results) {
        expect(result.status).toBe(200);
        const data = await result.json();
        expect(data.success).toBe(true);
      }

      // Status queries should be very fast
      expect(avgDuration).toBeLessThan(200); // Average under 200ms
      expect(maxDuration).toBeLessThan(1000); // Max under 1 second
      
      console.log(`Status query performance:
        - Average duration: ${avgDuration.toFixed(2)}ms
        - Max duration: ${maxDuration.toFixed(2)}ms`);
    });
  });

  describe('Public Status API Performance', () => {
    it('should handle public status queries efficiently', async () => {
      const request = new NextRequest('http://localhost:3000/api/subscriptions/status/public', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          cpf_cnpj: '12345678901',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const { result, duration } = await measureExecutionTime(() => publicStatusPost(request));

      expect(result.status).toBe(200);
      expect(duration).toBeLessThan(800); // Should complete within 800ms
      
      const data = await result.json();
      expect(data.success).toBe(true);
      expect(data.subscription).toBeDefined();
    });

    it('should maintain performance for public queries under load', async () => {
      const createPublicStatusRequest = () => {
        const uniqueEmail = `public-test-${Math.random()}@example.com`;
        mockSubscriptionIntentService.getIntentByIdentifier.mockResolvedValue({
          ...mockIntent,
          user_email: uniqueEmail,
        });
        
        return publicStatusPost(new NextRequest('http://localhost:3000/api/subscriptions/status/public', {
          method: 'POST',
          body: JSON.stringify({
            email: uniqueEmail,
            cpf_cnpj: '12345678901',
          }),
          headers: {
            'content-type': 'application/json',
          },
        }));
      };

      const { results, avgDuration, maxDuration } = await runConcurrentRequests(
        createPublicStatusRequest,
        15, // 15 concurrent public queries
        2 // 2 iterations = 30 total requests
      );

      // All requests should succeed
      for (const result of results) {
        expect(result.status).toBe(200);
        const data = await result.json();
        expect(data.success).toBe(true);
      }

      expect(avgDuration).toBeLessThan(1000); // Average under 1 second
      expect(maxDuration).toBeLessThan(2000); // Max under 2 seconds
      
      console.log(`Public status query performance:
        - Total requests: ${results.length}
        - Average duration: ${avgDuration.toFixed(2)}ms
        - Max duration: ${maxDuration.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not cause memory leaks during repeated requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many requests to test for memory leaks
      const createRequest = () => {
        const uniqueEmail = `memory-test-${Math.random()}@example.com`;
        return checkoutPost(new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
          method: 'POST',
          body: JSON.stringify({
            ...validCheckoutData,
            user_email: uniqueEmail,
          }),
          headers: {
            'content-type': 'application/json',
          },
        }));
      };

      await runConcurrentRequests(createRequest, 5, 20); // 100 total requests
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory usage:
        - Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle validation errors quickly', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          plan_id: 'invalid-uuid',
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const { result, duration } = await measureExecutionTime(() => checkoutPost(invalidRequest));

      expect(result.status).toBe(400);
      expect(duration).toBeLessThan(100); // Validation errors should be very fast
      
      const data = await result.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Dados de entrada inválidos');
    });

    it('should handle service errors efficiently', async () => {
      mockSubscriptionIntentService.createIntent.mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
        method: 'POST',
        body: JSON.stringify(validCheckoutData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const { result, duration } = await measureExecutionTime(() => checkoutPost(request));

      expect(result.status).toBe(500);
      expect(duration).toBeLessThan(1000); // Error handling should still be fast
      
      const data = await result.json();
      expect(data.success).toBe(false);
      expect(data.metadata.processing_time_ms).toBeLessThan(1000);
    });
  });

  describe('Rate Limiting Simulation', () => {
    it('should handle high request rates gracefully', async () => {
      const startTime = Date.now();
      
      // Simulate high request rate
      const createRequest = () => {
        const uniqueEmail = `rate-test-${Math.random()}@example.com`;
        return checkoutPost(new NextRequest('http://localhost:3000/api/subscriptions/checkout-iugu', {
          method: 'POST',
          body: JSON.stringify({
            ...validCheckoutData,
            user_email: uniqueEmail,
          }),
          headers: {
            'content-type': 'application/json',
          },
        }));
      };

      const { results, avgDuration } = await runConcurrentRequests(
        createRequest,
        25, // 25 concurrent requests (high load)
        1
      );

      const totalTime = Date.now() - startTime;
      const requestsPerSecond = (results.length / totalTime) * 1000;

      // All requests should succeed even under high load
      for (const result of results) {
        expect(result.status).toBe(200);
        const data = await result.json();
        expect(data.success).toBe(true);
      }

      console.log(`Rate limiting simulation:
        - Total requests: ${results.length}
        - Total time: ${totalTime}ms
        - Requests per second: ${requestsPerSecond.toFixed(2)}
        - Average duration: ${avgDuration.toFixed(2)}ms`);

      // Should handle at least 10 requests per second
      expect(requestsPerSecond).toBeGreaterThan(10);
    });
  });
});