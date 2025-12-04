"use client";

/**
 * Google Metrics Cards Component
 * 
 * Displays Google Ads specific KPIs and metrics
 * Shows only Google Ads data without combining with other platforms
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign,
  Eye,
  Users,
  TrendingUp,
  Target,
  Zap,
  BarChart3,
  RefreshCw
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GoogleMetricsCardsProps {
  clientId?: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
}

interface GoogleMetricsData {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  conversionRate: number;
  roas: number;
  campaigns: number;
  activeCampaigns: number;
}

interface MetricCardData {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  format: 'currency' | 'number' | 'percentage';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('pt-BR');
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const getDateRange = (filter: string) => {
  const today = new Date();
  
  const filters: Record<string, number> = {
    'today': 0,
    'yesterday': 1,
    'last_7_days': 7,
    'last_14_days': 14,
    'last_30_days': 30,
    'last_90_days': 90,
  };
  
  const days = filters[filter] || 30;
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  
  return {
    from: from.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  };
};

// ============================================================================
// Main Component
// ============================================================================

export function GoogleMetricsCards({
  clientId,
  dateFilter = 'last_30_days',
  startDate,
  endDate,
}: GoogleMetricsCardsProps) {
  const [metrics, setMetrics] = useState<GoogleMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  useEffect(() => {
    const fetchGoogleMetrics = async () => {
      // Usar datas explícitas se fornecidas, senão usar o filtro
      let dateFrom, dateTo;
      if (startDate && endDate) {
        dateFrom = startDate;
        dateTo = endDate;
      } else {
        const currentDateRange = getDateRange(dateFilter);
        dateFrom = currentDateRange.from;
        dateTo = currentDateRange.to;
      }

      console.log('🔍 GoogleMetricsCards: Starting fetch with:', {
        clientId,
        dateFilter,
        startDate: dateFrom,
        endDate: dateTo,
      });

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          clientId: clientId || '',
          startDate: dateFrom,
          endDate: dateTo,
          _t: Date.now().toString(), // Cache buster
        });

        const url = `/api/google/metrics-simple?${params}`;
        console.log('🔍 GoogleMetricsCards: Making request to:', url);

        const response = await fetch(url);
        
        console.log('🔍 GoogleMetricsCards: Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log('🔍 GoogleMetricsCards: Error response body:', errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('🔍 GoogleMetricsCards: Success response:', data);
        
        if (data.summary && data.campaigns) {
          // Transform Google metrics to our format
          const googleMetrics: GoogleMetricsData = {
            spend: data.summary.totalCost || 0,
            impressions: data.summary.totalImpressions || 0,
            clicks: data.summary.totalClicks || 0,
            conversions: data.summary.totalConversions || 0,
            ctr: data.summary.averageCtr || 0,
            cpc: data.summary.averageCpc || 0,
            cpa: data.summary.averageCpa || 0,
            conversionRate: data.summary.averageConversionRate || 0,
            roas: data.summary.averageRoas || 0,
            campaigns: data.campaigns?.length || 0,
            activeCampaigns: data.campaigns?.filter((c: any) => c.status === 'ENABLED').length || 0,
          };
          
          setMetrics(googleMetrics);
        } else if (data.requiresClientSelection || !clientId) {
          // Caso especial quando precisa selecionar um cliente específico ou não há clientId
          setMetrics({
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            ctr: 0,
            cpc: 0,
            cpa: 0,
            conversionRate: 0,
            roas: 0,
            campaigns: 0,
            activeCampaigns: 0,
          });
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('❌ GoogleMetricsCards: Error fetching Google metrics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchGoogleMetrics();
  }, [clientId, dateFilter, startDate, endDate]);

  // ==========================================================================
  // Metric Cards Configuration
  // ==========================================================================

  const getMetricCards = (): MetricCardData[] => {
    if (!metrics) return [];

    return [
      {
        title: 'Gasto Total',
        value: formatCurrency(metrics.spend),
        icon: DollarSign,
        description: 'Investimento total em Google Ads',
        format: 'currency',
      },
      {
        title: 'Impressões',
        value: formatNumber(metrics.impressions),
        icon: Eye,
        description: 'Total de impressões dos anúncios',
        format: 'number',
      },
      {
        title: 'Cliques',
        value: formatNumber(metrics.clicks),
        icon: Target,
        description: 'Total de cliques nos anúncios',
        format: 'number',
      },
      {
        title: 'Conversões',
        value: formatNumber(metrics.conversions),
        icon: TrendingUp,
        description: 'Total de conversões geradas',
        format: 'number',
      },
      {
        title: 'CTR',
        value: formatPercentage(metrics.ctr),
        icon: Zap,
        description: 'Taxa de cliques',
        format: 'percentage',
      },
      {
        title: 'CPC',
        value: formatCurrency(metrics.cpc),
        icon: BarChart3,
        description: 'Custo por clique',
        format: 'currency',
      },
      {
        title: 'CPA',
        value: formatCurrency(metrics.cpa),
        icon: Users,
        description: 'Custo por aquisição',
        format: 'currency',
      },
      {
        title: 'Taxa de Conversão',
        value: formatPercentage(metrics.conversionRate),
        icon: TrendingUp,
        description: 'Taxa de conversão',
        format: 'percentage',
      },
    ];
  };

  // ==========================================================================
  // Render States - Sem retornos antecipados para evitar erro de hooks
  // ==========================================================================

  const metricCards = getMetricCards();

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Métricas do Google Ads
          </h2>
          <p className="text-muted-foreground">
            {loading
              ? 'Carregando dados do Google Ads...'
              : error
                ? 'Erro ao carregar dados do Google Ads'
                : !metrics
                  ? 'Nenhum dado encontrado'
                  : clientId
                    ? 'Dados exclusivos do Google Ads'
                    : 'Selecione um cliente para ver as métricas'
            }
          </p>
        </div>
        
        {/* Platform Status Badge */}
        <div className="flex space-x-2">
          <Badge variant="default">
            <div className="w-2 h-2 bg-green-600 rounded-full mr-1" />
            Google Ads
          </Badge>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <div className="h-4 bg-muted rounded animate-pulse w-24" />
                </CardTitle>
                <div className="h-4 w-4 animate-spin text-muted-foreground">⟳</div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 bg-muted/50 rounded animate-pulse w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">Erro ao carregar métricas</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards Grid - Only show when not loading and has metrics */}
      {!loading && !error && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metricCards.map((card, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-1">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign Summary - Only show when has metrics */}
      {!loading && !error && metrics && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {metrics.activeCampaigns} de {metrics.campaigns} campanhas ativas
              </span>
              <span>
                Última atualização: {new Date().toLocaleString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}