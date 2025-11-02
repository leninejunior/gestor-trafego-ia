import { createClient } from '@/lib/supabase/server';
import { PlanFeatures } from '@/lib/types/subscription';
import { SubscriptionService } from './subscription-service';
import { gracefulDegradation } from '@/lib/resilience/graceful-degradation';

export type FeatureKey = 
  | 'maxClients'
  | 'maxCampaigns'
  | 'advancedAnalytics'
  | 'customReports'
  | 'apiAccess'
  | 'whiteLabel'
  | 'prioritySupport'
  | 'dataRetention'
  | 'csvExport'
  | 'jsonExport'
  | 'historicalDataCache';

export interface FeatureAccessResult {
  hasAccess: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  currentUsage?: number;
  limit?: number;
}

export interface UsageLimitResult {
  withinLimit: boolean;
  currentUsage: number;
  limit: number;
  remainingUsage: number;
}

export interface FeatureMatrix {
  [key: string]: boolean | number;
}

/**
 * Feature Gate Service
 * 
 * Handles feature access validation, usage limit checking and tracking,
 * and real-time feature matrix management for subscription-based access control.
 */
export class FeatureGateService {
  private subscriptionService: SubscriptionService;

  constructor() {
    this.subscriptionService = new SubscriptionService();
  }

  private async getSupabaseClient() {
    return createClient();
  }

