'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, BarChart3, Activity } from 'lucide-react';

interface PerformanceData {
  date: string;
  campaignId?: string;
  campaignName?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  conversionRate: number;
  cpc: number;
  cpa: number;
}

interface DateRange {
  from: string;
  to: string;
}

interface GooglePerformanceChartProps {
  data: PerformanceData[];
  comparison?: PerformanceData[];
  granularity: 'daily' | 'weekly' | 'monthly';
  dateRange: DateRange;
}

type ChartType = 'line' | 'bar' | 'area' | 'composed';
type MetricType = 'cost' | 'conversions' | 'clicks' | 'impressions' | 'ctr' | 'conversionRate' | 'cpc' | 'cpa';

const METRIC_CONFIG = {
  cost: {
    label: 'Gasto',
    color: '#10b981',
    format: (value: number) => `$${value.toFixed(2)}`,
    yAxisId: 'cost',
  },
  conversions: {
    label: 'Conversões',
    color: '#3b82f6',
    format: (value: number) => value.toFixed(1),
    yAxisId: 'conversions',
  },
  clicks: {
    label: 'Cliques',
    color: '#8b5cf6',
    format: (value: number) => value.toLocaleString(),
    yAxisId: 'clicks',
  },
  impressions: {
    label: 'Impressões',
    color: '#f59e0b',
    format: (value: number) => value.toLocaleString(),
    yAxisId: 'impressions',
  },
  ctr: {
    label: 'CTR (%)',
    color: '#ef4444',
    format: (value: number) => `${value.toFixed(2)}%`,
    yAxisId: 'percentage',
  },
  conversionRate: {
    label: 'Taxa de Conversão (%)',
    color: '#06b6d4',
    format: (value: number) => `${value.toFixed(2)}%`,
    yAxisId: 'percentage',
  },
  cpc: {
    label: 'CPC',
    color: '#84cc16',
    format: (value: number) => `$${value.toFixed(2)}`,
    yAxisId: 'cost',
  },
  cpa: {
    label: 'CPA',
    color: '#f97316',
    format: (value: number) => `$${value.toFixed(2)}`,
    yAxisId: 'cost',
  },
};

