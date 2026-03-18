/**
 * Circuit Breaker Tests
 * 
 * Tests for webhook circuit breaker functionality including
 * state transitions, failure thresholds, and recovery logic.
 * 
 * Requirements: 4.2, 8.1, 8.4
 */

import { WebhookCircuitBreaker, CircuitBreakerManager } from '@/lib/webhooks/circuit-breaker';
import { WebhookCircuitBreakerConfig } from '@/lib/types/webhook';

describe('WebhookCircuitBreaker', () => {
  let circuitBreaker: WebhookCircuitBreaker;
  let config: WebhookCircuitBreakerConfig;

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      resetTimeout: 1000, // 1 second for testing
      monitoringWindow: 5000, // 5 seconds for testing
    };
    circuitBreaker = new WebhookCircuitBreaker(config);
  });

  describe('Initial State', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should have zero metrics initially', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
      expect(metrics.state).toBe('closed');
    });
  });

  describe('Success Handling', () => {
    it('should execute successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successes).toBe(1);
      expect(metrics.failures).toBe(0);
    });

    it('should remain closed after successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(operation);
      await circuitBreaker.execute(operation);
      
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.canExecute()).toBe(true);
    });
  });

  describe('Failure Handling', () => {
    it('should track failures but remain closed below threshold', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Execute 2 failures (below threshold of 3)
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Test error');
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Test error');
      
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.canExecute()).toBe(true);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(2);
      expect(metrics.successes).toBe(0);
    });

    it('should open circuit breaker when failure threshold is reached', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Execute failures to reach threshold
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Test error');
      }
      
      expect(circuitBreaker.getState()).toBe('open');
      expect(circuitBreaker.canExecute()).toBe(false);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(config.failureThreshold);
    });

    it('should reject operations when circuit breaker is open', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Open the circuit breaker
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Test error');
      }
      
      // Now operations should be rejected immediately
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
      
      // Operation should not have been called
      expect(operation).toHaveBeenCalledTimes(config.failureThreshold);
    });
  });

  describe('Half-Open State and Recovery', () => {
    beforeEach(async () => {
      // Open the circuit breaker
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Test error');
      }
      expect(circuitBreaker.getState()).toBe('open');
    });

    it('should transition to half-open after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, config.resetTimeout + 100));
      
      expect(circuitBreaker.canExecute()).toBe(true);
      
      // Execute an operation to trigger half-open state
      const operation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(operation);
      
      // Should now be closed after successful operation
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should return to open state if operation fails in half-open', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, config.resetTimeout + 100));
      
      // Execute a failing operation
      const failingOperation = jest.fn().mockRejectedValue(new Error('Still failing'));
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Still failing');
      
      expect(circuitBreaker.getState()).toBe('open');
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should close circuit breaker after successful operation in half-open', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, config.resetTimeout + 100));
      
      // Execute a successful operation
      const successOperation = jest.fn().mockResolvedValue('recovered');
      const result = await circuitBreaker.execute(successOperation);
      
      expect(result).toBe('recovered');
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.canExecute()).toBe(true);
    });
  });

  describe('Manual Control', () => {
    it('should reset circuit breaker manually', async () => {
      // Open the circuit breaker
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Test error');
      }
      
      expect(circuitBreaker.getState()).toBe('open');
      
      // Reset manually
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.canExecute()).toBe(true);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });

    it('should force open circuit breaker manually', () => {
      expect(circuitBreaker.getState()).toBe('closed');
      
      circuitBreaker.forceOpen();
      
      expect(circuitBreaker.getState()).toBe('open');
      expect(circuitBreaker.canExecute()).toBe(false);
    });
  });

  describe('Metrics', () => {
    it('should track failure rate', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failingOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Execute mixed operations
      await circuitBreaker.execute(successOperation);
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await circuitBreaker.execute(successOperation);
      
      const failureRate = circuitBreaker.getFailureRate();
      expect(failureRate).toBeCloseTo(33.33, 1); // 1 failure out of 3 operations
    });

    it('should provide comprehensive metrics', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(operation);
      
      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('failures');
      expect(metrics).toHaveProperty('successes');
      expect(metrics).toHaveProperty('lastSuccessTime');
      expect(metrics.state).toBe('closed');
      expect(metrics.successes).toBe(1);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;
  let config: WebhookCircuitBreakerConfig;

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringWindow: 5000,
    };
    manager = new CircuitBreakerManager(config);
  });

  describe('Service Management', () => {
    it('should create circuit breakers for different services', () => {
      const cb1 = manager.getCircuitBreaker('service1');
      const cb2 = manager.getCircuitBreaker('service2');
      
      expect(cb1).toBeDefined();
      expect(cb2).toBeDefined();
      expect(cb1).not.toBe(cb2);
    });

    it('should reuse existing circuit breakers', () => {
      const cb1 = manager.getCircuitBreaker('service1');
      const cb2 = manager.getCircuitBreaker('service1');
      
      expect(cb1).toBe(cb2);
    });

    it('should execute operations with service-specific circuit breakers', async () => {
      const operation1 = jest.fn().mockResolvedValue('service1-result');
      const operation2 = jest.fn().mockResolvedValue('service2-result');
      
      const result1 = await manager.execute('service1', operation1);
      const result2 = await manager.execute('service2', operation2);
      
      expect(result1).toBe('service1-result');
      expect(result2).toBe('service2-result');
    });
  });

  describe('Monitoring', () => {
    it('should provide metrics for all services', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      await manager.execute('service1', operation);
      await manager.execute('service2', operation);
      
      const metrics = manager.getAllMetrics();
      
      expect(metrics).toHaveProperty('service1');
      expect(metrics).toHaveProperty('service2');
      expect(metrics.service1.successes).toBe(1);
      expect(metrics.service2.successes).toBe(1);
    });

    it('should provide health status for all services', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failingOperation = jest.fn().mockRejectedValue(new Error('error'));
      
      await manager.execute('healthy-service', successOperation);
      
      // Make unhealthy service fail enough to open circuit breaker
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(manager.execute('unhealthy-service', failingOperation)).rejects.toThrow();
      }
      
      const health = manager.getHealthStatus();
      
      expect(health['healthy-service'].healthy).toBe(true);
      expect(health['healthy-service'].state).toBe('closed');
      expect(health['unhealthy-service'].healthy).toBe(false);
      expect(health['unhealthy-service'].state).toBe('open');
    });

    it('should reset all circuit breakers', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('error'));
      
      // Open multiple circuit breakers
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(manager.execute('service1', failingOperation)).rejects.toThrow();
        await expect(manager.execute('service2', failingOperation)).rejects.toThrow();
      }
      
      const healthBefore = manager.getHealthStatus();
      expect(healthBefore.service1.healthy).toBe(false);
      expect(healthBefore.service2.healthy).toBe(false);
      
      manager.resetAll();
      
      const healthAfter = manager.getHealthStatus();
      expect(healthAfter.service1.healthy).toBe(true);
      expect(healthAfter.service2.healthy).toBe(true);
    });
  });
});