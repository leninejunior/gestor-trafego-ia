import * as promClient from 'prom-client';
import { Logger } from '../logging/logger';

export class MetricsService {
  private static instance: MetricsService;
  private register: promClient.Registry;
  private logger = Logger.getInstance();

  // Payment-specific metrics
  public readonly paymentCounter: promClient.Counter<string>;
  public readonly paymentDuration: promClient.Histogram<string>;
  public readonly providerHealth: promClient.Gauge<string>;
  public readonly activeConnections: promClient.Gauge<string>;
  public readonly errorRate: promClient.Counter<string>;
  public readonly queueSize: promClient.Gauge<string>;

  private constructor() {
    this.register = new promClient.Registry();
    
    // Collect default metrics
    promClient.collectDefaultMetrics({
      register: this.register,
      prefix: 'payment_service_',
    });

    // Initialize custom metrics
    this.paymentCounter = new promClient.Counter({
      name: 'payment_transactions_total',
      help: 'Total number of payment transactions',
      labelNames: ['provider', 'status', 'currency', 'type'],
      registers: [this.register],
    });

    this.paymentDuration = new promClient.Histogram({
      name: 'payment_duration_seconds',
      help: 'Payment processing duration in seconds',
      labelNames: ['provider', 'type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register],
    });

    this.providerHealth = new promClient.Gauge({
      name: 'payment_provider_health',
      help: 'Payment provider health status (1 = healthy, 0 = unhealthy)',
      labelNames: ['provider'],
      registers: [this.register],
    });

    this.activeConnections = new promClient.Gauge({
      name: 'payment_active_connections',
      help: 'Number of active connections to payment providers',
      labelNames: ['provider'],
      registers: [this.register],
    });

    this.errorRate = new promClient.Counter({
      name: 'payment_errors_total',
      help: 'Total number of payment errors',
      labelNames: ['provider', 'error_type', 'error_code'],
      registers: [this.register],
    });

    this.queueSize = new promClient.Gauge({
      name: 'payment_queue_size',
      help: 'Number of payments in processing queue',
      labelNames: ['queue_type'],
      registers: [this.register],
    });
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  public getRegistry(): promClient.Registry {
    return this.register;
  }

  public async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // Convenience methods for recording metrics
  public recordPayment(provider: string, status: string, currency: string, type: string): void {
    this.paymentCounter.inc({ provider, status, currency, type });
  }

  public recordPaymentDuration(provider: string, type: string, duration: number): void {
    this.paymentDuration.observe({ provider, type }, duration);
  }

  public setProviderHealth(provider: string, isHealthy: boolean): void {
    this.providerHealth.set({ provider }, isHealthy ? 1 : 0);
  }

  public setActiveConnections(provider: string, count: number): void {
    this.activeConnections.set({ provider }, count);
  }

  public recordError(provider: string, errorType: string, errorCode?: string): void {
    this.errorRate.inc({ provider, error_type: errorType, error_code: errorCode || 'unknown' });
  }

  public setQueueSize(queueType: string, size: number): void {
    this.queueSize.set({ queue_type: queueType }, size);
  }

  // Additional convenience methods for controllers
  public recordPaymentProcessed(status: string, duration: number, provider?: string): void {
    const durationInSeconds = duration / 1000;
    this.paymentCounter.inc({ 
      provider: provider || 'auto', 
      status, 
      currency: 'unknown', 
      type: 'payment' 
    });
    this.paymentDuration.observe({ 
      provider: provider || 'auto', 
      type: 'payment' 
    }, durationInSeconds);
  }

  public recordRefundProcessed(status: string, duration: number, provider?: string): void {
    const durationInSeconds = duration / 1000;
    this.paymentCounter.inc({ 
      provider: provider || 'auto', 
      status, 
      currency: 'unknown', 
      type: 'refund' 
    });
    this.paymentDuration.observe({ 
      provider: provider || 'auto', 
      type: 'refund' 
    }, durationInSeconds);
  }

  public recordSubscriptionProcessed(status: string, duration: number, provider?: string): void {
    const durationInSeconds = duration / 1000;
    this.paymentCounter.inc({ 
      provider: provider || 'auto', 
      status, 
      currency: 'unknown', 
      type: 'subscription' 
    });
    this.paymentDuration.observe({ 
      provider: provider || 'auto', 
      type: 'subscription' 
    }, durationInSeconds);
  }

  public recordWebhookProcessed(provider: string, status: string, duration: number): void {
    const durationInSeconds = duration / 1000;
    this.paymentCounter.inc({ 
      provider, 
      status, 
      currency: 'unknown', 
      type: 'webhook' 
    });
    this.paymentDuration.observe({ 
      provider, 
      type: 'webhook' 
    }, durationInSeconds);
  }

  // Method to create custom metrics
  public createCounter(name: string, help: string, labelNames?: string[]): promClient.Counter<string> {
    return new promClient.Counter({
      name,
      help,
      labelNames,
      registers: [this.register],
    });
  }

  public createGauge(name: string, help: string, labelNames?: string[]): promClient.Gauge<string> {
    return new promClient.Gauge({
      name,
      help,
      labelNames,
      registers: [this.register],
    });
  }

  public createHistogram(
    name: string,
    help: string,
    labelNames?: string[],
    buckets?: number[]
  ): promClient.Histogram<string> {
    return new promClient.Histogram({
      name,
      help,
      labelNames,
      buckets,
      registers: [this.register],
    });
  }
}