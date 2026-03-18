"use client";

/**
 * Google Ads Performance Chart Component
 * 
 * Displays performance trends over time for Google Ads campaigns
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface GooglePerformanceChartProps {
  clientId?: string;
  startDate?: string;
  endDate?: string;
}

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  cpc: number;
}

type MetricType = 'cost' | 'impressions' | 'clicks' | 'conversions' | 'ctr' | 'cpc';

const METRIC_CONFIG: Record<MetricType, { label: string; color: string; format: (v: number) => string }> = {
  cost: {
    label: 'Investimento',
    color: '#10b981',
    format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),
  },
  impressions: {
    label: 'Impressões',
    color: '#3b82f6',
    format: (v) => new Intl.NumberFormat('pt-BR').format(v),
  },
  clicks: {
    label: 'Cliques',
    color: '#8b5cf6',
    format: (v) => new Intl.NumberFormat('pt-BR').format(v),
  },
  conversions: {
    label: 'Conversões',
    color: '#f59e0b',
    format: (v) => v.toFixed(1),
  },
  ctr: {
    label: 'CTR',
    color: '#ec4899',
    format: (v) => `${v.toFixed(2)}%`,
  },
  cpc: {
    label: 'CPC',
    color: '#06b6d4',
    format: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v),
  },
};

export function GooglePerformanceChart({ clientId, startDate, endDate }: GooglePerformanceChartProps) {
  const [data, setData] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('cost');

  useEffect(() => {
    const fetchDailyMetrics = async () => {
      if (!clientId || !startDate || !endDate) {
        setData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          clientId,
          startDate,
          endDate,
          groupBy: 'date',
        });

        const response = await fetch(`/api/google/metrics-daily?${params}`);
        
        if (!response.ok) {
          // Fallback sem dados simulados: usa apenas o agregado como ponto único
          const fallbackResponse = await fetch(`/api/google/metrics-simple?clientId=${clientId}&startDate=${startDate}&endDate=${endDate}`);
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const totalCost = fallbackData.summary?.totalCost || 0;
            const totalImpressions = fallbackData.summary?.totalImpressions || 0;
            const totalClicks = fallbackData.summary?.totalClicks || 0;
            const totalConversions = fallbackData.summary?.totalConversions || 0;

            if (totalCost > 0 || totalImpressions > 0 || totalClicks > 0 || totalConversions > 0) {
              setData([
                {
                  date: endDate,
                  cost: totalCost,
                  impressions: totalImpressions,
                  clicks: totalClicks,
                  conversions: totalConversions,
                  ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                  cpc: totalClicks > 0 ? totalCost / totalClicks : 0,
                },
              ]);
            } else {
              setData([]);
            }
          }
          return;
        }

        const result = await response.json();
        setData(result.dailyMetrics || []);
      } catch (err) {
        console.error('Error fetching daily metrics:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchDailyMetrics();
  }, [clientId, startDate, endDate]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const calculateTrend = () => {
    if (data.length < 2) return null;
    
    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d[selectedMetric], 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d[selectedMetric], 0) / secondHalf.length;
    
    if (firstAvg === 0) return null;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: selectedMetric === 'cpc' || selectedMetric === 'cost' ? change < 0 : change > 0,
      direction: change >= 0 ? 'up' : 'down',
    };
  };

  const trend = calculateTrend();
  const config = METRIC_CONFIG[selectedMetric];

  if (!clientId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance ao Longo do Tempo</CardTitle>
          <CardDescription>Selecione um cliente para ver o gráfico de performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Selecione um cliente para visualizar os dados
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Performance ao Longo do Tempo</CardTitle>
            <CardDescription>
              Evolução das métricas do Google Ads no período selecionado
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {trend && (
              <Badge variant={trend.isPositive ? 'default' : 'destructive'} className="flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.value}%
              </Badge>
            )}
            <Select value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as MetricType)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="h-[300px] flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis
                tickFormatter={(v) => {
                  if (selectedMetric === 'cost' || selectedMetric === 'cpc') {
                    return `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}`;
                  }
                  if (selectedMetric === 'ctr') return `${v.toFixed(1)}%`;
                  return v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0);
                }}
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <Tooltip
                formatter={(value: number) => [config.format(value), config.label]}
                labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#gradient-${selectedMetric})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
