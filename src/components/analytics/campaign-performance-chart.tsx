'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  DollarSign,
  Target,
  MousePointer,
  TrendingUp,
} from "lucide-react";

interface CampaignPerformance {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
}

interface Campaign {
  id: string;
  account_name: string;
  is_active: boolean;
  created_at: string;
  clients?: {
    id: string;
    name: string;
  };
  performance?: CampaignPerformance;
}

interface CampaignPerformanceChartProps {
  campaigns: Campaign[];
}

type MetricKey = 'roas' | 'spend' | 'conversions' | 'ctr';

const METRICS: Array<{ value: MetricKey; label: string; icon: JSX.Element }> = [
  { value: 'roas', label: 'ROAS', icon: <TrendingUp className="w-4 h-4" /> },
  { value: 'spend', label: 'Investimento', icon: <DollarSign className="w-4 h-4" /> },
  { value: 'conversions', label: 'Conversões', icon: <Target className="w-4 h-4" /> },
  { value: 'ctr', label: 'CTR', icon: <MousePointer className="w-4 h-4" /> },
];

function formatValue(value: number, metric: MetricKey): string {
  switch (metric) {
    case 'spend':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    case 'roas':
      return `${value.toFixed(2)}x`;
    case 'ctr':
      return `${value.toFixed(2)}%`;
    case 'conversions':
      return Math.round(value).toString();
    default:
      return value.toFixed(2);
  }
}

function getMetricValue(campaign: Campaign, metric: MetricKey): number {
  const performance = campaign.performance;
  if (!performance) return 0;
  return performance[metric] || 0;
}

export default function CampaignPerformanceChart({ campaigns }: CampaignPerformanceChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('roas');

  const hasRealData = useMemo(
    () => campaigns.some((campaign) => {
      const perf = campaign.performance;
      if (!perf) return false;
      return (perf.spend || 0) > 0 || (perf.impressions || 0) > 0 || (perf.clicks || 0) > 0 || (perf.conversions || 0) > 0;
    }),
    [campaigns]
  );

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => getMetricValue(b, selectedMetric) - getMetricValue(a, selectedMetric));
  }, [campaigns, selectedMetric]);

  const maxValue = useMemo(() => {
    const values = sortedCampaigns.map((campaign) => getMetricValue(campaign, selectedMetric));
    return values.length > 0 ? Math.max(...values, 1) : 1;
  }, [sortedCampaigns, selectedMetric]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Performance por Campanha
              </CardTitle>
              <CardDescription>
                Ranking com métricas reais por campanha
              </CardDescription>
            </div>
            <div className="flex items-center space-x-1">
              {METRICS.map((metric) => (
                <Button
                  key={metric.value}
                  variant={selectedMetric === metric.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric(metric.value)}
                  className="flex items-center space-x-1"
                >
                  {metric.icon}
                  <span>{metric.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!hasRealData ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Sem dados de performance reais para exibir neste módulo.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Ranking por {METRICS.find((m) => m.value === selectedMetric)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedCampaigns.map((campaign, index) => {
                const value = getMetricValue(campaign, selectedMetric);
                const percentage = (value / maxValue) * 100;

                return (
                  <div key={campaign.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{campaign.account_name}</h4>
                          <p className="text-xs text-gray-500">{campaign.clients?.name || 'Cliente'}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="font-bold text-sm">{formatValue(value, selectedMetric)}</div>
                        <Badge variant={index === 0 ? 'default' : 'secondary'}>
                          {index === 0 ? 'Top' : 'Rank'}
                        </Badge>
                      </div>
                    </div>

                    <div className="ml-11">
                      <Progress value={percentage} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
