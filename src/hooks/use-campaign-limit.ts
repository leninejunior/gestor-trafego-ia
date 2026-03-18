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
  const [allowed, setAllowed] = useState(true); // Default to true to avoid blocking
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

      console.log('🔍 Checking campaign limit for client:', targetClientId);

      const response = await fetch(`/api/feature-gate/campaign-limit?clientId=${targetClientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });
      
      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error:', response.status, errorData);
        
        if (response.status === 401) {
          setError('Não autorizado - faça login novamente');
          return false;
        }

        if (response.status === 403) {
          console.warn('⚠️ Access denied to client - user may not have membership');
          setError('Acesso negado a este cliente');
          return false;
        }
        
        throw new Error(`API Error: ${response.status} - ${errorData?.error || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('✅ API Response data:', data);
      if (data?.debug) {
        console.log('🧪 Campaign limit debug:', data.debug);
      } else {
        console.log('🧪 Campaign limit debug: none');
      }
      
      setAllowed(data.allowed);
      setCurrent(data.current);
      setLimit(data.limit);

      return data.allowed;
    } catch (err) {
      console.error('❌ Error checking campaign limit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Erro ao verificar limite: ${errorMessage}`);
      
      // In case of error, default to allowing to not block user
      // But log the error for debugging
      setAllowed(true);
      setCurrent(0);
      setLimit(-1);
      
      return true;
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
