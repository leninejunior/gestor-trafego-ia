/**
 * TypeScript types for the SaaS Subscription Plans system
 * These types correspond to the database schema and API interfaces
 */

// =============================================
// SUBSCRIPTION PLAN TYPES
// =============================================

export interface PlanFeatures {
  maxClients: number;
  maxCampaigns: number;
  advancedAnalytics: boolean;
  customReports: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  dataRetention?: number;
  csvExport?: boolean;
  jsonExport?: boolean;
  historicalDataCache?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  features: PlanFeatures | string[]; // Support both object and array formats
  max_clients: number;
  max_campaigns: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================
// SUBSCRIPTION TYPES
// =============================================

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
export type BillingCycle = 'monthly' | 'annual';

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string | null;
  payment_method_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// INVOICE TYPES
// =============================================

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface SubscriptionInvoice {
  id: string;
  subscription_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  line_items: InvoiceLineItem[];
  due_date: string;
  paid_at?: string | null;
  payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// FEATURE USAGE TYPES
// =============================================

export interface FeatureUsage {
  id: string;
  organization_id: string;
  feature_key: string;
  usage_count: number;
  limit_count: number;
  usage_date: string;
  created_at: string;
  updated_at: string;
}

export interface UsageLimitInfo {
  current_usage: number;
  limit: number;
  has_limit: boolean;
  is_over_limit: boolean;
}

// =============================================
// API REQUEST/RESPONSE TYPES
// =============================================

export interface CreateSubscriptionRequest {
  organization_id: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  payment_method_id?: string;
  trial_days?: number;
}

export interface UpdateSubscriptionRequest {
  plan_id?: string;
  billing_cycle?: BillingCycle;
  payment_method_id?: string;
}

export interface SubscriptionWithPlan extends Subscription {
  plan: SubscriptionPlan;
}

export interface InvoiceWithSubscription extends SubscriptionInvoice {
  subscription: SubscriptionWithPlan;
}

// =============================================
// ANALYTICS TYPES
// =============================================

export interface SubscriptionAnalytics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  active_subscriptions: number;
  total_revenue: number;
  period_start: string;
  period_end: string;
  generated_at: string;
}

export interface RevenueMetrics {
  current_mrr: number;
  previous_mrr: number;
  mrr_growth: number;
  churn_rate: number;
  conversion_rate: number;
  customer_lifetime_value: number;
}

// =============================================
// FEATURE GATE TYPES
// =============================================

export interface FeatureGateResult {
  hasAccess: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  currentPlan?: string;
  requiredPlan?: string;
}

export interface FeatureAccessCheck {
  organization_id: string;
  feature_key: keyof PlanFeatures;
}

export interface UsageLimitCheck {
  organization_id: string;
  feature_key: string;
  increment?: boolean;
}

// =============================================
// PLAN MANAGEMENT TYPES
// =============================================

export interface CreatePlanRequest {
  name: string;
  description?: string;
  monthly_price: number;
  annual_price: number;
  features: PlanFeatures;
  max_clients: number;
  max_campaigns: number;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  monthly_price?: number;
  annual_price?: number;
  features?: Partial<PlanFeatures>;
  max_clients?: number;
  max_campaigns?: number;
  is_active?: boolean;
}

// =============================================
// BILLING TYPES
// =============================================

export interface ProrationCalculation {
  current_plan_cost: number;
  new_plan_cost: number;
  prorated_amount: number;
  days_remaining: number;
  effective_date: string;
}

export interface BillingCycleInfo {
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  days_until_renewal: number;
}

// =============================================
// ERROR TYPES
// =============================================

export interface SubscriptionError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class SubscriptionValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'SubscriptionValidationError';
  }
}

export class FeatureAccessError extends Error {
  constructor(
    message: string,
    public feature: string,
    public currentPlan: string,
    public requiredPlan?: string
  ) {
    super(message);
    this.name = 'FeatureAccessError';
  }
}

// =============================================
// UTILITY TYPES
// =============================================

export type SubscriptionEventType = 
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.renewed'
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.failed'
  | 'payment.succeeded'
  | 'payment.failed';

export interface SubscriptionEvent {
  id: string;
  type: SubscriptionEventType;
  data: Record<string, any>;
  created_at: string;
}

// Database table names for type safety
export const SUBSCRIPTION_TABLES = {
  PLANS: 'subscription_plans',
  SUBSCRIPTIONS: 'subscriptions',
  INVOICES: 'subscription_invoices',
  FEATURE_USAGE: 'feature_usage',
} as const;

// Feature keys for type safety
export const FEATURE_KEYS = {
  CLIENTS: 'clients',
  CAMPAIGNS: 'campaigns',
  ADVANCED_ANALYTICS: 'advancedAnalytics',
  CUSTOM_REPORTS: 'customReports',
  API_ACCESS: 'apiAccess',
  WHITE_LABEL: 'whiteLabel',
  PRIORITY_SUPPORT: 'prioritySupport',
} as const;

// Plan names for type safety
export const PLAN_NAMES = {
  BASIC: 'Basic',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
} as const;