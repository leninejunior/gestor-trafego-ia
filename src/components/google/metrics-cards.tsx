'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  DollarSign, 
  Target, 
  MousePointer, 
  Eye,
  BarChart3,
  Users
} from "lucide-react";

interface MetricsData {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalCost: number;
  averageCtr: number;
  averageConversionRate: number;
  averageCpc: number;
  averageCpa: number;
  campaignCount: number;
  dateCount: number;
  recordCount?: number;
}

interface GoogleMetricsCardsProps {
  data: MetricsData;
  comparison?: MetricsData;
  compareWith?: 'none' | 'previous_period' | 'previous_year';
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  change?: {
    value: number;
    percentage: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

function MetricCard({ title, value, icon, color, change, subtitle }: MetricCardProps) {
  const getTrendIcon = () => {
    if (!change) return null;
    
    if (change.percentage === 0) {
      return <Minus className="w-3 h-3" />;
    }
    
    return change.isPositive ? 
      <TrendingUp className="w-3 h-3" /> : 
      <TrendingDown className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (!change) return '';
    
    if (change.percentage === 0) return 'text-muted-foreground';
    
    // For metrics like CPC and CPA, lower is better
    const isLowerBetter = title.includes('CPC') || title.includes('CPA');
    
    if (isLowerBetter) {
      return change.isPositive ? 'text-red-600' : 'text-green-600';
    } else {
      return change.isPositive ? 'text-green-600' : 'text-red-600';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`h-4 w-4 ${color}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        
        {change && (
          <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>
              {Math.abs(change.percentage).toFixed(1)}% 
              {change.percentage !== 0 && (
                <span className="ml-1">
                  ({change.isPositive ? '+' : ''}{change.value > 0 ? change.value.toLocaleString() : change.value.toFixed(2)})
                </span>
              )}
            </span>
          </div>
        )}
        
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function GoogleMetricsCards({ data, comparison, compareWith }: GoogleMetricsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) {
      return {
        value: current,
        percentage: current > 0 ? 100 : 0,
        isPositive: current > 0,
      };
    }
    
    const difference = current - previous;
    const percentage = (difference / previous) * 100;
    
    return {
      value: difference,
      percentage: Math.abs(percentage),
      isPositive: difference > 0,
    };
  };

  const getComparisonLabel = () => {
    switch (compareWith) {
      case 'previous_period':
        return 'vs período anterior';
      case 'previous_year':
        return 'vs ano anterior';
      default:
        return '';
    }
  };

  // Calculate changes if comparison data is available
  const impressionsChange = comparison ? calculateChange(data.totalImpressions, comparison.totalImpressions) : undefined;
  const clicksChange = comparison ? calculateChange(data.totalClicks, comparison.totalClicks) : undefined;
  const conversionsChange = comparison ? calculateChange(data.totalConversions, comparison.totalConversions) : undefined;
  const costChange = comparison ? calculateChange(data.totalCost, comparison.totalCost) : undefined;
  const ctrChange = comparison ? calculateChange(data.averageCtr, comparison.averageCtr) : undefined;
  const conversionRateChange = comparison ? calculateChange(data.averageConversionRate, comparison.averageConversionRate) : undefined;
  const cpcChange = comparison ? calculateChange(data.averageCpc, comparison.averageCpc) : undefined;
  const cpaChange = comparison ? calculateChange(data.averageCpa, comparison.averageCpa) : undefined;

  return (
    <div className="space-y-6">
      {/* Primary Metrics */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Métricas Principais</h3>
          {comparison && (
            <Badge variant="outline" className="text-xs">
              {getComparisonLabel()}
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Gasto Total"
            value={formatCurrency(data.totalCost)}
            icon={<DollarSign />}
            color="text-green-600"
            change={costChange}
            subtitle="investimento total"
          />
          
          <MetricCard
            title="Conversões"
            value={formatNumber(data.totalConversions)}
            icon={<Target />}
            color="text-blue-600"
            change={conversionsChange}
            subtitle="conversões totais"
          />
          
          <MetricCard
            title="Cliques"
            value={formatNumber(data.totalClicks)}
            icon={<MousePointer />}
            color="text-purple-600"
            change={clicksChange}
            subtitle="cliques totais"
          />
          
          <MetricCard
            title="Impressões"
            value={formatNumber(data.totalImpressions)}
            icon={<Eye />}
            color="text-orange-600"
            change={impressionsChange}
            subtitle="impressões totais"
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Métricas de Performance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="CTR Médio"
            value={formatPercentage(data.averageCtr)}
            icon={<BarChart3 />}
            color="text-red-600"
            change={ctrChange}
            subtitle="taxa de cliques"
          />
          
          <MetricCard
            title="Taxa de Conversão"
            value={formatPercentage(data.averageConversionRate)}
            icon={<Target />}
            color="text-cyan-600"
            change={conversionRateChange}
            subtitle="conversões / cliques"
          />
          
          <MetricCard
            title="CPC Médio"
            value={formatCurrency(data.averageCpc)}
            icon={<DollarSign />}
            color="text-lime-600"
            change={cpcChange}
            subtitle="custo por clique"
          />
          
          <MetricCard
            title="CPA Médio"
            value={formatCurrency(data.averageCpa)}
            icon={<Target />}
            color="text-amber-600"
            change={cpaChange}
            subtitle="custo por aquisição"
          />
        </div>
      </div>

      {/* Summary Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Resumo da Conta</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="Campanhas Ativas"
            value={formatNumber(data.campaignCount)}
            icon={<BarChart3 />}
            color="text-indigo-600"
            subtitle="campanhas no período"
          />
          
          <MetricCard
            title="Dias de Dados"
            value={formatNumber(data.dateCount)}
            icon={<Users />}
            color="text-pink-600"
            subtitle="dias com atividade"
          />
          
          <MetricCard
            title="Registros Processados"
            value={formatNumber(data.recordCount || 0)}
            icon={<BarChart3 />}
            color="text-teal-600"
            subtitle="pontos de dados"
          />
        </div>
      </div>

      {/* Efficiency Metrics */}
      {data.totalConversions > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Métricas de Eficiência</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gasto por Impressão</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.totalImpressions > 0 ? data.totalCost / data.totalImpressions * 1000 : 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  CPM (custo por mil)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressões por Clique</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.totalClicks > 0 ? (data.totalImpressions / data.totalClicks).toFixed(1) : '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  impressões necessárias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cliques por Conversão</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.totalConversions > 0 ? (data.totalClicks / data.totalConversions).toFixed(1) : '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  cliques necessários
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eficiência de Gasto</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.campaignCount > 0 ? formatCurrency(data.totalCost / data.campaignCount) : formatCurrency(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  gasto médio por campanha
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}