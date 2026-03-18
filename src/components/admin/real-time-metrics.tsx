/**
 * Componente de métricas em tempo real
 * Exibe estatísticas atualizadas automaticamente
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Users,
  CreditCard
} from 'lucide-react';

interface RealTimeMetrics {
  active_checkouts: number;
  pending_payments: number;
  recent_completions: number;
  failed_last_hour: number;
  conversion_rate_today: number;
  average_time_today: number;
}

export function RealTimeMetrics() {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRealTimeMetrics = async () => {
    try {
      const response = await fetch('/api/admin/subscription-intents/real-time-metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealTimeMetrics();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchRealTimeMetrics, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}min`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Checkouts Ativos</p>
              <p className="text-lg font-bold">{metrics?.active_checkouts || 0}</p>
            </div>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pagamentos Pendentes</p>
              <p className="text-lg font-bold">{metrics?.pending_payments || 0}</p>
            </div>
            <Clock className="h-4 w-4 text-yellow-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Completados (1h)</p>
              <p className="text-lg font-bold text-green-600">{metrics?.recent_completions || 0}</p>
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Falhas (1h)</p>
              <p className="text-lg font-bold text-red-600">{metrics?.failed_last_hour || 0}</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Conversão Hoje</p>
              <p className="text-lg font-bold">{(metrics?.conversion_rate_today || 0).toFixed(1)}%</p>
            </div>
            <Users className="h-4 w-4 text-purple-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Tempo Médio</p>
              <p className="text-lg font-bold">{formatTime(metrics?.average_time_today || 0)}</p>
            </div>
            <CreditCard className="h-4 w-4 text-indigo-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}