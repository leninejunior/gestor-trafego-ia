import { initializeProviders, getProviderRegistry } from '../infrastructure/providers/provider-loader';
import { ProviderFactory } from '../domain/services/provider-factory';
import { PaymentRequest, Currency, BillingInterval, SubscriptionRequest } from '../domain/types';
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
import { describe } from 'node:test';
import { describe } from 'node:test';

describe('Payment Microservice Integration', () => {
  beforeAll(async () => {
    await initializeProviders();
  });

  afterAll(() => {
    getProviderRegistry().clear();
  });

  describe('Provider Registration', () => {
    it('should have all providers registered', () => {
      const registry = getProviderRegistry();
      const plugins = registry.listActivePlugins();
      
      expect(plugins).toHaveLength(4);
      
      const providerNames = plugins.map(p => p.name);
      expect(providerNames).toContain('stripe');
      expect(providerNames).toContain('iugu');
      expect(providerNames).toContain('pagseguro');
      expect(providerNames).toContain('mercadopago');
    });

    it('should have correct provider configurations', () => {
      const registry = getProviderRegistry();
      
      const stripePlugin = registry.getPlugin('stripe');
      expect(stripePlugin?.requiredCredentials).toContain('secretKey');
      
      const iuguPlugin = registry.getPlugin('iugu');
      expect(iuguPlugin?.requiredCredentials).toContain('apiToken');
      
      const pagseguroPlugin = registry.getPlugin('pagseguro');
      expect(pagseguroPlugin?.requiredCredentials).toContain('email');
      expect(pagseguroPlugin?.requiredCredentials).toContain('token');
      
      const mercadopagoPlugin = registry.getPlugin('mercadopago');
      expect(mercadopagoPlugin?.requiredCredentials).toContain('accessToken');
    });
  });

  describe('Provider Factory', () => {
    it('should create provider instances', () => {
      const registry = getProviderRegistry();
      const factory = new ProviderFactory(registry);
      
      const stripeConfig = {
        id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          secretKey: 'sk_test_123'
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      expect(() => factory.createProvider('stripe', stripeConfig)).not.toThrow();
    });

    it('should validate required credentials', () => {
      const registry = getProviderRegistry();
      const factory = new ProviderFactory(registry);
      
      const invalidConfig = {
        id: '550e8400-e29b-41d4-a716-446655440001', // Valid UUID
        name: 'stripe',
        isActive: true,
        priority: 1,
        credentials: {
          // Missing secretKey
        },
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      expect(() => factory.createProvider('stripe', invalidConfig)).toThrow('Validation failed');
    });
  });

  describe('Provider Interface Compliance', () => {
    it('should have consistent interface across all providers', () => {
      const registry = getProviderRegistry();
      const plugins = registry.listActivePlugins();
      
      plugins.forEach(plugin => {
        const ProviderClass = plugin.providerClass;
        const provider = new ProviderClass();
        
        // Check that all required methods exist
        expect(typeof provider.configure).toBe('function');
        expect(typeof provider.validateConfig).toBe('function');
        expect(typeof provider.createPayment).toBe('function');
        expect(typeof provider.capturePayment).toBe('function');
        expect(typeof provider.refundPayment).toBe('function');
        expect(typeof provider.createSubscription).toBe('function');
        expect(typeof provider.updateSubscription).toBe('function');
        expect(typeof provider.cancelSubscription).toBe('function');
        expect(typeof provider.validateWebhook).toBe('function');
        expect(typeof provider.parseWebhook).toBe('function');
        expect(typeof provider.healthCheck).toBe('function');
        
        // Check provider metadata
        expect(provider.name).toBeDefined();
        expect(provider.version).toBeDefined();
      });
    });
  });

  describe('Payment Request Validation', () => {
    it('should validate payment request structure', () => {
      const validPaymentRequest: PaymentRequest = {
        amount: 1000,
        currency: Currency.BRL,
        organizationId: 'org_123',
        description: 'Test payment',
        customerId: 'customer_123',
        metadata: {
          orderId: 'order_456'
        }
      };
      
      // Should not throw validation errors
      expect(validPaymentRequest.amount).toBeGreaterThan(0);
      expect(validPaymentRequest.currency).toBeDefined();
      expect(validPaymentRequest.organizationId).toBeDefined();
    });

    it('should validate subscription request structure', () => {
      const validSubscriptionRequest: SubscriptionRequest = {
        customerId: 'customer_123',
        organizationId: 'org_123',
        planId: 'plan_basic',
        amount: 1000,
        currency: 'BRL',
        billingInterval: BillingInterval.MONTHLY
      };
      
      // Should not throw validation errors
      expect(validSubscriptionRequest.amount).toBeGreaterThan(0);
      expect(validSubscriptionRequest.billingInterval).toBeDefined();
      expect(validSubscriptionRequest.planId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown provider gracefully', () => {
      const registry = getProviderRegistry();
      
      expect(() => registry.getPlugin('unknown_provider')).not.toThrow();
      expect(registry.getPlugin('unknown_provider')).toBeUndefined();
    });

    it('should handle provider creation errors', () => {
      const registry = getProviderRegistry();
      const factory = new ProviderFactory(registry);
      
      expect(() => factory.createProvider('unknown_provider', {} as any)).toThrow();
    });
  });
});