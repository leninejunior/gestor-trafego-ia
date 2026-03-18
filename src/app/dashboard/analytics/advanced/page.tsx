import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdvancedKPICards from "@/components/analytics/advanced-kpi-cards";
import CampaignPerformanceChart from "@/components/analytics/campaign-performance-chart";
import ROIAnalysis from "@/components/analytics/roi-analysis";
import AudienceInsights from "@/components/analytics/audience-insights";
import CompetitorAnalysis from "@/components/analytics/competitor-analysis";
import PredictiveAnalytics from "@/components/analytics/predictive-analytics";
import Link from "next/link";
import { 
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Target,
  Users,
  DollarSign,
  Zap,
  Brain,
  Eye,
  Download,
  RefreshCw,
  Calendar,
  Filter
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AdvancedAnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Buscar dados avançados de analytics
  const { data: campaigns } = await supabase
    .from("client_meta_connections")
    .select(`
      id,
      account_name,
      is_active,
      created_at,
      clients (
        id,
        name,
        organization_id
      )
    `)
    .eq("is_active", true);

  // Buscar dados reais de performance (últimos 30 dias)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const { data: insights } = await supabase
    .from('meta_campaign_insights')
    .select('spend,impressions,clicks,conversions,date_start')
    .gte('date_start', startDate.toISOString().split('T')[0])
    .lte('date_start', endDate.toISOString().split('T')[0]);

  const totals = (insights || []).reduce(
    (acc, insight: any) => {
      acc.spend += parseFloat(insight.spend || '0');
      acc.impressions += parseInt(insight.impressions || '0', 10);
      acc.clicks += parseInt(insight.clicks || '0', 10);
      acc.conversions += parseFloat(insight.conversions || '0');
      return acc;
    },
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
    }
  );

  const performanceData = {
    totalSpend: totals.spend,
    totalImpressions: totals.impressions,
    totalClicks: totals.clicks,
    totalConversions: totals.conversions,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    roas: totals.spend > 0 ? (totals.conversions * 50) / totals.spend : 0,
    conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
  };

  const activeCampaigns = campaigns?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/analytics">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Analytics Avançado
                </h1>
                <p className="text-gray-600 mt-1">
                  Insights profundos e análises preditivas das suas campanhas
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                Período
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
              <Button size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPIs Avançados */}
        <AdvancedKPICards data={performanceData} />

        {/* Tabs de Análises */}
        <Tabs defaultValue="performance" className="mt-8">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="roi" className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4" />
              <span>ROI</span>
            </TabsTrigger>
            <TabsTrigger value="audience" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Audiência</span>
            </TabsTrigger>
            <TabsTrigger value="competitors" className="flex items-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>Concorrentes</span>
            </TabsTrigger>
            <TabsTrigger value="predictive" className="flex items-center space-x-2">
              <Brain className="w-4 h-4" />
              <span>Preditivo</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Insights</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-6">
            <CampaignPerformanceChart campaigns={campaigns || []} />
          </TabsContent>

          <TabsContent value="roi" className="mt-6">
            <ROIAnalysis data={performanceData} />
          </TabsContent>

          <TabsContent value="audience" className="mt-6">
            <AudienceInsights />
          </TabsContent>

          <TabsContent value="competitors" className="mt-6">
            <CompetitorAnalysis />
          </TabsContent>

          <TabsContent value="predictive" className="mt-6">
            <PredictiveAnalytics data={performanceData} />
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                    Insights Automáticos
                  </CardTitle>
                  <CardDescription>
                    Descobertas importantes baseadas em IA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-800">
                            Performance Excepcional
                          </h4>
                          <p className="text-sm text-green-700 mt-1">
                            Suas campanhas de remarketing estão 35% acima da média do setor
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-800">
                            Oportunidade de Otimização
                          </h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Ajustar lances para audiência 25-34 anos pode aumentar ROI em 18%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Brain className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-800">
                            Tendência Identificada
                          </h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Conversões aumentam 42% nos fins de semana para este segmento
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recomendações de Ação</CardTitle>
                  <CardDescription>
                    Próximos passos sugeridos pela IA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-sm">Aumentar orçamento</p>
                          <p className="text-xs text-gray-500">Campanha "Verão 2024"</p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-xs">Alta</Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-sm">Otimizar criativos</p>
                          <p className="text-xs text-gray-500">CTR abaixo da média</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">Média</Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-sm">Expandir audiência</p>
                          <p className="text-xs text-gray-500">Lookalike 1% saturada</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">Baixa</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
