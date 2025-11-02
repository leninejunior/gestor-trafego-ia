'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface SubscriptionIntent {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  user_email: string;
  user_name: string;
  organization_name: string;
  plan_name?: string;
  billing_cycle: string;
  checkout_url?: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
  error_message?: string;
}

interface UsePaymentStatusOptions {
  intentId: string;
  enablePolling?: boolean;
  enableWebSocket?: boolean;
  pollingInterval?: number;
}

interface UsePaymentStatusReturn {
  intent: SubscriptionIntent | null;
  loading: boolean;
  error: string | null;
  isPolling: boolean;
  isConnected: boolean;
  refetch: () => Promise<void>;
  stopPolling: () => void;
  startPolling: () => void;
}

export function usePaymentStatus({
  intentId,
  enablePolling = true,
  enableWebSocket = true,
  pollingInterval = 3000
}: UsePaymentStatusOptions): UsePaymentStatusReturn {
  const [intent, setIntent] = useState<SubscriptionIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      const response = await fetch(`/api/subscriptions/status/${intentId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao buscar status do pagamento');
      }
      
      const data = await response.json();
      
      if (mountedRef.current) {
        setIntent(data.intent);
        setError(null);
        
        // Para de fazer polling se o status for final
        if (['completed', 'failed', 'expired'].includes(data.intent.status)) {
          stopPolling();
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        stopPolling();
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [intentId]);

  const startPolling = useCallback(() => {
    if (!enablePolling || isPolling) return;
    
    setIsPolling(true);
    pollingRef.current = setInterval(fetchStatus, pollingInterval);
  }, [enablePolling, isPolling, fetchStatus, pollingInterval]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket || wsRef.current) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/subscriptions/status/${intentId}/stream`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket conectado para status de pagamento');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'status_update' && mountedRef.current) {
            setIntent(data.intent);
            setError(null);
            
            // Para polling se receber update via WebSocket
            if (['completed', 'failed', 'expired'].includes(data.intent.status)) {
              stopPolling();
            }
          }
        } catch (err) {
          console.error('Erro ao processar mensagem WebSocket:', err);
        }
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        
        // Fallback para polling se WebSocket desconectar
        if (mountedRef.current && enablePolling && !isPolling) {
          startPolling();
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        setIsConnected(false);
        
        // Fallback para polling em caso de erro
        if (mountedRef.current && enablePolling && !isPolling) {
          startPolling();
        }
      };
    } catch (err) {
      console.error('Erro ao conectar WebSocket:', err);
      
      // Fallback para polling se WebSocket falhar
      if (enablePolling && !isPolling) {
        startPolling();
      }
    }
  }, [enableWebSocket, intentId, enablePolling, isPolling, startPolling, stopPolling]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchStatus();
  }, [fetchStatus]);

  // Inicialização
  useEffect(() => {
    fetchStatus();
    
    if (enableWebSocket) {
      connectWebSocket();
    } else if (enablePolling) {
      startPolling();
    }
    
    return () => {
      mountedRef.current = false;
      stopPolling();
      disconnectWebSocket();
    };
  }, []);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopPolling();
      disconnectWebSocket();
    };
  }, [stopPolling, disconnectWebSocket]);

  // Gerenciar visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página ficou oculta - reduzir atividade
        stopPolling();
      } else {
        // Página ficou visível - retomar atividade
        refetch();
        if (enablePolling && !isConnected) {
          startPolling();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enablePolling, isConnected, refetch, startPolling, stopPolling]);

  return {
    intent,
    loading,
    error,
    isPolling,
    isConnected,
    refetch,
    stopPolling,
    startPolling
  };
}