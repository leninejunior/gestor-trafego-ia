import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '../config/environment';
import { Logger } from '../logging/logger';
import { HealthController } from '../controllers/health.controller';
import { MetricsController } from '../controllers/metrics.controller';
import { initializeDatabase } from '../database/data-source';
import { RedisService } from '../cache/redis.service';
import { TracingService } from '../monitoring/tracing.service';
import { CorrelationMiddleware } from '../middleware/correlation.middleware';
import { initializeProviders } from '../providers/provider-loader';
import { setupContainer } from '../container/setup';
import { v1Router } from '../routes/v1';
import { v2Router } from '../routes/v2';
import { graphqlServerManager } from '../graphql/server';
import { createServer } from 'http';

export class Application {
  private app: express.Application;
  private logger = Logger.getInstance();

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    const correlationMiddleware = new CorrelationMiddleware();

    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(compression());

    // Correlation and tracing middleware
    this.app.use(correlationMiddleware.correlationId());
    this.app.use(correlationMiddleware.requestLogging());
    this.app.use(correlationMiddleware.rateLimiting());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    const healthController = new HealthController();
    const metricsController = new MetricsController();

    // Health check routes
    this.app.get('/health', healthController.health.bind(healthController));
    this.app.get('/ready', healthController.ready.bind(healthController));
    
    // Metrics route
    this.app.get('/metrics', metricsController.metrics.bind(metricsController));

    // API versioned routes
    this.app.use('/api/v1', v1Router);
    this.app.use('/api/v2', v2Router);

    // Root API info
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Payment Microservice API',
        description: 'Multi-provider payment processing microservice',
        versions: {
          v1: {
            status: 'stable',
            path: '/api/v1',
            documentation: '/api/v1/docs'
          },
          v2: {
            status: 'coming_soon',
            path: '/api/v2',
            availableFrom: '2024-Q2'
          }
        },
        health: '/health',
        metrics: '/metrics'
      });
    });
  }

  private setupErrorHandling(): void {
    const correlationMiddleware = new CorrelationMiddleware();

    // 404 handler
    this.app.use('*', (req, res) => {
      this.logger.warn('Route not found', {
        correlationId: req.correlationId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      });

      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        correlationId: req.correlationId,
      });
    });

    // Error logging middleware
    this.app.use(correlationMiddleware.errorLogging());

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const statusCode = (error as any).statusCode || 500;
      
      res.status(statusCode).json({
        error: statusCode >= 500 ? 'Internal Server Error' : error.name,
        message: config.env === 'production' && statusCode >= 500 ? 'Something went wrong' : error.message,
        correlationId: req.correlationId,
      });
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize tracing first
      const tracingService = TracingService.getInstance();
      tracingService.initialize();
      this.logger.info('Tracing initialized successfully');

      // Setup dependency injection container
      setupContainer();
      this.logger.info('Dependency container initialized successfully');

      // Initialize database
      await initializeDatabase();
      this.logger.info('Database initialized successfully');

      // Initialize Redis
      const redisService = RedisService.getInstance();
      await redisService.connect();
      this.logger.info('Redis connected successfully');

      // Initialize payment providers
      await initializeProviders();
      this.logger.info('Payment providers initialized successfully');

      // Create HTTP server for both Express and GraphQL
      const httpServer = createServer(this.app);

      // Setup GraphQL server
      await graphqlServerManager.createServer(this.app);
      await graphqlServerManager.start();
      await graphqlServerManager.setupSubscriptions(httpServer);
      this.logger.info('GraphQL server initialized successfully');

      // Start HTTP server
      return new Promise((resolve) => {
        httpServer.listen(config.port, () => {
          this.logger.info(`Payment Microservice listening on port ${config.port}`, {
            port: config.port,
            env: config.env,
            nodeVersion: process.version,
            endpoints: {
              rest: `/api/v1`,
              graphql: `/graphql`,
              playground: config.env !== 'production' ? `/graphql` : 'disabled'
            }
          });
          resolve();
        });
      });
    } catch (error) {
      this.logger.error('Failed to start application', error);
      throw error;
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}