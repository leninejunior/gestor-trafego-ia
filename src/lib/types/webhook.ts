/**
 * Webhook Types and Interfaces
 * 
 * Type definitions for the robust webhook processing system.
 * 
 * Requirements: 2.1, 4.1, 8.1
 */

// =============================================
// CORE WEBHOOK TYPES
// =============================================

/**
 * Supported webhook event types
 */
export type WebhookEventType = 
  | 'invoice.status_changed'
  | 'subscription.activated'
  | 'subscription.suspended'
  | 'subscription.expired'
  | 'subscription.canceled'
  | 'customer.created'
  | 'payment.created'
  | 'payment.failed'
  | 'refund.created';

/**
 * Processing status for webhook events
 */
export type ProcessingStatus = 
  | 'received'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'retrying'
  | 'duplicate'
  | 'validation_failed'
  | 'fatal_error'
  | 'retryable_error'
  | 'unknown_error'
  | 'circuit_breaker_open'
  | 'failed_after_retries'
  | 'circuit_breaker_rejected';

/**
 * Webhook event structure
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: Record<string, any>;
  created_at: string;
  signature?: string;
  source: 'iugu' | 'stripe' | 'other';
  version?: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook processing context
 */
export interface WebhookProcessingContext {
  eventId: string;
  eventType: WebhookEventType;
  processingId: string;
  startTime: number;
  attempt: number;
  metadata: Record<string, any>;
}

/**
 * Webhook processing result
 */
export interface WebhookProcessingResult {
  success: boolean;
  status: ProcessingStatus;
  message: string;
  processingTime: number;
  context: WebhookProcessingContext;
  result?: any;
  error?: {
    type: string;
    code: string;
    details: Record<string, any>;
  };
  retryable?: boolean;
}

// =============================================
// ERROR TYPES
// =============================================

/**
 * Base webhook processing error
 */
export class WebhookProcessingError extends Error {
  public readonly code: string;
  public readonly details: Record<string, any>;

  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'WebhookProcessingError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Webhook validation error (not retryable)
 */
export class WebhookValidationError extends WebhookProcessingError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[] = []) {
    super(message, 'VALIDATION_ERROR', { validationErrors });
    this.name = 'WebhookValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Webhook retryable error
 */
export class WebhookRetryableError extends WebhookProcessingError {
  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message, code, details);
    this.name = 'WebhookRetryableError';
  }
}

/**
 * Webhook fatal error (not retryable)
 */
export class WebhookFatalError extends WebhookProcessingError {
  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message, code, details);
    this.name = 'WebhookFatalError';
  }
}

// =============================================
// CONFIGURATION TYPES
// =============================================

/**
 * Webhook processor configuration
 */
export interface WebhookProcessorConfig {
  processing: {
    timeout: number;
    maxConcurrency: number;
    enableDeduplication: boolean;
    deduplicationWindow: number; // seconds
  };
  retry: WebhookRetryConfig;
  validation: WebhookValidationConfig;
  logging: WebhookLoggingConfig;
  circuitBreaker: WebhookCircuitBreakerConfig;
}

/**
 * Retry configuration
 */
export interface WebhookRetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

/**
 * Validation configuration
 */
export interface WebhookValidationConfig {
  validateSignature: boolean;
  signatureHeader: string;
  signatureSecret: string;
  allowedSources: string[];
  maxPayloadSize: number; // bytes
}

/**
 * Logging configuration
 */
export interface WebhookLoggingConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logPayloads: boolean;
  logResponses: boolean;
  retentionDays: number;
}

/**
 * Circuit breaker configuration
 */
export interface WebhookCircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // milliseconds
  monitoringWindow: number; // milliseconds
}

// =============================================
// PATTERN MATCHING TYPES
// =============================================

/**
 * Event pattern for validation
 */
export interface EventPattern {
  name: string;
  requiredFields: string[];
  optionalFields: string[];
  validation?: (data: any) => boolean;
}

/**
 * Pattern matching result
 */
export interface PatternMatchResult {
  matches: boolean;
  reason?: string;
  extractedData?: Record<string, any>;
}

// =============================================
// RETRY TYPES
// =============================================

/**
 * Retry context
 */
export interface RetryContext {
  eventId: string;
  eventType: WebhookEventType;
  attempt: number;
  lastError?: Error;
  nextRetryAt?: Date;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

// =============================================
// CIRCUIT BREAKER TYPES
// =============================================

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextRetryTime?: number;
}

