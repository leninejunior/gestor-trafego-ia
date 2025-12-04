'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Calendar,
  Zap,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  LineChart,
  PieChart
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

interface PredictiveAnalyticsProps {
  data: PerformanceData;
}

export default function PredictiveAnalytics({ data }: PredictiveAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedModel, setSelectedModel] = useState('conservative');

  // Calcular projeções baseadas nos dados atuais
  const generatePredictions = (period: string, model: string) => {
    const multipliers = {
      conservative: { growth: 1.05, variance: 0.1 },
      moderate: { growth: 1.15, variance: 0.15 },
      aggressive: { growth: 1.25, variance: 0.2 }
    };

    const periodMultipliers = {
      '7d': 0.25,
      '30d': 1,
      '90d': 3,
      '180d': 6
    };

    const modelConfig = multipliers[model as keyof typeof multipliers];
    const periodConfig = periodMultipliers[period as keyof typeof periodMultipliers];

    return {
      spend: data.totalSpend * periodConfig * modelConfig.growth,
      revenue: data.totalSpend * data.roas * periodConfig * modelConfig.growth,
      conversions: data.totalConversions * periodConfig * modelConfig.growth,
      roas: data.roas * (1 + (modelConfig.growth - 1) * 0.5), // ROAS cresce mais devagar
      confidence: Math.max(0.6, 0.95 - (modelConfig.variance * periodConfig))
    };
  };

  const predictions = generatePredictions(selectedPeriod, selectedModel);
  const profit = predictions.revenue - predictions.spend;

  const periods = [
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' },
    { value: '180d', label: '6 meses' }
  ];

  const models = [
    { value: 'conservative', label: 'Conservador', description: 'Crescimento estável e seguro' },
    { value: 'moderate', label: 'Moderado', description: 'Crescimento equilibrado' },
    { value: 'aggressive', label: 'Agressivo', description: 'Crescimento acelerado' }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  // Simulação de insights de IA
  const aiInsights = [
    {
      type: 'opportunity',
      title: 'Oportunidade de Crescimento',
      description: 'Modelo prevê 23% de aumento no ROAS se otimizar horários de veiculação',
      confidence: 0.87,
      impact: 'high'
    },
    {
      type: 'warning',
      title: 'Saturação de Audiência',
      description: 'Audiência atual pode saturar em 45 dias com investimento atual',
      confidence: 0.72,
      impact: 'medium'
    },
    {
      type: 'trend',
      title: 'Tendência Sazonal',
      description: 'Histórico indica aumento de 35% nas conversões nos próximos 2 meses',
      confidence: 0.91,
      impact: 'high'
    },
    {
      type: 'optimization',
      title: 'Otimização de Orçamento',
      description: 'Redistribuir 15% do orçamento para remarketing pode aumentar ROI em 12%',
      confidence: 0.79,
      impact: 'medium'
    }
  ];

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'trend':
        return <LineChart className="w-5 h-5 text-blue-600" />;
      case 'optimization':
        return <Target className="w-5 h-5 text-purple-600" />;
      default:
        return <Brain className="w-5 h-5 text-gray-600" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'opportunity':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'trend':
        return 'bg-blue-50 border-blue-200';
      case 'optimization':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-muted/50 border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Brain className="w-5 h-5 mr-2" />
                Analytics Preditivo
              </CardTitle>
              <CardDescription>
                Projeções inteligentes baseadas em machine learning
              </CardDescription>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-600">Período:</span>
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
                <span className="text-sm text-gray-600">Modelo:</span>
                {models.map((model) => (
                  <Button
                    key={model.value}
                    variant={selectedModel === model.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedModel(model.value)}
                    title={model.description}
                  >
                    {model.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Projeções Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Investimento Projetado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(predictions.spend)}
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">
                  +{(((predictions.spend / data.totalSpend) - 1) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">Confiança:</span>
                <Badge variant="outline" className="text-xs">
                  {(predictions.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Receita Projetada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(predictions.revenue)}
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">
                  +{(((predictions.revenue / (data.totalSpend * data.roas)) - 1) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-500">
                ROAS: {predictions.roas.toFixed(1)}x
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Conversões Projetadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-purple-600">
                {formatNumber(predictions.conversions)}
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">
                  +{(((predictions.conversions / data.totalConversions) - 1) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-500">
                vs período atual
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Lucro Projetado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(profit)}
              </div>
              <div className="text-xs text-gray-500">
                Margem: {((profit / predictions.revenue) * 100).toFixed(1)}%
              </div>
              <Progress 
                value={Math.min((profit / predictions.revenue) * 100, 100)} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cenários de Projeção */}
      <Card>
        <CardHeader>
          <CardTitle>Cenários de Projeção</CardTitle>
          <CardDescription>
            Compare diferentes cenários para os próximos {periods.find(p => p.value === selectedPeriod)?.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {models.map((model) => {
              const scenarioPredictions = generatePredictions(selectedPeriod, model.value);
              const scenarioProfit = scenarioPredictions.revenue - scenarioPredictions.spend;
              const isSelected = selectedModel === model.value;
              
              return (
                <div 
                  key={model.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedModel(model.value)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{model.label}</h3>
                    {isSelected && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{model.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Investimento:</span>
                      <span className="font-medium">{formatCurrency(scenarioPredictions.spend)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Receita:</span>
                      <span className="font-medium text-green-600">{formatCurrency(scenarioPredictions.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lucro:</span>
                      <span className="font-medium text-blue-600">{formatCurrency(scenarioProfit)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>ROAS:</span>
                      <span className="font-bold">{scenarioPredictions.roas.toFixed(1)}x</span>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Confiança</span>
                      <span>{(scenarioPredictions.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={scenarioPredictions.confidence * 100} className="h-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Insights de IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-500" />
            Insights de Inteligência Artificial
          </CardTitle>
          <CardDescription>
            Descobertas e recomendações baseadas em análise preditiva
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiInsights.map((insight, index) => (
              <div key={index} className={`p-4 border rounded-lg ${getInsightColor(insight.type)}`}>
                <div className="flex items-start space-x-3">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{insight.title}</h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant={insight.impact === 'high' ? 'default' : 'secondary'} className="text-xs">
                          {insight.impact === 'high' ? 'Alto Impacto' : 'Médio Impacto'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Confiança:</span>
                      <Progress value={insight.confidence * 100} className="h-1 flex-1" />
                      <span className="text-xs font-medium">{(insight.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recomendações de Ação */}
      <Card>
        <CardHeader>
          <CardTitle>Recomendações de Ação</CardTitle>
          <CardDescription>
            Próximos passos baseados nas projeções
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800">Otimizar Horários de Veiculação</h4>
                <p className="text-sm text-green-700 mt-1">
                  Modelo prevê 23% de melhoria no ROAS focando nos horários de maior conversão (18h-22h).
                </p>
                <Badge variant="outline" className="mt-2 text-xs">Implementar em 3 dias</Badge>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Target className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Expandir Audiência Gradualmente</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Aumentar audiência em 15% a cada 2 semanas para evitar saturação e manter eficiência.
                </p>
                <Badge variant="outline" className="mt-2 text-xs">Implementar em 1 semana</Badge>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-800">Redistribuir Orçamento</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Mover 15% do orçamento para campanhas de remarketing pode aumentar ROI geral em 12%.
                </p>
                <Badge variant="outline" className="mt-2 text-xs">Implementar em 5 dias</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}