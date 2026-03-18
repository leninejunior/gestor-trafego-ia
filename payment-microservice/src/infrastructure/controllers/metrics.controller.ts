import { Request, Response } from 'express';
import { Logger } from '../logging/logger';
import { MetricsService } from '../monitoring/metrics.service';

export class MetricsController {
  private logger = Logger.getInstance();
  private metricsService = MetricsService.getInstance();

  public async metrics(req: Request, res: Response): Promise<void> {
    try {
      const correlationId = this.logger.generateCorrelationId();
      
      this.logger.debug('Metrics endpoint accessed', {
        correlationId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.set('Content-Type', this.metricsService.getRegistry().contentType);
      const metrics = await this.metricsService.getMetrics();
      res.end(metrics);

      this.logger.debug('Metrics successfully generated', {
        correlationId,
        metricsSize: metrics.length,
      });
    } catch (error) {
      this.logger.error('Failed to generate metrics', error, {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
      
      res.status(500).json({
        error: 'Failed to generate metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}