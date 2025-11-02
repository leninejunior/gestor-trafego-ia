/**
 * Webhook Validator
 * 
 * Validates webhook events including signature verification and payload validation.
 * 
 * Requirements: 2.1, 4.1, 8.1
 */

import crypto from 'crypto';
import {
  WebhookEvent,
  WebhookValidationConfig,
  ValidationResult,
  SignatureValidationResult,
  WebhookValidationError,
} from '@/lib/types/webhook';

/**
 * Webhook validator with signature verification and payload validation
 */
export class WebhookValidator {
  private config: WebhookValidationConfig;

  constructor(config?: Partial<WebhookValidationConfig>) {
    this.config = {
      validateSignature: true,
      signatureHeader: 'x-iugu-signature',
      signatureSecret: process.env.IUGU_WEBHOOK_SECRET || '',
      allowedSources: ['iugu', 'stripe'],
      maxPayloadSize: 1024 * 1024, // 1MB
      ...config,
    };
  }

  /**
   * Validate webhook event
   */
  async validateEvent(event: WebhookEvent, rawPayload?: string, headers?: Record<string, string>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate basic event structure
      const structureValidation = this.validateEventStructure(event);
      if (!structureValidation.isValid) {
        errors.push(...structureValidation.errors);
      }

      // Validate payload size
      if (rawPayload) {
        const sizeValidation = this.validatePayloadSize(rawPayload);
        if (!sizeValidation.isValid) {
          errors.push(...sizeValidation.errors);
        }
      }

      // Validate source
      const sourceValidation = this.validateEventSource(event);
      if (!sourceValidation.isValid) {
        errors.push(...sourceValidation.errors);
      }

      // Validate signature if enabled and headers provided
      if (this.config.validateSignature && rawPayload && headers) {
        const signatureValidation = await this.validateSignature(rawPayload, headers);
        if (!signatureValidation.isValid) {
          errors.push(`Signature validation failed: ${signatureValidation.error}`);
        }
      }

      // Validate event-specific data
      const dataValidation = this.validateEventData(event);
      if (!dataValidation.isValid) {
        errors.push(...dataValidation.errors);
      }
      if (dataValidation.warnings) {
        warnings.push(...dataValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
      };
    }
  }

