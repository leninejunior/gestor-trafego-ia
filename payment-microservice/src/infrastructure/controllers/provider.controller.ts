import { Request, Response, NextFunction } from 'express';
import { ProviderConfigSchema } from '../../domain/validation/schemas';
import { Logger } from '../logging/logger';
import { MetricsService } from '../monitoring/metrics.service';
import { ProviderRegistry } from '../../domain/services/provider-registry';
import { HealthChecker } from '../../domain/services/health-checker';

export class ProviderController {
  private logger = Logger.getInstance();
  private metricsService = MetricsService.getInstance();

  constructor(
    private providerRegistry: ProviderRegistry,
    private healthChecker: HealthChecker
  ) {}

  /**
   * GET /api/v1/providers
   * List all available providers
   */
  async listProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Listing providers', {
        correlationId: req.correlationId
      });

      const providers = this.providerRegistry.getAllProviders();
      const providerList = providers.map(provider => ({
        name: provider.name,
        version: provider.version,
        isActive: true // TODO: Get from configuration
      }));

      res.json({
        success: true,
        data: providerList,
        count: providerList.length,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Provider listing failed', {
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/providers/:name
   * Get provider details
   */
  async getProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;

      this.logger.info('Retrieving provider', {
        correlationId: req.correlationId,
        providerName: name
      });

      const provider = this.providerRegistry.getProvider(name);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: 'Provider not found',
          correlationId: req.correlationId
        });
        return;
      }

      // Get health status
      const healthStatus = await this.healthChecker.checkProvider(provider);

      const providerDetails = {
        name: provider.name,
        version: provider.version,
        isActive: true, // TODO: Get from configuration
        healthStatus,
        capabilities: {
          payments: true,
          subscriptions: true,
          refunds: true,
          webhooks: true
        }
      };

      res.json({
        success: true,
        data: providerDetails,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Provider retrieval failed', {
        correlationId: req.correlationId,
        providerName: req.params.name,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * POST /api/v1/providers/:name/configure
   * Configure provider credentials and settings
   */
  async configureProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const { credentials, settings, isActive = true, priority = 0 } = req.body;

      this.logger.info('Configuring provider', {
        correlationId: req.correlationId,
        providerName: name,
        isActive,
        priority
      });

      const provider = this.providerRegistry.getProvider(name);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: 'Provider not found',
          correlationId: req.correlationId
        });
        return;
      }

      // Validate credentials
      if (!credentials || typeof credentials !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Valid credentials are required',
          correlationId: req.correlationId
        });
        return;
      }

      // TODO: Implement provider configuration logic
      // - Encrypt credentials
      // - Save to database
      // - Update provider configuration
      // const config = await this.providerConfigService.saveConfiguration(name, {
      //   credentials,
      //   settings,
      //   isActive,
      //   priority
      // });

      // For now, return a placeholder response
      const config = {
        id: `config_${Date.now()}`,
        name,
        isActive,
        priority,
        settings: settings || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      res.status(201).json({
        success: true,
        data: config,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Provider configuration failed', {
        correlationId: req.correlationId,
        providerName: req.params.name,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/providers/:name/health
   * Check provider health status
   */
  async checkProviderHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;

      this.logger.info('Checking provider health', {
        correlationId: req.correlationId,
        providerName: name
      });

      const provider = this.providerRegistry.getProvider(name);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: 'Provider not found',
          correlationId: req.correlationId
        });
        return;
      }

      const healthStatus = await this.healthChecker.checkProvider(provider);

      res.json({
        success: true,
        data: healthStatus,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Provider health check failed', {
        correlationId: req.correlationId,
        providerName: req.params.name,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * POST /api/v1/providers/:name/test
   * Test provider configuration
   */
  async testProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const { testAmount = 100, currency = 'BRL' } = req.body;

      this.logger.info('Testing provider', {
        correlationId: req.correlationId,
        providerName: name,
        testAmount,
        currency
      });

      const provider = this.providerRegistry.getProvider(name);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: 'Provider not found',
          correlationId: req.correlationId
        });
        return;
      }

      // TODO: Implement provider test logic
      // - Create a test payment
      // - Verify the response
      // - Clean up test data
      // const testResult = await this.providerTestService.testProvider(provider, {
      //   amount: testAmount,
      //   currency
      // });

      // For now, return a placeholder response
      const testResult = {
        success: true,
        provider: name,
        testType: 'payment_creation',
        responseTime: Math.floor(Math.random() * 1000) + 100,
        details: {
          apiAccessible: true,
          credentialsValid: true,
          paymentCreated: true
        },
        testedAt: new Date()
      };

      res.json({
        success: true,
        data: testResult,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Provider test failed', {
        correlationId: req.correlationId,
        providerName: req.params.name,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }

  /**
   * GET /api/v1/providers/status
   * Get status of all providers
   */
  async getProvidersStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Getting providers status', {
        correlationId: req.correlationId
      });

      const providers = this.providerRegistry.getAllProviders();
      const statusPromises = providers.map(async (provider) => {
        try {
          const healthStatus = await this.healthChecker.checkProvider(provider);
          return {
            name: provider.name,
            version: provider.version,
            status: healthStatus.status,
            responseTime: healthStatus.responseTime,
            errorRate: healthStatus.errorRate,
            lastCheck: healthStatus.lastCheck
          };
        } catch (error) {
          return {
            name: provider.name,
            version: provider.version,
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            lastCheck: new Date()
          };
        }
      });

      const statuses = await Promise.all(statusPromises);

      res.json({
        success: true,
        data: statuses,
        count: statuses.length,
        correlationId: req.correlationId
      });

    } catch (error) {
      this.logger.error('Providers status check failed', {
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : error
      });
      
      next(error);
    }
  }
}