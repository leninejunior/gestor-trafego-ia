import { CircuitBreaker, CircuitBreakerState } from '../domain/services/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      successThreshold: 2
    });
  });

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(0);
    });
  });

  describe('State Transitions', () => {
    it('should transition from CLOSED to OPEN after threshold failures', () => {
      // Registra falhas até o threshold
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.canExecute()).toBe(true);
      
      circuitBreaker.recordFailure(); // Terceira falha - deve abrir
      expect(circuitBreaker.canExecute()).toBe(false);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
      expect(metrics.consecutiveFailures).toBe(3);
    });

    it('should transition from OPEN to HALF_OPEN after recovery timeout', async () => {
      // Força estado OPEN
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      expect(circuitBreaker.canExecute()).toBe(false);
      
      // Simula passagem do tempo
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(circuitBreaker.canExecute()).toBe(true);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should transition from HALF_OPEN to CLOSED after success threshold', () => {
      // Força estado HALF_OPEN
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.HALF_OPEN);
      
      circuitBreaker.recordSuccess(); // Segunda success - deve fechar
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should transition from HALF_OPEN to OPEN on failure', () => {
      // Força estado HALF_OPEN
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      circuitBreaker.recordFailure();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.canExecute()).toBe(false);
    });
  });

  describe('Success Recording', () => {
    it('should reset consecutive failures on success', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      let metrics = circuitBreaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(2);
      
      circuitBreaker.recordSuccess();
      
      metrics = circuitBreaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should increment total requests on success', () => {
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.totalFailures).toBe(0);
      expect(metrics.failureRate).toBe(0);
    });
  });

  describe('Failure Recording', () => {
    it('should increment consecutive failures', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(2);
      expect(metrics.lastFailureTime).toBeDefined();
    });

    it('should calculate failure rate correctly', () => {
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(4);
      expect(metrics.totalFailures).toBe(2);
      expect(metrics.failureRate).toBe(50);
    });

    it('should reset consecutive successes on failure', () => {
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      circuitBreaker.recordSuccess();
      let metrics = circuitBreaker.getMetrics();
      expect(metrics.consecutiveSuccesses).toBe(1);
      
      circuitBreaker.recordFailure();
      metrics = circuitBreaker.getMetrics();
      expect(metrics.consecutiveSuccesses).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should provide accurate metrics', () => {
      const startTime = Date.now();
      
      circuitBreaker.recordSuccess();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.consecutiveFailures).toBe(2);
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalFailures).toBe(2);
      expect(metrics.failureRate).toBeCloseTo(66.67, 1);
      expect(metrics.lastStateChange.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(metrics.lastFailureTime).toBeDefined();
    });

    it('should handle zero requests correctly', () => {
      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalFailures).toBe(0);
      expect(metrics.failureRate).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customCircuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 2000,
        monitoringPeriod: 10000,
        successThreshold: 3
      });
      
      const config = customCircuitBreaker.getConfig();
      expect(config.failureThreshold).toBe(5);
      expect(config.recoveryTimeout).toBe(2000);
      expect(config.monitoringPeriod).toBe(10000);
      expect(config.successThreshold).toBe(3);
    });

    it('should update configuration', () => {
      circuitBreaker.updateConfig({
        failureThreshold: 5,
        recoveryTimeout: 2000
      });
      
      const config = circuitBreaker.getConfig();
      expect(config.failureThreshold).toBe(5);
      expect(config.recoveryTimeout).toBe(2000);
      // Outras configurações devem permanecer inalteradas
      expect(config.monitoringPeriod).toBe(5000);
      expect(config.successThreshold).toBe(2);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to initial state', () => {
      // Modifica o estado
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      expect(circuitBreaker.canExecute()).toBe(false);
      
      // Reset
      circuitBreaker.reset();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalFailures).toBe(0);
      expect(metrics.lastFailureTime).toBeUndefined();
      expect(circuitBreaker.canExecute()).toBe(true);
    });
  });

  describe('Force State', () => {
    it('should allow forcing state changes', () => {
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      
      expect(circuitBreaker.canExecute()).toBe(false);
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.OPEN);
      
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getMetrics().state).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });

  describe('Monitoring Period Reset', () => {
    it('should reset metrics after monitoring period', async () => {
      // Configura período curto para teste
      const shortPeriodCircuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000,
        monitoringPeriod: 100, // 100ms
        successThreshold: 2
      });
      
      shortPeriodCircuitBreaker.recordFailure();
      shortPeriodCircuitBreaker.recordSuccess();
      
      let metrics = shortPeriodCircuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      
      // Espera o período de monitoramento passar
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Próxima operação deve resetar as métricas do período
      shortPeriodCircuitBreaker.recordSuccess();
      
      metrics = shortPeriodCircuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(1); // Resetou e contou apenas a última
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid state changes correctly', () => {
      // Testa transições rápidas
      for (let i = 0; i < 10; i++) {
        circuitBreaker.recordFailure();
        circuitBreaker.recordSuccess();
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.consecutiveFailures).toBe(0);
    });

    it('should handle zero thresholds gracefully', () => {
      const zeroThresholdCircuitBreaker = new CircuitBreaker({
        failureThreshold: 0,
        recoveryTimeout: 1000,
        monitoringPeriod: 5000,
        successThreshold: 0
      });
      
      // Com threshold 0, qualquer falha deve abrir o circuito
      zeroThresholdCircuitBreaker.recordFailure();
      expect(zeroThresholdCircuitBreaker.canExecute()).toBe(false);
    });
  });
});