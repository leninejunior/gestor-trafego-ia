import DataLoader from 'dataloader';
import { PaymentService } from '../../application/services/payment.service';
import { ProviderRegistry } from '../../domain/services/provider-registry';
import { HealthChecker } from '../../domain/services/health-checker';
import { Logger } from '../logging/logger';
import { container } from '../container/container';

const logger = Logger.getInstance();

/**
 * DataLoader implementation for optimizing GraphQL queries
 * Batches and caches database requests to prevent N+1 query problems
 */

// Payment DataLoader
export const createPaymentLoader = () => {
  return new DataLoader<string, any>(async (paymentIds: readonly string[]) => {
    try {
      const paymentService = container.get<PaymentService>('PaymentService');
      
      // Batch load payments
      const payments = await Promise.all(
        paymentIds.map(id => paymentService.getTransaction(id))
      );
      
      return payments;
    } catch (error) {
      logger.error('PaymentLoader batch load failed', { paymentIds, error });
      throw error;
    }
  });
};

// Provider DataLoader
export const createProviderLoader = () => {
  return new DataLoader<string, any>(async (providerNames: readonly string[]) => {
    try {
      const providerRegistry = container.get<ProviderRegistry>('ProviderRegistry');
      
      // Batch load providers
      const providers = providerNames.map(name => {
        const provider = providerRegistry.getProvider(name);
        return provider ? {
          name: provider.name,
          version: provider.version,
          isActive: true, // TODO: Get from configuration
          priority: 0 // TODO: Get from configuration
        } : null;
      });
      
      return providers;
    } catch (error) {
      logger.error('ProviderLoader batch load failed', { providerNames, error });
      throw error;
    }
  });
};

// Provider Health DataLoader
export const createProviderHealthLoader = () => {
  return new DataLoader<string, any>(async (providerNames: readonly string[]) => {
    try {
      const providerRegistry = container.get<ProviderRegistry>('ProviderRegistry');
      const healthChecker = container.get<HealthChecker>('HealthChecker');
      
      // Batch load provider health statuses
      const healthStatuses = await Promise.all(
        providerNames.map(async (name) => {
          try {
            const provider = providerRegistry.getProvider(name);
            if (!provider) {
              return null;
            }
            
            return await healthChecker.checkProvider(provider);
          } catch (error) {
            logger.error('Provider health check failed in DataLoader', { providerName: name, error });
            return {
              status: 'UNHEALTHY',
              lastCheck: new Date(),
              details: { error: 'Health check failed' }
            };
          }
        })
      );
      
      return healthStatuses;
    } catch (error) {
      logger.error('ProviderHealthLoader batch load failed', { providerNames, error });
      throw error;
    }
  });
};

// Organization Transactions DataLoader
export const createOrganizationTransactionsLoader = () => {
  return new DataLoader<string, any[]>(async (organizationIds: readonly string[]) => {
    try {
      const paymentService = container.get<PaymentService>('PaymentService');
      
      // Batch load transactions by organization
      const transactionsByOrg = await Promise.all(
        organizationIds.map(orgId => paymentService.getTransactionsByOrganization(orgId))
      );
      
      return transactionsByOrg;
    } catch (error) {
      logger.error('OrganizationTransactionsLoader batch load failed', { organizationIds, error });
      throw error;
    }
  });
};

// Provider Metrics DataLoader
export const createProviderMetricsLoader = () => {
  return new DataLoader<string, any>(async (providerNames: readonly string[]) => {
    try {
      // TODO: Implement actual metrics loading from database/cache
      const metrics = providerNames.map(name => ({
        totalTransactions: Math.floor(Math.random() * 1000) + 100,
        successfulTransactions: Math.floor(Math.random() * 950) + 90,
        successRate: 95.0 + Math.random() * 4,
        averageResponseTime: 1000 + Math.random() * 500,
        period: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          end: new Date()
        }
      }));
      
      return metrics;
    } catch (error) {
      logger.error('ProviderMetricsLoader batch load failed', { providerNames, error });
      throw error;
    }
  });
};

/**
 * Create all DataLoaders for a GraphQL request context
 */
export const createDataLoaders = () => {
  return {
    paymentLoader: createPaymentLoader(),
    providerLoader: createProviderLoader(),
    providerHealthLoader: createProviderHealthLoader(),
    organizationTransactionsLoader: createOrganizationTransactionsLoader(),
    providerMetricsLoader: createProviderMetricsLoader()
  };
};

export type DataLoaders = ReturnType<typeof createDataLoaders>;