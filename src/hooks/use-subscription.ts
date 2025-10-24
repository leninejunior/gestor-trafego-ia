"use client";

import { useState, useEffect } from 'react';
import { 
  SubscriptionWithPlan, 
  BillingCycleInfo, 
  SubscriptionPlan,
  ProrationCalculation 
} from '@/lib/types/subscription';

interface UseSubscriptionProps {
  organizationId: string;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionWithPlan | null;
  billingInfo: BillingCycleInfo | null;
  availablePlans: SubscriptionPlan[];
  loading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  upgradeSubscription: (planId: string, billingCycle: 'monthly' | 'annual') => Promise<void>;
  cancelSubscription: (reason?: string) => Promise<void>;
  calculateUpgradeCost: (planId: string, billingCycle: 'monthly' | 'annual') => Promise<ProrationCalculation | null>;
}

export function useSubscription({ organizationId }: UseSubscriptionProps): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingCycleInfo | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    try {
      setError(null);
      
      const response = await fetch(`/api/subscriptions/current?organization_id=${organizationId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar informações da assinatura');
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setSubscription(data.data.subscription);
        setBillingInfo(data.data.billing_info);
      } else {
        setSubscription(null);
        setBillingInfo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  const fetchAvailablePlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans');
      
      if (!response.ok) {
        throw new Error('Falha ao carregar planos disponíveis');
      }

      const data = await response.json();
      setAvailablePlans(data.plans || []);
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
      // Don't set error for plans as it's not critical
    }
  };

  const refreshSubscription = async () => {
    setLoading(true);
    await Promise.all([fetchSubscription(), fetchAvailablePlans()]);
    setLoading(false);
  };

  const upgradeSubscription = async (planId: string, billingCycle: 'monthly' | 'annual') => {
    if (!subscription) {
      throw new Error('Nenhuma assinatura ativa encontrada');
    }

    try {
      const response = await fetch('/api/subscriptions/upgrade', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: subscription.id,
          plan_id: planId,
          billing_cycle: billingCycle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao atualizar assinatura');
      }

      // Refresh subscription data
      await refreshSubscription();
    } catch (err) {
      throw err;
    }
  };

  const cancelSubscription = async (reason?: string) => {
    if (!subscription) {
      throw new Error('Nenhuma assinatura ativa encontrada');
    }

    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: subscription.id,
          cancel_at_period_end: true,
          reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao cancelar assinatura');
      }

      // Refresh subscription data
      await refreshSubscription();
    } catch (err) {
      throw err;
    }
  };

  const calculateUpgradeCost = async (
    planId: string, 
    billingCycle: 'monthly' | 'annual'
  ): Promise<ProrationCalculation | null> => {
    if (!subscription) return null;

    try {
      const response = await fetch('/api/subscriptions/calculate-proration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: subscription.id,
          new_plan_id: planId,
          billing_cycle: billingCycle,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao calcular custos');
      }

      const data = await response.json();
      return data.proration;
    } catch (err) {
      console.error('Erro ao calcular custos:', err);
      return null;
    }
  };

  useEffect(() => {
    if (organizationId) {
      refreshSubscription();
    }
  }, [organizationId]);

  return {
    subscription,
    billingInfo,
    availablePlans,
    loading,
    error,
    refreshSubscription,
    upgradeSubscription,
    cancelSubscription,
    calculateUpgradeCost,
  };
}