  /**
   * Validate basic event structure
   */
  private validateEventStructure(event: WebhookEvent): ValidationResult {
    const errors: string[] = [];

    if (!event) {
      errors.push('Event is required');
      return { isValid: false, errors };
    }

    if (!event.id || typeof event.id !== 'string') {
      errors.push('Event ID is required and must be a string');
    }

    if (!event.type || typeof event.type !== 'string') {
      errors.push('Event type is required and must be a string');
    }

    if (!event.data || typeof event.data !== 'object') {
      errors.push('Event data is required and must be an object');
    }

    if (!event.created_at || typeof event.created_at !== 'string') {
      errors.push('Event created_at is required and must be a string');
    } else {
      // Validate date format
      const date = new Date(event.created_at);
      if (isNaN(date.getTime())) {
        errors.push('Event created_at must be a valid ISO date string');
      }
    }

    if (!event.source || typeof event.source !== 'string') {
      errors.push('Event source is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate payload size
   */
  private validatePayloadSize(payload: string): ValidationResult {
    const errors: string[] = [];
    const payloadSize = Buffer.byteLength(payload, 'utf8');

    if (payloadSize > this.config.maxPayloadSize) {
      errors.push(`Payload size (${payloadSize} bytes) exceeds maximum allowed size (${this.config.maxPayloadSize} bytes)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate event source
   */
  private validateEventSource(event: WebhookEvent): ValidationResult {
    const errors: string[] = [];

    if (!this.config.allowedSources.includes(event.source)) {
      errors.push(`Event source '${event.source}' is not in allowed sources: ${this.config.allowedSources.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate webhook signature
   */
  private async validateSignature(payload: string, headers: Record<string, string>): Promise<SignatureValidationResult> {
    try {
      const signature = headers[this.config.signatureHeader] || headers[this.config.signatureHeader.toLowerCase()];
      
      if (!signature) {
        return {
          isValid: false,
          error: `Missing signature header: ${this.config.signatureHeader}`,
        };
      }

      if (!this.config.signatureSecret) {
        return {
          isValid: false,
          error: 'Webhook secret not configured',
        };
      }

      // Handle different signature formats
      let expectedSignature: string;
      let algorithm = 'sha256';

      if (signature.startsWith('sha256=')) {
        // GitHub/Stripe style: sha256=<signature>
        expectedSignature = signature.substring(7);
        algorithm = 'sha256';
      } else if (signature.includes('=')) {
        // Parse algorithm=signature format
        const parts = signature.split('=', 2);
        algorithm = parts[0];
        expectedSignature = parts[1];
      } else {
        // Raw signature
        expectedSignature = signature;
      }

      // Generate expected signature
      const hmac = crypto.createHmac(algorithm, this.config.signatureSecret);
      hmac.update(payload, 'utf8');
      const computedSignature = hmac.digest('hex');

      // Compare signatures using timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(computedSignature, 'hex')
      );

      return {
        isValid,
        algorithm,
        error: isValid ? undefined : 'Signature mismatch',
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Signature validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validate event-specific data based on event type
   */
  private validateEventData(event: WebhookEvent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (event.type) {
      case 'invoice.status_changed':
        return this.validateInvoiceStatusChanged(event.data);
      
      case 'subscription.activated':
      case 'subscription.suspended':
      case 'subscription.expired':
      case 'subscription.canceled':
        return this.validateSubscriptionEvent(event.data);
      
      case 'customer.created':
        return this.validateCustomerCreated(event.data);
      
      case 'payment.created':
      case 'payment.failed':
        return this.validatePaymentEvent(event.data);
      
      case 'refund.created':
        return this.validateRefundEvent(event.data);
      
      default:
        warnings.push(`Unknown event type: ${event.type}`);
        return {
          isValid: true,
          errors: [],
          warnings,
        };
    }
  }

  /**
   * Validate invoice status changed event data
   */
  private validateInvoiceStatusChanged(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.id) {
      errors.push('Invoice ID is required');
    }

    if (!data.status) {
      errors.push('Invoice status is required');
    } else {
      const validStatuses = ['pending', 'paid', 'canceled', 'partially_paid', 'refunded', 'expired'];
      if (!validStatuses.includes(data.status)) {
        warnings.push(`Unknown invoice status: ${data.status}`);
      }
    }

    if (!data.subscription_id) {
      errors.push('Subscription ID is required for invoice events');
    }

    if (data.total_cents !== undefined && (typeof data.total_cents !== 'number' || data.total_cents < 0)) {
      errors.push('Invoice total_cents must be a non-negative number');
    }

    if (data.due_date && !this.isValidDateString(data.due_date)) {
      errors.push('Invoice due_date must be a valid date string');
    }

    if (data.paid_at && !this.isValidDateString(data.paid_at)) {
      errors.push('Invoice paid_at must be a valid date string');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate subscription event data
   */
  private validateSubscriptionEvent(data: any): ValidationResult {
    const errors: string[] = [];

    if (!data.id) {
      errors.push('Subscription ID is required');
    }

    if (data.activated_at && !this.isValidDateString(data.activated_at)) {
      errors.push('Subscription activated_at must be a valid date string');
    }

    if (data.suspended_at && !this.isValidDateString(data.suspended_at)) {
      errors.push('Subscription suspended_at must be a valid date string');
    }

    if (data.expired_at && !this.isValidDateString(data.expired_at)) {
      errors.push('Subscription expired_at must be a valid date string');
    }

    if (data.canceled_at && !this.isValidDateString(data.canceled_at)) {
      errors.push('Subscription canceled_at must be a valid date string');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate customer created event data
   */
  private validateCustomerCreated(data: any): ValidationResult {
    const errors: string[] = [];

    if (!data.id) {
      errors.push('Customer ID is required');
    }

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Customer email must be a valid email address');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate payment event data
   */
  private validatePaymentEvent(data: any): ValidationResult {
    const errors: string[] = [];

    if (!data.id) {
      errors.push('Payment ID is required');
    }

    if (data.amount !== undefined && (typeof data.amount !== 'number' || data.amount < 0)) {
      errors.push('Payment amount must be a non-negative number');
    }

    if (data.currency && typeof data.currency !== 'string') {
      errors.push('Payment currency must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate refund event data
   */
  private validateRefundEvent(data: any): ValidationResult {
    const errors: string[] = [];

    if (!data.id) {
      errors.push('Refund ID is required');
    }

    if (!data.payment_id) {
      errors.push('Payment ID is required for refund events');
    }

    if (data.amount !== undefined && (typeof data.amount !== 'number' || data.amount < 0)) {
      errors.push('Refund amount must be a non-negative number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate date string format
   */
  private isValidDateString(dateString: string): boolean {
    if (typeof dateString !== 'string') {
      return false;
    }

    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    if (typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WebhookValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): WebhookValidationConfig {
    return { ...this.config };
  }
}

// =============================================
// FACTORY FUNCTION
// =============================================

/**
 * Create a new WebhookValidator instance
 */
export function createWebhookValidator(
  config?: Partial<WebhookValidationConfig>
): WebhookValidator {
  return new WebhookValidator(config);
}