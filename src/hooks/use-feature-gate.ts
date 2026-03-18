import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/use-user';
import { FeatureKey, FeatureAccessResult, UsageLimitResult, FeatureMatrix } from '@/lib/services/feature-gate';

/**
 * Hook for checking feature access
 */
export function useFeatureAccess(feature: FeatureKey) {
  const { user } = useUser();
  const [access, setAccess] = useState<FeatureAccessResult>({
    hasAccess: false,
    reason: 'Loading...'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAccess = useCallback(async () => {
    if (!user) {
      setAccess({
        hasAccess: false,
        reason: 'User not authenticated',
        upgradeRequired: true
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/feature-gate/check-access', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feature }),
      });

      if (!response.ok) {
        throw new Error('Failed to check feature access');
      }

      const result = await response.json();
      setAccess(result.data || result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setAccess({
        hasAccess: false,
        reason: errorMessage,
        upgradeRequired: true
      });
    } finally {
      setLoading(false);
    }
  }, [user, feature]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return {
    ...access,
    loading,
    error,
    refetch: checkAccess
  };
}

/**
 * Hook for checking usage limits
 */
export function useUsageLimit(feature: FeatureKey) {
  const { user } = useUser();
  const [usage, setUsage] = useState<UsageLimitResult>({
    withinLimit: true,
    currentUsage: 0,
    limit: 0,
    remainingUsage: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkUsage = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/feature-gate/check-usage', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feature }),
      });

      if (!response.ok) {
        throw new Error('Failed to check usage limit');
      }

      const result = await response.json();
      setUsage(result.data || result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setUsage({
        withinLimit: true,
        currentUsage: 0,
        limit: 1000,
        remainingUsage: 1000
      });
    } finally {
      setLoading(false);
    }
  }, [user, feature]);

  const incrementUsage = useCallback(async () => {
    if (!user) return false;

    try {
      const response = await fetch('/api/feature-gate/increment-usage', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feature }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      
      if (result.success) {
        await checkUsage();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      return false;
    }
  }, [user, feature, checkUsage]);

  useEffect(() => {
    checkUsage();
  }, [checkUsage]);

  return {
    ...usage,
    loading,
    error,
    refetch: checkUsage,
    incrementUsage
  };
}

/**
 * Hook for subscription status
 */
export function useSubscriptionStatus() {
  const { user } = useUser();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      setSubscription({
        status: 'active',
        plan: 'development',
        planName: 'Development Plan'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    subscription,
    plan: subscription?.plan,
    isActive: subscription?.status === 'active',
    isTrialing: subscription?.status === 'trialing',
    isPastDue: subscription?.status === 'past_due',
    isCanceled: subscription?.status === 'canceled',
    loading,
    error,
    refetch: fetchSubscription
  };
}

/**
 * Hook for getting complete feature matrix
 */
export function useFeatureMatrix() {
  const { user } = useUser();
  const [matrix, setMatrix] = useState<FeatureMatrix>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/feature-gate/matrix', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feature matrix');
      }

      const result = await response.json();
      setMatrix(result.data || result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setMatrix({});
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  return {
    matrix,
    loading,
    error,
    refetch: fetchMatrix,
    hasFeature: (feature: string) => Boolean(matrix[feature]),
    getLimit: (feature: string) => matrix[feature] as number || 0,
    getUsage: (feature: string) => matrix[`${feature}Usage`] as number || 0,
    getRemaining: (feature: string) => matrix[`${feature}Remaining`] as number || 0
  };
}

/**
 * Hook for usage statistics
 */
export function useUsageStatistics() {
  const { user } = useUser();
  const [statistics, setStatistics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/feature-gate/statistics', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const result = await response.json();
      setStatistics(result.data || result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatistics({});
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    loading,
    error,
    refetch: fetchStatistics
  };
}

/**
 * Combined hook for comprehensive feature gating
 */
export function useFeatureGate(feature: FeatureKey) {
  const access = useFeatureAccess(feature);
  const usage = useUsageLimit(feature);
  const subscription = useSubscriptionStatus();

  return {
    // Access control
    hasAccess: access.hasAccess,
    accessReason: access.reason,
    upgradeRequired: access.upgradeRequired,
    
    // Usage limits
    withinLimit: usage.withinLimit,
    currentUsage: usage.currentUsage,
    limit: usage.limit,
    remainingUsage: usage.remainingUsage,
    usagePercentage: usage.currentUsage > 0 && usage.limit > 0 ? (usage.currentUsage / usage.limit) * 100 : 0,
    
    // Subscription info
    subscription: subscription.subscription,
    plan: subscription.plan,
    isActive: subscription.isActive,
    
    // Loading states
    loading: access.loading || usage.loading || subscription.loading,
    error: access.error || usage.error || subscription.error,
    
    // Actions
    incrementUsage: usage.incrementUsage,
    refetch: () => {
      access.refetch();
      usage.refetch();
      subscription.refetch();
    }
  };
}