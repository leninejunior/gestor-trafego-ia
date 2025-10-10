'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Eye,
  MousePointer,
  Calendar,
  Filter
} from "lucide-react";

interface Campaign {
  id: string;
  account_name: string;
  is_active: boolean;
  created_at: string;
  clients?: {
    id: string;
    name: string;
  };
}

interface CampaignPerformanceChartProps {
  campaigns: Campaign[];
}

export default function CampaignPerformanceChart({ campaigns }: CampaignPerformanceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('roas');

  // Simular dados de performance para cada campanha
  const mockCampaignData = campaigns.map((campaign, index) => ({
    ...campaign,
    performance: {
      spend: Math.random() * 5000 + 1000,
      impressions: Math.random() * 100000 + 50000,
      clicks: Math.random() * 5000 + 1000,
      conversions: Math.random() * 100 + 20,
      roas: Math.random() * 3 + 2,
      ctr: Math.random() * 2 + 1,
      cpc: Math.random() * 0.5 + 0.3,
      conversionRate: Math.random() * 2 + 0.5
    },
    trend: Math.random() > 0.5 ? 'up' : 'down',
    trendValue: Math.random() * 20 + 5
  }));

  const periods = [
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' }
  ];

  const metrics = [
    { value: 'roas', label: 'ROAS', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'spend', label: 'Investimento', icon: <DollarSign className="w-4 h-4" /> },
    { value: 'conversions', label: 'Conversões', icon: <Target className="w-4 h-4" /> },
    { value: 'ctr', label: 'CTR', icon: <MousePointer className="w-4 h-4" /> }
  ];

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'spend':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(value);
      case 'roas':
        return `${value.toFixed(1)}x`;
      case 'ctr':
        return `${value.toFixed(2)}%`;
      case 'conversions':
        return Math.round(value).toString();
      default:
        return value.toFixed(2);
    }
  };

  const getMetricValue = (campaign: any, metric: string) => {
    return campaign.performance[metric] || 0;
  };

  const sortedCampaigns = [...mockCampaignData].sort((a, b) => 
    getMetricValue(b, selectedMetric) - getMetricValue(a, selectedMetric)
  );

  const maxValue = Math.max(...sortedCampaigns.map(c => getMetricValue(c, selectedMetric)));

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Performance por Campanha
              </CardTitle>
              <CardDescription>
                Compare o desempenho de todas as suas campanhas ativas
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {periods.map((period) => (
                  <Button
                    key={period.value}
                    variant={selectedPeriod === period.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period.value)}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center space-x-1">
                {metrics.map((metric) => (
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
          </div>
        </CardHeader>
      </Card>

      {/* Gráfico de Barras Horizontal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Ranking por {metrics.find(m => m.value === selectedMetric)?.label}
          </CardTitle>
          <CardDescription>
            Últimos {periods.find(p => p.value === selectedPeriod)?.label}
          </CardDescription>
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
                        <span className="text-sm font-bold text-blue-600">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">
                          {campaign.account_name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {campaign.clients?.name || 'Cliente'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="font-bold text-sm">
                          {formatValue(value, selectedMetric)}
                        </div>
                        <div className="flex items-center space-x-1">
                          {campaign.trend === 'up' ? (
                            <TrendingUp className="w-3 h-3 text-green-500" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          )}
                          <span className={`text-xs ${
                            campaign.trend === 'up' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {campaign.trendValue.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      <Badge variant={
                        index === 0 ? 'default' :
                        index < 3 ? 'secondary' : 'outline'
                      }>
                        {index === 0 ? '🏆 Top' :
                         index < 3 ? '⭐ Alto' : '📊 Médio'}
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

      {/* Resumo Estatístico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Melhor Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-lg font-bold text-green-600">
                {sortedCampaigns[0]?.account_name || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                {formatValue(getMetricValue(sortedCampaigns[0], selectedMetric), selectedMetric)}
              </div>
              <Badge variant="default" className="text-xs">
                🏆 Líder
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Média Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-lg font-bold text-blue-600">
                {formatValue(
                  sortedCampaigns.reduce((sum, c) => sum + getMetricValue(c, selectedMetric), 0) / sortedCampaigns.length,
                  selectedMetric
                )}
              </div>
              <div className="text-sm text-gray-500">
                Todas as campanhas
              </div>
              <Badge variant="secondary" className="text-xs">
                📊 Benchmark
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Oportunidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-lg font-bold text-orange-600">
                {sortedCampaigns[sortedCampaigns.length - 1]?.account_name || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                Precisa de otimização
              </div>
              <Badge variant="destructive" className="text-xs">
                🎯 Foco
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}