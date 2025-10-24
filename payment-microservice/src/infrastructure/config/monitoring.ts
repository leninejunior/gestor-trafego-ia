import { config } from './environment';

export const monitoringConfig = {
  // Tracing configuration
  tracing: {
    serviceName: 'payment-microservice',
    serviceVersion: '1.0.0',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '1.0'),
    enableConsoleExporter: config.env === 'development',
  },

  // Metrics configuration
  metrics: {
    port: config.monitoring.metricsPort,
    endpoint: '/metrics',
    collectDefaultMetrics: true,
    defaultMetricsPrefix: 'payment_service_',
    buckets: {
      duration: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      size: [1, 10, 100, 1000, 10000, 100000],
    },
  },

  // Logging configuration
  logging: {
    level: config.logging.level,
    format: 'json',
    enableCorrelationId: true,
    enableTracing: true,
    maxFileSize: '10MB',
    maxFiles: 5,
    auditLog: {
      enabled: true,
      level: 'info',
    },
    performanceLog: {
      enabled: true,
      threshold: 1000, // Log slow operations > 1s
    },
    securityLog: {
      enabled: true,
      level: 'warn',
    },
  },

  // Health check configuration
  healthCheck: {
    interval: config.monitoring.healthCheckInterval,
    timeout: 5000,
    retries: 3,
    endpoints: {
      database: true,
      redis: true,
      providers: true,
    },
  },

  // Alerting thresholds
  alerts: {
    errorRate: {
      threshold: 0.05, // 5%
      window: '5m',
    },
    responseTime: {
      threshold: 5000, // 5 seconds
      percentile: 95,
    },
    memoryUsage: {
      threshold: 0.8, // 80%
    },
    cpuUsage: {
      threshold: 0.8, // 80%
    },
    providerHealth: {
      threshold: 0.9, // 90% success rate
      window: '1m',
    },
  },
};