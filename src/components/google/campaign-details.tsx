'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Eye, 
  MousePointer, 
  Target,
  Calendar,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  conversion_rate: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface CampaignDetails {
  id: string;
  campaign_id: string;
  campaign_name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budget_amount: number;
  budget_currency: string;
  start_date: string;
  end_date?: string;
  metrics: CampaignMetrics;
  updated_at: string;
}

interface HistoricalData {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  roas: number;
}

interface CampaignDetailsProps {
  campaignId: string;
  clientId: string;
  onBack?: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function GoogleCampaignDetails({ campaignId, clientId, onBack }: CampaignDetailsProps) {
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [comparisonPeriod, setComparisonPeriod] = useState('previous');
  const { toast } = useToast();

  const fetchCampaignDetails = async () => {
    try {
      setLoading(true);
      
      const [detailsResponse, metricsResponse] = await Promise.all([
        fetch(`/api/google/campaigns/${campaignId}?clientId=${clientId}`),
        fetch(`/api/google/metrics?campaignId=${campaignId}&dateRange=${dateRange}`)
      ]);

      if (!detailsResponse.ok || !metricsResponse.ok) {
        throw new Error('Falha ao carregar detalhes da campanha');
      }

      const detailsData = await detailsResponse.json();
      const metricsData = await metricsResponse.json();

      setCampaign(detailsData.campaign);
      setHistoricalData(metricsData.historicalData || []);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os detalhes da campanha.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId && clientId) {
      fetchCampaignDetails();
    }
  }, [campaignId, clientId, dateRange]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ENABLED':
        return <Badge className="bg-green-100 text-green-800">Ativa</Badge>;
      case 'PAUSED':
        return <Badge variant="secondary">Pausada</Badge>;
      case 'REMOVED':
        return <Badge variant="destructive">Removida</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, _currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getMetricCards = () => {
    if (!campaign) return [];

    return [
      {
        title: 'Gasto Total',
        value: formatCurrency(campaign.metrics.cost, campaign.budget_currency),
        icon: DollarSign,
        trend: '+12.5%',
        trendUp: true
      },
      {
        title: 'Impressões',
        value: campaign.metrics.impressions.toLocaleString(),
        icon: Eye,
        trend: '+8.2%',
        trendUp: true
      },
      {
        title: 'Cliques',
        value: campaign.metrics.clicks.toLocaleString(),
        icon: MousePointer,
        trend: '+15.3%',
        trendUp: true
      },
      {
        title: 'Conversões',
        value: campaign.metrics.conversions.toFixed(1),
        icon: Target,
        trend: '-2.1%',
        trendUp: false
      },
      {
        title: 'CTR',
        value: formatPercentage(campaign.metrics.ctr),
        icon: TrendingUp,
        trend: '+5.7%',
        trendUp: true
      },
      {
        title: 'ROAS',
        value: `${campaign.metrics.roas.toFixed(2)}x`,
        icon: TrendingUp,
        trend: '+18.9%',
        trendUp: true
      }
    ];
  };

  const getPerformanceData = () => {
    return historicalData.map(item => ({
      date: formatDate(item.date),
      impressions: item.impressions,
      clicks: item.clicks,
      conversions: item.conversions,
      cost: item.cost,
      ctr: item.ctr * 100,
      roas: item.roas
    }));
  };

  const getConversionFunnelData = () => {
    if (!campaign) return [];

    const { impressions, clicks, conversions } = campaign.metrics;
    
    return [
      { name: 'Impressões', value: impressions, percentage: 100 },
      { name: 'Cliques', value: clicks, percentage: (clicks / impressions) * 100 },
      { name: 'Conversões', value: conversions, percentage: (conversions / impressions) * 100 }
    ];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Carregando detalhes da campanha...
        </CardContent>
      </Card>
    );
  }

  if (!campaign) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Campanha não encontrada.</p>
          {onBack && (
            <Button onClick={onBack} variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button onClick={onBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">{campaign.campaign_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(campaign.status)}
              <span className="text-sm text-muted-foreground">
                ID: {campaign.campaign_id}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="14d">14 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={fetchCampaignDetails} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getMetricCards().map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                </div>
                <metric.icon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="flex items-center mt-2">
                {metric.trendUp ? (
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                )}
                <span className={`text-sm ${metric.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.trend}
                </span>
                <span className="text-sm text-muted-foreground ml-1">vs período anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Analysis */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="funnel">Funil de Conversão</TabsTrigger>
          <TabsTrigger value="comparison">Comparação</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Impressions and Clicks Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Impressões e Cliques</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getPerformanceData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="impressions" 
                      stroke="#8884d8" 
                      name="Impressões"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#82ca9d" 
                      name="Cliques"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost and ROAS Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Gasto e ROAS</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getPerformanceData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar 
                      yAxisId="left"
                      dataKey="cost" 
                      fill="#8884d8" 
                      name="Gasto"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="roas" 
                      stroke="#ff7300" 
                      name="ROAS"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="funnel">
          <Card>
            <CardHeader>
              <CardTitle>Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getConversionFunnelData().map((step, index) => (
                  <div key={step.name} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">{step.name}</div>
                    <div className="flex-1">
                      <div className="bg-muted rounded-full h-8 relative">
                        <div 
                          className="bg-blue-500 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ width: `${step.percentage}%` }}
                        >
                          {step.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm">
                      {step.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle>Comparação entre Períodos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Funcionalidade de comparação será implementada em breve.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Orçamento</p>
              <p className="font-medium">
                {formatCurrency(campaign.budget_amount, campaign.budget_currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data de Início</p>
              <p className="font-medium">{formatDate(campaign.start_date)}</p>
            </div>
            {campaign.end_date && (
              <div>
                <p className="text-sm text-muted-foreground">Data de Fim</p>
                <p className="font-medium">{formatDate(campaign.end_date)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Última Atualização</p>
              <p className="font-medium">{formatDate(campaign.updated_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}