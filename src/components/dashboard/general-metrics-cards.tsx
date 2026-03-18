"use client";

/**
 * General Metrics Cards Component
 * 
 * Displays aggregated general KPIs from both Meta and Google Ads platforms
 * Shows combined metrics like total marketing spend, total reach, total impressions, etc.
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
  BarChart3
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GeneralMetricsCardsProps {
  clientId?: string;
  hasMetaConnections: boolean;
  hasGoogleConnections: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

interface GeneralMetrics {
  totalMarketingSpend: number;
  totalReach: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  platforms: {
    meta?: {
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr?: number;
    };
    google?: {
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr?: number;
    };
  };
  dataQuality: {
    metaDataAvailable: boolean;
    googleDataAvailable: boolean;
    totalCampaigns: number;
  };
}

interface MetricCardData {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  breakdown?: {
    meta?: number;
    google?: number;
  };
  format: 'currency' | 'number' | 'percentage';
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
// Metric Cards Configuration
// ============================================================================

const getMetricCards = (metrics: GeneralMetrics | null) => {
  if (!metrics) return [];

  const { platforms } = metrics;

  return [
    {
      title: 'Valor Total de Marketing',
      value: formatCurrency(metrics.totalMarketingSpend),
      icon: DollarSign,
      description: 'Investimento total em marketing',
      breakdown: {
        meta: platforms.meta?.spend,
        google: platforms.google?.spend,
      },
      format: 'currency',
    },
    {
      title: 'Alcance Total',
      value: formatNumber(metrics.totalReach),
      icon: Users,
      description: 'Pessoas alcançadas nas campanhas',
      breakdown: {
        meta: platforms.meta?.reach,
        google: platforms.google?.reach,
      },
      format: 'number',
    },
    {
      title: 'Impressões Totais',
      value: formatNumber(metrics.totalImpressions),
      icon: Eye,
      description: 'Total de impressões dos anúncios',
      breakdown: {
        meta: platforms.meta?.impressions,
        google: platforms.google?.impressions,
      },
      format: 'number',
    },
    {
      title: 'Cliques Totais',
      value: formatNumber(metrics.totalClicks),
      icon: Target,
      description: 'Total de cliques nos anúncios',
      breakdown: {
        meta: platforms.meta?.clicks,
        google: platforms.google?.clicks,
      },
      format: 'number',
    },
    {
      title: 'Conversões Totais',
      value: formatNumber(metrics.totalConversions),
      icon: TrendingUp,
      description: 'Total de conversões geradas',
      breakdown: {
        meta: platforms.meta?.conversions,
        google: platforms.google?.conversions,
      },
      format: 'number',
    },
    {
      title: 'CTR Médio',
      value: formatPercentage(metrics.averageCtr),
      icon: Zap,
      description: 'Taxa de cliques média',
      breakdown: {
        meta: platforms.meta?.ctr || 0,
        google: platforms.google?.ctr || 0,
      },
      format: 'percentage',
    },
  ];
};

// ============================================================================
// Main Component
// ============================================================================

export function GeneralMetricsCards({
  clientId,
  hasMetaConnections,
  hasGoogleConnections,
  dateRange = getDefaultDateRange(),
}: GeneralMetricsCardsProps) {
  const [metrics, setMetrics] = useState<GeneralMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = () => {
    return {
      from: dateRange.startDate,
      to: dateRange.endDate,
    };
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchMetrics = async () => {
      if (!clientId) {
        console.log('🔍 GeneralMetricsCards: No clientId provided');
        return;
      }

      const currentDateRange = getDateRange();
      console.log('🔍 GeneralMetricsCards: Starting fetch with:', {
        clientId,
        startDate: currentDateRange.from,
        endDate: currentDateRange.to,
      });

      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        const params = new URLSearchParams({
          clientId,
          startDate: currentDateRange.from,
          endDate: currentDateRange.to,
          _t: Date.now().toString(), // Add cache-busting timestamp
        });

        const url = `/api/unified/metrics?${params}`;
        console.log('🔍 GeneralMetricsCards: Making request to:', url);

        const response = await fetch(url);

        console.log('🔍 GeneralMetricsCards: Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.log('🔍 GeneralMetricsCards: Error response body:', errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('🔍 GeneralMetricsCards: Success response:', data);

        if (isMounted && data.success && data.data) {
          const unifiedData = data.data;
          const metaPlatform = unifiedData.byPlatform.find((p: any) => p.platform === 'meta');
          const googlePlatform = unifiedData.byPlatform.find((p: any) => p.platform === 'google');

          console.log('🔍 GeneralMetricsCards: Platform data received:', {
            metaPlatform: metaPlatform ? 'available' : 'not available',
            googlePlatform: googlePlatform ? 'available' : 'not available',
            dataQuality: unifiedData.dataQuality
          });

          const generalMetrics: GeneralMetrics = {
            totalMarketingSpend: unifiedData.total.spend,
            totalReach: unifiedData.total.impressions * 0.7,
            totalImpressions: unifiedData.total.impressions,
            totalClicks: unifiedData.total.clicks,
            totalConversions: unifiedData.total.conversions,
            averageCtr: unifiedData.total.averageCtr,
            averageCpc: unifiedData.total.averageCpc,
            platforms: {
              meta: metaPlatform,
              google: googlePlatform,
            },
            dataQuality: unifiedData.dataQuality,
          };

          setMetrics(generalMetrics);
        } else if (isMounted) {
          throw new Error(data.error || 'Failed to fetch metrics');
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ GeneralMetricsCards: Error fetching general metrics:', err);
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fetchMetrics();
    }, 500);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [clientId, dateRange.startDate, dateRange.endDate]);

  const metricCards = getMetricCards(metrics);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Métricas Gerais de Marketing
          </h2>
          <p className="text-muted-foreground">
            {loading
              ? 'Carregando dados combinados das plataformas...'
              : error
                ? 'Erro ao carregar dados das plataformas'
                : !metrics
                  ? 'Nenhum dado encontrado'
                  : metrics?.dataQuality?.metaDataAvailable && metrics?.dataQuality?.googleDataAvailable ? 'combinada de Meta Ads e Google Ads' :
                    metrics?.dataQuality?.metaDataAvailable ? 'do Meta Ads' :
                      metrics?.dataQuality?.googleDataAvailable ? 'do Google Ads' : 'sem plataformas conectadas'
            }
          </p>
        </div>

        {/* Platform Status Badges */}
        <div className="flex space-x-2">
          {metrics?.dataQuality?.metaDataAvailable && (
            <Badge variant="default">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-1" />
              Meta Ads
            </Badge>
          )}
          {metrics?.dataQuality?.googleDataAvailable && (
            <Badge variant="default">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-1" />
              Google Ads
            </Badge>
          )}
          {!metrics?.dataQuality?.metaDataAvailable && !metrics?.dataQuality?.googleDataAvailable && (
            <Badge variant="secondary">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-1" />
              Sem Conexões
            </Badge>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
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
                <div className="h-3 bg-muted rounded animate-pulse w-32" />
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
              <p className="text-red-600 mb-2">Erro ao carregar métricas</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards Grid */}
      {!loading && !error && metrics && (
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

                {card.breakdown && (metrics?.dataQuality?.metaDataAvailable || metrics?.dataQuality?.googleDataAvailable) && (
                  <div className="space-y-1">
                    {metrics?.dataQuality?.metaDataAvailable && card.breakdown.meta !== undefined && card.breakdown.meta > 0 && (
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
                    {metrics?.dataQuality?.googleDataAvailable && card.breakdown.google !== undefined && card.breakdown.google > 0 && (
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
      )}

      {/* Data Quality Info */}
      {!loading && !error && metrics && metrics.dataQuality.totalCampaigns > 0 && (
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