export function GooglePerformanceChart({ 
  data, 
  comparison, 
  granularity, 
  dateRange 
}: GooglePerformanceChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [primaryMetric, setPrimaryMetric] = useState<MetricType>('cost');
  const [secondaryMetric, setSecondaryMetric] = useState<MetricType>('conversions');
  const [showComparison, setShowComparison] = useState(!!comparison);

  // Process data for chart display
  const processedData = processDataForChart(data, granularity);
  const comparisonData = comparison ? processDataForChart(comparison, granularity) : null;

  // Combine data with comparison if enabled
  const chartData = combineDataWithComparison(processedData, comparisonData, showComparison);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    
    if (granularity === 'daily') {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } else if (granularity === 'weekly') {
      return `Sem ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}:</span>
              <span className="font-medium">
                {METRIC_CONFIG[entry.dataKey as MetricType]?.format(entry.value) || entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const primaryConfig = METRIC_CONFIG[primaryMetric];
    const secondaryConfig = METRIC_CONFIG[secondaryMetric];

    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              yAxisId={primaryConfig.yAxisId}
              orientation="left"
              tick={{ fontSize: 12 }}
              tickFormatter={primaryConfig.format}
            />
            {primaryConfig.yAxisId !== secondaryConfig.yAxisId && (
              <YAxis 
                yAxisId={secondaryConfig.yAxisId}
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={secondaryConfig.format}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId={primaryConfig.yAxisId}
              type="monotone"
              dataKey={primaryMetric}
              stroke={primaryConfig.color}
              strokeWidth={2}
              name={primaryConfig.label}
              dot={{ r: 4 }}
            />
            <Line
              yAxisId={secondaryConfig.yAxisId}
              type="monotone"
              dataKey={secondaryMetric}
              stroke={secondaryConfig.color}
              strokeWidth={2}
              name={secondaryConfig.label}
              dot={{ r: 4 }}
            />
            {showComparison && comparisonData && (
              <>
                <Line
                  yAxisId={primaryConfig.yAxisId}
                  type="monotone"
                  dataKey={`${primaryMetric}_comparison`}
                  stroke={primaryConfig.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={`${primaryConfig.label} (Comparação)`}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId={secondaryConfig.yAxisId}
                  type="monotone"
                  dataKey={`${secondaryMetric}_comparison`}
                  stroke={secondaryConfig.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={`${secondaryConfig.label} (Comparação)`}
                  dot={{ r: 3 }}
                />
              </>
            )}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              yAxisId={primaryConfig.yAxisId}
              orientation="left"
              tick={{ fontSize: 12 }}
              tickFormatter={primaryConfig.format}
            />
            {primaryConfig.yAxisId !== secondaryConfig.yAxisId && (
              <YAxis 
                yAxisId={secondaryConfig.yAxisId}
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={secondaryConfig.format}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId={primaryConfig.yAxisId}
              dataKey={primaryMetric}
              fill={primaryConfig.color}
              name={primaryConfig.label}
            />
            <Bar
              yAxisId={secondaryConfig.yAxisId}
              dataKey={secondaryMetric}
              fill={secondaryConfig.color}
              name={secondaryConfig.label}
            />
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              yAxisId={primaryConfig.yAxisId}
              orientation="left"
              tick={{ fontSize: 12 }}
              tickFormatter={primaryConfig.format}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              yAxisId={primaryConfig.yAxisId}
              type="monotone"
              dataKey={primaryMetric}
              stackId="1"
              stroke={primaryConfig.color}
              fill={primaryConfig.color}
              fillOpacity={0.6}
              name={primaryConfig.label}
            />
          </AreaChart>
        );

      case 'composed':
        return (
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              yAxisId={primaryConfig.yAxisId}
              orientation="left"
              tick={{ fontSize: 12 }}
              tickFormatter={primaryConfig.format}
            />
            {primaryConfig.yAxisId !== secondaryConfig.yAxisId && (
              <YAxis 
                yAxisId={secondaryConfig.yAxisId}
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={secondaryConfig.format}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId={primaryConfig.yAxisId}
              dataKey={primaryMetric}
              fill={primaryConfig.color}
              name={primaryConfig.label}
            />
            <Line
              yAxisId={secondaryConfig.yAxisId}
              type="monotone"
              dataKey={secondaryMetric}
              stroke={secondaryConfig.color}
              strokeWidth={2}
              name={secondaryConfig.label}
            />
          </ComposedChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance ao Longo do Tempo
            </CardTitle>
            <CardDescription>
              Análise de performance das campanhas Google Ads no período selecionado
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {comparison && (
              <Badge 
                variant={showComparison ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setShowComparison(!showComparison)}
              >
                Comparação
              </Badge>
            )}
          </div>
        </div>
        
        {/* Chart Controls */}
        <div className="flex flex-wrap gap-4 pt-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Linha</SelectItem>
                <SelectItem value="bar">Barras</SelectItem>
                <SelectItem value="area">Área</SelectItem>
                <SelectItem value="composed">Composto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Métrica 1:</span>
            <Select value={primaryMetric} onValueChange={(value: MetricType) => setPrimaryMetric(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METRIC_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {(chartType === 'line' || chartType === 'composed') && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Métrica 2:</span>
              <Select value={secondaryMetric} onValueChange={(value: MetricType) => setSecondaryMetric(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        
        {/* Chart Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-gray-900">
                {METRIC_CONFIG[primaryMetric].format(
                  chartData.reduce((sum, item) => sum + (item[primaryMetric] || 0), 0)
                )}
              </div>
              <div className="text-muted-foreground">Total {METRIC_CONFIG[primaryMetric].label}</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-gray-900">
                {METRIC_CONFIG[secondaryMetric].format(
                  chartData.reduce((sum, item) => sum + (item[secondaryMetric] || 0), 0)
                )}
              </div>
              <div className="text-muted-foreground">Total {METRIC_CONFIG[secondaryMetric].label}</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-foreground">{chartData.length}</div>
              <div className="text-muted-foreground">Pontos de Dados</div>
            </div>
            
            <div className="text-center">
              <div className="font-medium text-gray-900">
                {granularity === 'daily' ? 'Diário' : 
                 granularity === 'weekly' ? 'Semanal' : 'Mensal'}
              </div>
              <div className="text-muted-foreground">Granularidade</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function processDataForChart(data: PerformanceData[], granularity: string) {
  // Group data by date
  const grouped = new Map();
  
  data.forEach(item => {
    const date = item.date;
    
    if (!grouped.has(date)) {
      grouped.set(date, {
        date,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cost: 0,
        count: 0,
      });
    }
    
    const group = grouped.get(date);
    group.impressions += item.impressions || 0;
    group.clicks += item.clicks || 0;
    group.conversions += item.conversions || 0;
    group.cost += item.cost || 0;
    group.count += 1;
  });
  
  // Calculate derived metrics
  return Array.from(grouped.values()).map(group => ({
    date: group.date,
    impressions: group.impressions,
    clicks: group.clicks,
    conversions: group.conversions,
    cost: parseFloat(group.cost.toFixed(2)),
    ctr: group.impressions > 0 ? parseFloat(((group.clicks / group.impressions) * 100).toFixed(2)) : 0,
    conversionRate: group.clicks > 0 ? parseFloat(((group.conversions / group.clicks) * 100).toFixed(2)) : 0,
    cpc: group.clicks > 0 ? parseFloat((group.cost / group.clicks).toFixed(2)) : 0,
    cpa: group.conversions > 0 ? parseFloat((group.cost / group.conversions).toFixed(2)) : 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function combineDataWithComparison(
  mainData: any[], 
  comparisonData: any[] | null, 
  showComparison: boolean
) {
  if (!showComparison || !comparisonData) {
    return mainData;
  }
  
  // Create a map of comparison data by date
  const comparisonMap = new Map();
  comparisonData.forEach(item => {
    comparisonMap.set(item.date, item);
  });
  
  // Combine main data with comparison data
  return mainData.map(item => {
    const comparison = comparisonMap.get(item.date);
    
    if (comparison) {
      return {
        ...item,
        cost_comparison: comparison.cost,
        conversions_comparison: comparison.conversions,
        clicks_comparison: comparison.clicks,
        impressions_comparison: comparison.impressions,
        ctr_comparison: comparison.ctr,
        conversionRate_comparison: comparison.conversionRate,
        cpc_comparison: comparison.cpc,
        cpa_comparison: comparison.cpa,
      };
    }
    
    return item;
  });
}