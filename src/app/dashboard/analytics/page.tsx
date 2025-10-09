'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, DollarSign, Eye, RefreshCw } from "lucide-react";
import { InsightsChart } from "@/components/reports/insights-chart";
import { CampaignComparison } from "@/components/reports/campaign-comparison";
import { useClients } from "@/hooks/use-clients";

interface AnalyticsData {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  averageCtr: number;
  campaignCount: number;
  topCampaign?: {
    name: string;
    impressions: number;
  };
}

export default function AnalyticsPage() {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [campaignInsights, setCampaignInsights] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { clients, isLoading: clientsLoading } = useClients();

  const loadAnalytics = async () => {
    if (!selectedClient) return;
    
    setIsLoading(true);
    try {
      // Buscar campanhas do cliente
      const campaignsResponse = await fetch(`/api/meta/campaigns?clientId=${selectedClient}`);
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json();
        const campaigns = campaignsData.campaigns || [];
        
        // Buscar insights de cada campanha
        const insightsPromises = campaigns.map(async (campaign: any) => {
          try {
            const insightsResponse = await fetch(
              `/api/meta/insights?clientId=${selectedClient}&campaignId=${campaign.id}`
            );
            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json();
              return {
                campaign: campaign.name,
                ...insightsData.insights[0]
              };
            }
          } catch (error) {
            console.error(`Erro ao buscar insights da campanha ${campaign.id}:`, error);
          }
          return null;
        });

        const insights = (await Promise.all(insightsPromises)).filter(Boolean);
        setCampaignInsights(insights);

        // Calcular dados agregados
        const totalData = insights.reduce((acc, insight) => ({
          totalImpressions: acc.totalImpressions + (insight.impressions || 0),
          totalClicks: acc.totalClicks + (insight.clicks || 0),
          totalSpend: acc.totalSpend + (insight.spend || 0),
          campaignCount: acc.campaignCount + 1
        }), {
          totalImpressions: 0,
          totalClicks: 0,
          totalSpend: 0,
          campaignCount: 0
        });

        const averageCtr = totalData.totalImpressions > 0 
          ? totalData.totalClicks / totalData.totalImpressions 
          : 0;

        const topCampaign = insights.reduce((top, current) => 
          (current.impressions || 0) > (top?.impressions || 0) ? current : top
        , null);

        setAnalyticsData({
          ...totalData,
          averageCtr,
          topCampaign: topCampaign ? {
            name: topCampaign.campaign,
            impressions: topCampaign.impressions
          } : undefined
        });
      }
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClient) {
      loadAnalytics();
    }
  }, [selectedClient]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">
          Análise detalhada de performance e métricas das campanhas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Cliente</CardTitle>
          <CardDescription>
            Escolha um cliente para ver os analytics de suas campanhas
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center space-x-2">
          <Select value={selectedClient} onValueChange={setSelectedClient} disabled={clientsLoading}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={clientsLoading ? "Carregando clientes..." : "Selecione um cliente"} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={loadAnalytics}
            disabled={!selectedClient || isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardContent>
      </Card>

      {analyticsData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressões Totais</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analyticsData.totalImpressions)}</div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData.campaignCount} campanhas ativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cliques Totais</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analyticsData.totalClicks)}</div>
                <p className="text-xs text-muted-foreground">
                  CTR: {formatPercentage(analyticsData.averageCtr)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analyticsData.totalSpend)}</div>
                <p className="text-xs text-muted-foreground">
                  Últimos 30 dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Campanha</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold truncate">
                  {analyticsData.topCampaign?.name || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData.topCampaign ? formatNumber(analyticsData.topCampaign.impressions) : '0'} impressões
                </p>
              </CardContent>
            </Card>
          </div>

          {campaignInsights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance por Campanha</CardTitle>
                <CardDescription>
                  Métricas detalhadas de cada campanha ativa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {campaignInsights.map((insight, index) => (
                  <div key={index}>
                    <h4 className="font-medium mb-3">{insight.campaign}</h4>
                    <InsightsChart data={insight} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <CampaignComparison clientId={selectedClient} />
        </>
      )}

      {!selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle>Selecione um Cliente</CardTitle>
            <CardDescription>
              Escolha um cliente acima para ver os analytics de suas campanhas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Analytics Detalhados
              </h3>
              <p className="text-gray-500 mb-4">
                Visualize métricas em tempo real, compare performance entre campanhas 
                e obtenha insights automáticos para otimizar seus resultados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}