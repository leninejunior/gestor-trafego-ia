'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Chrome, 
  BarChart3, 
  TrendingUp, 
  Calendar,
  RefreshCw,
  Filter,
  Users,
  Target,
  DollarSign,
  MousePointer,
  Eye
} from "lucide-react";
import { Download } from "lucide-react";
import { GooglePerformanceChart } from "@/components/google/performance-chart";
import { GoogleMetricsCards } from "@/components/google/metrics-cards";
import { GoogleDateRangeSelector } from "@/components/google/date-range-selector";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
}

interface CampaignType {
  type: string;
  count: number;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
}

interface AnalyticsData {
  summary: {
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
  };
  metrics: any[];
  topCampaigns: {
    byConversions: any[];
    byCost: any[];
    byClicks: any[];
    byImpressions: any[];
  };
  comparison?: {
    period: string;
    summary: any;
    metrics: any[];
  };
}

interface DateRange {
  from: string;
  to: string;
}

export default function GoogleAnalyticsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [compareWith, setCompareWith] = useState<'none' | 'previous_period' | 'previous_year'>('none');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [campaignTypes, setCampaignTypes] = useState<CampaignType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (!response.ok) throw new Error('Falha ao carregar clientes');
      
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os clientes.',
        variant: 'destructive',
      });
    }
  };

  const fetchAnalyticsData = async () => {
    // Se nenhum cliente específico selecionado, limpar dados e não buscar
    if (selectedClient === 'all' || !selectedClient) {
      setAnalyticsData(null);
      setCampaignTypes([]);
      setRefreshing(false);
      return;
    }

    try {
      setRefreshing(true);
      
      const params = new URLSearchParams({
        clientId: selectedClient,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        granularity,
        groupBy: 'campaign_date',
        compareWith,
      });

      if (selectedCampaigns.length > 0) {
        params.append('campaignIds', selectedCampaigns.join(','));
      }

      const response = await fetch(`/api/google/metrics?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('Analytics API error:', errorData);
        // Não mostrar toast para erros esperados (ex: sem dados)
        if (response.status !== 404 && response.status !== 503) {
          toast({
            title: 'Erro',
            description: errorData.message || 'Não foi possível carregar os dados de analytics.',
            variant: 'destructive',
          });
        }
        setAnalyticsData(null);
        setCampaignTypes([]);
        return;
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      
      // Process campaign types data
      const typeMap = new Map<string, CampaignType>();
      
      data.metrics?.forEach((metric: any) => {
        const type = metric.campaignStatus || 'UNKNOWN';
        
        if (!typeMap.has(type)) {
          typeMap.set(type, {
            type,
            count: 0,
            spend: 0,
            conversions: 0,
            impressions: 0,
            clicks: 0,
          });
        }
        
        const typeData = typeMap.get(type)!;
        typeData.count += 1;
        typeData.spend += metric.cost || 0;
        typeData.conversions += metric.conversions || 0;
        typeData.impressions += metric.impressions || 0;
        typeData.clicks += metric.clicks || 0;
      });
      
      setCampaignTypes(Array.from(typeMap.values()));
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de analytics.',
        variant: 'destructive',
      });
      setAnalyticsData(null);
      setCampaignTypes([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        format: 'csv',
      });

      if (selectedClient !== 'all') {
        params.append('clientId', selectedClient);
      }

      const response = await fetch(`/api/exports/google?${params}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Falha ao exportar dados');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `google-ads-analytics-${dateRange.from}-${dateRange.to}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Exportação Concluída',
        description: 'Os dados foram exportados com sucesso.',
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Erro na Exportação',
        description: 'Não foi possível exportar os dados.',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchClients();
      setLoading(false);
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchAnalyticsData();
    }
  }, [selectedClient, dateRange, granularity, compareWith, selectedCampaigns, loading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Carregando analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-blue-600" />
            Analytics Google Ads
          </h1>
          <p className="text-gray-600 mt-1">
            Análise detalhada de performance das campanhas Google Ads
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={fetchAnalyticsData} variant="outline" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cliente</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Granularidade</label>
              <Select value={granularity} onValueChange={(value: any) => setGranularity(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Comparar com</label>
              <Select value={compareWith} onValueChange={(value: any) => setCompareWith(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem comparação</SelectItem>
                  <SelectItem value="previous_period">Período anterior</SelectItem>
                  <SelectItem value="previous_year">Ano anterior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <GoogleDateRangeSelector
                value={dateRange}
                onChange={handleDateRangeChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      {analyticsData && (
        <GoogleMetricsCards 
          data={analyticsData.summary}
          comparison={analyticsData.comparison?.summary}
          compareWith={compareWith}
        />
      )}

      {/* Main Analytics Content */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="conversions">Conversões</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {analyticsData && (
            <GooglePerformanceChart
              data={analyticsData.metrics}
              comparison={analyticsData.comparison?.metrics}
              granularity={granularity}
              dateRange={dateRange}
            />
          )}
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6">
          {analyticsData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Campanhas por Conversões</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.topCampaigns.byConversions.slice(0, 5).map((campaign, index) => (
                      <div key={campaign.campaignId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{campaign.campaignName}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(campaign.cost)} gasto
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{campaign.conversions.toFixed(1)}</div>
                          <div className="text-sm text-muted-foreground">conversões</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Campanhas por Gasto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.topCampaigns.byCost.slice(0, 5).map((campaign, index) => (
                      <div key={campaign.campaignId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{campaign.campaignName}</div>
                            <div className="text-sm text-muted-foreground">
                              {campaign.conversions.toFixed(1)} conversões
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(campaign.cost)}</div>
                          <div className="text-sm text-muted-foreground">gasto</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <Target className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData ? formatPercentage(analyticsData.summary.averageConversionRate) : '0%'}
                </div>
                <p className="text-xs text-muted-foreground">
                  conversões / cliques
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPA Médio</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData ? formatCurrency(analyticsData.summary.averageCpa) : 'R$ 0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  custo por aquisição
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Conversões</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData ? formatNumber(analyticsData.summary.totalConversions) : '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  no período selecionado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor por Conversão</CardTitle>
                <Target className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsData ? formatCurrency(analyticsData.summary.averageCpa) : 'R$ 0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  valor médio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Conversion Analysis Chart would go here */}
          <Card>
            <CardHeader>
              <CardTitle>Análise de Conversões ao Longo do Tempo</CardTitle>
              <CardDescription>
                Tendência de conversões e taxa de conversão no período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                Gráfico de análise de conversões será implementado aqui
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Breakdown por Status de Campanha</CardTitle>
              <CardDescription>
                Performance segmentada por status das campanhas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignTypes.map((type) => (
                  <div key={type.type} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant={type.type === 'ENABLED' ? 'default' : 'secondary'}>
                        {type.type === 'ENABLED' ? 'Ativas' : 
                         type.type === 'PAUSED' ? 'Pausadas' : 
                         type.type === 'REMOVED' ? 'Removidas' : type.type}
                      </Badge>
                      <div>
                        <div className="font-medium">{type.count} campanhas</div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(type.impressions)} impressões
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(type.spend)}</div>
                      <div className="text-sm text-muted-foreground">
                        {type.conversions.toFixed(1)} conversões
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Period Comparison */}
          {analyticsData?.comparison && (
            <Card>
              <CardHeader>
                <CardTitle>Comparação de Períodos</CardTitle>
                <CardDescription>
                  Comparação com {compareWith === 'previous_period' ? 'período anterior' : 'ano anterior'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatNumber(analyticsData.summary.totalImpressions)}
                    </div>
                    <div className="text-sm text-muted-foreground">Impressões Atual</div>
                    <div className="text-xs text-gray-500 mt-1">
                      vs {formatNumber(analyticsData.comparison.summary.totalImpressions)} anterior
                    </div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatNumber(analyticsData.summary.totalClicks)}
                    </div>
                    <div className="text-sm text-muted-foreground">Cliques Atual</div>
                    <div className="text-xs text-gray-500 mt-1">
                      vs {formatNumber(analyticsData.comparison.summary.totalClicks)} anterior
                    </div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(analyticsData.summary.totalCost)}
                    </div>
                    <div className="text-sm text-muted-foreground">Gasto Atual</div>
                    <div className="text-xs text-gray-500 mt-1">
                      vs {formatCurrency(analyticsData.comparison.summary.totalCost)} anterior
                    </div>
                  </div>
                  
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatNumber(analyticsData.summary.totalConversions)}
                    </div>
                    <div className="text-sm text-muted-foreground">Conversões Atual</div>
                    <div className="text-xs text-gray-500 mt-1">
                      vs {formatNumber(analyticsData.comparison.summary.totalConversions)} anterior
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}