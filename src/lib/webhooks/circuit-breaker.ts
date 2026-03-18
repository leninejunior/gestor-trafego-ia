/**
 * Circuit Breaker Implementation
 * 
 * Implements circuit breaker pattern for webhook processing to prevent
 * cascading failures and provide graceful degradation.
 * 
 * Requirements: 4.2, 8.1, 8.4
 */

import { WebhookCircuitBreakerConfig, CircuitBreakerState, CircuitBreakerMetrics } from '@/lib/types/webhook';

/**
 * Circuit breaker for webhook processing
 */
export class WebhookCircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private nextRetryTime: number = 0;
  private config: WebhookCircuitBreakerConfig;

  constructor(config: WebhookCircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextRetryTime) {
        throw new Error('Circuit breaker is OPEN - operation rejected');
      }
      // Transition to half-open for testing
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'half-open') {
      // Reset circuit breaker after successful operation in half-open state
      this.state = 'closed';
      this.failures = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Go back to open state if operation fails in half-open
      this.state = 'open';
      this.nextRetryTime = Date.now() + this.config.resetTimeout;
    } else if (this.failures >= this.config.failureThreshold) {
      // Open circuit breaker if failure threshold is reached
      this.state = 'open';
      this.nextRetryTime = Date.now() + this.config.resetTimeout;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime || undefined,
      lastSuccessTime: this.lastSuccessTime || undefined,
      nextRetryTime: this.nextRetryTime || undefined,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if circuit breaker allows operation
   */
  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open' && Date.now() >= this.nextRetryTime) {
      return true; // Will transition to half-open
    }

    return this.state === 'half-open';
  }

  /**
   * Force reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.nextRetryTime = 0;
  }

  /**
   * Force open circuit breaker
   */
  forceOpen(): void {
    this.state = 'open';
    this.nextRetryTime = Date.now() + this.config.resetTimeout;
  }

  /**
   * Get failure rate within monitoring window
   */
  getFailureRate(): number {
    const windowStart = Date.now() - this.config.monitoringWindow;
    
    // Simple implementation - in production, you might want to track
    // failures within a sliding window more precisely
    if (this.lastFailureTime < windowStart && this.lastSuccessTime < windowStart) {
      return 0;
    }

    const totalOperations = this.failures + this.successes;
    if (totalOperations === 0) {
      return 0;
    }

    return (this.failures / totalOperations) * 100;
  }
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, WebhookCircuitBreaker> = new Map();
  private defaultConfig: WebhookCircuitBreakerConfig;

  constructor(defaultConfig: WebhookCircuitBreakerConfig) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create circuit breaker for service
   */
  getCircuitBreaker(
    serviceName: string, 
    config?: WebhookCircuitBreakerConfig
  ): WebhookCircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      const circuitBreaker = new WebhookCircuitBreaker(config || this.defaultConfig);
      this.circuitBreakers.set(serviceName, circuitBreaker);
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    config?: WebhookCircuitBreakerConfig
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, config);
    return circuitBreaker.execute(operation);
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      metrics[serviceName] = circuitBreaker.getMetrics();
    }
    
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  /**
   * Get health status of all services
   */
  getHealthStatus(): Record<string, { healthy: boolean; state: CircuitBreakerState }> {
    const status: Record<string, { healthy: boolean; state: CircuitBreakerState }> = {};
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      const state = circuitBreaker.getState();
      status[serviceName] = {
        healthy: state === 'closed',
        state,
      };
    }
    
    return status;
  }
}

// Singleton instance
let circuitBreakerManagerInstance: CircuitBreakerManager | null = null;

/**
 * Get singleton circuit breaker manager
 */
export function getCircuitBreakerManager(): CircuitBreakerManager {
  if (!circuitBreakerManagerInstance) {
    const defaultConfig: WebhookCircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringWindow: 300000, // 5 minutes
    };
    circuitBreakerManagerInstance = new CircuitBreakerManager(defaultConfig);
  }
  return circuitBreakerManagerInstance;
}