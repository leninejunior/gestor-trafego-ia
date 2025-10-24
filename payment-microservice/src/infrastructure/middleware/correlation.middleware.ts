import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../logging/logger';
import { TracingService } from '../monitoring/tracing.service';
import { MetricsService } from '../monitoring/metrics.service';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
    }
  }
}

export class CorrelationMiddleware {
  private logger = Logger.getInstance();
  private tracingService = TracingService.getInstance();
  private metricsService = MetricsService.getInstance();

  public correlationId() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Generate or extract correlation ID
      const correlationId = req.headers['x-correlation-id'] as string || 
                           req.headers['x-request-id'] as string || 
                           uuidv4();

      req.correlationId = correlationId;
      req.startTime = Date.now();

      // Set correlation ID in logger context
      this.logger.setCorrelationId(correlationId);

      // Add correlation ID to response headers
      res.setHeader('x-correlation-id', correlationId);

      // Add tracing attributes
      this.tracingService.addSpanAttributes({
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.route?.path,
        'correlation.id': correlationId,
        'user.agent': req.get('User-Agent'),
        'client.ip': req.ip,
      });

      next();
    };
  }

  public requestLogging() {
    return (req: Request, res: Response, next: NextFunction): void => {
      this.logger.info('Request started', {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: req.get('Content-Length'),
      });

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const duration = (Date.now() - req.startTime) / 1000;
        
        // Log response
        Logger.getInstance().info('Request completed', {
          correlationId: req.correlationId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('Content-Length'),
        });

        // Record metrics
        MetricsService.getInstance().recordPaymentDuration('http', 'request', duration);

        // Add tracing attributes
        TracingService.getInstance().addSpanAttributes({
          'http.status_code': res.statusCode,
          'http.response.duration': duration,
        });

        // Clear correlation ID from logger
        Logger.getInstance().clearCorrelationId();

        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  public errorLogging() {
    return (error: Error, req: Request, res: Response, next: NextFunction): void => {
      this.logger.error('Request error', error, {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      // Record error metrics
      this.metricsService.recordError('http', 'request_error', res.statusCode?.toString());

      // Add error to tracing
      this.tracingService.addSpanEvent('error', {
        'error.name': error.name,
        'error.message': error.message,
      });

      next(error);
    };
  }

  public rateLimiting() {
    const requests = new Map<string, { count: number; resetTime: number }>();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100; // per window

    return (req: Request, res: Response, next: NextFunction): void => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      
      const clientData = requests.get(clientId);
      
      if (!clientData || now > clientData.resetTime) {
        requests.set(clientId, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      if (clientData.count >= maxRequests) {
        this.logger.security('Rate limit exceeded', {
          correlationId: req.correlationId,
          clientId,
          count: clientData.count,
          maxRequests,
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
        });
        return;
      }

      clientData.count++;
      next();
    };
  }
}