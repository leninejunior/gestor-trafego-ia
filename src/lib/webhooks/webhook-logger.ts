/**
 * Webhook Logger
 * 
 * Comprehensive logging system for webhook events with database persistence
 * and structured logging capabilities.
 * 
 * Requirements: 4.1, 4.2
 */

import { createClient } from '@supabase/supabase-js';
import {
  WebhookEvent,
  WebhookProcessingContext,
  WebhookProcessingResult,
  WebhookLoggingConfig,
  WebhookLogEntry,
  ProcessingStepLog,
  ProcessingStatus,
} from '@/lib/types/webhook';

/**
 * Webhook logger with database persistence and structured logging
 */
export class WebhookLogger {
  private supabase;
  private config: WebhookLoggingConfig;
  private processingSteps: Map<string, ProcessingStepLog[]> = new Map();

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config?: Partial<WebhookLoggingConfig>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      logLevel: 'info',
      logPayloads: true,
      logResponses: true,
      retentionDays: 30,
      ...config,
    };
  }

  // =============================================
  // EVENT LOGGING METHODS
  // =============================================

  /**
   * Log webhook event received
   */
  async logEventReceived(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<void> {
    try {
      await this.createLogEntry({
        event_id: event.id,
        event_type: event.type,
        status: 'received',
        payload: this.config.logPayloads ? event.data : {},
        retry_count: 0,
        created_at: new Date().toISOString(),
      });

      this.logToConsole('info', `Webhook event received: ${event.type} (${event.id})`, {
        eventId: event.id,
        eventType: event.type,
        processingId: context.processingId,
      });

      this.initializeProcessingSteps(context.processingId);
      this.addProcessingStep(context.processingId, 'event_received', {
        event_id: event.id,
        event_type: event.type,
        source: event.source,
      });

    } catch (error) {
      this.logToConsole('error', `Failed to log event received: ${error.message}`, {
        eventId: event.id,
        error: error.message,
      });
    }
  }

  /**
   * Log webhook event processed successfully
   */
  async logEventProcessed(
    event: WebhookEvent,
    context: WebhookProcessingContext,
    result: any
  ): Promise<void> {
    try {
      await this.updateLogEntry(event.id, {
        status: 'processed',
        response: this.config.logResponses ? result : {},
        processing_time: Date.now() - context.startTime,
        processed_at: new Date().toISOString(),
      });

      this.logToConsole('info', `Webhook event processed: ${event.type} (${event.id})`, {
        eventId: event.id,
        eventType: event.type,
        processingId: context.processingId,
        processingTime: Date.now() - context.startTime,
      });

      this.addProcessingStep(context.processingId, 'event_processed', {
        result: result,
        processing_time: Date.now() - context.startTime,
      });

    } catch (error) {
      this.logToConsole('error', `Failed to log event processed: ${error.message}`, {
        eventId: event.id,
        error: error.message,
      });
    }
  }

  /**
   * Log webhook event error
   */
  async logEventError(
    event: WebhookEvent,
    context: WebhookProcessingContext,
    error: Error
  ): Promise<void> {
    try {
      await this.updateLogEntry(event.id, {
        status: 'failed',
        error_message: error.message,
        response: this.config.logResponses ? {
          error: error.message,
          stack: error.stack,
        } : {},
        processing_time: Date.now() - context.startTime,
        processed_at: new Date().toISOString(),
      });

      this.logToConsole('error', `Webhook event failed: ${event.type} (${event.id})`, {
        eventId: event.id,
        eventType: event.type,
        processingId: context.processingId,
        error: error.message,
        processingTime: Date.now() - context.startTime,
      });

      this.addProcessingStep(context.processingId, 'event_failed', {
        error: error.message,
        error_type: error.constructor.name,
        processing_time: Date.now() - context.startTime,
      });

    } catch (logError) {
      this.logToConsole('error', `Failed to log event error: ${logError.message}`, {
        eventId: event.id,
        originalError: error.message,
        logError: logError.message,
      });
    }
  }

  /**
   * Log duplicate event
   */
  async logEventDuplicate(
    event: WebhookEvent,
    context: WebhookProcessingContext
  ): Promise<void> {
    try {
      this.logToConsole('warn', `Duplicate webhook event: ${event.type} (${event.id})`, {
        eventId: event.id,
        eventType: event.type,
        processingId: context.processingId,
      });

      this.addProcessingStep(context.processingId, 'event_duplicate', {
        event_id: event.id,
        event_type: event.type,
      });

    } catch (error) {
      this.logToConsole('error', `Failed to log duplicate event: ${error.message}`, {
        eventId: event.id,
        error: error.message,
      });
    }
  }

  /**
   * Log retry attempt
   */
  async logRetryAttempt(
    event: WebhookEvent,
    context: WebhookProcessingContext,
    attempt: number,
    error: Error
  ): Promise<void> {
    try {
      await this.updateLogEntry(event.id, {
        status: 'retrying',
        retry_count: attempt,
        error_message: error.message,
        processing_time: Date.now() - context.startTime,
      });

      this.logToConsole('warn', `Webhook retry attempt ${attempt}: ${event.type} (${event.id})`, {
        eventId: event.id,
        eventType: event.type,
        processingId: context.processingId,
        attempt,
        error: error.message,
      });

      this.addProcessingStep(context.processingId, 'retry_attempt', {
        attempt,
        error: error.message,
        next_retry_delay: this.calculateNextRetryDelay(attempt),
      });

    } catch (logError) {
      this.logToConsole('error', `Failed to log retry attempt: ${logError.message}`, {
        eventId: event.id,
        attempt,
        error: logError.message,
      });
    }
  }

  // =============================================
  // PROCESSING STEP LOGGING
  // =============================================

  /**
   * Log processing step
   */
  async logProcessingStep(
    event: WebhookEvent,
    context: WebhookProcessingContext,
    step: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      this.addProcessingStep(context.processingId, step, data);

      if (this.config.logLevel === 'debug') {
        this.logToConsole('debug', `Processing step: ${step}`, {
          eventId: event.id,
          processingId: context.processingId,
          step,
          data,
        });
      }

    } catch (error) {
      this.logToConsole('error', `Failed to log processing step: ${error.message}`, {
        eventId: event.id,
        step,
        error: error.message,
      });
    }
  }

  /**
   * Initialize processing steps for a processing session
   */
  private initializeProcessingSteps(processingId: string): void {
    this.processingSteps.set(processingId, []);
  }

  /**
   * Add processing step
   */
  private addProcessingStep(
    processingId: string,
    step: string,
    data: Record<string, any>
  ): void {
    const steps = this.processingSteps.get(processingId) || [];
    const stepLog: ProcessingStepLog = {
      step,
      timestamp: Date.now(),
      data,
    };

    // Calculate duration from previous step
    if (steps.length > 0) {
      const previousStep = steps[steps.length - 1];
      stepLog.duration = stepLog.timestamp - previousStep.timestamp;
    }

    steps.push(stepLog);
    this.processingSteps.set(processingId, steps);
  }

  /**
   * Get processing steps for a session
   */
  getProcessingSteps(processingId: string): ProcessingStepLog[] {
    return this.processingSteps.get(processingId) || [];
  }

  /**
   * Clear processing steps for a session
   */
  clearProcessingSteps(processingId: string): void {
    this.processingSteps.delete(processingId);
  }

  // =============================================
  // DATABASE OPERATIONS
  // =============================================

  /**
   * Create webhook log entry in database
   */
  private async createLogEntry(logData: Partial<WebhookLogEntry>): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_logs')
      .insert({
        id: this.generateLogId(),
        ...logData,
      });

    if (error) {
      throw new Error(`Failed to create webhook log entry: ${error.message}`);
    }
  }

  /**
   * Update webhook log entry in database
   */
  private async updateLogEntry(
    eventId: string,
    updates: Partial<WebhookLogEntry>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_logs')
      .update(updates)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to update webhook log entry: ${error.message}`);
    }
  }

  /**
   * Log webhook event with subscription intent association
   */
  async logWebhookEvent(
    event: WebhookEvent,
    subscriptionIntentId?: string
  ): Promise<void> {
    try {
      await this.createLogEntry({
        event_id: event.id,
        event_type: event.type,
        subscription_intent_id: subscriptionIntentId,
        status: 'processing',
        payload: this.config.logPayloads ? event.data : {},
        retry_count: 0,
        created_at: new Date().toISOString(),
      });

    } catch (error) {
      this.logToConsole('error', `Failed to log webhook event: ${error.message}`, {
        eventId: event.id,
        subscriptionIntentId,
        error: error.message,
      });
    }
  }

  // =============================================
  // QUERY METHODS
  // =============================================

  /**
   * Get webhook logs for an event
   */
  async getEventLogs(eventId: string): Promise<WebhookLogEntry[]> {
    const { data, error } = await this.supabase
      .from('webhook_logs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get event logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get webhook logs for a subscription intent
   */
  async getSubscriptionIntentLogs(subscriptionIntentId: string): Promise<WebhookLogEntry[]> {
    const { data, error } = await this.supabase
      .from('webhook_logs')
      .select('*')
      .eq('subscription_intent_id', subscriptionIntentId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get subscription intent logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get recent webhook logs with filters
   */
  async getRecentLogs(
    filters: {
      event_type?: string;
      status?: ProcessingStatus;
      limit?: number;
      hours?: number;
    } = {}
  ): Promise<WebhookLogEntry[]> {
    let query = this.supabase
      .from('webhook_logs')
      .select('*');

    if (filters.event_type) {
      query = query.eq('event_type', filters.event_type);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.hours) {
      const since = new Date(Date.now() - (filters.hours * 60 * 60 * 1000));
      query = query.gte('created_at', since.toISOString());
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent logs: ${error.message}`);
    }

    return data || [];
  }

  // =============================================
  // MAINTENANCE METHODS
  // =============================================

  /**
   * Clean up old webhook logs
   */
  async cleanupOldLogs(): Promise<{ deleted: number }> {
    const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));

    const { data, error } = await this.supabase
      .from('webhook_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Failed to cleanup old logs: ${error.message}`);
    }

    const deletedCount = Array.isArray(data) ? data.length : 0;

    this.logToConsole('info', `Cleaned up ${deletedCount} old webhook logs`, {
      cutoffDate: cutoffDate.toISOString(),
      retentionDays: this.config.retentionDays,
    });

    return { deleted: deletedCount };
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Log to console with structured format
   */
  private logToConsole(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata: Record<string, any> = {}
  ): void {
    if (this.shouldLog(level)) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message,
        component: 'WebhookLogger',
        ...metadata,
      };

      console[level](JSON.stringify(logEntry));
    }
  }

  /**
   * Check if should log based on log level
   */
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate next retry delay (for logging purposes)
   */
  private calculateNextRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const backoffMultiplier = 2;
    
    return Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
  }

  /**
   * Log general error
   */
  async logError(
    context: string,
    message: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    this.logToConsole('error', `${context}: ${message}`, metadata);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WebhookLoggingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): WebhookLoggingConfig {
    return { ...this.config };
  }
}

// =============================================
// FACTORY FUNCTION
// =============================================

/**
 * Create a new WebhookLogger instance
 */
export function createWebhookLogger(
  supabaseUrl: string,
  supabaseKey: string,
  config?: Partial<WebhookLoggingConfig>
): WebhookLogger {
  return new WebhookLogger(supabaseUrl, supabaseKey, config);
}