import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface PlanLimits {
  max_clients: number;
  max_campaigns: number;
  max_users: number;
  features: {
    advancedAnalytics: boolean;
    customReports: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    prioritySupport: boolean;
  };
}

export interface UsageStats {
  clients: number;
  campaigns: number;
  users: number;
}

export class PlanLimitsService {
  async getUserPlanLimits(userId: string): Promise<PlanLimits | null> {
    const supabase = await createClient();

    try {
      // Get user's organization and subscription
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (!membership) return null;

      // Get subscription with plan details - fix the relationship issue
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select(`
          status,
          plan_id
        `)
        .eq('organization_id', membership.organization_id)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (!subscription) {
        // Default free plan limits
        return {
          max_clients: 1,
          max_campaigns: 3,
          max_users: 1,
          features: {
            advancedAnalytics: false,
            customReports: false,
            apiAccess: false,
            whiteLabel: false,
            prioritySupport: false
          }
        };
      }

      // Get plan details separately
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('max_clients, max_campaigns, features')
        .eq('id', subscription.plan_id)
        .single();

      if (!plan) {
        // Default free plan limits
        return {
          max_clients: 1,
          max_campaigns: 3,
          max_users: 1,
          features: {
            advancedAnalytics: false,
            customReports: false,
            apiAccess: false,
            whiteLabel: false,
            prioritySupport: false
          }
        };
      }

      // Convert features array to object if needed
      let featuresObj = {
        advancedAnalytics: false,
        customReports: false,
        apiAccess: false,
        whiteLabel: false,
        prioritySupport: false
      };

      if (Array.isArray(plan.features)) {
        featuresObj = {
          advancedAnalytics: plan.features.includes('advancedAnalytics') || plan.features.includes('Advanced Analytics'),
          customReports: plan.features.includes('customReports') || plan.features.includes('Custom Reports'),
          apiAccess: plan.features.includes('apiAccess') || plan.features.includes('API Access') || plan.features.includes('Full API Access'),
          whiteLabel: plan.features.includes('whiteLabel') || plan.features.includes('White Label Solution'),
          prioritySupport: plan.features.includes('prioritySupport') || plan.features.includes('Priority Support') || plan.features.includes('Dedicated Support Manager')
        };
      } else if (typeof plan.features === 'object' && plan.features !== null) {
        featuresObj = { ...featuresObj, ...plan.features };
      }

      return {
        max_clients: plan.max_clients || 1,
        max_campaigns: plan.max_campaigns || 3,
        max_users: 10, // Default value for users
        features: featuresObj
      };
    } catch (error) {
      console.error('Error getting plan limits:', error);
      return null;
    }
  }

  async getUserUsage(userId: string): Promise<UsageStats | null> {
    const supabase = await createClient();
    try {
      // Get user's organization
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', userId)
        .single();

      if (!membership) return null;

      const organizationId = membership.organization_id;

      // Get current usage
      const [clientsResult, usersResult] = await Promise.all([
        supabase
          .from('clients')
          .select('id')
          .eq('org_id', organizationId),
        supabase
          .from('memberships')
          .select('id')
          .eq('organization_id', organizationId)
      ]);

      return {
        clients: clientsResult.data?.length || 0,
        campaigns: 0, // Simplified for now since meta_campaigns structure is different
        users: usersResult.data?.length || 0
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }
  }

  async checkLimit(userId: string, resource: 'clients' | 'campaigns' | 'users'): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    message?: string;
  }> {
    const [limits, usage] = await Promise.all([
      this.getUserPlanLimits(userId),
      this.getUserUsage(userId)
    ]);

    if (!limits || !usage) {
      return {
        allowed: false,
        current: 0,
        limit: 0,
        message: 'Erro ao verificar limites do plano'
      };
    }

    const current = usage[resource];
    const limit = limits[`max_${resource}` as keyof PlanLimits] as number;

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        current,
        limit: -1
      };
    }

    const allowed = current < limit;

    return {
      allowed,
      current,
      limit,
      message: allowed ? undefined : `Limite de ${limit} ${resource} atingido. Faça upgrade do seu plano.`
    };
  }

  async checkFeature(userId: string, feature: keyof PlanLimits['features']): Promise<{
    allowed: boolean;
    message?: string;
  }> {
    const limits = await this.getUserPlanLimits(userId);

    if (!limits) {
      return {
        allowed: false,
        message: 'Erro ao verificar recursos do plano'
      };
    }

    const allowed = limits.features[feature];

    return {
      allowed,
      message: allowed ? undefined : `Recurso ${feature} não disponível no seu plano atual. Faça upgrade.`
    };
  }
}

// Middleware function to check limits
export async function checkPlanLimits(
  _request: NextRequest,
  resource: 'clients' | 'campaigns' | 'users'
): Promise<NextResponse | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const planService = new PlanLimitsService();
    const limitCheck = await planService.checkLimit(user.id, resource);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Plan limit exceeded',
          message: limitCheck.message,
          current: limitCheck.current,
          limit: limitCheck.limit,
          upgrade_required: true
        },
        { status: 403 }
      );
    }

    return null; // No limit exceeded, continue
  } catch (error) {
    console.error('Plan limits check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Middleware function to check features
export async function checkPlanFeature(
  _request: NextRequest,
  feature: keyof PlanLimits['features']
): Promise<NextResponse | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const planService = new PlanLimitsService();
    const featureCheck = await planService.checkFeature(user.id, feature);

    if (!featureCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Feature not available',
          message: featureCheck.message,
          upgrade_required: true
        },
        { status: 403 }
      );
    }

    return null; // Feature available, continue
  } catch (error) {
    console.error('Plan feature check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}