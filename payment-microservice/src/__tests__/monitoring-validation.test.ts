import { MetricsService } from '../infrastructure/monitoring/metrics.service';
import { Logger } from '../infrastructure/logging/logger';
import { Application } from '../infrastructure/web/application';
import { FailoverManager } from '../domain/services/failover-manager';
import { ProviderRegistry } from '../domain/services/provider-registry';
import request from 'supertest';
import * as promClient from 'prom-client';


// Mock environment
jest.mock('../infrastructure/config/environment', () => ({
  config: {
    server: { port: 3002 },
    database: { url: 'postgresql://test:test@localhost:5432/test_db' },
    redis: { url: 'redis://localhost:6379' },
    security: { encryptionKey: 'test-key-32-chars-for-testing-only' }
  }
}));

describe('Monitoring and Metrics Validation', () => {
  let app: Application;
  let server: any;
  let metricsService: MetricsService;
  let logger: Logger;
  let failoverManager: FailoverManager;
  let providerRegistry: ProviderRegistry;

  beforeAll(async () => {
    // Clear singleton instances
    (MetricsService as any).instance = undefined;
    (FailoverManager as any).instance = undefined;
    (ProviderRegistry as any).instance = undefined;

    // Initialize services
    logger = Logger.getInstance();
    metricsService = MetricsService.getInstance();
    providerRegistry = ProviderRegistry.getInstance();
    failoverManager = FailoverManager.getInstance();

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
  });

  beforeEach(() => {
    // Clear metrics before each test
    promClient.register.clear();
  });

  describe('Metrics Collection and Exposure', () => {
    it('should collect and expose Prometheus metrics', async () => {
      // 1. Record some metrics
      metricsService.recordPayment('stripe', 'success', 'USD', 'payment');
      metricsService.recordPayment('iugu', 'failed', 'BRL', 'payment');
      metricsService.recordPaymentDuration('stripe', 'payment', 1.5);
      metricsService.setProviderHealth('stripe', true);
      metricsService.setProviderHealth('iugu', false);
      metricsService.recordError('iugu', 'network_error', 'TIMEOUT');

      // 2. Get metrics from service
      const metricsText = await metricsService.getMetrics();
      
      // 3. Verify metrics format and content
      expect(metricsText).toContain('payment_transactions_total');
      expect(metricsText).toContain('payment_duration_seconds');
      expect(metricsText).toContain('payment_provider_health');
      expect(metricsText).toContain('payment_errors_total');

      // 4. Verify specific metric values
      expect(metricsText).toContain('provider="stripe"');
      expect(metricsText).toContain('provider="iugu"');
      expect(metricsText).toContain('status="success"');
      expect(metricsText).toContain('status="failed"');
      expect(metricsText).toContain('currency="USD"');
      expect(metricsText).toContain('currency="BRL"');

      logger.info('Prometheus metrics validation completed');
    });

    it('should expose metrics via HTTP endpoint', async () => {
      // 1. Record test metrics
      metricsService.recordPayment('stripe', 'success', 'USD', 'payment');
      metricsService.recordPaymentDuration('stripe', 'payment', 0.8);

      // 2. Request metrics endpoint
      const response = await request(server)
        .get('/metrics')
        .expect(200);

      // 3. Verify response format
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      expect(response.text).toContain('payment_transactions_total');

      logger.info('HTTP metrics endpoint validation completed');
    });

    it('should track custom business metrics', async () => {
      // 1. Create custom metrics
      const customCounter = metricsService.createCounter(
        'custom_business_events_total',
        'Total custom business events',
        ['event_type', 'status']
      );

      const customGauge = metricsService.createGauge(
        'custom_business_value',
        'Current business value',
        ['metric_type']
      );

      const customHistogram = metricsService.createHistogram(
        'custom_operation_duration_seconds',
        'Custom operation duration',
        ['operation'],
        [0.1, 0.5, 1, 2, 5]
      );

      // 2. Record custom metrics
      customCounter.inc({ event_type: 'subscription_created', status: 'success' });
      customCounter.inc({ event_type: 'subscription_created', status: 'success' });
      customCounter.inc({ event_type: 'subscription_cancelled', status: 'success' });

      customGauge.set({ metric_type: 'active_subscriptions' }, 150);
      customGauge.set({ metric_type: 'monthly_revenue' }, 25000);

      customHistogram.observe({ operation: 'payment_processing' }, 1.2);
      customHistogram.observe({ operation: 'payment_processing' }, 0.8);
      customHistogram.observe({ operation: 'refund_processing' }, 2.1);

      // 3. Verify custom metrics are collected
      const metricsText = await metricsService.getMetrics();
      
      expect(metricsText).toContain('custom_business_events_total');
      expect(metricsText).toContain('custom_business_value');
      expect(metricsText).toContain('custom_operation_duration_seconds');
      expect(metricsText).toContain('event_type="subscription_created"');
      expect(metricsText).toContain('metric_type="active_subscriptions"');
      expect(metricsText).toContain('operation="payment_processing"');

      logger.info('Custom business metrics validation completed');
    });
  });

  describe('Real-time Monitoring', () => {
    it('should track provider health in real-time', async () => {
      // 1. Set initial health status
      metricsService.setProviderHealth('stripe', true);
      metricsService.setProviderHealth('iugu', true);
      metricsService.setProviderHealth('pagseguro', false);

      // 2. Get current metrics
      let metricsText = await metricsService.getMetrics();
      
      // 3. Verify initial health status
      expect(metricsText).toContain('payment_provider_health{provider="stripe"} 1');
      expect(metricsText).toContain('payment_provider_health{provider="iugu"} 1');
      expect(metricsText).toContain('payment_provider_health{provider="pagseguro"} 0');

      // 4. Update health status
      metricsService.setProviderHealth('iugu', false);
      metricsService.setProviderHealth('pagseguro', true);

      // 5. Verify updated health status
      metricsText = await metricsService.getMetrics();
      expect(metricsText).toContain('payment_provider_health{provider="iugu"} 0');
      expect(metricsText).toContain('payment_provider_health{provider="pagseguro"} 1');

      logger.info('Real-time provider health tracking validation completed');
    });

    it('should monitor active connections', async () => {
      // 1. Set connection counts
      metricsService.setActiveConnections('stripe', 5);
      metricsService.setActiveConnections('iugu', 3);
      metricsService.setActiveConnections('mercadopago', 0);

      // 2. Verify connection metrics
      const metricsText = await metricsService.getMetrics();
      
      expect(metricsText).toContain('payment_active_connections{provider="stripe"} 5');
      expect(metricsText).toContain('payment_active_connections{provider="iugu"} 3');
      expect(metricsText).toContain('payment_active_connections{provider="mercadopago"} 0');

      logger.info('Active connections monitoring validation completed');
    });

    it('should track queue sizes', async () => {
      // 1. Set queue sizes
      metricsService.setQueueSize('payment_processing', 12);
      metricsService.setQueueSize('webhook_processing', 3);
      metricsService.setQueueSize('retry_queue', 0);

      // 2. Verify queue metrics
      const metricsText = await metricsService.getMetrics();
      
      expect(metricsText).toContain('payment_queue_size{queue_type="payment_processing"} 12');
      expect(metricsText).toContain('payment_queue_size{queue_type="webhook_processing"} 3');
      expect(metricsText).toContain('payment_queue_size{queue_type="retry_queue"} 0');

      logger.info('Queue size monitoring validation completed');
    });
  });

  describe('Performance Metrics', () => {
    it('should track payment processing duration', async () => {
      // 1. Record various payment durations
      metricsService.recordPaymentDuration('stripe', 'payment', 0.5);
      metricsService.recordPaymentDuration('stripe', 'payment', 1.2);
      metricsService.recordPaymentDuration('stripe', 'payment', 0.8);
      metricsService.recordPaymentDuration('iugu', 'payment', 2.1);
      metricsService.recordPaymentDuration('iugu', 'refund', 1.5);

      // 2. Get metrics and verify histogram buckets
      const metricsText = await metricsService.getMetrics();
      
      expect(metricsText).toContain('payment_duration_seconds_bucket');
      expect(metricsText).toContain('payment_duration_seconds_sum');
      expect(metricsText).toContain('payment_duration_seconds_count');
      expect(metricsText).toContain('provider="stripe"');
      expect(metricsText).toContain('provider="iugu"');
      expect(metricsText).toContain('type="payment"');
      expect(metricsText).toContain('type="refund"');

      logger.info('Payment duration tracking validation completed');
    });

    it('should use convenience methods for recording metrics', async () => {
      // 1. Use convenience methods
      metricsService.recordPaymentProcessed('success', 800, 'stripe');
      metricsService.recordPaymentProcessed('failed', 1200, 'iugu');
      metricsService.recordRefundProcessed('success', 600, 'stripe');
      metricsService.recordSubscriptionProcessed('success', 1500, 'iugu');
      metricsService.recordWebhookProcessed('stripe', 'success', 200);

      // 2. Verify all metrics were recorded
      const metricsText = await metricsService.getMetrics();
      
      // Check counters
      expect(metricsText).toContain('payment_transactions_total');
      expect(metricsText).toContain('type="payment"');
      expect(metricsText).toContain('type="refund"');
      expect(metricsText).toContain('type="subscription"');
      expect(metricsText).toContain('type="webhook"');

      // Check histograms
      expect(metricsText).toContain('payment_duration_seconds');

      logger.info('Convenience methods validation completed');
    });
  });

  describe('Error Tracking', () => {
    it('should track errors by provider and type', async () => {
      // 1. Record various errors
      metricsService.recordError('stripe', 'network_error', 'TIMEOUT');
      metricsService.recordError('stripe', 'validation_error', 'INVALID_CARD');
      metricsService.recordError('iugu', 'network_error', 'CONNECTION_REFUSED');
      metricsService.recordError('pagseguro', 'provider_error', 'INSUFFICIENT_FUNDS');
      metricsService.recordError('mercadopago', 'unknown_error');

      // 2. Verify error metrics
      const metricsText = await metricsService.getMetrics();
      
      expect(metricsText).toContain('payment_errors_total');
      expect(metricsText).toContain('provider="stripe"');
      expect(metricsText).toContain('provider="iugu"');
      expect(metricsText).toContain('provider="pagseguro"');
      expect(metricsText).toContain('provider="mercadopago"');
      expect(metricsText).toContain('error_type="network_error"');
      expect(metricsText).toContain('error_type="validation_error"');
      expect(metricsText).toContain('error_type="provider_error"');
      expect(metricsText).toContain('error_code="TIMEOUT"');
      expect(metricsText).toContain('error_code="INVALID_CARD"');
      expect(metricsText).toContain('error_code="unknown"');

      logger.info('Error tracking validation completed');
    });
  });

  describe('Health Check Endpoints', () => {
    it('should provide basic health check', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body.status).toBe('healthy');

      logger.info('Basic health check validation completed');
    });

    it('should provide readiness check', async () => {
      const response = await request(server)
        .get('/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toBeInstanceOf(Object);

      logger.info('Readiness check validation completed');
    });

    it('should provide detailed health information', async () => {
      // 1. Set some provider health status
      metricsService.setProviderHealth('stripe', true);
      metricsService.setProviderHealth('iugu', false);

      // 2. Request detailed health
      const response = await request(server)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('providers');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('metrics');

      logger.info('Detailed health check validation completed');
    });
  });

  describe('Metrics Integration with Failover System', () => {
    it('should track failover metrics', async () => {
      // This test would require integration with actual failover manager
      // For now, we'll simulate the metrics that would be generated

      // 1. Simulate failover scenario metrics
      metricsService.recordPayment('stripe', 'failed', 'USD', 'payment');
      metricsService.recordError('stripe', 'network_error', 'TIMEOUT');
      metricsService.recordPayment('iugu', 'success', 'USD', 'payment');
      metricsService.recordPaymentDuration('iugu', 'payment', 1.2);

      // 2. Verify failover-related metrics
      const metricsText = await metricsService.getMetrics();
      
      expect(metricsText).toContain('payment_transactions_total{provider="stripe",status="failed"');
      expect(metricsText).toContain('payment_transactions_total{provider="iugu",status="success"');
      expect(metricsText).toContain('payment_errors_total{provider="stripe"');

      logger.info('Failover metrics integration validation completed');
    });
  });

  describe('Monitoring System Validation', () => {
    it('should validate complete monitoring pipeline', async () => {
      // 1. Generate comprehensive test data
      const testScenarios = [
        { provider: 'stripe', status: 'success', duration: 0.8, currency: 'USD' },
        { provider: 'stripe', status: 'failed', duration: 2.1, currency: 'USD' },
        { provider: 'iugu', status: 'success', duration: 1.2, currency: 'BRL' },
        { provider: 'pagseguro', status: 'success', duration: 1.8, currency: 'BRL' },
        { provider: 'mercadopago', status: 'failed', duration: 3.2, currency: 'ARS' }
      ];

      // 2. Record all test scenarios
      testScenarios.forEach(scenario => {
        metricsService.recordPayment(scenario.provider, scenario.status, scenario.currency, 'payment');
        metricsService.recordPaymentDuration(scenario.provider, 'payment', scenario.duration);
        
        if (scenario.status === 'failed') {
          metricsService.recordError(scenario.provider, 'provider_error', 'PROCESSING_ERROR');
        }
      });

      // 3. Set provider health based on success rate
      metricsService.setProviderHealth('stripe', true);  // 50% success rate
      metricsService.setProviderHealth('iugu', true);    // 100% success rate
      metricsService.setProviderHealth('pagseguro', true); // 100% success rate
      metricsService.setProviderHealth('mercadopago', false); // 0% success rate

      // 4. Set connection and queue metrics
      metricsService.setActiveConnections('stripe', 8);
      metricsService.setActiveConnections('iugu', 5);
      metricsService.setQueueSize('payment_processing', 15);
      metricsService.setQueueSize('webhook_processing', 2);

      // 5. Validate complete metrics collection
      const metricsText = await metricsService.getMetrics();
      
      // Verify all metric types are present
      const expectedMetrics = [
        'payment_transactions_total',
        'payment_duration_seconds',
        'payment_provider_health',
        'payment_active_connections',
        'payment_errors_total',
        'payment_queue_size'
      ];

      expectedMetrics.forEach(metric => {
        expect(metricsText).toContain(metric);
      });

      // Verify all providers are tracked
      const expectedProviders = ['stripe', 'iugu', 'pagseguro', 'mercadopago'];
      expectedProviders.forEach(provider => {
        expect(metricsText).toContain(`provider="${provider}"`);
      });

      // 6. Test metrics endpoint performance
      const startTime = Date.now();
      await request(server).get('/metrics').expect(200);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second

      logger.info('Complete monitoring system validation PASSED', {
        metricsCount: expectedMetrics.length,
        providersCount: expectedProviders.length,
        responseTime: `${responseTime}ms`
      });
    });
  });
});