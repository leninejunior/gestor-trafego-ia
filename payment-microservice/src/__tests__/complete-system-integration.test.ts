import { Application } from '../infrastructure/web/application';
import { MetricsService } from '../infrastructure/monitoring/metrics.service';
import { FailoverManager, FailoverStrategy } from '../domain/services/failover-manager';
import { ProviderRegistry } from '../domain/services/provider-registry';
import { CryptographyManager } from '../domain/services/cryptography-manager';
import { WebhookSecurity } from '../domain/services/webhook-security';
import { PaymentService } from '../application/services/payment.service';
import { IPaymentProvider } from '../domain/interfaces/payment-provider.interface';
import { PaymentError, PaymentErrorType, ProviderStatus, Currency, BillingInterval } from '../domain/types';
import { Logger } from '../infrastructure/logging/logger';
import request from 'supertest';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock environment for testing
jest.mock('../infrastructure/config/environment', () => ({
  config: {
    security: {
      encryptionKey: 'test-encryption-key-for-testing-purposes-32-chars'
    },
    database: {
      url: 'postgresql://test:test@localhost:5432/test_db'
    },
    redis: {
      url: 'redis://localhost:6379'
    },
    server: {
      port: 3001
    }
  }
}));

// Mock provider implementations for sandbox testing
class SandboxStripeProvider implements IPaymentProvider {
  public readonly name = 'stripe';
  public readonly version = '1.0.0';
  private isHealthy = true;
  private responseDelay = 100;

  async configure(): Promise<void> {}
  async validateConfig(): Promise<boolean> { return true; }