// =============================================
// LOGGING TYPES
// =============================================

/**
 * Webhook log entry
 */
export interface WebhookLogEntry {
  id: string;
  event_id: string;
  event_type: WebhookEventType;
  subscription_intent_id?: string;
  status: ProcessingStatus;
  payload: Record<string, any>;
  response?: Record<string, any>;
  error_message?: string;
  processing_time?: number;
  retry_count: number;
  created_at: string;
  processed_at?: string;
}

/**
 * Processing step log
 */
export interface ProcessingStepLog {
  step: string;
  timestamp: number;
  data: Record<string, any>;
  duration?: number;
}

// =============================================
// METRICS TYPES
// =============================================

/**
 * Processor metrics
 */
export interface ProcessorMetrics {
  events_received: number;
  events_processed: number;
  events_failed: number;
  events_retried: number;
  processing_time_total: number;
  last_reset: number;
}

/**
 * Event type metrics
 */
export interface EventTypeMetrics {
  event_type: WebhookEventType;
  count: number;
  success_rate: number;
  avg_processing_time: number;
  last_processed: string;
}

// =============================================
// ACCOUNT CREATION TYPES
// =============================================

/**
 * Account creation context
 */
export interface AccountCreationContext {
  source: 'webhook_payment' | 'manual' | 'api';
  invoice_id?: string;
  payment_method?: string;
  metadata?: Record<string, any>;
}

/**
 * Account creation result
 */
export interface AccountCreationResult {
  success: boolean;
  user_id: string;
  organization_id?: string;
  membership_id?: string;
  welcome_email_sent: boolean;
  existing_user?: boolean;
  error?: string;
}

/**
 * Account creation error
 */
export class AccountCreationError extends WebhookProcessingError {
  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message, code, details);
    this.name = 'AccountCreationError';
  }
}

/**
 * Welcome email data
 */
export interface WelcomeEmailData {
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
  } | null;
  tempPassword?: string;
  context: AccountCreationContext;
}

// =============================================
// QUEUE TYPES
// =============================================

/**
 * Webhook queue item
 */
export interface WebhookQueueItem {
  id: string;
  event: WebhookEvent;
  priority: number;
  scheduled_at: string;
  attempts: number;
  max_attempts: number;
  last_error?: string;
  created_at: string;
}

/**
 * Queue processing options
 */
export interface QueueProcessingOptions {
  batchSize: number;
  maxConcurrency: number;
  processingTimeout: number;
  retryDelay: number;
}

// =============================================
// VALIDATION TYPES
// =============================================

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Signature validation result
 */
export interface SignatureValidationResult {
  isValid: boolean;
  algorithm?: string;
  timestamp?: number;
  error?: string;
}

// =============================================
// DEAD LETTER QUEUE TYPES
// =============================================

/**
 * Dead letter queue item
 */
export interface DeadLetterQueueItem {
  id: string;
  original_event: WebhookEvent;
  failure_reason: string;
  attempts: number;
  first_failed_at: string;
  last_failed_at: string;
  error_details: Record<string, any>;
  can_retry: boolean;
}

/**
 * Dead letter queue processing result
 */
export interface DeadLetterProcessingResult {
  processed: number;
  failed: number;
  skipped: number;
  errors: Array<{
    item_id: string;
    error: string;
  }>;
}

// =============================================
// MONITORING TYPES
// =============================================

/**
 * Webhook health status
 */
export interface WebhookHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_processed_event?: string;
  processing_rate: number; // events per minute
  error_rate: number; // percentage
  circuit_breaker_state: CircuitBreakerState;
  queue_size: number;
  dead_letter_queue_size: number;
  uptime: number; // seconds
}

/**
 * Alert configuration
 */
export interface WebhookAlertConfig {
  error_rate_threshold: number; // percentage
  processing_delay_threshold: number; // seconds
  queue_size_threshold: number;
  dead_letter_threshold: number;
  notification_channels: string[];
}

// =============================================
// UTILITY TYPES
// =============================================

/**
 * Webhook processor factory options
 */
export interface WebhookProcessorFactoryOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  config?: Partial<WebhookProcessorConfig>;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  total: number;
  processed: number;
  failed: number;
  results: WebhookProcessingResult[];
  processing_time: number;
}