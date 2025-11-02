'use client';

import { useState, useEffect } from 'react';

interface CampaignLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  loading: boolean;
  error: string | null;
  checkLimit: (clientId: string) => Promise<boolean>;
}

export function useCampaignLimit(clientId?: string): CampaignLimitResult {
  const [allowed, setAllowed] = useState(true);
  const [current, setCurrent] = useState(0);
  const [limit, setLimit] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) {
      checkLimit(clientId);
    }
  }, [clientId]);

  const checkLimit = async (targetClientId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/feature-gate/campaign-limit?clientId=${targetClientId}`);
      
      if (!response.ok) {
        throw new Error('Failed to check campaign limit');
      }

      const data = await response.json();
      
      setAllowed(data.allowed);
      setCurrent(data.current);
      setLimit(data.limit);

      return data.allowed;
    } catch (err) {
      console.error('Error checking campaign limit:', err);
      setError('Erro ao verificar limite de campanhas');
      return true; // Allow on error to not block user
    } finally {
      setLoading(false);
    }
  };

  return {
    allowed,
    current,
    limit,
    loading,
    error,
    checkLimit
  };
}
