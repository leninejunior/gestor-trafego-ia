'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Target, DollarSign, Users } from "lucide-react";

interface ExecutiveSummaryProps {
  insights: any;
  campaignName: string;
  dateRange: { since: string; until: string };
}

export function ExecutiveSummary({ insights, campaignName, dateRange }: ExecutiveSummaryProps) {
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

  // Calcular métricas de performance
  const ctr = insights.ctr || 0;
  const cpm = insights.cpm || 0;
  const cpc = insights.cpc || 0;
  const spend = insights.spend || 0;
  const impressions = insights.impressions || 0;
  const clicks = insights.clicks || 0;

  // Determinar status da performance baseado em benchmarks
  const getCTRStatus = (ctr: number) => {
    if (ctr >= 0.02) return { status: 'Excelente', color: 'bg-green-500', icon: TrendingUp };
    if (ctr >= 0.01) return { status: 'Bom', color: 'bg-blue-500', icon: TrendingUp };
    if (ctr >= 0.005) return { status: 'Regular', color: 'bg-yellow-500', icon: Minus };
    return { status: 'Baixo', color: 'bg-red-500', icon: TrendingDown };
  };

  const getCPMStatus = (cpm: number) => {
    if (cpm <= 10) return { status: 'Excelente', color: 'bg-green-500', icon: TrendingUp };
    if (cpm <= 20) return { status: 'Bom', color: 'bg-blue-500', icon: TrendingUp };
    if (cpm <= 35) return { status: 'Regular', color: 'bg-yellow-500', icon: Minus };
    return { status: 'Alto', color: 'bg-red-500', icon: TrendingDown };
  };

  const ctrStatus = getCTRStatus(ctr);
  const cpmStatus = getCPMStatus(cpm);

  // Gerar insights automáticos
  const generateInsights = () => {
    const insights = [];

    if (ctr >= 0.02) {
      insights.push("🎯 Excelente taxa de cliques! Sua audiência está muito engajada com o conteúdo.");
    } else if (ctr < 0.005) {
      insights.push("⚠️ CTR baixo. Considere testar novos criativos ou ajustar o público-alvo.");
    }

    if (cpm <= 15) {
      insights.push("💰 CPM competitivo! Você está alcançando sua audiência com eficiência de custo.");
    } else if (cpm > 30) {
      insights.push("📈 CPM elevado. Revise a segmentação ou teste horários diferentes.");
    }

    if (clicks > 0 && impressions > 0) {
      const engagementRate = clicks / impressions;
      if (engagementRate > 0.015) {
        insights.push("🚀 Alto engajamento! Considere aumentar o orçamento para esta campanha.");
      }
    }

    if (spend > 0 && clicks > 0) {
      const costPerClick = spend / clicks;
      if (costPerClick < 2) {
        insights.push("✅ CPC eficiente! Ótimo retorno sobre o investimento.");
      }
    }

    return insights;
  };

  const autoInsights = generateInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Resumo Executivo
        </CardTitle>
        <CardDescription>
          Análise automática da performance da campanha {campaignName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-4 border rounded-lg">
            <div className={`p-2 rounded-full ${ctrStatus.color}`}>
              <ctrStatus.icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">CTR</p>
              <p className="text-lg font-bold">{formatPercentage(ctr)}</p>
              <Badge variant="secondary" className="text-xs">
                {ctrStatus.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 border rounded-lg">
            <div className={`p-2 rounded-full ${cpmStatus.color}`}>
              <cpmStatus.icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">CPM</p>
              <p className="text-lg font-bold">{formatCurrency(cpm)}</p>
              <Badge variant="secondary" className="text-xs">
                {cpmStatus.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 border rounded-lg">
            <div className="p-2 rounded-full bg-blue-500">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">Gasto Total</p>
              <p className="text-lg font-bold">{formatCurrency(spend)}</p>
              <Badge variant="secondary" className="text-xs">
                {formatNumber(clicks)} cliques
              </Badge>
            </div>
          </div>
        </div>

        {/* Insights Automáticos */}
        {autoInsights.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">💡 Insights Automáticos</h4>
            <div className="space-y-2">
              {autoInsights.map((insight, index) => (
                <div key={index} className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                  <p className="text-sm">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recomendações */}
        <div>
          <h4 className="font-medium mb-3">🎯 Próximos Passos</h4>
          <div className="space-y-2">
            {ctr < 0.01 && (
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="text-sm">Teste novos formatos de anúncio ou ajuste o público-alvo para melhorar o CTR.</p>
              </div>
            )}
            {cpm > 25 && (
              <div className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded">
                <p className="text-sm">Considere refinar a segmentação ou testar horários de menor concorrência.</p>
              </div>
            )}
            {ctr >= 0.015 && cpm <= 20 && (
              <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                <p className="text-sm">Performance excelente! Considere escalar o orçamento desta campanha.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}