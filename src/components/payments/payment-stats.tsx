'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  DollarSign,
  Activity
} from 'lucide-react';
import { PaymentStats as PaymentStatsType } from '@/lib/types/payments';

export function PaymentStats() {
  const [stats, setStats] = useState<PaymentStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/payments/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Carregando...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Erro ao carregar estatísticas de pagamentos
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600 dark:text-green-400';
    if (rate >= 85) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getSuccessRateBadge = (rate: number) => {
    if (rate >= 95) return 'default';
    if (rate >= 85) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total de Transações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Transações</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_transactions.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            +12% em relação ao mês anterior
          </p>
        </CardContent>
      </Card>

      {/* Volume Total */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Volume Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.total_amount)}</div>
          <p className="text-xs text-muted-foreground">
            +8% em relação ao mês anterior
          </p>
        </CardContent>
      </Card>

      {/* Taxa de Sucesso */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className={`text-2xl font-bold ${getSuccessRateColor(stats.success_rate)}`}>
              {stats.success_rate.toFixed(1)}%
            </div>
            <Badge variant={getSuccessRateBadge(stats.success_rate)}>
              {stats.success_rate >= 95 ? 'Excelente' : 
               stats.success_rate >= 85 ? 'Bom' : 'Atenção'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Últimos 30 dias
          </p>
        </CardContent>
      </Card>

      {/* Tempo Médio de Processamento */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.avg_processing_time > 0 
              ? `${(stats.avg_processing_time / 1000).toFixed(1)}s`
              : '< 1s'
            }
          </div>
          <p className="text-xs text-muted-foreground">
            Tempo de processamento
          </p>
        </CardContent>
      </Card>

      {/* Distribuição por Status */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(stats.transactions_by_status).map(([status, count]) => {
              const getStatusInfo = (status: string) => {
                switch (status) {
                  case 'succeeded':
                    return { label: 'Aprovadas', color: 'text-green-600', icon: CheckCircle };
                  case 'failed':
                    return { label: 'Falharam', color: 'text-red-600', icon: AlertCircle };
                  case 'pending':
                    return { label: 'Pendentes', color: 'text-yellow-600', icon: CreditCard };
                  case 'processing':
                    return { label: 'Processando', color: 'text-blue-600', icon: Activity };
                  default:
                    return { label: status, color: 'text-muted-foreground', icon: CreditCard };
                }
              };

              const statusInfo = getStatusInfo(status);
              const Icon = statusInfo.icon;
              const percentage = stats.total_transactions > 0 
                ? ((count / stats.total_transactions) * 100).toFixed(1)
                : '0';

              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${statusInfo.color}`} />
                    <span className="text-sm font-medium">{statusInfo.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{percentage}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por Provedor */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição por Provedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(stats.transactions_by_provider).map(([provider, count]) => {
              const percentage = stats.total_transactions > 0 
                ? ((count / stats.total_transactions) * 100).toFixed(1)
                : '0';

              const getProviderColor = (provider: string) => {
                switch (provider) {
                  case 'stripe': return 'bg-purple-500';
                  case 'iugu': return 'bg-blue-500';
                  case 'pagseguro': return 'bg-yellow-500';
                  case 'mercadopago': return 'bg-cyan-500';
                  default: return 'bg-muted-foreground';
                }
              };

              return (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getProviderColor(provider)}`}></div>
                    <span className="text-sm font-medium capitalize">{provider}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{percentage}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}