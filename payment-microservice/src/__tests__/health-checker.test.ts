import { HealthChecker } from '../domain/services/health-checker';
import { ProviderRegistry } from '../domain/services/provider-registry';
import { IPaymentProvider } from '../domain/interfaces/payment-provider.interface';
import { ProviderStatus, PaymentError, PaymentErrorType } from '../domain/types';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

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
  async createPayment(): Promise<any> { return {}; }
  async capturePayment(): Promise<any> { return {}; }
  async refundPayment(): Promise<any> { return {}; }
  async createSubscription(): Promise<any> { return {}; }
  async updateSubscription(): Promise<any> { return {}; }
  async cancelSubscription(): Promise<any> { return {}; }
  validateWebhook(): boolean { return true; }
  parseWebhook(): any { return {}; }
  
  async healthCheck(): Promise<any> {
    await this.sleep(this.responseTime);
    if (this.shouldFail) {
      throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Health check failed', undefined, true);
    }
    return {
      status: ProviderStatus.HEALTHY,
      lastCheck: new Date(),
      details: { responseTime: this.responseTime }
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

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;
  let providerRegistry: ProviderRegistry;
  let mockProvider1: MockProvider;
  let mockProvider2: MockProvider;

  beforeEach(() => {
    // Limpa singleton instances
    (HealthChecker as any).instance = undefined;
    (ProviderRegistry as any).instance = undefined;

    providerRegistry = ProviderRegistry.getInstance();
    mockProvider1 = new MockProvider('provider1');
    mockProvider2 = new MockProvider('provider2');

    // Registra providers no registry
    (providerRegistry as any).providers.set('provider1', mockProvider1);
    (providerRegistry as any).providers.set('provider2', mockProvider2);

    healthChecker = HealthChecker.getInstance({
      checkInterval: 1000,
      checkTimeout: 500,
      failureThreshold: 2,
      recoveryThreshold: 1,
      autoCheck: false // Desabilita para testes controlados
    });
  });

  afterEach(() => {
    healthChecker.destroy();
  });

  describe('Provider Health Checking', () => {
    it('should check healthy provider successfully', async () => {
      const result = await healthChecker.checkProvider(mockProvider1);

      expect(result.providerName).toBe('provider1');
      expect(result.status).toBe(ProviderStatus.HEALTHY);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should detect unhealthy provider', async () => {
      mockProvider1.setFailure(true);

      const result = await healthChecker.checkProvider(mockProvider1);

      expect(result.providerName).toBe('provider1');
      expect(result.status).toBe(ProviderStatus.UNHEALTHY);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout correctly', async () => {
      mockProvider1.setResponseTime(1000); // Maior que o timeout de 500ms

      const result = await healthChecker.checkProvider(mockProvider1);

      expect(result.status).toBe(ProviderStatus.UNHEALTHY);
      expect(result.error).toContain('timed out');
    });
  });

  describe('All Providers Check', () => {
    it('should check all active providers', async () => {
      const results = await healthChecker.checkAllProviders();

      expect(results).toHaveLength(2);
      expect(results.map(r => r.providerName)).toContain('provider1');
      expect(results.map(r => r.providerName)).toContain('provider2');
    });

    it('should exclude providers from excluded list', async () => {
      healthChecker.updateConfig({ excludedProviders: ['provider1'] });

      const results = await healthChecker.checkAllProviders();

      expect(results).toHaveLength(1);
      expect(results[0].providerName).toBe('provider2');
    });
  });

  describe('Status Tracking', () => {
    it('should track provider status correctly', async () => {
      await healthChecker.checkProvider(mockProvider1);

      const status = healthChecker.getProviderStatus('provider1');
      expect(status).toBe(ProviderStatus.HEALTHY);
    });

    it('should transition to unhealthy after threshold failures', async () => {
      mockProvider1.setFailure(true);

      // Primeira falha
      await healthChecker.checkProvider(mockProvider1);
      expect(healthChecker.getProviderStatus('provider1')).toBe(ProviderStatus.UNHEALTHY);

      // Segunda falha - deve marcar como unhealthy
      await healthChecker.checkProvider(mockProvider1);
      expect(healthChecker.getProviderStatus('provider1')).toBe(ProviderStatus.UNHEALTHY);
    });

    it('should recover after success threshold', async () => {
      // Primeiro marca como unhealthy
      mockProvider1.setFailure(true);
      await healthChecker.checkProvider(mockProvider1);
      await healthChecker.checkProvider(mockProvider1);
      expect(healthChecker.getProviderStatus('provider1')).toBe(ProviderStatus.UNHEALTHY);

      // Depois recupera
      mockProvider1.setFailure(false);
      await healthChecker.checkProvider(mockProvider1);
      expect(healthChecker.getProviderStatus('provider1')).toBe(ProviderStatus.HEALTHY);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      // Executa algumas verificações
      await healthChecker.checkProvider(mockProvider1);
      mockProvider1.setFailure(true);
      await healthChecker.checkProvider(mockProvider1);
      mockProvider1.setFailure(false);
      await healthChecker.checkProvider(mockProvider1);

      const stats = healthChecker.getProviderStats('provider1');
      expect(stats).toBeDefined();
      expect(stats!.currentStatus).toBe(ProviderStatus.HEALTHY);
      expect(stats!.averageResponseTime).toBeGreaterThan(0);
      expect(stats!.uptime).toBeGreaterThan(0);
    });

    it('should return undefined for unknown provider', () => {
      const stats = healthChecker.getProviderStats('unknown');
      expect(stats).toBeUndefined();
    });
  });

  describe('Auto Check', () => {
    it('should start and stop auto check', () => {
      const spy = jest.spyOn(healthChecker, 'checkAllProviders');
      
      healthChecker.startAutoCheck();
      expect((healthChecker as any).intervalId).toBeDefined();
      
      healthChecker.stopAutoCheck();
      expect((healthChecker as any).intervalId).toBeUndefined();
      
      spy.mockRestore();
    });
  });

  describe('Status Change Callbacks', () => {
    it('should notify on status changes', async () => {
      const callback = jest.fn();
      healthChecker.onStatusChange(callback);

      // Força mudança de status
      mockProvider1.setFailure(true);
      await healthChecker.checkProvider(mockProvider1);
      await healthChecker.checkProvider(mockProvider1); // Segunda falha para trigger threshold

      expect(callback).toHaveBeenCalled();
    });

    it('should remove callbacks correctly', () => {
      const callback = jest.fn();
      healthChecker.onStatusChange(callback);
      healthChecker.removeStatusChangeCallback(callback);

      expect((healthChecker as any).statusChangeCallbacks).toHaveLength(0);
    });
  });

  describe('Force Check', () => {
    it('should force check specific provider', async () => {
      const result = await healthChecker.forceCheck('provider1');

      expect(result).toBeDefined();
      expect(result!.providerName).toBe('provider1');
    });

    it('should return null for unknown provider', async () => {
      const result = await healthChecker.forceCheck('unknown');
      expect(result).toBeNull();
    });
  });

  describe('History Management', () => {
    it('should maintain provider history', async () => {
      await healthChecker.checkProvider(mockProvider1);
      await healthChecker.checkProvider(mockProvider1);

      const history = healthChecker.getProviderHistory('provider1');
      expect(history).toHaveLength(2);
    });

    it('should clear provider history', async () => {
      await healthChecker.checkProvider(mockProvider1);
      
      healthChecker.clearProviderHistory('provider1');
      
      const history = healthChecker.getProviderHistory('provider1');
      expect(history).toHaveLength(0);
    });

    it('should clear all history', async () => {
      await healthChecker.checkProvider(mockProvider1);
      await healthChecker.checkProvider(mockProvider2);
      
      healthChecker.clearAllHistory();
      
      expect(healthChecker.getAllProvidersStatus().size).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        checkInterval: 2000,
        failureThreshold: 5
      };

      healthChecker.updateConfig(newConfig);
      const config = healthChecker.getConfig();

      expect(config.checkInterval).toBe(2000);
      expect(config.failureThreshold).toBe(5);
    });
  });
});