/**
 * Dashboard de Analytics para Subscription Intents
 * Exibe métricas de conversão, abandono e performance
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  CreditCard, 
  AlertCircle, 
  CheckCircle,
  Clock,
  DollarSign,
  RefreshCw
} from 'lucide-react';

interface AnalyticsMetrics {
  total_intents: number;
  pending_intents: number;
  completed_intents: number;
  failed_intents: number;
  expired_intents: number;
  conversion_rate: number;
  average_completion_time: number;
  abandonment_rate: number;
  total_revenue: number;
}

interface ConversionTrendData {
  date: string;
  started: number;
  completed: number;
  conversion_rate: number;
}

interface PlanPerformanceData {
  plan_name: string;
  plan_id: string;
  total_intents: number;
  completed_intents: number;
  conversion_rate: number;
  revenue: number;
}

interface AbandonmentData {
  stage: string;
  count: number;
  percentage: number;
}

interface AnalyticsFilters {
  period_start?: string;
  period_end?: string;
  status_filter?: string;
  plan_filter?: string;
  billing_cycle_filter?: string;
}

interface SubscriptionIntentAnalyticsProps {
  filters?: AnalyticsFilters;
}

export default function SubscriptionIntentAnalytics({ filters = {} }: SubscriptionIntentAnalyticsProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [conversionTrend, setConversionTrend] = useState<ConversionTrendData[]>([]);
  const [planPerformance, setPlanPerformance] = useState<PlanPerformanceData[]>([]);
  const [abandonmentData, setAbandonmentData] = useState<AbandonmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      const periodStart = filters.period_start || getPeriodStart(period);
      const periodEnd = filters.period_end || new Date().toISOString();
      
      const params = new URLSearchParams({
        period_start: periodStart,
        period_end: periodEnd
      });
      
      if (filters.status_filter) params.append('status_filter', filters.status_filter);
      if (filters.plan_filter) params.append('plan_filter', filters.plan_filter);
      if (filters.billing_cycle_filter) params.append('billing_cycle_filter', filters.billing_cycle_filter);
      
      const response = await fetch(`/api/admin/subscription-intents/analytics?${params.toString()}`);
      
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      
      setMetrics(data.analytics.metrics);
      setConversionTrend(data.conversion_trend || []);
      setPlanPerformance(data.plan_performance || []);
      setAbandonmentData(data.abandonment_analysis || []);
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    try {
      setRefreshing(true);
      
      // Refresh cache first
      await fetch('/api/admin/subscription-intents/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_cache' })
      });
      
      // Then fetch fresh data
      await fetchAnalytics();
      
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const exportAnalytics = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const periodStart = getPeriodStart(period);
      const periodEnd = new Date().toISOString();
      
      const response = await fetch('/api/admin/subscription-intents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          format,
          period_start: periodStart,
          period_end: periodEnd
        })
      });
      
      if (!response.ok) throw new Error('Failed to export analytics');
      
      // Criar download do arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscription-intents-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  };

  const getPeriodStart = (period: string): string => {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, filters]);

  if (loading && !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="1y">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAnalytics}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAnalytics('csv')}
            >
              📥 CSV
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAnalytics('json')}
            >
              📥 JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Intents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_intents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.pending_intents || 0} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(metrics?.conversion_rate || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.completed_intents || 0} completados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.total_revenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(metrics?.average_completion_time || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Para completar checkout
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Completados</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{metrics?.completed_intents || 0}</span>
                  <Badge variant="secondary">
                    {formatPercentage(
                      metrics?.total_intents ? 
                      (metrics.completed_intents / metrics.total_intents) * 100 : 0
                    )}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Pendentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{metrics?.pending_intents || 0}</span>
                  <Badge variant="secondary">
                    {formatPercentage(
                      metrics?.total_intents ? 
                      (metrics.pending_intents / metrics.total_intents) * 100 : 0
                    )}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Falharam</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{metrics?.failed_intents || 0}</span>
                  <Badge variant="secondary">
                    {formatPercentage(
                      metrics?.total_intents ? 
                      (metrics.failed_intents / metrics.total_intents) * 100 : 0
                    )}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Expirados</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{metrics?.expired_intents || 0}</span>
                  <Badge variant="secondary">
                    {formatPercentage(
                      metrics?.total_intents ? 
                      (metrics.expired_intents / metrics.total_intents) * 100 : 0
                    )}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxa de Abandono</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-red-500">
                {formatPercentage(metrics?.abandonment_rate || 0)}
              </div>
              <p className="text-sm text-muted-foreground">
                dos checkouts são abandonados
              </p>
            </div>
            
            {abandonmentData.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Por etapa:</h4>
                {abandonmentData.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.stage}</span>
                    <span className="font-medium">{formatPercentage(item.percentage)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion Trend Chart */}
      {conversionTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendência de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={conversionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                  formatter={(value: any, name: string) => {
                    if (name === 'conversion_rate') {
                      return [formatPercentage(value), 'Taxa de Conversão'];
                    }
                    return [value, name === 'started' ? 'Iniciados' : 'Completados'];
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="started"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="completed"
                  stackId="1"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.6}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversion_rate"
                  stroke="#ff7300"
                  strokeWidth={2}
                  dot={{ fill: '#ff7300' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Plan Performance */}
      {planPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={planPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plan_name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === 'conversion_rate') {
                      return [formatPercentage(value), 'Taxa de Conversão'];
                    }
                    if (name === 'revenue') {
                      return [formatCurrency(value), 'Receita'];
                    }
                    return [value, name === 'total_intents' ? 'Total' : 'Completados'];
                  }}
                />
                <Bar yAxisId="left" dataKey="total_intents" fill="#8884d8" name="total_intents" />
                <Bar yAxisId="left" dataKey="completed_intents" fill="#82ca9d" name="completed_intents" />
                <Bar yAxisId="right" dataKey="conversion_rate" fill="#ffc658" name="conversion_rate" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Named export for compatibility
export { SubscriptionIntentAnalytics };