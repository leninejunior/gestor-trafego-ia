import { FailoverManager, FailoverStrategy } from '../domain/services/failover-manager';
import { CircuitBreakerState } from '../domain/services/circuit-breaker';
import { ProviderRegistry } from '../domain/services/provider-registry';
import { IPaymentProvider } from '../domain/interfaces/payment-provider.interface';
import { PaymentError, PaymentErrorType, ProviderStatus } from '../domain/types';

// Mock provider para testes
class MockProvider implements IPaymentProvider {
  constructor(
    public readonly name: string,
    public readonly version: string = '1.0.0',
    private shouldFail: boolean = false,
    private responseTime: number = 100
  ) {}

  async configure(): Promise<void> {}
  async validateConfig(): Promise<boolean> { return true; }
  async createPayment(): Promise<any> {
    await this.sleep(this.responseTime);
    if (this.shouldFail) {
      throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Mock failure', undefined, true);
    }
    return { id: 'payment_123', status: 'success' };
  }
  async capturePayment(): Promise<any> { return {}; }
  async refundPayment(): Promise<any> { return {}; }
  async createSubscription(): Promise<any> { return {}; }
  async updateSubscription(): Promise<any> { return {}; }
  async cancelSubscription(): Promise<any> { return {}; }
  validateWebhook(): boolean { return true; }
  parseWebhook(): any { return {}; }
  async healthCheck(): Promise<any> {
    return {
      status: this.shouldFail ? ProviderStatus.UNHEALTHY : ProviderStatus.HEALTHY,
      lastCheck: new Date()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setResponseTime(ms: number): void {
    this.responseTime = ms;
  }
}

describe('FailoverManager', () => {
  let failoverManager: FailoverManager;
  let providerRegistry: ProviderRegistry;
  let mockProvider1: MockProvider;
  let mockProvider2: MockProvider;
  let mockProvider3: MockProvider;

  beforeEach(() => {
    // Limpa singleton instances
    (FailoverManager as any).instance = undefined;
    (ProviderRegistry as any).instance = undefined;

    providerRegistry = ProviderRegistry.getInstance();
    mockProvider1 = new MockProvider('provider1');
    mockProvider2 = new MockProvider('provider2');
    mockProvider3 = new MockProvider('provider3');

    // Registra providers no registry
    (providerRegistry as any).providers.set('provider1', mockProvider1);
    (providerRegistry as any).providers.set('provider2', mockProvider2);
    (providerRegistry as any).providers.set('provider3', mockProvider3);

    failoverManager = FailoverManager.getInstance({
      strategy: FailoverStrategy.PRIORITY,
      maxRetries: 3,
      timeoutPerAttempt: 1000,
      retryInterval: 100,
      backoffMultiplier: 1.5
    });
  });

  afterEach(() => {
    failoverManager.resetAllMetrics();
  });

  describe('executeWithFailover', () => {
    it('should succeed with first provider when healthy', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await failoverManager.executeWithFailover(operation);

      expect(result.successfulProvider).toBe('provider1');
      expect(result.attemptsCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should failover to second provider when first fails', async () => {
      mockProvider1.setFailure(true);

      const operation = jest.fn()
        .mockRejectedValueOnce(new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Provider 1 failed', undefined, true))
        .mockResolvedValueOnce({ success: true });

      const result = await failoverManager.executeWithFailover(operation);

      expect(result.successfulProvider).toBe('provider2');
      expect(result.attemptsCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail when all providers fail', async () => {
      mockProvider1.setFailure(true);
      mockProvider2.setFailure(true);
      mockProvider3.setFailure(true);

      const operation = jest.fn()
        .mockRejectedValue(new PaymentError(PaymentErrorType.NETWORK_ERROR, 'All failed', undefined, true));

      await expect(failoverManager.executeWithFailover(operation))
        .rejects.toThrow(PaymentError);

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maxRetries configuration', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Always fails', undefined, true));

      await expect(failoverManager.executeWithFailover(operation, { maxRetries: 2 }))
        .rejects.toThrow(PaymentError);

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new PaymentError(PaymentErrorType.VALIDATION_ERROR, 'Invalid data', undefined, false));

      await expect(failoverManager.executeWithFailover(operation))
        .rejects.toThrow(PaymentError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use preferred provider first', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await failoverManager.executeWithFailover(operation, {
        preferredProvider: 'provider3'
      });

      expect(result.successfulProvider).toBe('provider3');
      expect(operation).toHaveBeenCalledWith(mockProvider3);
    });

    it('should handle timeout correctly', async () => {
      const operation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      await expect(failoverManager.executeWithFailover(operation, { timeout: 500 }))
        .rejects.toThrow('timed out');
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should skip providers with open circuit breaker', async () => {
      // Simula circuit breaker aberto para provider1
      const circuitBreaker = (failoverManager as any).getCircuitBreaker('provider1');
      circuitBreaker.forceState(CircuitBreakerState.OPEN);

      const operation = jest.fn().mockResolvedValue({ success: true });

      const result = await failoverManager.executeWithFailover(operation);

      expect(result.successfulProvider).toBe('provider2');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error.message).toContain('Circuit breaker is open');
    });

    it('should record success and failure in circuit breaker', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Fail', undefined, true))
        .mockResolvedValueOnce({ success: true });

      await failoverManager.executeWithFailover(operation);

      const circuitBreaker1 = (failoverManager as any).getCircuitBreaker('provider1');
      const circuitBreaker2 = (failoverManager as any).getCircuitBreaker('provider2');

      expect(circuitBreaker1.getMetrics().consecutiveFailures).toBe(1);
      expect(circuitBreaker2.getMetrics().consecutiveFailures).toBe(0);
    });
  });

  describe('Provider Metrics', () => {
    it('should track provider success metrics', async () => {
      const operation = jest.fn().mockResolvedValue({ success: true });

      await failoverManager.executeWithFailover(operation);

      const metrics = failoverManager.getProviderMetrics('provider1');
      expect(metrics).toBeDefined();
      expect(metrics!.successRate).toBe(100);
      expect(metrics!.totalRequests).toBe(1);
      expect(metrics!.successfulRequests).toBe(1);
    });

    it('should track provider failure metrics', async () => {
      mockProvider1.setFailure(true);
      const operation = jest.fn()
        .mockRejectedValueOnce(new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Fail', undefined, true))
        .mockResolvedValueOnce({ success: true });

      await failoverManager.executeWithFailover(operation);

      const metrics1 = failoverManager.getProviderMetrics('provider1');
      const metrics2 = failoverManager.getProviderMetrics('provider2');

      expect(metrics1!.successRate).toBe(0);
      expect(metrics1!.totalRequests).toBe(1);
      expect(metrics1!.successfulRequests).toBe(0);

      expect(metrics2!.successRate).toBe(100);
      expect(metrics2!.totalRequests).toBe(1);
      expect(metrics2!.successfulRequests).toBe(1);
    });
  });

  describe('Failover Strategies', () => {
    beforeEach(() => {
      // Configura diferentes tempos de resposta para testar ordenação
      mockProvider1.setResponseTime(300);
      mockProvider2.setResponseTime(100);
      mockProvider3.setResponseTime(200);
    });

    it('should use round robin strategy', async () => {
      failoverManager.updateConfig({ strategy: FailoverStrategy.ROUND_ROBIN });

      const operation = jest.fn().mockResolvedValue({ success: true });

      // Primeira execução
      const result1 = await failoverManager.executeWithFailover(operation);
      
      // Segunda execução
      const result2 = await failoverManager.executeWithFailover(operation);

      // Deve alternar entre provedores
      expect(result1.successfulProvider).not.toBe(result2.successfulProvider);
    });

    it('should use performance strategy', async () => {
      failoverManager.updateConfig({ strategy: FailoverStrategy.PERFORMANCE });

      // Simula histórico de performance
      (failoverManager as any).providerMetrics.set('provider1', {
        providerName: 'provider1',
        successRate: 80,
        averageLatency: 200,
        lastUpdated: new Date(),
        totalRequests: 10,
        successfulRequests: 8
      });

      (failoverManager as any).providerMetrics.set('provider2', {
        providerName: 'provider2',
        successRate: 95,
        averageLatency: 150,
        lastUpdated: new Date(),
        totalRequests: 10,
        successfulRequests: 9.5
      });

      const operation = jest.fn().mockResolvedValue({ success: true });
      const result = await failoverManager.executeWithFailover(operation);

      // Provider2 tem melhor performance, deve ser usado primeiro
      expect(result.successfulProvider).toBe('provider2');
    });
  });

  describe('Configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        maxRetries: 5,
        timeoutPerAttempt: 2000,
        strategy: FailoverStrategy.PERFORMANCE
      };

      failoverManager.updateConfig(newConfig);
      const config = failoverManager.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.timeoutPerAttempt).toBe(2000);
      expect(config.strategy).toBe(FailoverStrategy.PERFORMANCE);
    });

    it('should reset metrics correctly', () => {
      // Adiciona algumas métricas
      (failoverManager as any).recordSuccess('provider1');
      (failoverManager as any).recordFailure('provider2', new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Test'));

      expect(failoverManager.getAllProviderMetrics()).toHaveLength(2);

      failoverManager.resetAllMetrics();

      expect(failoverManager.getAllProviderMetrics()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty provider list', async () => {
      // Remove todos os providers
      (providerRegistry as any).providers.clear();

      const operation = jest.fn();

      await expect(failoverManager.executeWithFailover(operation))
        .rejects.toThrow('No providers available');

      expect(operation).not.toHaveBeenCalled();
    });

    it('should normalize different error types', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Generic error'))
        .mockResolvedValueOnce({ success: true });

      const result = await failoverManager.executeWithFailover(operation);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBeInstanceOf(PaymentError);
      expect(result.errors[0].error.type).toBe(PaymentErrorType.UNKNOWN_ERROR);
    });
  });
});