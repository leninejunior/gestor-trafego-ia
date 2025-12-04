"use client";

/**
 * Google Ads Dashboard Completo
 * 
 * Dashboard com todos os indicadores do Google Ads:
 * - KPIs principais (Gasto, Impressões, Cliques, Conversões)
 * - Métricas de performance (CTR, CPC, CPA, ROAS)
 * - Gráfico de evolução temporal
 * - Comparativo de campanhas
 */

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, Eye, MousePointer, Target, TrendingUp, TrendingDown,
  BarChart3, Users, Zap, Activity, PieChart, RefreshCw
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

interface GoogleDashboardProps {
  clientId: string;
  startDate: string;
  endDate: string;
  onRefresh?: () => void;
}

interface DashboardMetrics {
  // KPIs principais
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  
  // Métricas de performance
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  conversionRate: number;
  
  // Contadores
  totalCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  
  // Dados para gráficos
  dailyData: DailyMetric[];
  campaignData: CampaignMetric[];
}

interface DailyMetric {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

interface CampaignMetric {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const COLORS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9334E6', '#00ACC1'];

// ============================================================================
// KPI Card Component
// ============================================================================

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  trend?: { value: number; isPositive: boolean };
  color?: string;
}

function KPICard({ title, value, icon, description, trend, color = 'blue' }: KPICardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    red: 'text-red-600 bg-red-100',
    purple: 'text-purple-600 bg-purple-100',
    cyan: 'text-cyan-600 bg-cyan-100',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center text-xs mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}% vs período anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GoogleDashboardComplete({ clientId, startDate, endDate, onRefresh }: GoogleDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!clientId || !startDate || !endDate) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Buscar métricas agregadas
        const metricsResponse = await fetch(
          `/api/google/metrics-simple?clientId=${clientId}&startDate=${startDate}&endDate=${endDate}&groupBy=campaign`
        );
        
        if (!metricsResponse.ok) {
          throw new Error('Falha ao carregar métricas');
        }

        const metricsData = await metricsResponse.json();

        // Buscar campanhas com métricas detalhadas
        const campaignsResponse = await fetch(
          `/api/google/campaigns?clientId=${clientId}&startDate=${startDate}&endDate=${endDate}`
        );

        const campaignsData = campaignsResponse.ok ? await campaignsResponse.json() : { campaigns: [] };

        // Processar dados
        const campaigns = campaignsData.campaigns || [];
        const summary = metricsData.summary || {};

        const dashboardMetrics: DashboardMetrics = {
          totalSpend: summary.totalCost || 0,
          totalImpressions: summary.totalImpressions || 0,
          totalClicks: summary.totalClicks || 0,
          totalConversions: summary.totalConversions || 0,
          ctr: summary.averageCtr || 0,
          cpc: summary.averageCpc || 0,
          cpa: summary.totalConversions > 0 ? (summary.totalCost / summary.totalConversions) : 0,
          roas: summary.averageRoas || 0,
          conversionRate: summary.totalClicks > 0 ? ((summary.totalConversions / summary.totalClicks) * 100) : 0,
          totalCampaigns: campaigns.length,
          activeCampaigns: campaigns.filter((c: any) => c.status === 'ENABLED').length,
          pausedCampaigns: campaigns.filter((c: any) => c.status === 'PAUSED').length,
          dailyData: [], // TODO: Implementar dados diários
          campaignData: campaigns.map((c: any) => ({
            id: c.id,
            name: c.name || c.campaign_name,
            status: c.status,
            spend: c.metrics?.cost || 0,
            impressions: c.metrics?.impressions || 0,
            clicks: c.metrics?.clicks || 0,
            conversions: c.metrics?.conversions || 0,
            ctr: c.metrics?.ctr || 0,
            cpc: c.metrics?.cpc || 0,
            cpa: c.metrics?.cpa || 0,
          })),
        };

