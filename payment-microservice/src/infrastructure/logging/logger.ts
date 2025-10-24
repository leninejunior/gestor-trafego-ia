import * as winston from 'winston';
import { config } from '../config/environment';
import { trace, context } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

interface LogContext {
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  transactionId?: string;
  providerName?: string;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private correlationId: string | null = null;

  private constructor() {
    // Custom format for structured logging
    const structuredFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf((info) => {
        const span = trace.getActiveSpan();
        const spanContext = span?.spanContext();
        
        const { timestamp, level, message, ...otherInfo } = info;
        
        const logEntry = {
          '@timestamp': timestamp,
          level,
          message,
          service: 'payment-microservice',
          correlationId: this.correlationId || info.correlationId,
          traceId: spanContext?.traceId,
          spanId: spanContext?.spanId,
          ...otherInfo,
        };

        return JSON.stringify(logEntry);
      })
    );

    this.logger = winston.createLogger({
      level: config.logging.level,
      format: structuredFormat,
      defaultMeta: { service: 'payment-microservice' },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
      ],
    });

    if (config.env !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf((info) => {
            const span = trace.getActiveSpan();
            const spanContext = span?.spanContext();
            const traceInfo = spanContext ? `[${spanContext.traceId.slice(-8)}:${spanContext.spanId.slice(-8)}]` : '';
            const correlationInfo = this.correlationId ? `[${this.correlationId.slice(-8)}]` : '';
            
            return `${info.timestamp} ${info.level}: ${traceInfo}${correlationInfo} ${info.message} ${
              Object.keys(info).length > 3 ? JSON.stringify(info, null, 2) : ''
            }`;
          })
        )
      }));
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  public generateCorrelationId(): string {
    const correlationId = uuidv4();
    this.setCorrelationId(correlationId);
    return correlationId;
  }

  public clearCorrelationId(): void {
    this.correlationId = null;
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, this.enrichContext(context));
  }

  public error(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : { error };

    this.logger.error(message, this.enrichContext({ ...context, ...errorContext }));
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.enrichContext(context));
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.enrichContext(context));
  }

  public audit(action: string, context: LogContext): void {
    this.logger.info(`AUDIT: ${action}`, this.enrichContext({ ...context, audit: true }));
  }

  public performance(operation: string, duration: number, context?: LogContext): void {
    this.logger.info(`PERFORMANCE: ${operation}`, this.enrichContext({
      ...context,
      performance: true,
      duration,
      durationMs: Math.round(duration * 1000),
    }));
  }

  public security(event: string, context?: LogContext): void {
    this.logger.warn(`SECURITY: ${event}`, this.enrichContext({ ...context, security: true }));
  }

  private enrichContext(context?: LogContext): LogContext {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();

    return {
      correlationId: this.correlationId || undefined,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      timestamp: new Date().toISOString(),
      ...context,
    };
  }

  // Method to create child logger with persistent context
  public child(context: LogContext): Logger {
    const childLogger = Object.create(this);
    childLogger.defaultContext = { ...this.enrichContext(), ...context };
    return childLogger;
  }

  // Async context-aware logging
  public async withContext<T>(context: LogContext, operation: () => Promise<T>): Promise<T> {
    const originalCorrelationId = this.correlationId;
    
    try {
      if (context.correlationId) {
        this.setCorrelationId(context.correlationId);
      }
      
      return await operation();
    } finally {
      this.correlationId = originalCorrelationId;
    }
  }
}