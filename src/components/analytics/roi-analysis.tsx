'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  PieChart,
  Calculator,
  Zap
} from "lucide-react";

interface PerformanceData {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  conversionRate: number;
}

interface ROIAnalysisProps {
  data: PerformanceData;
}

export default function ROIAnalysis({ data }: ROIAnalysisProps) {
  const [selectedView, setSelectedView] = useState('overview');

  // Calcular métricas de ROI
  const totalRevenue = data.totalSpend * data.roas;
  const profit = totalRevenue - data.totalSpend;
  const profitMargin = (profit / totalRevenue) * 100;
  const costPerConversion = data.totalSpend / data.totalConversions;
  const revenuePerConversion = totalRevenue / data.totalConversions;

  // Simular dados por canal/campanha
  const channelData = [
    {
      name: 'Meta Ads - Feed',
      spend: data.totalSpend * 0.4,
      revenue: data.totalSpend * 0.4 * 4.5,
      conversions: data.totalConversions * 0.35,
      roas: 4.5
    },
    {
      name: 'Meta Ads - Stories',
      spend: data.totalSpend * 0.3,
      revenue: data.totalSpend * 0.3 * 3.8,
      conversions: data.totalConversions * 0.25,
      roas: 3.8
    },
    {
      name: 'Meta Ads - Reels',
      spend: data.totalSpend * 0.2,
      revenue: data.totalSpend * 0.2 * 4.2,
      conversions: data.totalConversions * 0.3,
      roas: 4.2
    },
    {
      name: 'Meta Ads - Remarketing',
      spend: data.totalSpend * 0.1,
      revenue: data.totalSpend * 0.1 * 6.2,
      conversions: data.totalConversions * 0.1,
      roas: 6.2
    }
  ];

  const views = [
    { value: 'overview', label: 'Visão Geral', icon: <BarChart3 className="w-4 h-4" /> },
    { value: 'channels', label: 'Por Canal', icon: <PieChart className="w-4 h-4" /> },
    { value: 'trends', label: 'Tendências', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'calculator', label: 'Calculadora', icon: <Calculator className="w-4 h-4" /> }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getROASColor = (roas: number) => {
    if (roas >= 4) return 'text-green-600 bg-green-100';
    if (roas >= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getROASLabel = (roas: number) => {
    if (roas >= 4) return 'Excelente';
    if (roas >= 3) return 'Bom';
    if (roas >= 2) return 'Regular';
    return 'Baixo';
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Análise de ROI
              </CardTitle>
              <CardDescription>
                Análise detalhada do retorno sobre investimento
              </CardDescription>
            </div>
            <div className="flex items-center space-x-1">
              {views.map((view) => (
                <Button
                  key={view.value}
                  variant={selectedView === view.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedView(view.value)}
                  className="flex items-center space-x-1"
                >
                  {view.icon}
                  <span>{view.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Métricas Principais de ROI */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  ROAS Geral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-gray-900">
                    {data.roas.toFixed(1)}x
                  </div>
                  <Badge className={getROASColor(data.roas)}>
                    {getROASLabel(data.roas)}
                  </Badge>
                  <p className="text-xs text-gray-500">
                    Para cada R$ 1 investido, retorna R$ {data.roas.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Receita Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalRevenue)}
                  </div>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">+23.5%</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Receita gerada pelos anúncios
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Lucro Líquido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(profit)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Margem: {profitMargin.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-500">
                    Lucro após descontar investimento
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Custo por Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(costPerConversion)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Valor: {formatCurrency(revenuePerConversion)}
                  </div>
                  <p className="text-xs text-gray-500">
                    Custo médio para gerar uma conversão
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown de Investimento vs Retorno */}
          <Card>
            <CardHeader>
              <CardTitle>Breakdown Financeiro</CardTitle>
              <CardDescription>
                Visualização detalhada do investimento e retorno
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Investimento</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Gasto em Anúncios</span>
                        <span className="font-medium">{formatCurrency(data.totalSpend)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Taxa de Plataforma (estimada)</span>
                        <span className="font-medium">{formatCurrency(data.totalSpend * 0.05)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="font-medium">Total Investido</span>
                        <span className="font-bold text-red-600">
                          {formatCurrency(data.totalSpend * 1.05)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Retorno</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Receita Bruta</span>
                        <span className="font-medium">{formatCurrency(totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Impostos (estimado)</span>
                        <span className="font-medium">{formatCurrency(totalRevenue * 0.15)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="font-medium">Receita Líquida</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(totalRevenue * 0.85)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Lucro Final</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency((totalRevenue * 0.85) - (data.totalSpend * 1.05))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Lucro líquido após todos os custos e impostos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'channels' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ROI por Canal</CardTitle>
              <CardDescription>
                Performance de cada canal de anúncios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {channelData.map((channel, index) => {
                  const profit = channel.revenue - channel.spend;
                  const profitMargin = (profit / channel.revenue) * 100;
                  
                  return (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{channel.name}</h4>
                        <Badge className={getROASColor(channel.roas)}>
                          {channel.roas.toFixed(1)}x ROAS
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Investimento</span>
                          <div className="font-medium">{formatCurrency(channel.spend)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Receita</span>
                          <div className="font-medium text-green-600">
                            {formatCurrency(channel.revenue)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Lucro</span>
                          <div className="font-medium text-blue-600">
                            {formatCurrency(profit)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Margem</span>
                          <div className="font-medium">{profitMargin.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <Progress value={(channel.roas / 6) * 100} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'trends' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tendências de ROI</CardTitle>
              <CardDescription>
                Evolução do retorno sobre investimento ao longo do tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Tendência Positiva</span>
                    </div>
                    <p className="text-sm text-green-700">
                      ROAS aumentou 15% nos últimos 30 dias
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-800">Meta Atingida</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      ROAS acima da meta de 3.5x estabelecida
                    </p>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Zap className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Oportunidade</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Remarketing com potencial de 25% mais ROI
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'calculator' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calculadora de ROI</CardTitle>
              <CardDescription>
                Simule diferentes cenários de investimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Cenário Atual</h4>
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between">
                      <span>Investimento:</span>
                      <span className="font-medium">{formatCurrency(data.totalSpend)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ROAS:</span>
                      <span className="font-medium">{data.roas.toFixed(1)}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Receita:</span>
                      <span className="font-medium text-green-600">{formatCurrency(totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Lucro:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(profit)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Projeção (+50% investimento)</h4>
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between">
                      <span>Investimento:</span>
                      <span className="font-medium">{formatCurrency(data.totalSpend * 1.5)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ROAS estimado:</span>
                      <span className="font-medium">{(data.roas * 0.95).toFixed(1)}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Receita projetada:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(data.totalSpend * 1.5 * data.roas * 0.95)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Lucro projetado:</span>
                      <span className="font-bold text-blue-600">
                        {formatCurrency((data.totalSpend * 1.5 * data.roas * 0.95) - (data.totalSpend * 1.5))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}