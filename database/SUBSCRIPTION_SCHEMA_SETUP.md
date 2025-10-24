# SaaS Subscription Plans Database Schema Setup

This document provides instructions for setting up the complete subscription management database schema for the Ads Manager platform.

## Overview

The subscription system includes:
- **Subscription Plans**: Configurable plans with feature sets and pricing
- **Subscriptions**: Active subscriptions linked to organizations
- **Invoices**: Billing history and payment tracking
- **Feature Usage**: Usage tracking and limit enforcement
- **RLS Security**: Multi-tenant data isolation

## Manual Setup Instructions

### Step 1: Execute the Schema

1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database/subscription-plans-schema.sql`
4. Execute the SQL script

### Step 2: Verify Tables Created

After execution, verify these tables exist:
- `subscription_plans`
- `subscriptions`
- `subscription_invoices`
- `feature_usage`

### Step 3: Check Default Data

The schema includes 3 default subscription plans:
- **Basic**: $29/month, 5 clients, 25 campaigns
- **Pro**: $79/month, 25 clients, 100 campaigns  
- **Enterprise**: $199/month, unlimited clients/campaigns

## Database Schema Details

### Tables Structure

#### subscription_plans
```sql
- id (UUID, Primary Key)
- name (VARCHAR, Plan name)
- description (TEXT, Plan description)
- monthly_price (DECIMAL, Monthly pricing)
- annual_price (DECIMAL, Annual pricing)
- features (JSONB, Feature configuration)
- max_clients (INTEGER, Client limit)
- max_campaigns (INTEGER, Campaign limit)
- is_active (BOOLEAN, Plan availability)
- created_at, updated_at (TIMESTAMP)
```

#### subscriptions
```sql
- id (UUID, Primary Key)
- organization_id (UUID, FK to organizations)
- plan_id (UUID, FK to subscription_plans)
- status (VARCHAR, active|past_due|canceled|trialing)
- billing_cycle (VARCHAR, monthly|annual)
- current_period_start/end (TIMESTAMP)
- trial_end (TIMESTAMP, optional)
- payment_method_id (VARCHAR, Stripe payment method)
- stripe_subscription_id (VARCHAR, Stripe subscription)
- stripe_customer_id (VARCHAR, Stripe customer)
- created_at, updated_at (TIMESTAMP)
```

#### subscription_invoices
```sql
- id (UUID, Primary Key)
- subscription_id (UUID, FK to subscriptions)
- invoice_number (VARCHAR, Auto-generated)
- amount (DECIMAL, Invoice total)
- currency (VARCHAR, Default USD)
- status (VARCHAR, draft|open|paid|void|uncollectible)
- line_items (JSONB, Invoice line items)
- due_date (TIMESTAMP, Payment due date)
- paid_at (TIMESTAMP, Payment date)
- payment_intent_id (VARCHAR, Stripe payment intent)
- stripe_invoice_id (VARCHAR, Stripe invoice)
- created_at, updated_at (TIMESTAMP)
```

#### feature_usage
```sql
- id (UUID, Primary Key)
- organization_id (UUID, FK to organizations)
- feature_key (VARCHAR, Feature identifier)
- usage_count (INTEGER, Current usage)
- limit_count (INTEGER, Usage limit)
- usage_date (DATE, Tracking date)
- created_at, updated_at (TIMESTAMP)
```

### Row Level Security (RLS)

All tables have RLS enabled with these policies:

#### subscription_plans
- **Public read**: Anyone can view active plans
- **Admin full access**: Super admins can manage all plans

#### subscriptions
- **Organization access**: Users can only access their organization's subscriptions

#### subscription_invoices
- **Organization access**: Users can only access invoices for their organization's subscriptions

#### feature_usage
- **Organization access**: Users can only access their organization's usage data

### Helper Functions

The schema includes several utility functions:

#### has_feature_access(org_id, feature_name)
Checks if an organization has access to a specific feature based on their active subscription.

#### check_usage_limit(org_id, feature_name)
Returns usage information and limit status for a feature.

#### increment_feature_usage(org_id, feature_name)
Increments usage count for a feature (respects limits).

#### get_subscription_analytics(start_date, end_date)
Returns subscription analytics including MRR, ARR, and revenue metrics.

### Triggers and Automation

#### Auto-generated Invoice Numbers
Format: `INV-YYYY-DDD-NNNNNN` (Year-DayOfYear-Sequence)

#### Automatic Period Calculation
Subscription periods are automatically calculated based on billing cycle.

#### Updated Timestamps
All tables have automatic `updated_at` timestamp updates.

## Feature Configuration

### Plan Features Schema
```json
{
  "maxClients": number,
  "maxCampaigns": number,
  "advancedAnalytics": boolean,
  "customReports": boolean,
  "apiAccess": boolean,
  "whiteLabel": boolean,
  "prioritySupport": boolean
}
```

### Usage Tracking
- **clients**: Track number of clients created
- **campaigns**: Track number of campaigns created
- **advancedAnalytics**: Boolean feature access
- **customReports**: Boolean feature access
- **apiAccess**: Boolean feature access
- **whiteLabel**: Boolean feature access
- **prioritySupport**: Boolean feature access

## Integration Points

### Required Dependencies
- Organizations table must exist (for foreign keys)
- Auth users table (for RLS policies)
- Memberships table (for organization access control)

### Stripe Integration Fields
- `stripe_subscription_id`: Links to Stripe subscription
- `stripe_customer_id`: Links to Stripe customer
- `payment_method_id`: Stripe payment method
- `payment_intent_id`: Stripe payment intent
- `stripe_invoice_id`: Links to Stripe invoice

## Testing the Schema

### 1. Verify RLS Policies
```sql
-- Test as different users to ensure data isolation
SELECT * FROM subscriptions; -- Should only show user's org data
```

### 2. Test Helper Functions
```sql
-- Check feature access
SELECT has_feature_access('org-uuid', 'advancedAnalytics');

-- Check usage limits
SELECT check_usage_limit('org-uuid', 'clients');

-- Get analytics
SELECT get_subscription_analytics();
```

### 3. Test Default Plans
```sql
-- Verify default plans exist
SELECT name, monthly_price, features FROM subscription_plans WHERE is_active = true;
```

## Troubleshooting

### Common Issues

1. **Foreign Key Errors**: Ensure `organizations` table exists
2. **RLS Access Denied**: Verify user has proper organization membership
3. **Function Errors**: Check that all required extensions are enabled
4. **Index Errors**: Ensure GIN extension is available for JSONB indexes

### Verification Queries

```sql
-- Check table existence
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%subscription%';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename LIKE '%subscription%';

-- Check functions
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%subscription%' OR routine_name LIKE '%feature%';
```

## Next Steps

After successful schema setup:

1. **Implement API endpoints** for subscription management
2. **Create React components** for subscription UI
3. **Set up Stripe integration** for payment processing
4. **Implement feature gating** throughout the application
5. **Add subscription analytics** to admin dashboard

## Security Considerations

- All sensitive payment data should be stored in Stripe, not locally
- RLS policies ensure complete data isolation between organizations
- Service role access is required for admin functions
- All API endpoints should validate organization membership
- Feature usage tracking should be atomic to prevent race conditions

## Performance Optimization

- Indexes are created on frequently queried columns
- JSONB GIN indexes enable efficient feature queries
- Unique constraints prevent duplicate subscriptions
- Proper foreign key relationships maintain data integrity