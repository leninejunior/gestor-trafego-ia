/**
 * TypeScript types for Subscription Intent system
 * These types correspond to the subscription_intents table and related functionality
 */

// =============================================
// SUBSCRIPTION INTENT TYPES
// =============================================

export type SubscriptionIntentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
export type BillingCycle = 'monthly' | 'annual';

export interface SubscriptionIntent {
  id: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  status: SubscriptionIntentStatus;
  user_email: string;
  user_name: string;
  organization_name: string;
  cpf_cnpj?: string | null;
  phone?: string | null;
  // Iugu fields
  iugu_customer_id?: string | null;
  iugu_subscription_id?: string | null;
  // Stripe fields
  stripe_customer_id?: string | null;
  stripe_session_id?: string | null;
  stripe_subscription_id?: string | null;
  // Common fields
  checkout_url?: string | null;
  user_id?: string | null;
  metadata: Record<string, any>;
  expires_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionIntentWithPlan extends SubscriptionIntent {
  plan: {
    id: string;
    name: string;
    description?: string;
    monthly_price: number;
    annual_price: number;
    features: Record<string, any>;
  };
}

// =============================================
// REQUEST/RESPONSE TYPES
// =============================================

export interface CreateSubscriptionIntentRequest {
  plan_id: string;
  billing_cycle: BillingCycle;
  user_email: string;
  user_name: string;
  organization_name: string;
  cpf_cnpj?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionIntentResponse {
  success: boolean;
  intent_id: string;
  checkout_url?: string;
  status_url: string;
  expires_at: string;
  error?: string;
}

export interface UpdateSubscriptionIntentRequest {
  status?: SubscriptionIntentStatus;
  // Iugu fields
  iugu_customer_id?: string;
  iugu_subscription_id?: string;
  // Stripe fields
  stripe_customer_id?: string;
  stripe_session_id?: string;
  stripe_subscription_id?: string;
  // Common fields
  checkout_url?: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionIntentStatusResponse {
  intent_id: string;
  status: SubscriptionIntentStatus;
  plan_name: string;
  billing_cycle: BillingCycle;
  created_at: string;
  expires_at: string;
  checkout_url?: string;
  user_email: string;
  organization_name: string;
}

// =============================================
// STATE MACHINE TYPES
// =============================================

export interface StateTransition {
  from: SubscriptionIntentStatus;
  to: SubscriptionIntentStatus;
  allowed: boolean;
  reason?: string;
}

export interface StateMachineConfig {
  transitions: Record<SubscriptionIntentStatus, SubscriptionIntentStatus[]>;
  finalStates: SubscriptionIntentStatus[];
}

// =============================================
// VALIDATION TYPES
// =============================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// =============================================
// CACHE TYPES
// =============================================

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix: string;
}

export interface CachedSubscriptionIntent {
  data: SubscriptionIntent;
  cachedAt: number;
  expiresAt: number;
}

// =============================================
// SEARCH AND FILTER TYPES
// =============================================

export interface SubscriptionIntentFilters {
  status?: SubscriptionIntentStatus[];
  plan_id?: string;
  user_email?: string;
  created_after?: string;
  created_before?: string;
  expires_after?: string;
  expires_before?: string;
}

export interface SubscriptionIntentSearchParams {
  filters?: SubscriptionIntentFilters;
  sort?: {
    field: keyof SubscriptionIntent;
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SubscriptionIntentSearchResult {
  intents: SubscriptionIntentWithPlan[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================
// METRICS AND ANALYTICS TYPES
// =============================================

export interface SubscriptionIntentMetrics {
  total_intents: number;
  pending_intents: number;
  completed_intents: number;
  failed_intents: number;
  expired_intents: number;
  conversion_rate: number;
  average_completion_time: number; // in minutes
  abandonment_rate: number;
}

export interface IntentAnalytics {
  period_start: string;
  period_end: string;
  metrics: SubscriptionIntentMetrics;
  by_plan: Record<string, SubscriptionIntentMetrics>;
  by_billing_cycle: Record<BillingCycle, SubscriptionIntentMetrics>;
}

// =============================================
// ERROR TYPES
// =============================================

export class SubscriptionIntentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SubscriptionIntentError';
  }
}

export class SubscriptionIntentValidationError extends SubscriptionIntentError {
  constructor(
    message: string,
    public field: string,
    public value?: any
  ) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'SubscriptionIntentValidationError';
  }
}

export class SubscriptionIntentNotFoundError extends SubscriptionIntentError {
  constructor(intentId: string) {
    super(`Subscription intent not found: ${intentId}`, 'NOT_FOUND', { intentId });
    this.name = 'SubscriptionIntentNotFoundError';
  }
}

export class InvalidStateTransitionError extends SubscriptionIntentError {
  constructor(
    from: SubscriptionIntentStatus,
    to: SubscriptionIntentStatus
  ) {
    super(
      `Invalid state transition from ${from} to ${to}`,
      'INVALID_TRANSITION',
      { from, to }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

// =============================================
// SERVICE CONFIGURATION TYPES
// =============================================

export interface SubscriptionIntentServiceConfig {
  cache: CacheConfig;
  expiration: {
    defaultDays: number;
    maxDays: number;
  };
  validation: {
    emailRegex: RegExp;
    phoneRegex?: RegExp;
    cpfCnpjRegex?: RegExp;
  };
  cleanup: {
    batchSize: number;
    intervalMinutes: number;
  };
}

// =============================================
// WEBHOOK INTEGRATION TYPES
// =============================================

export interface WebhookIntentUpdate {
  intent_id: string;
  event_type: string;
  status: SubscriptionIntentStatus;
  iugu_data?: {
    customer_id?: string;
    subscription_id?: string;
    invoice_id?: string;
  };
  metadata?: Record<string, any>;
}

// =============================================
// CONSTANTS
// =============================================

export const SUBSCRIPTION_INTENT_STATUS = {
  PENDING: 'pending' as const,
  PROCESSING: 'processing' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  EXPIRED: 'expired' as const,
} as const;

export const DEFAULT_EXPIRATION_DAYS = 7;
export const MAX_EXPIRATION_DAYS = 30;

export const STATE_MACHINE_CONFIG: StateMachineConfig = {
  transitions: {
    pending: ['processing', 'expired', 'failed'],
    processing: ['completed', 'failed', 'expired'],
    failed: ['pending', 'expired'],
    completed: [], // Final state
    expired: [], // Final state
  },
  finalStates: ['completed', 'expired'],
};