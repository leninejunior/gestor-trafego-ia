import { FailoverManager, FailoverStrategy } from '../domain/services/failover-manager';
import { ProviderRegistry } from '../domain/services/provider-registry';
import { CryptographyManager } from '../domain/services/cryptography-manager';
import { WebhookSecurity } from '../domain/services/webhook-security';
import { AdminController } from '../infrastructure/controllers/admin.controller';
import { IPaymentProvider } from '../domain/interfaces/payment-provider.interface';
import { PaymentError, PaymentErrorType, ProviderStatus, Currency } from '../domain/types';
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
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock environment config for tests
jest.mock('../infrastructure/config/environment', () => ({
  config: {
    security: {
      encryptionKey: 'test-encryption-key-for-testing-purposes-32-chars'
    }
  }
}));

// Mock provider for integration tests
class MockIntegrationProvider implements IPaymentProvider {
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
    return { id: 'payment_123', status: 'success', amount: 1000 };
  }
  
  async capturePayment(): Promise<any> { return { id: 'capture_123', status: 'captured' }; }
  async refundPayment(): Promise<any> { return { id: 'refund_123', status: 'refunded' }; }
  async createSubscription(): Promise<any> { return { id: 'sub_123', status: 'active' }; }
  async updateSubscription(): Promise<any> { return { id: 'sub_123', status: 'updated' }; }
  async cancelSubscription(): Promise<any> { return { id: 'sub_123', status: 'cancelled' }; }
  
  validateWebhook(): boolean { return true; }
  parseWebhook(): any { return { event: 'payment.completed', id: 'evt_123' }; }
  
  async healthCheck(): Promise<any> {
    return {
      status: this.shouldFail ? ProviderStatus.UNHEALTHY : ProviderStatus.HEALTHY,
      lastCheck: new Date(),
      responseTime: this.responseTime
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

describe('System Integration Validation', () => {
  let providerRegistry: ProviderRegistry;
  let failoverManager: FailoverManager;
  let cryptographyManager: CryptographyManager;
  let webhookSecurity: WebhookSecurity;
  let mockProvider1: MockIntegrationProvider;
  let mockProvider2: MockIntegrationProvider;

  beforeEach(async () => {
    // Clear singleton instances
    (FailoverManager as any).instance = undefined;
    (ProviderRegistry as any).instance = undefined;

    // Initialize services
    providerRegistry = ProviderRegistry.getInstance();
    mockProvider1 = new MockIntegrationProvider('stripe');
    mockProvider2 = new MockIntegrationProvider('iugu');

    // Register providers
    (providerRegistry as any).providers.set('stripe', mockProvider1);
    (providerRegistry as any).providers.set('iugu', mockProvider2);

    failoverManager = FailoverManager.getInstance({
      strategy: FailoverStrategy.PRIORITY,
      maxRetries: 2,
      timeoutPerAttempt: 5000,
      retryInterval: 100
    });

    cryptographyManager = new CryptographyManager({
      keyRotation: { autoRotate: false },
      monitoredDomains: ['api.stripe.com', 'api.iugu.com']
    });
    await cryptographyManager.initialize();

    webhookSecurity = new WebhookSecurity();
  });

  afterEach(() => {
    failoverManager.resetAllMetrics();
    cryptographyManager.destroy();
    webhookSecurity.clearCertificates();
  });

  describe('End-to-End Payment Flow', () => {
    it('should process payment successfully through failover system', async () => {
      const paymentOperation = jest.fn().mockImplementation(async (provider) => {
        return provider.createPayment({
          amount: 1000,
          currency: 'USD',
          organizationId: 'org_123'
        });
      });

      const result = await failoverManager.executeWithFailover(paymentOperation);

      expect(result.successfulProvider).toBe('stripe');
      expect((result.result as any).id).toBe('payment_123');
      expect((result.result as any).status).toBe('success');
      expect(result.attemptsCount).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should failover to second provider when first fails', async () => {
      mockProvider1.setFailure(true);

      const paymentOperation = jest.fn()
        .mockImplementationOnce(async (provider) => {
          if (provider.name === 'stripe') {
            throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Stripe failed', undefined, true);
          }
          return provider.createPayment({ amount: 1000, currency: 'USD' });
        })
        .mockImplementationOnce(async (provider) => {
          return provider.createPayment({ amount: 1000, currency: 'USD' });
        });

      const result = await failoverManager.executeWithFailover(paymentOperation);

      expect(result.successfulProvider).toBe('iugu');
      expect(result.attemptsCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].provider).toBe('stripe');
    });

    it('should handle complete payment workflow with encryption', async () => {
      // 1. Encrypt provider credentials
      const credentials = {
        apiKey: 'sk_mock_12345',
        secretKey: 'secret_67890'
      };

      const encryptedCredentials = await cryptographyManager.encryptProviderCredentials(
        'stripe',
        credentials
      );

      expect(Object.keys(encryptedCredentials)).toEqual(Object.keys(credentials));

      // 2. Decrypt credentials for payment processing
      const decryptedCredentials = await cryptographyManager.decryptProviderCredentials(
        'stripe',
        encryptedCredentials
      );

      expect(decryptedCredentials).toEqual(credentials);

      // 3. Process payment with failover
      const paymentOperation = async (provider: IPaymentProvider) => {
        // Simulate using decrypted credentials
        return provider.createPayment({
          amount: 1000,
          currency: Currency.USD,
          organizationId: 'test-org',
          metadata: { credentials: decryptedCredentials }
        });
      };

      const result = await failoverManager.executeWithFailover(paymentOperation);

      expect(result.successfulProvider).toBe('stripe');
      expect(result.result.status).toBe('success');
    });
  });

  describe('Webhook Processing Integration', () => {
    it('should validate webhook signatures from multiple providers', async () => {
      const payload = '{"event": "payment.completed", "id": "12345"}';
      const secret = 'webhook-secret-key';

      // Test Stripe webhook
      const stripeSignature = webhookSecurity.generateHmacSignature(
        payload,
        secret,
        WebhookSecurity.createProviderConfig('stripe')
      );

      const stripeResult = await cryptographyManager.validateProviderWebhook(
        'stripe',
        payload,
        { 'stripe-signature': stripeSignature },
        secret
      );

      expect(stripeResult.isValid).toBe(true);

      // Test PayPal webhook
      const paypalSignature = webhookSecurity.generateHmacSignature(
        payload,
        secret,
        WebhookSecurity.createProviderConfig('paypal')
      );

      const paypalResult = await cryptographyManager.validateProviderWebhook(
        'paypal',
        payload,
        { 'paypal-auth-algo': paypalSignature },
        secret
      );

      expect(paypalResult.isValid).toBe(true);
    });

    it('should reject invalid webhook signatures', async () => {
      const payload = '{"event": "payment.completed", "id": "12345"}';
      const secret = 'webhook-secret-key';
      const invalidSignature = 'invalid-signature';

      const result = await cryptographyManager.validateProviderWebhook(
        'stripe',
        payload,
        { 'stripe-signature': invalidSignature },
        secret
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('Monitoring and Metrics Integration', () => {
    it('should track provider metrics across operations', async () => {
      // Execute multiple operations
      const operations = Array(5).fill(null).map(() => 
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 1000, currency: Currency.USD, organizationId: 'test-org' })
        )
      );

      await Promise.all(operations);

      // Check metrics
      const metrics = failoverManager.getProviderMetrics('stripe');
      expect(metrics).toBeDefined();
      expect(metrics!.totalRequests).toBe(5);
      expect(metrics!.successfulRequests).toBe(5);
      expect(metrics!.successRate).toBe(100);
    });

    it('should generate comprehensive security report', async () => {
      // Perform some operations to generate data
      await cryptographyManager.validateProviderWebhook(
        'stripe',
        '{"test": "data"}',
        { 'stripe-signature': 'test-signature' },
        'test-secret'
      );

      const report = await cryptographyManager.generateSecurityReport();

      expect(report.ssl).toBeDefined();
      expect(report.encryption).toBeDefined();
      expect(report.webhooks).toBeDefined();
      
      expect(report.encryption.keys).toBeInstanceOf(Array);
      expect(report.encryption.stats).toBeDefined();
      
      expect(typeof report.webhooks.validationsToday).toBe('number');
      expect(typeof report.webhooks.failedValidations).toBe('number');
      expect(typeof report.webhooks.successRate).toBe('number');
    });
  });

  describe('Admin Controller Integration', () => {
    it('should handle admin operations with proper authentication', async () => {
      // Mock dependencies for AdminController
      const mockHealthChecker = {
        checkProvider: jest.fn().mockResolvedValue({
          status: 'healthy',
          responseTime: 100
        })
      };

      const mockAuditService = {
        logAction: jest.fn().mockResolvedValue(undefined),
        getAuditLogs: jest.fn().mockResolvedValue([])
      };

      const mockReportService = {
        generateFinancialReport: jest.fn().mockResolvedValue({
          summary: { totalTransactions: 100, successRate: 95 }
        }),
        generatePerformanceReport: jest.fn().mockResolvedValue({
          providers: [{ name: 'stripe', successRate: 95 }]
        })
      };

      const mockAlertManager = {
        getAlerts: jest.fn().mockResolvedValue([]),
        acknowledgeAlert: jest.fn().mockResolvedValue(undefined)
      };

      const adminController = new AdminController(
        providerRegistry,
        mockHealthChecker as any,
        mockAuditService as any,
        mockReportService as any,
        mockAlertManager as any
      );

      // Test dashboard access
      const mockRequest = {
        user: {
          id: 'admin_123',
          email: 'admin@test.com',
          role: 'super_admin',
          permissions: ['dashboard:read', 'providers:read']
        },
        correlationId: 'test-correlation-id'
      };

      const mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      const mockNext = jest.fn();

      await adminController.getDashboard(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            overview: expect.any(Object),
            providers: expect.any(Array)
          })
        })
      );
    });

    it('should reject unauthorized access', async () => {
      const mockHealthChecker = { checkProvider: jest.fn() };
      const mockAuditService = { logAction: jest.fn(), getAuditLogs: jest.fn() };
      const mockReportService = { generateFinancialReport: jest.fn() };
      const mockAlertManager = { getAlerts: jest.fn() };

      const adminController = new AdminController(
        providerRegistry,
        mockHealthChecker as any,
        mockAuditService as any,
        mockReportService as any,
        mockAlertManager as any
      );

      const mockRequest = {
        user: {
          id: 'user_123',
          email: 'user@test.com',
          role: 'viewer',
          permissions: [] // No permissions
        },
        correlationId: 'test-correlation-id'
      };

      const mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      const mockNext = jest.fn();

      await adminController.getDashboard(
        mockRequest as any,
        mockResponse as any,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Insufficient permissions'
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle system-wide failures gracefully', async () => {
      // Make all providers fail
      mockProvider1.setFailure(true);
      mockProvider2.setFailure(true);

      const paymentOperation = jest.fn().mockRejectedValue(
        new PaymentError(PaymentErrorType.NETWORK_ERROR, 'All providers failed', undefined, true)
      );

      await expect(failoverManager.executeWithFailover(paymentOperation))
        .rejects.toThrow(PaymentError);

      // Verify metrics were recorded
      const metrics1 = failoverManager.getProviderMetrics('stripe');
      const metrics2 = failoverManager.getProviderMetrics('iugu');

      expect(metrics1?.successRate).toBe(0);
      expect(metrics2?.successRate).toBe(0);
    });

    it('should recover after provider comes back online', async () => {
      // First, make provider fail
      mockProvider1.setFailure(true);

      const failingOperation = jest.fn().mockRejectedValue(
        new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Provider failed', undefined, true)
      );

      await expect(failoverManager.executeWithFailover(failingOperation))
        .rejects.toThrow(PaymentError);

      // Now make provider healthy again
      mockProvider1.setFailure(false);

      const successOperation = jest.fn().mockResolvedValue({
        id: 'payment_recovered',
        status: 'success'
      });

      const result = await failoverManager.executeWithFailover(successOperation);

      expect(result.successfulProvider).toBe('stripe');
      expect((result.result as any).id).toBe('payment_recovered');
    });
  });
});