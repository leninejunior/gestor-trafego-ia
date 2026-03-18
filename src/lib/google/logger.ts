/**
 * Google Ads Structured Logger
 * 
 * Provides structured logging for all Google Ads operations
 * Requirements: 10.3, 10.5
 */

export interface GoogleAdsLogContext {
  connectionId?: string;
  clientId?: string;
  userId?: string;
  organizationId?: string;
  customerId?: string;
  campaignId?: string;
  operation?: string;
  requestId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface GoogleAdsLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: GoogleAdsLogContext;
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

export class GoogleAdsLogger {
  private readonly component = 'GoogleAds';

  /**
   * Log debug information
   */
  debug(message: string, context: GoogleAdsLogContext = {}): void {
    this.log('debug', message, context);
  }

  /**
   * Log informational messages
   */
  info(message: string, context: GoogleAdsLogContext = {}): void {
    this.log('info', message, context);
  }

  /**
   * Log warnings
   */
  warn(message: string, context: GoogleAdsLogContext = {}): void {
    this.log('warn', message, context);
  }

  /**
   * Log errors
   */
  error(message: string, error?: Error, context: GoogleAdsLogContext = {}): void {
    const errorInfo = error ? {
      code: (error as any).code,
      message: error.message,
      stack: error.stack
    } : undefined;

    this.log('error', message, context, errorInfo);
  }

  /**
   * Log API request start
   */
  apiRequestStart(
    endpoint: string,
    method: string,
    context: GoogleAdsLogContext = {}
  ): string {
    const requestId = this.generateRequestId();
    
    this.info(`API Request Started: ${method} ${endpoint}`, {
      ...context,
      operation: 'api_request',
      requestId,
      metadata: {
        endpoint,
        method,
        startTime: Date.now()
      }
    });

    return requestId;
  }

  /**
   * Log API request completion
   */
  apiRequestComplete(
    requestId: string,
    statusCode: number,
    duration: number,
    context: GoogleAdsLogContext = {}
  ): void {
    const level = statusCode >= 400 ? 'error' : 'info';
    
    this.log(level, `API Request Completed: ${statusCode}`, {
      ...context,
      operation: 'api_request',
      requestId,
      duration,
      metadata: {
        statusCode,
        success: statusCode < 400
      }
    });
  }

  /**
   * Log sync operation start
   */
  syncStart(
    syncType: 'campaigns' | 'metrics' | 'full',
    context: GoogleAdsLogContext = {}
  ): string {
    const requestId = this.generateRequestId();
    
    this.info(`Sync Started: ${syncType}`, {
      ...context,
      operation: 'sync',
      requestId,
      metadata: {
        syncType,
        startTime: Date.now()
      }
    });

    return requestId;
  }

  /**
   * Log sync operation completion
   */
  syncComplete(
    requestId: string,
    result: {
      success: boolean;
      campaignsSynced: number;
      metricsUpdated: number;
      errors: number;
    },
    duration: number,
    context: GoogleAdsLogContext = {}
  ): void {
    const level = result.success ? 'info' : 'error';
    
    this.log(level, `Sync Completed: ${result.success ? 'Success' : 'Failed'}`, {
      ...context,
      operation: 'sync',
      requestId,
      duration,
      metadata: {
        ...result,
        endTime: Date.now()
      }
    });
  }

  /**
   * Log authentication events
   */
  authEvent(
    event: 'token_refresh' | 'oauth_start' | 'oauth_complete' | 'oauth_error',
    context: GoogleAdsLogContext = {},
    error?: Error
  ): void {
    const level = event.includes('error') ? 'error' : 'info';
    const message = this.getAuthEventMessage(event);
    
    if (error) {
      this.error(message, error, {
        ...context,
        operation: 'auth',
        metadata: { event }
      });
    } else {
      this.log(level, message, {
        ...context,
        operation: 'auth',
        metadata: { event }
      });
    }
  }

