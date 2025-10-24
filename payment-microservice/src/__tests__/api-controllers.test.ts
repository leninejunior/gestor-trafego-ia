import request from 'supertest';
import express from 'express';
import { PaymentController } from '../infrastructure/controllers/payment.controller';
import { SubscriptionController } from '../infrastructure/controllers/subscription.controller';
import { ProviderController } from '../infrastructure/controllers/provider.controller';
import { WebhookController } from '../infrastructure/controllers/webhook.controller';
import { v1Router } from '../infrastructure/routes/v1';

// Mock dependencies
jest.mock('../application/services/payment.service');
jest.mock('../domain/services/provider-registry');
jest.mock('../domain/services/health-checker');
jest.mock('../domain/services/webhook-security');
jest.mock('../infrastructure/container/container');

describe('API Controllers', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Add correlation ID middleware for testing
    app.use((req, res, next) => {
      req.correlationId = 'test-correlation-id';
      next();
    });
    
    // Mock container dependencies
    const mockContainer = {
      get: jest.fn().mockImplementation((serviceName: string) => {
        switch (serviceName) {
          case 'PaymentService':
            return {
              processPayment: jest.fn().mockResolvedValue({
                id: 'pay_123',
                providerPaymentId: 'provider_pay_123',
                status: 'succeeded',
                amount: 1000,
                currency: 'BRL',
                createdAt: new Date(),
                updatedAt: new Date()
              }),
              getTransaction: jest.fn().mockResolvedValue({
                id: 'pay_123',
                organizationId: 'org_123',
                providerName: 'stripe',
                status: 'completed',
                amount: 1000,
                currency: 'BRL'
              }),
              getTransactionsByOrganization: jest.fn().mockResolvedValue([])
            };
          case 'ProviderRegistry':
            return {
              getAllProviders: jest.fn().mockReturnValue([
                { name: 'stripe', version: '1.0.0' },
                { name: 'iugu', version: '1.0.0' }
              ]),
              getProvider: jest.fn().mockReturnValue({
                name: 'stripe',
                version: '1.0.0',
                parseWebhook: jest.fn().mockReturnValue({
                  id: 'evt_123',
                  type: 'payment.succeeded',
                  data: { id: 'pay_123' }
                })
              })
            };
          case 'HealthChecker':
            return {
              checkProvider: jest.fn().mockResolvedValue({
                status: 'healthy',
                responseTime: 100,
                lastCheck: new Date()
              })
            };
          case 'WebhookSecurityService':
            return {
              validateWebhookSignature: jest.fn().mockResolvedValue(true)
            };
          default:
            return {};
        }
      })
    };

    // Mock the container module
    jest.doMock('../infrastructure/container/container', () => ({
      container: mockContainer
    }));
  });

  describe('Payment Controller', () => {
    it('should create a payment', async () => {
      const paymentData = {
        amount: 1000,
        currency: 'BRL',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Test payment'
      };

      const response = await request(app)
        .post('/api/v1/payments')
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.correlationId).toBe('test-correlation-id');
    });

    it('should validate payment request', async () => {
      const invalidPaymentData = {
        amount: -100, // Invalid negative amount
        currency: 'INVALID',
        organizationId: 'invalid-uuid'
      };

      const response = await request(app)
        .post('/api/v1/payments')
        .send(invalidPaymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should get payment by ID', async () => {
      const response = await request(app)
        .get('/api/v1/payments/pay_123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('pay_123');
    });

    it('should list payments for organization', async () => {
      const response = await request(app)
        .get('/api/v1/payments?organizationId=org_123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Subscription Controller', () => {
    it('should create a subscription', async () => {
      const subscriptionData = {
        customerId: 'cust_123',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        planId: 'plan_basic',
        amount: 2999,
        currency: 'BRL',
        billingInterval: 'MONTHLY'
      };

      const response = await request(app)
        .post('/api/v1/subscriptions')
        .send(subscriptionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
    });

    it('should get subscription by ID', async () => {
      const response = await request(app)
        .get('/api/v1/subscriptions/sub_123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('sub_123');
    });
  });

  describe('Provider Controller', () => {
    it('should list all providers', async () => {
      const response = await request(app)
        .get('/api/v1/providers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get provider details', async () => {
      const response = await request(app)
        .get('/api/v1/providers/stripe')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('stripe');
    });

    it('should check provider health', async () => {
      const response = await request(app)
        .get('/api/v1/providers/stripe/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('Webhook Controller', () => {
    it('should receive webhook from provider', async () => {
      const webhookPayload = {
        id: 'evt_123',
        type: 'payment.succeeded',
        data: { id: 'pay_123' },
        created: Date.now()
      };

      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('x-signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.eventId).toBe('evt_123');
    });

    it('should reject webhook without signature', async () => {
      const webhookPayload = {
        id: 'evt_123',
        type: 'payment.succeeded',
        data: { id: 'pay_123' }
      };

      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .send(webhookPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('signature');
    });
  });

  describe('API Versioning', () => {
    it('should return API v1 info', async () => {
      const response = await request(app)
        .get('/api/v1')
        .expect(200);

      expect(response.body.version).toBe('v1');
      expect(response.body.endpoints).toBeDefined();
    });

    it('should return API root info', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.name).toContain('Payment Microservice');
      expect(response.body.versions).toBeDefined();
      expect(response.body.versions.v1.status).toBe('stable');
    });
  });
});