        setMetrics(dashboardMetrics);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [clientId, startDate, endDate]);

  // Dados para gráfico de pizza (distribuição de gastos por campanha)
  const pieChartData = useMemo(() => {
    if (!metrics?.campaignData) return [];
    return metrics.campaignData
      .filter(c => c.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6)
      .map(c => ({
        name: c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name,
        value: c.spend,
      }));
  }, [metrics]);

  // Dados para gráfico de barras (performance por campanha)
  const barChartData = useMemo(() => {
    if (!metrics?.campaignData) return [];
    return metrics.campaignData
      .filter(c => c.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 8)
      .map(c => ({
        name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
        clicks: c.clicks,
        conversions: c.conversions,
        ctr: c.ctr,
      }));
  }, [metrics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Carregando dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600">Erro ao carregar dashboard: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Selecione um cliente para ver o dashboard</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com resumo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Google Ads</h2>
          <p className="text-muted-foreground text-sm">
            Período: {new Date(startDate).toLocaleDateString('pt-BR')} - {new Date(endDate).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700">
            {metrics.activeCampaigns} ativas
          </Badge>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            {metrics.pausedCampaigns} pausadas
          </Badge>
        </div>
      </div>

      {/* Tabs para diferentes visões */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Investimento Total"
              value={formatCurrency(metrics.totalSpend)}
              icon={<DollarSign className="w-4 h-4" />}
              description="Gasto total no período"
              color="green"
            />
            <KPICard
              title="Impressões"
              value={formatNumber(metrics.totalImpressions)}
              icon={<Eye className="w-4 h-4" />}
              description="Visualizações dos anúncios"
              color="blue"
            />
            <KPICard
              title="Cliques"
              value={formatNumber(metrics.totalClicks)}
              icon={<MousePointer className="w-4 h-4" />}
              description="Cliques nos anúncios"
              color="purple"
            />
            <KPICard
              title="Conversões"
              value={formatNumber(metrics.totalConversions)}
              icon={<Target className="w-4 h-4" />}
              description="Ações concluídas"
              color="cyan"
            />
          </div>

          {/* Gráficos lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribuição de Gastos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Investimento</CardTitle>
                <CardDescription>Por campanha (top 6)</CardDescription>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados de gastos
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance por Campanha */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cliques vs Conversões</CardTitle>
                <CardDescription>Por campanha (top 8)</CardDescription>
              </CardHeader>
              <CardContent>
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="clicks" fill="#4285F4" name="Cliques" />
                      <Bar dataKey="conversions" fill="#34A853" name="Conversões" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados de cliques
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Performance */}
        <TabsContent value="performance" className="space-y-6">
          {/* Métricas de Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="CTR"
              value={formatPercent(metrics.ctr)}
              icon={<BarChart3 className="w-4 h-4" />}
              description="Taxa de cliques"
              color="blue"
            />
            <KPICard
              title="CPC"
              value={formatCurrency(metrics.cpc)}
              icon={<MousePointer className="w-4 h-4" />}
              description="Custo por clique"
              color="green"
            />
            <KPICard
              title="CPA"
              value={formatCurrency(metrics.cpa)}
              icon={<Target className="w-4 h-4" />}
              description="Custo por aquisição"
              color="yellow"
            />
            <KPICard
              title="Taxa de Conversão"
              value={formatPercent(metrics.conversionRate)}
              icon={<TrendingUp className="w-4 h-4" />}
              description="Cliques → Conversões"
              color="purple"
            />
            <KPICard
              title="ROAS"
              value={`${metrics.roas.toFixed(2)}x`}
              icon={<Activity className="w-4 h-4" />}
              description="Retorno sobre investimento"
              color="cyan"
            />
          </div>

          {/* Tabela de métricas por campanha */}
          <Card>
            <CardHeader>
              <CardTitle>Performance por Campanha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Campanha</th>
                      <th className="text-right py-3 px-2">Status</th>
                      <th className="text-right py-3 px-2">Gasto</th>
                      <th className="text-right py-3 px-2">Impressões</th>
                      <th className="text-right py-3 px-2">Cliques</th>
                      <th className="text-right py-3 px-2">CTR</th>
                      <th className="text-right py-3 px-2">CPC</th>
                      <th className="text-right py-3 px-2">Conv.</th>
                      <th className="text-right py-3 px-2">CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.campaignData.map((campaign) => (
                      <tr key={campaign.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium max-w-[200px] truncate" title={campaign.name}>
                          {campaign.name}
                        </td>
                        <td className="text-right py-3 px-2">
                          <Badge variant={campaign.status === 'ENABLED' ? 'default' : 'secondary'}>
                            {campaign.status === 'ENABLED' ? 'Ativa' : campaign.status === 'PAUSED' ? 'Pausada' : campaign.status}
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-2">{formatCurrency(campaign.spend)}</td>
                        <td className="text-right py-3 px-2">{formatNumber(campaign.impressions)}</td>
                        <td className="text-right py-3 px-2">{formatNumber(campaign.clicks)}</td>
                        <td className="text-right py-3 px-2">{formatPercent(campaign.ctr)}</td>
                        <td className="text-right py-3 px-2">{formatCurrency(campaign.cpc)}</td>
                        <td className="text-right py-3 px-2">{campaign.conversions.toFixed(1)}</td>
                        <td className="text-right py-3 px-2">{formatCurrency(campaign.cpa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Campanhas */}
        <TabsContent value="campaigns" className="space-y-6">
          {/* Resumo de campanhas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Total de Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.totalCampaigns}</div>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-700">Campanhas Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{metrics.activeCampaigns}</div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-yellow-700">Campanhas Pausadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{metrics.pausedCampaigns}</div>
              </CardContent>
            </Card>
          </div>

          {/* Lista detalhada de campanhas */}
          <Card>
            <CardHeader>
              <CardTitle>Todas as Campanhas</CardTitle>
              <CardDescription>Ordenadas por investimento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.campaignData
                  .sort((a, b) => b.spend - a.spend)
                  .map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                          <span>{formatNumber(campaign.impressions)} impressões</span>
                          <span>{formatNumber(campaign.clicks)} cliques</span>
                          <span>{campaign.conversions.toFixed(1)} conversões</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{formatCurrency(campaign.spend)}</div>
                        <Badge variant={campaign.status === 'ENABLED' ? 'default' : 'secondary'} className="mt-1">
                          {campaign.status === 'ENABLED' ? 'Ativa' : campaign.status === 'PAUSED' ? 'Pausada' : campaign.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
