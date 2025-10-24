import { Request, Response } from 'express';
import { Logger } from '../logging/logger';
import { AppDataSource } from '../database/data-source';
import { RedisService } from '../cache/redis.service';

export class HealthController {
  private logger = Logger.getInstance();

  public async health(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      };

      res.status(200).json(healthStatus);
    } catch (error) {
      this.logger.error('Health check failed', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  public async ready(req: Request, res: Response): Promise<void> {
    try {
      // Check database connection
      const databaseCheck = await this.checkDatabase();
      
      // Check Redis connection
      const redisCheck = await this.checkRedis();
      
      const readinessChecks = {
        database: databaseCheck,
        redis: redisCheck,
        providers: true, // TODO: Implement provider health checks
      };

      const isReady = Object.values(readinessChecks).every(check => check);

      if (isReady) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          checks: readinessChecks,
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          checks: readinessChecks,
        });
      }
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      if (!AppDataSource.isInitialized) {
        return false;
      }
      
      // Simple query to check database connectivity
      await AppDataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const redisService = RedisService.getInstance();
      return await redisService.healthCheck();
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return false;
    }
  }
}