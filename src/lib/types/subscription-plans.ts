import { z } from 'zod';

// Plan Features Interface
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

// Subscription Plan Interface
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: PlanFeatures;
  maxClients: number;
  maxCampaigns: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Interface
export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  paymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice Line Item Interface
export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
}

// Subscription Invoice Interface
export interface SubscriptionInvoice {
  id: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  lineItems: InvoiceLineItem[];
  dueDate: Date;
  paidAt?: Date;
  paymentIntentId?: string;
  createdAt: Date;
}

// Zod Validation Schemas

// Plan Features Schema
export const PlanFeaturesSchema = z.object({
  maxClients: z.number().min(1),
  maxCampaigns: z.number().min(1),
  advancedAnalytics: z.boolean(),
  customReports: z.boolean(),
  apiAccess: z.boolean(),
  whiteLabel: z.boolean(),
  prioritySupport: z.boolean(),
  dataRetention: z.number().min(30).max(3650).optional(),
  csvExport: z.boolean().optional(),
  jsonExport: z.boolean().optional(),
  historicalDataCache: z.boolean().optional(),
});

// Subscription Plan Schema
export const SubscriptionPlanSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  monthlyPrice: z.number().min(0),
  annualPrice: z.number().min(0),
  features: PlanFeaturesSchema,
  maxClients: z.number().min(1),
  maxCampaigns: z.number().min(1),
  isActive: z.boolean().default(true),
});

// Create Plan Request Schema (for admin interface)
export const CreatePlanRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  monthly_price: z.number().min(0),
  annual_price: z.number().min(0),
  features: z.array(z.string()).default([]),
  limits: z.record(z.number().optional()).optional(),
  is_active: z.boolean().default(true),
  is_popular: z.boolean().default(false).optional(),
});

// Update Plan Request Schema (for admin interface)
export const UpdatePlanRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  monthly_price: z.number().min(0).optional(),
  annual_price: z.number().min(0).optional(),
  features: z.array(z.string()).optional(),
  limits: z.object({
    clients: z.number().optional(),
    users: z.number().optional(),
    campaigns: z.number().optional(),
    api_calls: z.number().optional(),
    storage_gb: z.number().optional(),
    max_clients: z.number().optional(),
    max_campaigns_per_client: z.number().optional(),
    data_retention_days: z.number().optional(),
    sync_interval_hours: z.number().optional(),
    allow_csv_export: z.union([z.number(), z.boolean()]).optional(),
    allow_json_export: z.union([z.number(), z.boolean()]).optional(),
  }).optional(),
  is_active: z.boolean().optional(),
  is_popular: z.boolean().optional(),
});

// Subscription Schema
export const SubscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  status: z.enum(['active', 'past_due', 'canceled', 'trialing']),
  billingCycle: z.enum(['monthly', 'annual']),
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  trialEnd: z.date().optional(),
  paymentMethodId: z.string().optional(),
});

// Create Subscription Request Schema
export const CreateSubscriptionRequestSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'annual']),
  paymentMethodId: z.string().optional(),
});

// Invoice Line Item Schema
export const InvoiceLineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

// Subscription Invoice Schema
export const SubscriptionInvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  subscriptionId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']),
  lineItems: z.array(InvoiceLineItemSchema),
  dueDate: z.date(),
  paidAt: z.date().optional(),
  paymentIntentId: z.string().optional(),
});

// Type exports for request/response types
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;
export type UpdatePlanRequest = z.infer<typeof UpdatePlanRequestSchema>;
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequestSchema>;