import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FeatureGateService, FeatureKey } from '@/lib/services/feature-gate';

export interface FeatureGateOptions {
  feature: FeatureKey;
  requireAccess?: boolean;
  checkUsageLimit?: boolean;
  incrementUsage?: boolean;
  errorMessage?: string;
}

/**
 * Feature Gate Middleware
 * 
 * Middleware for protecting API routes based on subscription features.
 * Can check feature access, validate usage limits, and increment usage counters.
 */
export function withFeatureGate(options: FeatureGateOptions) {
  return function middleware(handler: Function) {
    return async function (request: NextRequest, context?: any) {
      try {
        const supabase = await createClient();
        const featureGate = new FeatureGateService();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }

        // Get user's organization
        const { data: membership, error: membershipError } = await supabase
          .from('organization_memberships')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (membershipError || !membership) {
          return NextResponse.json(
            { error: 'Organization membership required' },
            { status: 403 }
          );
        }

        const organizationId = membership.organization_id;

        // Check feature access if required
        if (options.requireAccess) {
          const access = await featureGate.checkFeatureAccess(organizationId, options.feature);
          
          if (!access.hasAccess) {
            return NextResponse.json(
              { 
                error: options.errorMessage || access.reason || 'Feature access denied',
                upgradeRequired: access.upgradeRequired,
                feature: options.feature
              },
              { status: 403 }
            );
          }
        }

        // Check usage limit if required
        if (options.checkUsageLimit) {
          const usage = await featureGate.checkUsageLimit(organizationId, options.feature);
          
          if (!usage.withinLimit) {
            return NextResponse.json(
              { 
                error: options.errorMessage || `Usage limit exceeded for ${options.feature}`,
                currentUsage: usage.currentUsage,
                limit: usage.limit,
                feature: options.feature,
                upgradeRequired: true
              },
              { status:429 }
            );
          }
        }

        // Increment usage if required
        if (options.incrementUsage) {
          const incremented = await featureGate.incrementUsage(organizationId, options.feature);
          
          if (!incremented) {
            return NextResponse.json(
              { 
                error: `Failed to increment usage for ${options.feature}`,
                feature: options.feature
              },
              { status: 429 }
            );
          }
        }

        // Add organization ID to request context for handler
        const enhancedContext = {
          ...context,
          organizationId,
          user
        };

        // Call the original handler
        return await handler(request, enhancedContext);

      } catch (error) {
        console.error('Feature gate middleware error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Helper function to create feature gate middleware for specific features
 */
export const createFeatureGate = {
  /**
   * Require access to advanced analytics
   */
  advancedAnalytics: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'advancedAnalytics',
      requireAccess: true,
      errorMessage: 'Advanced analytics requires a Pro or Enterprise plan',
      ...options
    }),

  /**
   * Require access to custom reports
   */
  customReports: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'customReports',
      requireAccess: true,
      errorMessage: 'Custom reports require a Pro or Enterprise plan',
      ...options
    }),

  /**
   * Require API access
   */
  apiAccess: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'apiAccess',
      requireAccess: true,
      errorMessage: 'API access requires a Pro or Enterprise plan',
      ...options
    }),

  /**
   * Check client limit and optionally increment
   */
  clientLimit: (increment: boolean = false) =>
    withFeatureGate({
      feature: 'maxClients',
      checkUsageLimit: true,
      incrementUsage: increment,
      errorMessage: 'Client limit reached. Upgrade your plan to add more clients.'
    }),

  /**
   * Check campaign limit and optionally increment
   */
  campaignLimit: (increment: boolean = false) =>
    withFeatureGate({
      feature: 'maxCampaigns',
      checkUsageLimit: true,
      incrementUsage: increment,
      errorMessage: 'Campaign limit reached. Upgrade your plan to create more campaigns.'
    }),

  /**
   * Require white label access
   */
  whiteLabel: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'whiteLabel',
      requireAccess: true,
      errorMessage: 'White label features require an Enterprise plan',
      ...options
    }),

  /**
   * Require priority support access
   */
  prioritySupport: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'prioritySupport',
      requireAccess: true,
      errorMessage: 'Priority support requires a Pro or Enterprise plan',
      ...options
    }),

  /**
   * Require data retention access
   */
  dataRetention: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'dataRetention',
      requireAccess: true,
      errorMessage: 'Extended data retention requires a higher plan',
      ...options
    }),

  /**
   * Require CSV export access
   */
  csvExport: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'csvExport',
      requireAccess: true,
      errorMessage: 'CSV export requires a Pro or Enterprise plan',
      ...options
    }),

  /**
   * Require JSON export access
   */
  jsonExport: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'jsonExport',
      requireAccess: true,
      errorMessage: 'JSON export requires a Pro or Enterprise plan',
      ...options
    }),

  /**
   * Require historical data cache access
   */
  historicalDataCache: (options?: Partial<FeatureGateOptions>) =>
    withFeatureGate({
      feature: 'historicalDataCache',
      requireAccess: true,
      errorMessage: 'Historical data cache requires a Pro or Enterprise plan',
      ...options
    })
};

/**
 * Utility function to extract organization ID from request context
 */
export function getOrganizationFromContext(context: any): string | null {
  return context?.organizationId || null;
}

/**
 * Utility function to extract user from request context
 */
export function getUserFromContext(context: any): any | null {
  return context?.user || null;
}