  async createPayment(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) {
      throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Stripe sandbox error', undefined, true);
    }
    return {
      id: `pi_${Date.now()}`,
      status: 'succeeded',
      amount: request.amount,
      currency: request.currency,
      created: Date.now()
    };
  }

  async capturePayment(paymentId: string): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: paymentId, status: 'captured' };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: `re_${Date.now()}`, status: 'succeeded', amount };
  }

  async createSubscription(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: `sub_${Date.now()}`, status: 'active' };
  }

  async updateSubscription(): Promise<any> {
    return { status: 'updated' };
  }

  async cancelSubscription(): Promise<any> {
    return { status: 'canceled' };
  }

  validateWebhook(payload: string, signature: string): boolean {
    return signature.includes('stripe');
  }

  parseWebhook(payload: string): any {
    return JSON.parse(payload);
  }

  async healthCheck(): Promise<any> {
    return {
      status: this.isHealthy ? ProviderStatus.HEALTHY : ProviderStatus.UNHEALTHY,
      responseTime: this.responseDelay,
      lastCheck: new Date()
    };
  }

  // Test helpers
  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  setResponseDelay(delay: number): void {
    this.responseDelay = delay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class SandboxIuguProvider implements IPaymentProvider {
  public readonly name = 'iugu';
  public readonly version = '1.0.0';
  private isHealthy = true;
  private responseDelay = 150;

  async configure(): Promise<void> {}
  async validateConfig(): Promise<boolean> { return true; }

  async createPayment(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) {
      throw new PaymentError(PaymentErrorType.PROVIDER_UNAVAILABLE, 'Iugu sandbox error', undefined, true);
    }
    return {
      id: `iugu_${Date.now()}`,
      status: 'paid',
      amount: request.amount,
      currency: request.currency
    };
  }

  async capturePayment(paymentId: string): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: paymentId, status: 'captured' };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: `refund_${Date.now()}`, status: 'refunded', amount };
  }

  async createSubscription(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: `subscription_${Date.now()}`, status: 'active' };
  }

  async updateSubscription(): Promise<any> {
    return { status: 'updated' };
  }

  async cancelSubscription(): Promise<any> {
    return { status: 'canceled' };
  }

  validateWebhook(payload: string, signature: string): boolean {
    return signature.includes('iugu');
  }

  parseWebhook(payload: string): any {
    return JSON.parse(payload);
  }

  async healthCheck(): Promise<any> {
    return {
      status: this.isHealthy ? ProviderStatus.HEALTHY : ProviderStatus.UNHEALTHY,
      responseTime: this.responseDelay,
      lastCheck: new Date()
    };
  }

  // Test helpers
  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  setResponseDelay(delay: number): void {
    this.responseDelay = delay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('Complete System Integration Validation', () => {
  let app: Application;
  let server: any;
  let metricsService: MetricsService;
  let failoverManager: FailoverManager;
  let providerRegistry: ProviderRegistry;
  let cryptographyManager: CryptographyManager;
  let webhookSecurity: WebhookSecurity;
  let paymentService: PaymentService;
  let stripeProvider: SandboxStripeProvider;
  let iuguProvider: SandboxIuguProvider;
  let logger: Logger;

  beforeAll(async () => {
    // Initialize logger
    logger = Logger.getInstance();
    
    // Clear singleton instances
    (FailoverManager as any).instance = undefined;
    (ProviderRegistry as any).instance = undefined;
    (MetricsService as any).instance = undefined;

    // Initialize services
    metricsService = MetricsService.getInstance();
    providerRegistry = ProviderRegistry.getInstance();
    
    // Create sandbox providers
    stripeProvider = new SandboxStripeProvider();
    iuguProvider = new SandboxIuguProvider();

    // Register providers
    (providerRegistry as any).providers.set('stripe', stripeProvider);
    (providerRegistry as any).providers.set('iugu', iuguProvider);

    // Initialize failover manager
    failoverManager = FailoverManager.getInstance({
      strategy: FailoverStrategy.PRIORITY,
      maxRetries: 3,
      timeoutPerAttempt: 10000,
      retryInterval: 500,
      backoffMultiplier: 2,
      skipUnhealthyProviders: true,
      errorRateThreshold: 10,
      latencyThreshold: 5000
    });

    // Initialize cryptography manager
    cryptographyManager = new CryptographyManager({
      keyRotation: { autoRotate: false },
      monitoredDomains: ['api.stripe.com', 'api.iugu.com']
    });
    await cryptographyManager.initialize();

    // Initialize webhook security
    webhookSecurity = new WebhookSecurity();

    // Initialize payment service (mock dependencies)
    const mockTransactionRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findByOrganization: jest.fn()
    };
    const mockProviderConfigRepo = {
      findByName: jest.fn(),
      findActive: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };
    paymentService = new PaymentService(mockTransactionRepo as any, mockProviderConfigRepo as any);

    // Initialize application (mock for testing)
    app = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getServer: jest.fn().mockReturnValue({
        listen: jest.fn(),
        close: jest.fn()
      })
    } as any;
    
    await app.initialize();
    server = app.getServer();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    
    if (cryptographyManager) {
      cryptographyManager.destroy();
    }
    
    if (webhookSecurity) {
      webhookSecurity.clearCertificates();
    }
  });

  beforeEach(() => {
    // Reset providers to healthy state
    stripeProvider.setHealthy(true);
    stripeProvider.setResponseDelay(100);
    iuguProvider.setHealthy(true);
    iuguProvider.setResponseDelay(150);
    
    // Reset failover metrics
    failoverManager.resetAllMetrics();
  });

  describe('End-to-End Payment Flow Validation', () => {
    it('should process complete payment workflow successfully', async () => {
      const startTime = Date.now();
      
      // 1. Create payment request
      const paymentRequest = {
        amount: 10000, // $100.00
        currency: 'USD' as Currency,
        organizationId: 'org_test_123',
        customerId: 'cust_test_456',
        description: 'Integration test payment',
        metadata: {
          testId: 'integration_test_1',
          timestamp: startTime
        }
      };

      // 2. Process payment through failover system
      const paymentResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment(paymentRequest);
        }
      );

      // 3. Validate payment result
      expect(paymentResult.successfulProvider).toBeDefined();
      expect(paymentResult.result).toBeDefined();
      expect(paymentResult.result.amount).toBe(paymentRequest.amount);
      expect(paymentResult.result.currency).toBe(paymentRequest.currency);
      expect(paymentResult.attemptsCount).toBe(1);
      expect(paymentResult.errors).toHaveLength(0);
      expect(paymentResult.totalTime).toBeGreaterThan(0);

      // 4. Verify metrics were recorded
      const metrics = failoverManager.getProviderMetrics(paymentResult.successfulProvider);
      expect(metrics).toBeDefined();
      expect(metrics!.totalRequests).toBeGreaterThan(0);
      expect(metrics!.successfulRequests).toBeGreaterThan(0);
      expect(metrics!.successRate).toBe(100);

      logger.info('End-to-end payment flow completed successfully', {
        provider: paymentResult.successfulProvider,
        paymentId: paymentResult.result.id,
        duration: paymentResult.totalTime
      });
    });

    it('should handle payment capture and refund workflow', async () => {
      // 1. Create initial payment
      const paymentResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 5000,
            currency: 'USD' as Currency,
            organizationId: 'org_test_123'
          });
        }
      );

      const paymentId = paymentResult.result.id;
      const provider = providerRegistry.getProvider(paymentResult.successfulProvider);

      // 2. Capture payment
      const captureResult = await provider!.capturePayment(paymentId);
      expect(captureResult.status).toBe('captured');

      // 3. Refund payment
      const refundResult = await provider!.refundPayment(paymentId, 2500);
      expect(refundResult.status).toMatch(/succeeded|refunded/);
      expect(refundResult.amount).toBe(2500);

      logger.info('Payment capture and refund workflow completed', {
        paymentId,
        captureStatus: captureResult.status,
        refundId: refundResult.id
      });
    });

    it('should handle subscription lifecycle', async () => {
      // 1. Create subscription
      const subscriptionRequest = {
        organizationId: 'org_test_123',
        customerId: 'cust_test_789',
        planId: 'plan_monthly_1000',
        amount: 1000,
        currency: 'USD' as Currency,
        billingInterval: BillingInterval.MONTHLY
      };

      const subscriptionResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createSubscription(subscriptionRequest);
        }
      );

      expect(subscriptionResult.result.status).toBe('active');
      const subscriptionId = subscriptionResult.result.id;
      const provider = providerRegistry.getProvider(subscriptionResult.successfulProvider);

      // 2. Update subscription
      const updateResult = await provider!.updateSubscription(subscriptionId, {
        amount: 1500
      });
      expect(updateResult.status).toBe('updated');

      // 3. Cancel subscription
      const cancelResult = await provider!.cancelSubscription(subscriptionId);
      expect(cancelResult.status).toBe('canceled');

      logger.info('Subscription lifecycle completed', {
        subscriptionId,
        provider: subscriptionResult.successfulProvider
      });
    });
  });

  describe('Failover System Validation', () => {
    it('should automatically failover when primary provider fails', async () => {
      // 1. Make Stripe (primary) provider fail
      stripeProvider.setHealthy(false);

      // 2. Process payment - should failover to Iugu
      const paymentResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 3000,
            currency: 'USD' as Currency,
            organizationId: 'org_test_123'
          });
        }
      );

      // 3. Verify failover occurred
      expect(paymentResult.successfulProvider).toBe('iugu');
      expect(paymentResult.attemptsCount).toBe(2); // Failed on Stripe, succeeded on Iugu
      expect(paymentResult.errors).toHaveLength(1);
      expect(paymentResult.errors[0].provider).toBe('stripe');

      // 4. Verify metrics reflect the failure and success
      const stripeMetrics = failoverManager.getProviderMetrics('stripe');
      const iuguMetrics = failoverManager.getProviderMetrics('iugu');

      expect(stripeMetrics!.successRate).toBeLessThan(100);
      expect(iuguMetrics!.successRate).toBe(100);

      logger.info('Failover validation completed', {
        failedProvider: 'stripe',
        successfulProvider: 'iugu',
        attempts: paymentResult.attemptsCount
      });
    });

    it('should handle complete provider failure gracefully', async () => {
      // 1. Make all providers fail
      stripeProvider.setHealthy(false);
      iuguProvider.setHealthy(false);

      // 2. Attempt payment - should fail after all retries
      await expect(
        failoverManager.executeWithFailover(
          async (provider: IPaymentProvider) => {
            return await provider.createPayment({
              amount: 1000,
              currency: 'USD' as Currency,
              organizationId: 'org_test_123'
            });
          }
        )
      ).rejects.toThrow(PaymentError);

      // 3. Verify all providers were attempted
      const stripeMetrics = failoverManager.getProviderMetrics('stripe');
      const iuguMetrics = failoverManager.getProviderMetrics('iugu');

      expect(stripeMetrics!.successRate).toBe(0);
      expect(iuguMetrics!.successRate).toBe(0);

      logger.info('Complete provider failure handled correctly');
    });

    it('should recover when providers come back online', async () => {
      // 1. Start with failed provider
      stripeProvider.setHealthy(false);

      // 2. First payment should fail on Stripe, succeed on Iugu
      await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 1000,
            currency: 'USD' as Currency,
            organizationId: 'org_test_123'
          });
        }
      );

      // 3. Restore Stripe health
      stripeProvider.setHealthy(true);

      // 4. Next payment should succeed on Stripe again
      const recoveryResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 2000,
            currency: 'USD' as Currency,
            organizationId: 'org_test_123'
          });
        }
      );

      expect(recoveryResult.successfulProvider).toBe('stripe');
      expect(recoveryResult.attemptsCount).toBe(1);

      logger.info('Provider recovery validated', {
        recoveredProvider: 'stripe'
      });
    });
  });

  describe('Webhook Processing Validation', () => {
    it('should validate and process webhooks from multiple providers', async () => {
      const testPayload = JSON.stringify({
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 5000,
            currency: 'usd',
            status: 'succeeded'
          }
        }
      });

      // 1. Test Stripe webhook validation
      const stripeSignature = 'stripe_signature_test';
      const stripeValid = stripeProvider.validateWebhook(testPayload, stripeSignature);
      expect(stripeValid).toBe(true);

      const stripeParsed = stripeProvider.parseWebhook(testPayload);
      expect(stripeParsed.type).toBe('payment_intent.succeeded');

      // 2. Test Iugu webhook validation
      const iuguSignature = 'iugu_signature_test';
      const iuguValid = iuguProvider.validateWebhook(testPayload, iuguSignature);
      expect(iuguValid).toBe(true);

      const iuguParsed = iuguProvider.parseWebhook(testPayload);
      expect(iuguParsed.type).toBe('payment_intent.succeeded');

      logger.info('Webhook validation completed for all providers');
    });

    it('should reject invalid webhook signatures', async () => {
      const testPayload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'invalid_signature';

      const stripeValid = stripeProvider.validateWebhook(testPayload, invalidSignature);
      const iuguValid = iuguProvider.validateWebhook(testPayload, invalidSignature);

      expect(stripeValid).toBe(false);
      expect(iuguValid).toBe(false);

      logger.info('Invalid webhook signatures properly rejected');
    });

    it('should process webhook through HTTP endpoint', async () => {
      const webhookPayload = {
        id: 'evt_http_test',
        type: 'payment.completed',
        data: { amount: 1000, currency: 'USD' }
      };

      const response = await request(server)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      logger.info('HTTP webhook endpoint processed successfully');
    });
  });

  describe('Monitoring and Metrics Validation', () => {
    it('should collect and expose comprehensive metrics', async () => {
      // 1. Generate some activity
      await Promise.all([
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 1000, currency: 'USD' as Currency, organizationId: 'org1' })
        ),
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 2000, currency: 'USD' as Currency, organizationId: 'org2' })
        ),
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 3000, currency: 'USD' as Currency, organizationId: 'org3' })
        )
      ]);

      // 2. Check metrics endpoint
      const metricsResponse = await request(server)
        .get('/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;
      
      // 3. Verify key metrics are present
      expect(metricsText).toContain('payment_transactions_total');
      expect(metricsText).toContain('payment_duration_seconds');
      expect(metricsText).toContain('payment_provider_health');
      expect(metricsText).toContain('payment_active_connections');

      // 4. Verify provider-specific metrics
      const allMetrics = failoverManager.getAllProviderMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);
      
      allMetrics.forEach(metric => {
        expect(metric.providerName).toBeDefined();
        expect(metric.totalRequests).toBeGreaterThan(0);
        expect(metric.successRate).toBeGreaterThanOrEqual(0);
        expect(metric.successRate).toBeLessThanOrEqual(100);
      });

      logger.info('Metrics validation completed', {
        providersWithMetrics: allMetrics.length,
        totalRequests: allMetrics.reduce((sum, m) => sum + m.totalRequests, 0)
      });
    });

    it('should track performance metrics accurately', async () => {
      const startTime = Date.now();

      // 1. Set different response delays for providers
      stripeProvider.setResponseDelay(200);
      iuguProvider.setResponseDelay(300);

      // 2. Execute operations and measure
      const results = await Promise.all([
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 1000, currency: 'USD' as Currency, organizationId: 'org1' })
        ),
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 2000, currency: 'USD' as Currency, organizationId: 'org2' })
        )
      ]);

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // 3. Verify timing metrics
      results.forEach(result => {
        expect(result.totalTime).toBeGreaterThan(0);
        expect(result.totalTime).toBeLessThan(totalDuration);
      });

      // 4. Check health status endpoint
      const healthResponse = await request(server)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.providers).toBeDefined();

      logger.info('Performance metrics validation completed', {
        totalDuration,
        averageResponseTime: results.reduce((sum, r) => sum + r.totalTime, 0) / results.length
      });
    });

    it('should generate security and audit reports', async () => {
      // 1. Perform some operations to generate audit data
      await cryptographyManager.validateProviderWebhook(
        'stripe',
        '{"test": "audit_data"}',
        { 'stripe-signature': 'test_signature' },
        'test_secret'
      );

      // 2. Generate security report
      const securityReport = await cryptographyManager.generateSecurityReport();

      expect(securityReport).toBeDefined();
      expect(securityReport.ssl).toBeDefined();
      expect(securityReport.encryption).toBeDefined();
      expect(securityReport.webhooks).toBeDefined();

      // 3. Verify encryption metrics
      expect(securityReport.encryption.keys).toBeInstanceOf(Array);
      expect(securityReport.encryption.stats).toBeDefined();

      // 4. Verify webhook metrics
      expect(typeof securityReport.webhooks.validationsToday).toBe('number');
      expect(typeof securityReport.webhooks.failedValidations).toBe('number');
      expect(typeof securityReport.webhooks.successRate).toBe('number');

      logger.info('Security report generated successfully', {
        keysCount: securityReport.encryption.keys.length,
        webhookValidations: securityReport.webhooks.validationsToday
      });
    });
  });

  describe('System Health and Resilience', () => {
    it('should maintain system stability under load', async () => {
      const concurrentRequests = 10;
      const requestPromises: Promise<any>[] = [];

      // 1. Generate concurrent load
      for (let i = 0; i < concurrentRequests; i++) {
        requestPromises.push(
          failoverManager.executeWithFailover(async (provider) => 
            provider.createPayment({
              amount: 1000 + i * 100,
              currency: 'USD' as Currency,
              organizationId: `org_load_test_${i}`
            })
          )
        );
      }

      // 2. Wait for all requests to complete
      const results = await Promise.allSettled(requestPromises);

      // 3. Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(0);
      expect(successful + failed).toBe(concurrentRequests);

      // 4. Verify system is still responsive
      const healthCheck = await request(server)
        .get('/health')
        .expect(200);

      expect(healthCheck.body.status).toBe('healthy');

      logger.info('Load test completed', {
        concurrentRequests,
        successful,
        failed,
        successRate: (successful / concurrentRequests) * 100
      });
    });

    it('should handle provider timeout scenarios', async () => {
      // 1. Set very high response delay to trigger timeout
      stripeProvider.setResponseDelay(15000); // 15 seconds (exceeds 10s timeout)
      iuguProvider.setResponseDelay(100); // Normal response time

      // 2. Execute payment - should timeout on Stripe and succeed on Iugu
      const result = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 5000,
            currency: 'USD' as Currency,
            organizationId: 'org_timeout_test'
          });
        }
      );

      // 3. Verify timeout handling
      expect(result.successfulProvider).toBe('iugu');
      expect(result.attemptsCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error.type).toBe(PaymentErrorType.NETWORK_ERROR);

      logger.info('Timeout scenario handled correctly', {
        successfulProvider: result.successfulProvider,
        timeoutErrors: result.errors.length
      });
    });

    it('should validate complete system integration', async () => {
      // This is the comprehensive integration test that validates all components working together
      
      // 1. Health check all components
      const healthChecks = await Promise.all([
        stripeProvider.healthCheck(),
        iuguProvider.healthCheck(),
        request(server).get('/health'),
        request(server).get('/ready')
      ]);

      healthChecks.forEach((check, index) => {
        if (index < 2) {
          // Provider health checks
          expect(check.status).toBe(ProviderStatus.HEALTHY);
        } else {
          // HTTP health checks
          expect(check.status).toBe(200);
        }
      });

      // 2. Test complete payment workflow with all security measures
      const securePaymentRequest = {
        amount: 15000,
        currency: 'USD' as Currency,
        organizationId: 'org_integration_final',
        customerId: 'cust_integration_final',
        description: 'Complete integration validation payment',
        metadata: {
          integrationTest: true,
          timestamp: Date.now(),
          testPhase: 'final_validation'
        }
      };

      // 3. Process with full encryption and audit trail
      const encryptedCredentials = await cryptographyManager.encryptProviderCredentials(
        'stripe',
        { apiKey: 'sk_test_integration', secretKey: 'secret_integration' }
      );

      expect(encryptedCredentials).toBeDefined();

      const paymentResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment(securePaymentRequest);
        }
      );

      // 4. Validate complete result
      expect(paymentResult.successfulProvider).toBeDefined();
      expect(paymentResult.result.amount).toBe(securePaymentRequest.amount);
      expect(paymentResult.attemptsCount).toBeGreaterThan(0);
      expect(paymentResult.totalTime).toBeGreaterThan(0);

      // 5. Verify all metrics were recorded
      const finalMetrics = await request(server).get('/metrics');
      expect(finalMetrics.status).toBe(200);
      expect(finalMetrics.text).toContain('payment_transactions_total');

      // 6. Generate final security report
      const finalSecurityReport = await cryptographyManager.generateSecurityReport();
      expect(finalSecurityReport.webhooks.validationsToday).toBeGreaterThanOrEqual(0);

      logger.info('Complete system integration validation PASSED', {
        paymentId: paymentResult.result.id,
        provider: paymentResult.successfulProvider,
        duration: paymentResult.totalTime,
        securityValidations: finalSecurityReport.webhooks.validationsToday
      });
    });
  });
});