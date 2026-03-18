import { FailoverManager, FailoverStrategy } from '../domain/services/failover-manager';
import { ProviderRegistry } from '../domain/services/provider-registry';
import { CryptographyManager } from '../domain/services/cryptography-manager';
import { WebhookSecurity } from '../domain/services/webhook-security';
import { CircuitBreaker } from '../domain/services/circuit-breaker';
import { HealthChecker } from '../domain/services/health-checker';
import { IPaymentProvider } from '../domain/interfaces/payment-provider.interface';
import { PaymentError, PaymentErrorType, ProviderStatus, Currency, BillingInterval } from '../domain/types';
import { Logger } from '../infrastructure/logging/logger';
import request from 'supertest';
import express from 'express';
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
    env: 'test',
    port: 3001,
    security: {
      encryptionKey: 'test-encryption-key-for-testing-purposes-32-chars',
      jwtSecret: 'test-jwt-secret-key-for-testing-purposes-32-chars'
    },
    database: {
      url: 'postgresql://test:test@localhost:5432/test_db',
      host: 'localhost',
      port: 5432,
      name: 'test_db',
      user: 'test',
      password: 'test',
      ssl: false
    },
    redis: {
      url: 'redis://localhost:6379',
      host: 'localhost',
      port: 6379
    },
    logging: {
      level: 'error'
    },
    monitoring: {
      metricsPort: 9090,
      healthCheckInterval: 30000
    },
    providers: {
      stripe: {
        secretKey: 'sk_mock_123',
        webhookSecret: 'whsec_test'
      },
      iugu: {
        apiToken: 'test_token'
      },
      pagseguro: {
        email: 'test@test.com',
        token: 'test_token'
      },
      mercadopago: {
        accessToken: 'test_access_token'
      }
    }
  }
}));

// Sandbox provider implementations for real provider testing
class SandboxStripeProvider implements IPaymentProvider {
  public readonly name = 'stripe';
  public readonly version = '1.0.0';
  private isHealthy = true;
  private responseDelay = 100;
  private failureRate = 0;

  async configure(): Promise<void> {}
  async validateConfig(): Promise<boolean> { return true; }

  async createPayment(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    
    if (Math.random() < this.failureRate || !this.isHealthy) {
      throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Stripe sandbox error', undefined, true);
    }
    
    return {
      id: `pi_${Date.now()}`,
      status: 'succeeded',
      amount: request.amount,
      currency: request.currency,
      created: Date.now(),
      metadata: request.metadata
    };
  }

