'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Eye,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Zap
} from "lucide-react";

export default function CompetitorAnalysis() {
  // Dados simulados de concorrentes
  const competitorData = [
    {
      name: "Concorrente A",
      category: "E-commerce",
      estimatedSpend: 85000,
      estimatedReach: 1200000,
      adCount: 45,
      performance: "high",
      trend: "up",
      trendValue: 15,
      strengths: ["Criativos visuais", "Segmentação precisa"],
      weaknesses: ["Pouca variedade", "CTAs genéricos"]
    },
    {
      name: "Concorrente B", 
      category: "Serviços",
      estimatedSpend: 62000,
      estimatedReach: 890000,
      adCount: 32,
      performance: "medium",
      trend: "down",
      trendValue: 8,
      strengths: ["Copywriting forte", "Ofertas atrativas"],
      weaknesses: ["Criativos repetitivos", "Targeting amplo"]
    },
    {
      name: "Concorrente C",
      category: "SaaS",
      estimatedSpend: 120000,
      estimatedReach: 1800000,
      adCount: 67,
      performance: "very-high",
      trend: "up",
      trendValue: 22,
      strengths: ["Diversidade de formatos", "Remarketing avançado"],
      weaknesses: ["Saturação de audiência"]
    }
  ];

  const industryBenchmarks = {
    avgSpend: 75000,
    avgReach: 1100000,
    avgAdCount: 38,
    avgCTR: 2.8,
    avgCPC: 0.65,
    avgROAS: 3.2
  };

  const myPerformance = {
    spend: 45230,
    reach: 2400000,
    adCount: 28,
    ctr: 3.65,
    cpc: 0.51,
    roas: 4.2
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'very-high':
        return 'text-green-600 bg-green-100';
      case 'high':
        return 'text-blue-600 bg-blue-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getComparisonStatus = (myValue: number, benchmarkValue: number) => {
    const diff = ((myValue - benchmarkValue) / benchmarkValue) * 100;
    if (diff > 10) return { status: 'better', color: 'text-green-600', icon: <TrendingUp className="w-4 h-4" /> };
    if (diff < -10) return { status: 'worse', color: 'text-red-600', icon: <TrendingDown className="w-4 h-4" /> };
    return { status: 'similar', color: 'text-yellow-600', icon: <Target className="w-4 h-4" /> };
  };

  return (
    <div className="space-y-6">
      {/* Comparação com Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Sua Performance vs Mercado
          </CardTitle>
          <CardDescription>
            Como você se compara aos benchmarks da indústria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Investimento</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Seu investimento</span>
                  <span className="font-medium">{formatCurrency(myPerformance.spend)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Média do mercado</span>
                  <span className="font-medium">{formatCurrency(industryBenchmarks.avgSpend)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Status</span>
                  <div className="flex items-center space-x-1">
                    {getComparisonStatus(myPerformance.spend, industryBenchmarks.avgSpend).icon}
                    <span className={`font-medium ${getComparisonStatus(myPerformance.spend, industryBenchmarks.avgSpend).color}`}>
                      {myPerformance.spend > industryBenchmarks.avgSpend ? 'Acima' : 
                       myPerformance.spend < industryBenchmarks.avgSpend ? 'Abaixo' : 'Similar'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Performance</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Seu ROAS</span>
                  <span className="font-medium text-green-600">{myPerformance.roas.toFixed(1)}x</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">ROAS médio</span>
                  <span className="font-medium">{industryBenchmarks.avgROAS.toFixed(1)}x</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Status</span>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-600">Excelente</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Alcance</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Seu alcance</span>
                  <span className="font-medium">{formatNumber(myPerformance.reach)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Alcance médio</span>
                  <span className="font-medium">{formatNumber(industryBenchmarks.avgReach)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Status</span>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-600">Superior</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análise de Concorrentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Análise de Concorrentes
          </CardTitle>
          <CardDescription>
            Principais concorrentes identificados e suas estratégias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {competitorData.map((competitor, index) => (
              <div key={index} className="p-6 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-blue-600">
                        {competitor.name.charAt(competitor.name.length - 1)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">{competitor.name}</h3>
                      <p className="text-sm text-gray-500">{competitor.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPerformanceColor(competitor.performance)}>
                      {competitor.performance === 'very-high' ? '🔥 Muito Alto' :
                       competitor.performance === 'high' ? '⭐ Alto' :
                       competitor.performance === 'medium' ? '📊 Médio' : '⚠️ Baixo'}
                    </Badge>
                    <div className="flex items-center space-x-1">
                      {competitor.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${
                        competitor.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {competitor.trendValue}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <DollarSign className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <div className="font-medium">{formatCurrency(competitor.estimatedSpend)}</div>
                    <div className="text-xs text-gray-500">Investimento estimado</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <div className="font-medium">{formatNumber(competitor.estimatedReach)}</div>
                    <div className="text-xs text-gray-500">Alcance estimado</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <div className="font-medium">{competitor.adCount}</div>
                    <div className="text-xs text-gray-500">Anúncios ativos</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-green-800 mb-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Pontos Fortes
                    </h4>
                    <ul className="space-y-1">
                      {competitor.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-green-700 flex items-center">
                          <span className="w-1 h-1 bg-green-500 rounded-full mr-2"></span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-800 mb-2 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Pontos Fracos
                    </h4>
                    <ul className="space-y-1">
                      {competitor.weaknesses.map((weakness, idx) => (
                        <li key={idx} className="text-sm text-red-700 flex items-center">
                          <span className="w-1 h-1 bg-red-500 rounded-full mr-2"></span>
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Oportunidades Identificadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-500" />
            Oportunidades Identificadas
          </CardTitle>
          <CardDescription>
            Insights baseados na análise competitiva
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-blue-800">🎯 Vantagens Competitivas</h4>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>ROAS superior:</strong> Seu ROAS de 4.2x está 31% acima da média dos concorrentes
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Eficiência de custo:</strong> CPC 22% menor que a média do mercado
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Alcance otimizado:</strong> Maior alcance com menor investimento
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-orange-800">🚀 Oportunidades de Crescimento</h4>
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    <strong>Aumentar investimento:</strong> Potencial para escalar mantendo eficiência
                  </p>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    <strong>Diversificar formatos:</strong> Explorar Reels e Stories como Concorrente C
                  </p>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    <strong>Remarketing avançado:</strong> Implementar estratégias mais sofisticadas
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recomendações Estratégicas */}
      <Card>
        <CardHeader>
          <CardTitle>Recomendações Estratégicas</CardTitle>
          <CardDescription>
            Próximos passos baseados na análise competitiva
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800">Manter Vantagem Competitiva</h4>
                <p className="text-sm text-green-700 mt-1">
                  Continue focando na eficiência de custos e otimização de ROAS, que são seus principais diferenciais.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Target className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Expandir Investimento Gradualmente</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Considere aumentar o orçamento em 25-30% mantendo as métricas atuais de performance.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-800">Inovar em Formatos</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Teste novos formatos de anúncios (Reels, Stories) para capturar audiências que os concorrentes estão alcançando.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}