import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { config } from '../config/environment';
import { Logger } from '../logging/logger';

export class TracingService {
  private static instance: TracingService;
  private sdk: NodeSDK;
  private logger = Logger.getInstance();

  private constructor() {
    this.sdk = new NodeSDK({
      serviceName: 'payment-microservice',
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable file system instrumentation to reduce noise
        },
      })],
      traceExporter: new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      }),
      metricReader: new PrometheusExporter({
        port: config.monitoring.metricsPort,
      }),
    });
  }

  public static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService();
    }
    return TracingService.instance;
  }

  public initialize(): void {
    try {
      this.sdk.start();
      this.logger.info('OpenTelemetry tracing initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry tracing', error);
    }
  }

  public shutdown(): Promise<void> {
    return this.sdk.shutdown();
  }

  public createSpan(name: string, options?: { kind?: SpanKind; attributes?: Record<string, any> }) {
    const tracer = trace.getTracer('payment-microservice');
    return tracer.startSpan(name, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    });
  }

  public async executeWithSpan<T>(
    name: string,
    operation: () => Promise<T>,
    options?: { kind?: SpanKind; attributes?: Record<string, any> }
  ): Promise<T> {
    const span = this.createSpan(name, options);
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), operation);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  }

  public addSpanAttributes(attributes: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  public addSpanEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }
}