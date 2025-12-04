"use client";

/**
 * Platform Comparison Chart Component
 * 
 * Provides visual comparison between Meta Ads and Google Ads performance
 * Requirements: 5.2, 5.3
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  AlertCircle
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PlatformComparisonChartProps {
  clientId: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

interface PlatformComparison {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  platforms: {
    meta?: PlatformMetrics;
    google?: PlatformMetrics;
  };
  comparison: {
    betterPerformingPlatform: 'meta' | 'google' | null;
    metrics: {
      spend: MetricComparison;
      conversions: MetricComparison;
      roas: MetricComparison;
      ctr: MetricComparison;
      cpc: MetricComparison;
      cpa: MetricComparison;
    };
  };
  insights: string[];
}

interface PlatformMetrics {
  platform: 'meta' | 'google';
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  conversionRate?: number;
}

interface MetricComparison {
  meta?: number;
  google?: number;
  difference?: number;
  winner?: 'meta' | 'google' | 'tie';
  significance?: 'high' | 'medium' | 'low' | 'none';
}

type MetricKey = 'spend' | 'conversions' | 'roas' | 'ctr' | 'cpc' | 'cpa';
type ChartType = 'bar' | 'pie';

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_COLORS = {
  meta: '#1877F2',
  google: '#4285F4',
};

const METRIC_LABELS = {
  spend: 'Investimento',
  conversions: 'Conversões',
  roas: 'ROAS',
  ctr: 'CTR (%)',
  cpc: 'CPC',
  cpa: 'CPA',
};

const METRIC_FORMATS = {
  spend: 'currency',
  conversions: 'number',
  roas: 'percentage',
  ctr: 'percentage',
  cpc: 'currency',
  cpa: 'currency',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

const formatValue = (value: number, format: string): string => {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'number':
      return value.toLocaleString('pt-BR');
    default:
      return value.toString();
  }
};

const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

const getWinnerIcon = (winner?: string, significance?: string) => {
  if (!winner || winner === 'tie' || significance === 'none') {
    return <div className="h-4 w-4 text-muted-foreground">-</div>;
  }
  
  if (significance === 'high') {
    return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
  } else if (significance === 'medium') {
    return <TrendingUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
  } else {
    return <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  }
};

// ============================================================================
// Main Component
// ============================================================================

export function PlatformComparisonChart({
  clientId,
  dateRange = getDefaultDateRange(),
}: PlatformComparisonChartProps) {
  const [comparison, setComparison] = useState<PlatformComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('spend');
  const [chartType, setChartType] = useState<ChartType>('bar');

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  useEffect(() => {
    const fetchComparison = async () => {
      if (!clientId) return;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          clientId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          includeInsights: 'true',
        });

        const response = await fetch(`/api/unified/comparison?${params}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success && data.data) {
          setComparison(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch comparison data');
        }
      } catch (err) {
        console.error('Error fetching platform comparison:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [clientId, dateRange.startDate, dateRange.endDate]);

  // ==========================================================================
  // Chart Data Preparation
  // ==========================================================================

  const getChartData = () => {
    if (!comparison) return [];

    const { platforms } = comparison;
    const metaValue = platforms.meta?.[selectedMetric] || 0;
    const googleValue = platforms.google?.[selectedMetric] || 0;

    if (chartType === 'pie') {
      const data = [];
      if (metaValue > 0) {
        data.push({
          name: 'Meta Ads',
          value: metaValue,
          color: PLATFORM_COLORS.meta,
        });
      }
      if (googleValue > 0) {
        data.push({
          name: 'Google Ads',
          value: googleValue,
          color: PLATFORM_COLORS.google,
        });
      }
      return data;
    }

    // Bar chart data
    return [
      {
        metric: METRIC_LABELS[selectedMetric],
        Meta: metaValue,
        Google: googleValue,
      },
    ];
  };

  const getMetricsTableData = () => {
    if (!comparison) return [];

    return Object.entries(comparison.comparison.metrics).map(([key, metric]) => ({
      metric: METRIC_LABELS[key as MetricKey],
      key: key as MetricKey,
      meta: metric.meta,
      google: metric.google,
      winner: metric.winner,
      significance: metric.significance,
      difference: metric.difference,
    }));
  };

  // ==========================================================================
  // Render States
  // ==========================================================================

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="mr-2 h-5 w-5 animate-spin">⟳</div>
            Carregando Comparação
          </CardTitle>
          <CardDescription>
            Analisando dados de ambas as plataformas...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin text-muted-foreground">⟳</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertCircle className="mr-2 h-5 w-5" />
            Erro na Comparação
          </CardTitle>
          <CardDescription>
            Não foi possível carregar os dados de comparação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate derived values BEFORE any conditional returns
  // This ensures all hooks are called consistently
  const chartData = getChartData();
  const metricsData = getMetricsTableData();
  const { betterPerformingPlatform } = comparison.comparison;

  if (!comparison) {
    return null;
  }

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* Winner Badge */}
      {betterPerformingPlatform && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Badge variant="default" className="text-lg px-4 py-2">
                <div className="mr-2 h-5 w-5">⭐</div>
                {betterPerformingPlatform === 'meta' ? 'Meta Ads' : 'Google Ads'} está performando melhor
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart Controls and Visualization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Comparação Visual</CardTitle>
              <CardDescription>
                Compare métricas entre as plataformas
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Select value={selectedMetric} onValueChange={(value: MetricKey) => setSelectedMetric(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex border rounded-md">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  className="rounded-r-none"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartType('pie')}
                  className="rounded-l-none"
                >
                  <div className="h-4 w-4">○</div>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis tickFormatter={(value) => formatValue(value, METRIC_FORMATS[selectedMetric])} />
                  <Tooltip 
                    formatter={(value: number) => [
                      formatValue(value, METRIC_FORMATS[selectedMetric]),
                      ''
                    ]}
                  />
                  <Bar dataKey="Meta" fill={PLATFORM_COLORS.meta} />
                  <Bar dataKey="Google" fill={PLATFORM_COLORS.google} />
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatValue(value, METRIC_FORMATS[selectedMetric])}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={'color' in entry ? entry.color : PLATFORM_COLORS.meta} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatValue(value, METRIC_FORMATS[selectedMetric])} />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comparação Detalhada</CardTitle>
          <CardDescription>
            Análise métrica por métrica entre as plataformas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metricsData.map((row) => (
              <div key={row.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="font-medium">{row.metric}</div>
                  {getWinnerIcon(row.winner, row.significance)}
                </div>
                
                <div className="flex items-center space-x-6">
                  {/* Meta Value */}
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full" />
                      <span className="text-sm text-muted-foreground">Meta</span>
                    </div>
                    <div className="font-medium">
                      {row.meta !== undefined 
                        ? formatValue(row.meta, METRIC_FORMATS[row.key])
                        : 'N/A'
                      }
                    </div>
                  </div>

                  {/* Google Value */}
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-600 rounded-full" />
                      <span className="text-sm text-muted-foreground">Google</span>
                    </div>
                    <div className="font-medium">
                      {row.google !== undefined 
                        ? formatValue(row.google, METRIC_FORMATS[row.key])
                        : 'N/A'
                      }
                    </div>
                  </div>

                  {/* Winner Badge */}
                  {row.winner && row.winner !== 'tie' && (
                    <Badge 
                      variant={row.significance === 'high' ? 'default' : 'secondary'}
                      className="ml-4"
                    >
                      {row.winner === 'meta' ? 'Meta' : 'Google'} vence
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      {comparison.insights && comparison.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Insights da Comparação</CardTitle>
            <CardDescription>
              Análises automáticas baseadas nos dados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {comparison.insights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}