"use client";

/**
 * Unified Metrics Cards Component
 * 
 * Displays aggregated KPIs from both Meta and Google Ads platforms
 * Requirements: 5.1, 5.2
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Eye,
  Zap
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface UnifiedMetricsCardsProps {
  clientId: string;
  hasMetaConnections: boolean;
  hasGoogleConnections: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

interface MetricCardData {
  title: string;
  value: string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  breakdown?: {
    meta?: number;
    google?: number;
  };
  format: 'currency' | 'number' | 'percentage';
}

interface UnifiedMetrics {
  total: {
    spend: number;
    conversions: number;
    impressions: number;
    clicks: number;
    averageRoas: number;
    averageCtr: number;
    averageCpc: number;
    averageCpa: number;
  };
  byPlatform: Array<{
    platform: 'meta' | 'google';
    spend: number;
    conversions: number;
    impressions: number;
    clicks: number;
    roas: number;
    ctr: number;
    cpc: number;
    cpa: number;
  }>;
  dataQuality: {
    metaDataAvailable: boolean;
    googleDataAvailable: boolean;
    totalCampaigns: number;
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

const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

// ============================================================================
// Main Component
// ============================================================================

export function UnifiedMetricsCards({
  clientId,
  hasMetaConnections,
  hasGoogleConnections,
  dateRange = getDefaultDateRange(),
}: UnifiedMetricsCardsProps) {
  const [metrics, setMetrics] = useState<UnifiedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!clientId) {
        console.log('🔍 UnifiedMetricsCards: No clientId provided');
        return;
      }

      console.log('🔍 UnifiedMetricsCards: Starting fetch with:', {
        clientId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          clientId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          _t: Date.now().toString(), // Cache buster
        });

        const url = `/api/unified/metrics?${params}`;
        console.log('🔍 UnifiedMetricsCards: Making request to:', url);

        const response = await fetch(url);
        
        console.log('🔍 UnifiedMetricsCards: Response status:', response.status);
        console.log('🔍 UnifiedMetricsCards: Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log('🔍 UnifiedMetricsCards: Error response body:', errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('🔍 UnifiedMetricsCards: Success response:', data);
        
        if (data.success && data.data) {
          setMetrics(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch metrics');
        }
      } catch (err) {
        console.error('❌ UnifiedMetricsCards: Error fetching unified metrics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [clientId, dateRange.startDate, dateRange.endDate]);

  // ==========================================================================
  // Metric Cards Configuration
  // ==========================================================================

  const getMetricCards = (): MetricCardData[] => {
    if (!metrics) return [];

    const { total, byPlatform } = metrics;
    const metaPlatform = byPlatform.find(p => p.platform === 'meta');
    const googlePlatform = byPlatform.find(p => p.platform === 'google');

    return [
      {
        title: 'Investimento Total',
        value: formatCurrency(total.spend),
        icon: DollarSign,
        description: 'Gasto total em ambas as plataformas',
        breakdown: {
          meta: metaPlatform?.spend,
          google: googlePlatform?.spend,
        },
        format: 'currency',
      },
      {
        title: 'Conversões',
        value: formatNumber(total.conversions),
        icon: Target,
        description: 'Total de conversões geradas',
        breakdown: {
          meta: metaPlatform?.conversions,
          google: googlePlatform?.conversions,
        },
        format: 'number',
      },
      {
        title: 'ROAS Médio',
        value: formatPercentage(total.averageRoas * 100),
        icon: TrendingUp,
        description: 'Retorno sobre investimento publicitário',
        breakdown: {
          meta: metaPlatform?.roas ? metaPlatform.roas * 100 : undefined,
          google: googlePlatform?.roas ? googlePlatform.roas * 100 : undefined,
        },
        format: 'percentage',
      },
      {
        title: 'Impressões',
        value: formatNumber(total.impressions),
        icon: Eye,
        description: 'Total de impressões dos anúncios',
        breakdown: {
          meta: metaPlatform?.impressions,
          google: googlePlatform?.impressions,
        },
        format: 'number',
      },
      {
        title: 'Cliques',
        value: formatNumber(total.clicks),
        icon: Target,
        description: 'Total de cliques nos anúncios',
        breakdown: {
          meta: metaPlatform?.clicks,
          google: googlePlatform?.clicks,
        },
        format: 'number',
      },
      {
        title: 'CTR Médio',
        value: formatPercentage(total.averageCtr),
        icon: Zap,
        description: 'Taxa de cliques média',
        breakdown: {
          meta: metaPlatform?.ctr,
          google: googlePlatform?.ctr,
        },
        format: 'percentage',
      },
    ];
  };

  // ==========================================================================
  // Render States
  // ==========================================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Métricas Consolidadas
          </h2>
          <p className="text-muted-foreground">
            Carregando dados de ambas as plataformas...
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Métricas Consolidadas
          </h2>
          <p className="text-muted-foreground">
            Erro ao carregar dados das plataformas
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">Erro ao carregar métricas</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate derived values BEFORE any conditional returns
  // This ensures all hooks are called consistently
  const metricCards = getMetricCards();

  if (!metrics) {
    return null;
  }

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Métricas Consolidadas
          </h2>
          <p className="text-muted-foreground">
            Dados agregados de {hasMetaConnections && hasGoogleConnections ? 'Meta Ads e Google Ads' : 
              hasMetaConnections ? 'Meta Ads' : 'Google Ads'} - Últimos 30 dias
          </p>
        </div>
        
        {/* Platform Status Badges */}
        <div className="flex space-x-2">
          {hasMetaConnections && (
            <Badge variant={metrics.dataQuality.metaDataAvailable ? "default" : "secondary"}>
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-1" />
              Meta Ads
            </Badge>
          )}
          {hasGoogleConnections && (
            <Badge variant={metrics.dataQuality.googleDataAvailable ? "default" : "secondary"}>
              <div className="w-2 h-2 bg-green-600 rounded-full mr-1" />
              Google Ads
            </Badge>
          )}
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((card, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1">{card.value}</div>
              <p className="text-xs text-muted-foreground mb-3">
                {card.description}
              </p>
              
              {/* Platform Breakdown */}
              {card.breakdown && (hasMetaConnections || hasGoogleConnections) && (
                <div className="space-y-1">
                  {hasMetaConnections && card.breakdown.meta !== undefined && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mr-2" />
                        <span className="text-muted-foreground">Meta</span>
                      </div>
                      <span className="font-medium">
                        {card.format === 'currency' 
                          ? formatCurrency(card.breakdown.meta)
                          : card.format === 'percentage'
                          ? formatPercentage(card.breakdown.meta)
                          : formatNumber(card.breakdown.meta)
                        }
                      </span>
                    </div>
                  )}
                  {hasGoogleConnections && card.breakdown.google !== undefined && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-600 rounded-full mr-2" />
                        <span className="text-muted-foreground">Google</span>
                      </div>
                      <span className="font-medium">
                        {card.format === 'currency' 
                          ? formatCurrency(card.breakdown.google)
                          : card.format === 'percentage'
                          ? formatPercentage(card.breakdown.google)
                          : formatNumber(card.breakdown.google)
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Quality Info */}
      {metrics.dataQuality.totalCampaigns > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Dados de {metrics.dataQuality.totalCampaigns} campanhas ativas
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