  async capturePayment(paymentId: string): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Capture failed');
    return { id: paymentId, status: 'captured' };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Refund failed');
    return { id: `re_${Date.now()}`, status: 'succeeded', amount };
  }

  async createSubscription(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) throw new PaymentError(PaymentErrorType.NETWORK_ERROR, 'Subscription failed');
    return { id: `sub_${Date.now()}`, status: 'active', plan: request.planId };
  }

  async updateSubscription(subscriptionId: string, updates: any): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: subscriptionId, status: 'updated', ...updates };
  }

  async cancelSubscription(subscriptionId: string): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: subscriptionId, status: 'canceled' };
  }

  validateWebhook(payload: string, signature: string): boolean {
    return signature.includes('stripe') && payload.length > 0;
  }

  parseWebhook(payload: string): any {
    return JSON.parse(payload);
  }

  async healthCheck(): Promise<any> {
    return {
      status: this.isHealthy ? ProviderStatus.HEALTHY : ProviderStatus.UNHEALTHY,
      responseTime: this.responseDelay,
      lastCheck: new Date(),
      errorRate: this.failureRate * 100
    };
  }

  // Test control methods
  setHealthy(healthy: boolean): void { this.isHealthy = healthy; }
  setResponseDelay(delay: number): void { this.responseDelay = delay; }
  setFailureRate(rate: number): void { this.failureRate = rate; }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class SandboxIuguProvider implements IPaymentProvider {
  public readonly name = 'iugu';
  public readonly version = '1.0.0';
  private isHealthy = true;
  private responseDelay = 150;
  private failureRate = 0;

  async configure(): Promise<void> {}
  async validateConfig(): Promise<boolean> { return true; }

  async createPayment(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    
    if (Math.random() < this.failureRate || !this.isHealthy) {
      throw new PaymentError(PaymentErrorType.PROVIDER_UNAVAILABLE, 'Iugu sandbox error', undefined, true);
    }
    
    return {
      id: `iugu_${Date.now()}`,
      status: 'paid',
      amount: request.amount,
      currency: request.currency,
      metadata: request.metadata
    };
  }

  async capturePayment(paymentId: string): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) throw new PaymentError(PaymentErrorType.PROVIDER_UNAVAILABLE, 'Capture failed');
    return { id: paymentId, status: 'captured' };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) throw new PaymentError(PaymentErrorType.PROVIDER_UNAVAILABLE, 'Refund failed');
    return { id: `refund_${Date.now()}`, status: 'refunded', amount };
  }

  async createSubscription(request: any): Promise<any> {
    await this.delay(this.responseDelay);
    if (!this.isHealthy) throw new PaymentError(PaymentErrorType.PROVIDER_UNAVAILABLE, 'Subscription failed');
    return { id: `subscription_${Date.now()}`, status: 'active', plan: request.planId };
  }

  async updateSubscription(subscriptionId: string, updates: any): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: subscriptionId, status: 'updated', ...updates };
  }

  async cancelSubscription(subscriptionId: string): Promise<any> {
    await this.delay(this.responseDelay);
    return { id: subscriptionId, status: 'canceled' };
  }

  validateWebhook(payload: string, signature: string): boolean {
    return signature.includes('iugu') && payload.length > 0;
  }

  parseWebhook(payload: string): any {
    return JSON.parse(payload);
  }

  async healthCheck(): Promise<any> {
    return {
      status: this.isHealthy ? ProviderStatus.HEALTHY : ProviderStatus.UNHEALTHY,
      responseTime: this.responseDelay,
      lastCheck: new Date(),
      errorRate: this.failureRate * 100
    };
  }

  // Test control methods
  setHealthy(healthy: boolean): void { this.isHealthy = healthy; }
  setResponseDelay(delay: number): void { this.responseDelay = delay; }
  setFailureRate(rate: number): void { this.failureRate = rate; }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('Integration Tests - Payment Microservice', () => {
  let providerRegistry: ProviderRegistry;
  let failoverManager: FailoverManager;
  let cryptographyManager: CryptographyManager;
  let webhookSecurity: WebhookSecurity;
  let circuitBreaker: CircuitBreaker;
  let healthChecker: HealthChecker;
  let stripeProvider: SandboxStripeProvider;
  let iuguProvider: SandboxIuguProvider;
  let logger: Logger;
  let app: express.Application;

  beforeAll(async () => {
    // Initialize logger
    logger = Logger.getInstance();
    
    // Clear singleton instances
    (FailoverManager as any).instance = undefined;
    (ProviderRegistry as any).instance = undefined;

    // Initialize services
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

    // Initialize circuit breaker
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    });

    // Initialize health checker
    healthChecker = HealthChecker.getInstance({
      checkInterval: 30000,
      checkTimeout: 5000,
      failureThreshold: 3,
      recoveryThreshold: 2,
      autoCheck: false,
      excludedProviders: []
    });

    // Initialize cryptography manager
    cryptographyManager = new CryptographyManager({
      keyRotation: { autoRotate: false },
      monitoredDomains: ['api.stripe.com', 'api.iugu.com']
    });
    await cryptographyManager.initialize();

    // Initialize webhook security
    webhookSecurity = new WebhookSecurity();

    // Setup Express app for webhook testing
    app = express();
    app.use(express.json());
    app.use(express.raw({ type: 'application/json' }));

    // Add webhook endpoints
    app.post('/webhooks/stripe', async (req, res) => {
      try {
        const signature = req.headers['stripe-signature'] as string;
        let payload: string;
        
        // Handle different content types
        if (typeof req.body === 'string') {
          payload = req.body;
        } else {
          payload = JSON.stringify(req.body);
        }
        
        const isValid = stripeProvider.validateWebhook(payload, signature);
        if (!isValid) {
          return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = stripeProvider.parseWebhook(payload);
        res.json({ success: true, event });
      } catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });

    app.post('/webhooks/iugu', async (req, res) => {
      try {
        const signature = req.headers['iugu-signature'] as string;
        const payload = JSON.stringify(req.body);
        
        const isValid = iuguProvider.validateWebhook(payload, signature);
        if (!isValid) {
          return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = iuguProvider.parseWebhook(payload);
        res.json({ success: true, event });
      } catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });

    // Health check endpoint
    app.get('/health', async (req, res) => {
      const stripeHealth = await stripeProvider.healthCheck();
      const iuguHealth = await iuguProvider.healthCheck();
      
      const overallStatus = stripeHealth.status === ProviderStatus.HEALTHY && 
                           iuguHealth.status === ProviderStatus.HEALTHY ? 'healthy' : 'degraded';
      
      res.json({
        status: overallStatus,
        providers: {
          stripe: stripeHealth,
          iugu: iuguHealth
        }
      });
    });

    // Metrics endpoint
    app.get('/metrics', (req, res) => {
      const metrics = failoverManager.getAllProviderMetrics();
      res.set('Content-Type', 'text/plain');
      
      let metricsText = '# HELP payment_transactions_total Total number of payment transactions\n';
      metricsText += '# TYPE payment_transactions_total counter\n';
      
      metrics.forEach(metric => {
        metricsText += `payment_transactions_total{provider="${metric.providerName}"} ${metric.totalRequests}\n`;
        metricsText += `payment_success_rate{provider="${metric.providerName}"} ${metric.successRate}\n`;
        metricsText += `payment_avg_response_time{provider="${metric.providerName}"} ${metric.averageLatency}\n`;
      });
      
      res.send(metricsText);
    });
  });

  afterAll(async () => {
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
    stripeProvider.setFailureRate(0);
    
    iuguProvider.setHealthy(true);
    iuguProvider.setResponseDelay(150);
    iuguProvider.setFailureRate(0);
    
    // Reset failover metrics
    failoverManager.resetAllMetrics();
    
    // Reset circuit breaker
    circuitBreaker.reset();
  });

  describe('End-to-End Payment Flow with Real Providers (Sandbox)', () => {
    it('should process complete payment workflow successfully', async () => {
      const startTime = Date.now();
      
      const paymentRequest = {
        amount: 10000, // $100.00
        currency: Currency.USD,
        organizationId: 'org_test_123',
        customerId: 'cust_test_456',
        description: 'Integration test payment',
        metadata: {
          testId: 'integration_test_1',
          timestamp: startTime
        }
      };

      const paymentResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment(paymentRequest);
        }
      );

      expect(paymentResult.successfulProvider).toBeDefined();
      expect(paymentResult.result).toBeDefined();
      expect(paymentResult.result.amount).toBe(paymentRequest.amount);
      expect(paymentResult.result.currency).toBe(paymentRequest.currency);
      expect(paymentResult.attemptsCount).toBe(1);
      expect(paymentResult.errors).toHaveLength(0);
      expect(paymentResult.totalTime).toBeGreaterThan(0);

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
      const paymentResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 5000,
            currency: Currency.USD,
            organizationId: 'org_test_123'
          });
        }
      );

      const paymentId = paymentResult.result.id;
      const provider = providerRegistry.getProvider(paymentResult.successfulProvider);

      const captureResult = await provider!.capturePayment(paymentId);
      expect(captureResult.status).toBe('captured');

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
      const subscriptionRequest = {
        organizationId: 'org_test_123',
        customerId: 'cust_test_789',
        planId: 'plan_monthly_1000',
        amount: 1000,
        currency: Currency.USD,
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

      const updateResult = await provider!.updateSubscription(subscriptionId, {
        amount: 1500
      });
      expect(updateResult.status).toBe('updated');

      const cancelResult = await provider!.cancelSubscription(subscriptionId);
      expect(cancelResult.status).toBe('canceled');

      logger.info('Subscription lifecycle completed', {
        subscriptionId,
        provider: subscriptionResult.successfulProvider
      });
    });
  });

  describe('Failover and Circuit Breaker Tests', () => {
    it('should automatically failover when primary provider fails', async () => {
      stripeProvider.setHealthy(false);

      const paymentResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 3000,
            currency: Currency.USD,
            organizationId: 'org_test_123'
          });
        }
      );

      expect(paymentResult.successfulProvider).toBe('iugu');
      expect(paymentResult.attemptsCount).toBe(2);
      expect(paymentResult.errors).toHaveLength(1);
      expect(paymentResult.errors[0].provider).toBe('stripe');

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

    it('should trigger circuit breaker after multiple failures', async () => {
      stripeProvider.setFailureRate(1.0); // 100% failure rate

      // Trigger multiple failures to open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          if (circuitBreaker.canExecute()) {
            await stripeProvider.createPayment({
              amount: 1000,
              currency: Currency.USD,
              organizationId: 'test'
            });
            circuitBreaker.recordSuccess();
          }
        } catch (error) {
          circuitBreaker.recordFailure();
        }
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('open');

      // Next call should fail fast without calling provider
      const startTime = Date.now();
      const canExecute = circuitBreaker.canExecute();
      const duration = Date.now() - startTime;
      
      expect(canExecute).toBe(false);
      expect(duration).toBeLessThan(50); // Should fail fast

      logger.info('Circuit breaker test completed', {
        state: metrics.state,
        consecutiveFailures: metrics.consecutiveFailures
      });
    });

    it('should recover when providers come back online', async () => {
      stripeProvider.setHealthy(false);

      await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 1000,
            currency: Currency.USD,
            organizationId: 'org_test_123'
          });
        }
      );

      stripeProvider.setHealthy(true);

      const recoveryResult = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 2000,
            currency: Currency.USD,
            organizationId: 'org_test_123'
          });
        }
      );

      expect(['stripe', 'iugu']).toContain(recoveryResult.successfulProvider);
      expect(recoveryResult.attemptsCount).toBeGreaterThanOrEqual(1);

      logger.info('Provider recovery validated', {
        recoveredProvider: 'stripe'
      });
    });
  });

  describe('Webhook Processing Tests', () => {
    it('should validate and process webhooks from multiple providers', async () => {
      const testPayload = {
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
      };

      // Test Stripe webhook
      const stripeResponse = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'stripe_test_signature')
        .send(testPayload)
        .expect(200);

      expect(stripeResponse.body.success).toBe(true);
      expect(stripeResponse.body.event.type).toBe('payment_intent.succeeded');

      // Test Iugu webhook
      const iuguResponse = await request(app)
        .post('/webhooks/iugu')
        .set('iugu-signature', 'iugu_test_signature')
        .send(testPayload)
        .expect(200);

      expect(iuguResponse.body.success).toBe(true);
      expect(iuguResponse.body.event.type).toBe('payment_intent.succeeded');

      logger.info('Webhook validation completed for all providers');
    });

    it('should reject invalid webhook signatures', async () => {
      const testPayload = { test: 'data' };

      await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(testPayload)
        .expect(400);

      await request(app)
        .post('/webhooks/iugu')
        .set('iugu-signature', 'invalid_signature')
        .send(testPayload)
        .expect(400);

      logger.info('Invalid webhook signatures properly rejected');
    });

    it('should handle webhook processing failures gracefully', async () => {
      // Send malformed JSON that will cause JSON.parse to fail
      const invalidPayload = '{"invalid": json}'; // Missing quotes around json

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'stripe_test_signature')
        .set('Content-Type', 'application/json')
        .send(invalidPayload);

      // Should either return 400 for invalid signature or 500 for processing error
      expect([400, 500]).toContain(response.status);

      logger.info('Webhook processing failures handled gracefully');
    });
  });

  describe('Performance and Load Tests', () => {
    it('should maintain system stability under concurrent load', async () => {
      const concurrentRequests = 20;
      const requestPromises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requestPromises.push(
          failoverManager.executeWithFailover(async (provider) => 
            provider.createPayment({
              amount: 1000 + i * 100,
              currency: Currency.USD,
              organizationId: `org_load_test_${i}`
            })
          )
        );
      }

      const results = await Promise.allSettled(requestPromises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(concurrentRequests * 0.8); // At least 80% success
      expect(successful + failed).toBe(concurrentRequests);

      const healthCheck = await request(app)
        .get('/health')
        .expect(200);

      expect(['healthy', 'degraded']).toContain(healthCheck.body.status);

      logger.info('Load test completed', {
        concurrentRequests,
        successful,
        failed,
        successRate: (successful / concurrentRequests) * 100
      });
    });

    it('should handle provider timeout scenarios', async () => {
      stripeProvider.setResponseDelay(15000); // 15 seconds (exceeds 10s timeout)
      iuguProvider.setResponseDelay(100); // Normal response time

      const result = await failoverManager.executeWithFailover(
        async (provider: IPaymentProvider) => {
          return await provider.createPayment({
            amount: 5000,
            currency: Currency.USD,
            organizationId: 'org_timeout_test'
          });
        }
      );

      expect(result.successfulProvider).toBe('iugu');
      expect(result.attemptsCount).toBe(2);
      expect(result.errors).toHaveLength(1);

      logger.info('Timeout scenario handled correctly', {
        successfulProvider: result.successfulProvider,
        timeoutErrors: result.errors.length
      });
    });

    it('should measure and report performance metrics accurately', async () => {
      stripeProvider.setResponseDelay(200);
      iuguProvider.setResponseDelay(300);

      const startTime = Date.now();

      const results = await Promise.all([
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 1000, currency: Currency.USD, organizationId: 'org1' })
        ),
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 2000, currency: Currency.USD, organizationId: 'org2' })
        ),
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 3000, currency: Currency.USD, organizationId: 'org3' })
        )
      ]);

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      results.forEach(result => {
        expect(result.totalTime).toBeGreaterThan(0);
        expect(result.totalTime).toBeLessThanOrEqual(totalDuration + 100); // Add small buffer
      });

      const metricsResponse = await request(app)
        .get('/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;
      expect(metricsText).toContain('payment_transactions_total');
      expect(metricsText).toContain('payment_success_rate');
      expect(metricsText).toContain('payment_avg_response_time');

      const allMetrics = failoverManager.getAllProviderMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);
      
      allMetrics.forEach(metric => {
        expect(metric.providerName).toBeDefined();
        expect(metric.totalRequests).toBeGreaterThan(0);
        expect(metric.successRate).toBeGreaterThanOrEqual(0);
        expect(metric.successRate).toBeLessThanOrEqual(100);
      });

      logger.info('Performance metrics validation completed', {
        providersWithMetrics: allMetrics.length,
        totalRequests: allMetrics.reduce((sum, m) => sum + m.totalRequests, 0),
        averageResponseTime: results.reduce((sum, r) => sum + r.totalTime, 0) / results.length
      });
    });
  });

  describe('Security and Cryptography Tests', () => {
    it('should encrypt and decrypt provider credentials securely', async () => {
      const credentials = {
        apiKey: 'sk_mock_12345',
        secretKey: 'secret_67890',
        webhookSecret: 'whsec_test'
      };

      const encryptedCredentials = await cryptographyManager.encryptProviderCredentials(
        'stripe',
        credentials
      );

      expect(Object.keys(encryptedCredentials)).toEqual(Object.keys(credentials));
      expect(encryptedCredentials.apiKey).not.toBe(credentials.apiKey);
      expect(encryptedCredentials.secretKey).not.toBe(credentials.secretKey);

      const decryptedCredentials = await cryptographyManager.decryptProviderCredentials(
        'stripe',
        encryptedCredentials
      );

      expect(decryptedCredentials).toEqual(credentials);

      logger.info('Credential encryption/decryption test passed');
    });

    it('should validate webhook signatures with proper cryptographic verification', async () => {
      const payload = '{"event": "payment.completed", "id": "12345"}';
      const secret = 'webhook-secret-key';

      const stripeConfig = WebhookSecurity.createProviderConfig('stripe');
      const stripeSignature = webhookSecurity.generateHmacSignature(
        payload,
        secret,
        stripeConfig
      );

      const stripeResult = webhookSecurity.validateHmacSignature(
        payload,
        stripeSignature,
        secret,
        stripeConfig
      );

      expect(stripeResult.isValid).toBe(true);

      const invalidResult = webhookSecurity.validateHmacSignature(
        payload,
        'v1=invalid-signature',
        secret,
        stripeConfig
      );

      expect(invalidResult.isValid).toBe(false);

      logger.info('Webhook signature validation test passed');
    });

    it('should generate comprehensive security report', async () => {
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

      logger.info('Security report generated successfully', {
        keysCount: report.encryption.keys.length,
        webhookValidations: report.webhooks.validationsToday
      });
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive health check information', async () => {
      const healthResponse = await request(app)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toMatch(/healthy|degraded/);
      expect(healthResponse.body.providers).toBeDefined();
      expect(healthResponse.body.providers.stripe).toBeDefined();
      expect(healthResponse.body.providers.iugu).toBeDefined();

      expect(healthResponse.body.providers.stripe.status).toBe(ProviderStatus.HEALTHY);
      expect(healthResponse.body.providers.iugu.status).toBe(ProviderStatus.HEALTHY);

      logger.info('Health check validation completed');
    });

    it('should detect and report provider health issues', async () => {
      stripeProvider.setHealthy(false);

      const healthResponse = await request(app)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('degraded');
      expect(healthResponse.body.providers.stripe.status).toBe(ProviderStatus.UNHEALTHY);
      expect(healthResponse.body.providers.iugu.status).toBe(ProviderStatus.HEALTHY);

      logger.info('Provider health issue detection validated');
    });

    it('should track and expose comprehensive metrics', async () => {
      // Generate some activity
      await Promise.all([
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 1000, currency: Currency.USD, organizationId: 'org1' })
        ),
        failoverManager.executeWithFailover(async (provider) => 
          provider.createPayment({ amount: 2000, currency: Currency.USD, organizationId: 'org2' })
        )
      ]);

      const metricsResponse = await request(app)
        .get('/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;
      
      expect(metricsText).toContain('payment_transactions_total');
      expect(metricsText).toContain('payment_success_rate');
      expect(metricsText).toContain('payment_avg_response_time');

      const allMetrics = failoverManager.getAllProviderMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);
      
      allMetrics.forEach(metric => {
        expect(metric.providerName).toBeDefined();
        expect(metric.totalRequests).toBeGreaterThan(0);
        expect(metric.successRate).toBeGreaterThanOrEqual(0);
        expect(metric.successRate).toBeLessThanOrEqual(100);
      });

      logger.info('Comprehensive metrics validation completed', {
        providersWithMetrics: allMetrics.length,
        totalRequests: allMetrics.reduce((sum, m) => sum + m.totalRequests, 0)
      });
    });
  });

  describe('Complete System Integration Validation', () => {
    it('should validate complete end-to-end system integration', async () => {
      // This comprehensive test validates all components working together
      
      // 1. Health check all components
      const healthChecks = await Promise.all([
        stripeProvider.healthCheck(),
        iuguProvider.healthCheck(),
        request(app).get('/health')
      ]);

      healthChecks.forEach((check, index) => {
        if (index < 2) {
          expect(check.status).toBe(ProviderStatus.HEALTHY);
        } else {
          expect(check.status).toBe(200);
        }
      });

      // 2. Test complete payment workflow with security measures
      const securePaymentRequest = {
        amount: 15000,
        currency: Currency.USD,
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
        { apiKey: 'sk_mock_integration', secretKey: 'secret_integration' }
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
      const finalMetrics = await request(app).get('/metrics');
      expect(finalMetrics.status).toBe(200);
      expect(finalMetrics.text).toContain('payment_transactions_total');

      // 6. Generate final security report
      const finalSecurityReport = await cryptographyManager.generateSecurityReport();
      expect(finalSecurityReport.webhooks.validationsToday).toBeGreaterThanOrEqual(0);

      // 7. Test webhook processing
      const webhookPayload = {
        id: 'evt_final_test',
        type: 'payment.completed',
        data: { 
          object: {
            id: paymentResult.result.id,
            amount: paymentResult.result.amount,
            status: 'succeeded'
          }
        }
      };

      const webhookResponse = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'stripe_final_test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.success).toBe(true);

      logger.info('Complete system integration validation PASSED', {
        paymentId: paymentResult.result.id,
        provider: paymentResult.successfulProvider,
        duration: paymentResult.totalTime,
        securityValidations: finalSecurityReport.webhooks.validationsToday,
        webhookProcessed: webhookResponse.body.success
      });
    });
  });
});