  /**
   * Check if an organization has access to a specific feature
   */
  async checkFeatureAccess(
    organizationId: string, 
    feature: FeatureKey
  ): Promise<FeatureAccessResult> {
    return gracefulDegradation.executeWithFallback(
      'feature-gate',
      async () => {
        // Get organization's active subscription
        const subscription = await this.subscriptionService.getActiveSubscription(organizationId);
        
        if (!subscription) {
          return {
            hasAccess: false,
            reason: 'No active subscription found',
            upgradeRequired: true
          };
        }

        // Check if subscription is active
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          return {
            hasAccess: false,
            reason: `Subscription status is ${subscription.status}`,
            upgradeRequired: true
          };
        }

        const planFeatures = subscription.plan.features;

        // Handle boolean features
        if (typeof planFeatures[feature] === 'boolean') {
          const hasAccess = planFeatures[feature] as boolean;
          return {
            hasAccess,
            reason: hasAccess ? undefined : `Feature ${feature} not included in current plan`,
            upgradeRequired: !hasAccess
          };
        }

        // Handle numeric features (usage limits)
        if (typeof planFeatures[feature] === 'number') {
          const limit = planFeatures[feature] as number;
          const currentUsage = await this.getCurrentUsage(organizationId, feature);
          
          return {
            hasAccess: currentUsage < limit,
            reason: currentUsage >= limit ? `Usage limit reached for ${feature}` : undefined,
            upgradeRequired: currentUsage >= limit,
            currentUsage,
            limit
          };
        }

        return {
          hasAccess: false,
          reason: `Unknown feature: ${feature}`,
          upgradeRequired: false
        };
      },
      'check-feature-access'
    ).catch(error => {
      console.error('Error checking feature access:', error);
      
      // Fallback para permissões básicas em caso de falha total
      const basicFeatures: Record<FeatureKey, boolean | number> = {
        maxClients: 1,
        maxCampaigns: 5,
        advancedAnalytics: false,
        customReports: false,
        apiAccess: false,
        whiteLabel: false,
        prioritySupport: false,
        dataRetention: 30,
        csvExport: false,
        jsonExport: false,
        historicalDataCache: false
      };
      
      const fallbackValue = basicFeatures[feature];
      
      if (typeof fallbackValue === 'boolean') {
        return {
          hasAccess: fallbackValue,
          reason: fallbackValue ? undefined : 'Using fallback permissions due to system issues',
          upgradeRequired: !fallbackValue
        };
      } else if (typeof fallbackValue === 'number') {
        return {
          hasAccess: true, // Assume dentro do limite básico
          reason: 'Using fallback limits due to system issues',
          upgradeRequired: false,
          currentUsage: 0,
          limit: fallbackValue
        };
      }
      
      return {
        hasAccess: false,
        reason: 'System temporarily unavailable',
        upgradeRequired: false
      };
    });
  }

  /**
   * Check usage limits for numeric features
   */
  async checkUsageLimit(
    organizationId: string, 
    feature: FeatureKey
  ): Promise<UsageLimitResult> {
    try {
      const subscription = await this.subscriptionService.getActiveSubscription(organizationId);
      
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const planFeatures = subscription.plan.features;
      const limit = planFeatures[feature] as number;
      
      if (typeof limit !== 'number') {
        throw new Error(`Feature ${feature} is not a numeric limit`);
      }

      const currentUsage = await this.getCurrentUsage(organizationId, feature);
      
      return {
        withinLimit: currentUsage < limit,
        currentUsage,
        limit,
        remainingUsage: Math.max(0, limit - currentUsage)
      };

    } catch (error) {
      console.error('Error checking usage limit:', error);
      throw error;
    }
  }

  /**
   * Increment usage for a feature
   */
  async incrementUsage(
    organizationId: string, 
    feature: FeatureKey
  ): Promise<boolean> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Use atomic database function to check and increment usage
      const { data, error } = await supabase
        .rpc('check_and_increment_feature_usage', {
          org_id: organizationId,
          feature_name: feature
        });

      if (error) {
        console.error('Error incrementing usage:', error);
        return false;
      }

      // Return success status from the atomic function
      return data?.success === true;

    } catch (error) {
      console.error('Error incrementing usage:', error);
      return false;
    }
  }

  /**
   * Get current usage for a feature
   */
  async getCurrentUsage(
    organizationId: string, 
    feature: FeatureKey
  ): Promise<number> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Use server-side current_date to ensure consistent timezone handling
      const currentDate = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('feature_usage')
        .select('usage_count')
        .eq('organization_id', organizationId)
        .eq('feature_key', feature)
        .eq('usage_date', currentDate)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return 0; // Not found
        throw error;
      }

      return data?.usage_count || 0;

    } catch (error) {
      console.error('Error getting current usage:', error);
      return 0;
    }
  }

  /**
   * Get feature matrix for a subscription plan
   */
  async getFeatureMatrix(organizationId: string): Promise<FeatureMatrix> {
    try {
      const subscription = await this.subscriptionService.getActiveSubscription(organizationId);
      
      if (!subscription) {
        // Return free tier features
        return this.getFreeTierFeatures();
      }

      const planFeatures = subscription.plan.features;
      const matrix: FeatureMatrix = {};

      // Add all plan features to matrix
      Object.keys(planFeatures).forEach(key => {
        const value = planFeatures[key as keyof PlanFeatures];
        if (value !== undefined) {
          matrix[key] = value;
        }
      });

      // Add current usage for numeric features
      for (const feature of ['maxClients', 'maxCampaigns'] as FeatureKey[]) {
        if (typeof planFeatures[feature] === 'number') {
          const currentUsage = await this.getCurrentUsage(organizationId, feature);
          matrix[`${feature}Usage`] = currentUsage;
          matrix[`${feature}Remaining`] = Math.max(0, (planFeatures[feature] as number) - currentUsage);
        }
      }

      return matrix;

    } catch (error) {
      console.error('Error getting feature matrix:', error);
      return this.getFreeTierFeatures();
    }
  }

  /**
   * Get free tier features (fallback)
   */
  private getFreeTierFeatures(): FeatureMatrix {
    return {
      maxClients: 1,
      maxCampaigns: 5,
      advancedAnalytics: false,
      customReports: false,
      apiAccess: false,
      whiteLabel: false,
      prioritySupport: false,
      maxClientsUsage: 0,
      maxCampaignsUsage: 0,
      maxClientsRemaining: 1,
      maxCampaignsRemaining: 5
    };
  }

  /**
   * Validate feature access and throw error if not allowed
   */
  async validateFeatureAccess(
    organizationId: string, 
    feature: FeatureKey,
    errorMessage?: string
  ): Promise<void> {
    const access = await this.checkFeatureAccess(organizationId, feature);
    
    if (!access.hasAccess) {
      throw new Error(
        errorMessage || 
        access.reason || 
        `Access denied for feature: ${feature}`
      );
    }
  }

  /**
   * Validate usage limit and throw error if exceeded
   */
  async validateUsageLimit(
    organizationId: string, 
    feature: FeatureKey,
    errorMessage?: string
  ): Promise<void> {
    const usage = await this.checkUsageLimit(organizationId, feature);
    
    if (!usage.withinLimit) {
      throw new Error(
        errorMessage || 
        `Usage limit exceeded for ${feature}. Current: ${usage.currentUsage}, Limit: ${usage.limit}`
      );
    }
  }

  /**
   * Get usage statistics for an organization
   */
  async getUsageStatistics(organizationId: string): Promise<{
    [key: string]: {
      current: number;
      limit: number;
      percentage: number;
    }
  }> {
    try {
      const subscription = await this.subscriptionService.getActiveSubscription(organizationId);
      
      if (!subscription) {
        return {};
      }

      const stats: any = {};
      const planFeatures = subscription.plan.features;

      // Get usage stats for numeric features
      for (const feature of ['maxClients', 'maxCampaigns'] as FeatureKey[]) {
        if (typeof planFeatures[feature] === 'number') {
          const limit = planFeatures[feature] as number;
          const current = await this.getCurrentUsage(organizationId, feature);
          const percentage = limit > 0 ? (current / limit) * 100 : 0;

          stats[feature] = {
            current,
            limit,
            percentage: Math.min(100, percentage)
          };
        }
      }

      return stats;

    } catch (error) {
      console.error('Error getting usage statistics:', error);
      return {};
    }
  }

  /**
   * Reset usage for a specific feature (admin function)
   */
  async resetUsage(
    organizationId: string, 
    feature: FeatureKey,
    date?: Date
  ): Promise<boolean> {
    try {
      const supabase = await this.getSupabaseClient();
      
      // Use server-side current_date if no date provided to ensure timezone consistency
      let dateFilter: string;
      if (date) {
        // Convert provided date to UTC date string
        const utcDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        dateFilter = utcDate.toISOString().split('T')[0];
      } else {
        dateFilter = new Date().toISOString().split('T')[0];
      }
      
      const { error } = await supabase
        .from('feature_usage')
        .update({ usage_count: 0 })
        .eq('organization_id', organizationId)
        .eq('feature_key', feature)
        .eq('usage_date', dateFilter);

      if (error) {
        console.error('Error resetting usage:', error);
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error resetting usage:', error);
      return false;
    }
  }
}