  /**
   * Log performance metrics
   */
  performance(
    operation: string,
    metrics: {
      duration: number;
      memoryUsage?: number;
      recordsProcessed?: number;
      apiCalls?: number;
    },
    context: GoogleAdsLogContext = {}
  ): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      operation: 'performance',
      duration: metrics.duration,
      metadata: {
        operation,
        ...metrics
      }
    });
  }

  /**
   * Log rate limiting events
   */
  rateLimitEvent(
    event: 'limit_hit' | 'backoff_start' | 'backoff_complete',
    details: {
      retryAfter?: number;
      attemptNumber?: number;
      maxRetries?: number;
    },
    context: GoogleAdsLogContext = {}
  ): void {
    this.warn(`Rate Limit: ${event}`, {
      ...context,
      operation: 'rate_limit',
      metadata: {
        event,
        ...details
      }
    });
  }

  /**
   * Core logging method
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context: GoogleAdsLogContext = {},
    error?: { code?: string; message: string; stack?: string }
  ): void {
    const logEntry: GoogleAdsLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.component}] ${message}`,
      context: {
        ...context,
        component: this.component
      },
      error
    };

    // Use appropriate console method
    switch (level) {
      case 'debug':
        console.debug(this.formatLogEntry(logEntry));
        break;
      case 'info':
        console.info(this.formatLogEntry(logEntry));
        break;
      case 'warn':
        console.warn(this.formatLogEntry(logEntry));
        break;
      case 'error':
        console.error(this.formatLogEntry(logEntry));
        break;
    }

    // In production, you might want to send to external logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalLogger(logEntry);
    }
  }

  /**
   * Format log entry for console output
   */
  private formatLogEntry(entry: GoogleAdsLogEntry): string {
    const contextStr = Object.keys(entry.context).length > 0 
      ? ` | Context: ${JSON.stringify(entry.context)}`
      : '';
    
    const errorStr = entry.error 
      ? ` | Error: ${entry.error.message}${entry.error.code ? ` (${entry.error.code})` : ''}`
      : '';

    return `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}${contextStr}${errorStr}`;
  }

  /**
   * Send logs to external service and database
   */
  private async sendToExternalLogger(entry: GoogleAdsLogEntry): Promise<void> {
    try {
      // Store API logs in database if it's an API operation
      if (entry.context.operation === 'api_request' && entry.context.requestId) {
        await this.storeApiLog(entry);
      }

      // Store performance logs if it's a performance operation
      if (entry.context.operation === 'performance' && entry.context.duration) {
        await this.storePerformanceLog(entry);
      }

      // In production, you could also send to external services:
      // - Datadog: await this.sendToDatadog(entry);
      // - New Relic: await this.sendToNewRelic(entry);
      // - CloudWatch: await this.sendToCloudWatch(entry);
      // - Elasticsearch: await this.sendToElasticsearch(entry);
      
      if (entry.level === 'error') {
        await this.triggerAlert(entry);
      }
    } catch (error) {
      // Don't let logging errors break the main application
      console.error('[Logger] Failed to send to external logger:', error);
    }
  }

  /**
   * Store API logs in database
   */
  private async storeApiLog(entry: GoogleAdsLogEntry): Promise<void> {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();

      const metadata = entry.context.metadata || {};
      
      await supabase
        .from('google_ads_api_logs')
        .insert({
          request_id: entry.context.requestId!,
          endpoint: metadata.endpoint || 'unknown',
          method: metadata.method || 'unknown',
          status_code: metadata.statusCode,
          duration: entry.context.duration,
          connection_id: entry.context.connectionId,
          client_id: entry.context.clientId,
          user_id: entry.context.userId,
          error_code: entry.error?.code,
          error_message: entry.error?.message,
          created_at: entry.timestamp
        });
    } catch (error) {
      console.error('[Logger] Failed to store API log:', error);
    }
  }

  /**
   * Store performance logs in database
   */
  private async storePerformanceLog(entry: GoogleAdsLogEntry): Promise<void> {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();

      const metadata = entry.context.metadata || {};
      
      await supabase
        .from('google_ads_performance_logs')
        .insert({
          operation: metadata.operation || 'unknown',
          duration: entry.context.duration!,
          memory_usage: metadata.memoryUsage,
          records_processed: metadata.recordsProcessed,
          api_calls: metadata.apiCalls,
          connection_id: entry.context.connectionId,
          client_id: entry.context.clientId,
          user_id: entry.context.userId,
          metadata: metadata,
          created_at: entry.timestamp
        });
    } catch (error) {
      console.error('[Logger] Failed to store performance log:', error);
    }
  }

  /**
   * Trigger alerts for critical errors
   */
  private async triggerAlert(entry: GoogleAdsLogEntry): Promise<void> {
    try {
      // Determine alert severity based on error type
      const severity = this.determineAlertSeverity(entry);
      
      if (severity === 'low') return; // Don't create alerts for low severity

      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();

      // Create alert in database
      await supabase
        .from('google_ads_alerts')
        .insert({
          alert_type: this.getAlertType(entry),
          severity,
          title: this.generateAlertTitle(entry),
          message: entry.message,
          current_value: entry.context.duration || 1,
          connection_id: entry.context.connectionId,
          organization_id: entry.context.organizationId,
          is_active: true,
          created_at: entry.timestamp
        });

      // In production, you could also:
      // - Send to Slack/Discord: await this.sendToSlack(entry);
      // - Create PagerDuty incident: await this.createPagerDutyIncident(entry);
      // - Send email to administrators: await this.sendEmailAlert(entry);
      // - Update monitoring dashboard: await this.updateDashboard(entry);
      
      console.error('[ALERT] Critical Google Ads Error:', {
        severity,
        title: this.generateAlertTitle(entry),
        message: entry.message,
        context: entry.context
      });
    } catch (error) {
      console.error('[Logger] Failed to trigger alert:', error);
    }
  }

  /**
   * Determine alert severity based on error
   */
  private determineAlertSeverity(entry: GoogleAdsLogEntry): 'low' | 'medium' | 'high' | 'critical' {
    if (entry.level !== 'error') return 'low';

    const errorCode = entry.error?.code;
    const operation = entry.context.operation;

    // Critical errors
    if (errorCode?.includes('AUTH') || errorCode?.includes('PERMISSION')) {
      return 'critical';
    }

    // High severity errors
    if (operation === 'sync' || errorCode?.includes('RATE_LIMIT')) {
      return 'high';
    }

    // Medium severity for API errors
    if (operation === 'api_request') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get alert type based on error
   */
  private getAlertType(entry: GoogleAdsLogEntry): string {
    const errorCode = entry.error?.code;
    const operation = entry.context.operation;

    if (errorCode?.includes('AUTH') || errorCode?.includes('PERMISSION')) {
      return 'token_expiry';
    }

    if (errorCode?.includes('RATE_LIMIT')) {
      return 'rate_limit';
    }

    if (operation === 'sync') {
      return 'sync_failure';
    }

    if (entry.context.duration && entry.context.duration > 10000) {
      return 'performance';
    }

    return 'error_rate';
  }

  /**
   * Generate alert title
   */
  private generateAlertTitle(entry: GoogleAdsLogEntry): string {
    const operation = entry.context.operation;
    const errorCode = entry.error?.code;

    if (errorCode?.includes('AUTH')) {
      return 'Google Ads Authentication Failed';
    }

    if (errorCode?.includes('RATE_LIMIT')) {
      return 'Google Ads Rate Limit Exceeded';
    }

    if (operation === 'sync') {
      return 'Google Ads Sync Failed';
    }

    if (operation === 'api_request') {
      return 'Google Ads API Error';
    }

    return 'Google Ads System Error';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `gads_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get human-readable auth event message
   */
  private getAuthEventMessage(event: string): string {
    switch (event) {
      case 'token_refresh':
        return 'Access token refreshed successfully';
      case 'oauth_start':
        return 'OAuth flow initiated';
      case 'oauth_complete':
        return 'OAuth flow completed successfully';
      case 'oauth_error':
        return 'OAuth flow failed';
      default:
        return `Authentication event: ${event}`;
    }
  }
}

// Singleton instance
export const googleAdsLogger = new GoogleAdsLogger();