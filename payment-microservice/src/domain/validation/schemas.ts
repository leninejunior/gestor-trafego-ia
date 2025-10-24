import { z } from 'zod';
import { PaymentMethod, Currency, BillingInterval } from '../types';

/**
 * Schemas de validação usando Zod
 */

// Schema para PaymentRequest
export const PaymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.nativeEnum(Currency),
  organizationId: z.string().uuid('Invalid organization ID'),
  customerId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  description: z.string().max(500, 'Description too long').optional(),
  metadata: z.record(z.any()).optional(),
  returnUrl: z.string().url('Invalid return URL').optional(),
  cancelUrl: z.string().url('Invalid cancel URL').optional(),
  preferredMethod: z.nativeEnum(PaymentMethod).optional()
});

// Schema para SubscriptionRequest
export const SubscriptionRequestSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  organizationId: z.string().uuid('Invalid organization ID'),
  planId: z.string().min(1, 'Plan ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  billingInterval: z.nativeEnum(BillingInterval),
  trialPeriodDays: z.number().min(0).max(365).optional(),
  metadata: z.record(z.any()).optional()
});

// Schema para ProviderConfig
export const ProviderConfigSchema = z.object({
  id: z.string().uuid('Invalid provider config ID'),
  name: z.string().min(1, 'Provider name is required'),
  isActive: z.boolean(),
  priority: z.number().min(0, 'Priority must be non-negative'),
  credentials: z.record(z.string()).refine(
    (creds) => Object.keys(creds).length > 0,
    'At least one credential is required'
  ),
  settings: z.record(z.any()),
  healthCheckUrl: z.string().url('Invalid health check URL').optional(),
  webhookUrl: z.string().url('Invalid webhook URL').optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Schema para RefundRequest
export const RefundRequestSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().positive('Amount must be positive').optional(),
  reason: z.string().max(500, 'Reason too long').optional(),
  metadata: z.record(z.any()).optional()
});

// Schema para SubscriptionUpdate
export const SubscriptionUpdateSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  planId: z.string().min(1, 'Plan ID is required').optional(),
  metadata: z.record(z.any()).optional(),
  cancelAtPeriodEnd: z.boolean().optional()
});

// Schema para ProcessingOptions
export const ProcessingOptionsSchema = z.object({
  preferredProvider: z.string().optional(),
  enableFailover: z.boolean().default(true),
  timeout: z.number().positive('Timeout must be positive').default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
  metadata: z.record(z.any()).optional()
});

// Schema para Webhook payload básico
export const WebhookPayloadSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  type: z.string().min(1, 'Event type is required'),
  data: z.record(z.any()),
  created: z.union([z.number(), z.string(), z.date()]),
  provider: z.string().optional()
});

// Tipos inferidos dos schemas
export type ValidatedPaymentRequest = z.infer<typeof PaymentRequestSchema>;
export type ValidatedSubscriptionRequest = z.infer<typeof SubscriptionRequestSchema>;
export type ValidatedProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ValidatedRefundRequest = z.infer<typeof RefundRequestSchema>;
export type ValidatedSubscriptionUpdate = z.infer<typeof SubscriptionUpdateSchema>;
export type ValidatedProcessingOptions = z.infer<typeof ProcessingOptionsSchema>;
export type ValidatedWebhookPayload = z.infer<typeof WebhookPayloadSchema>;