'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  MousePointer,
  Target,
  Percent,
  BarChart3,
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

interface AdvancedKPICardsProps {
  data: PerformanceData;
}

export default function AdvancedKPICards({ data }: AdvancedKPICardsProps) {
  // Simular dados de comparação (período anterior)
  const previousData = {
    totalSpend: 38450.30,
    totalImpressions: 2100000,
    totalClicks: 76200,
    totalConversions: 980,
    ctr: 3.2,
    cpc: 0.58,
    cpm: 21.2,
    roas: 3.8,
    conversionRate: 1.1
  };

  const calculateChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      isPositive: change > 0,
      isNegative: change < 0
    };
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

  const kpis = [
    {
      title: "Investimento Total",
      value: formatCurrency(data.totalSpend),
      change: calculateChange(data.totalSpend, previousData.totalSpend),
      icon: <DollarSign className="w-5 h-5" />,
      color: "blue",
      description: "Gasto total em anúncios"
    },
    {
      title: "ROAS",
      value: `${data.roas.toFixed(1)}x`,
      change: calculateChange(data.roas, previousData.roas),
      icon: <TrendingUp className="w-5 h-5" />,
      color: "green",
      description: "Retorno sobre investimento em anúncios"
    },
    {
      title: "Impressões",
      value: formatNumber(data.totalImpressions),
      change: calculateChange(data.totalImpressions, previousData.totalImpressions),
      icon: <Eye className="w-5 h-5" />,
      color: "purple",
      description: "Total de visualizações"
    },
    {
      title: "Cliques",
      value: formatNumber(data.totalClicks),
      change: calculateChange(data.totalClicks, previousData.totalClicks),
      icon: <MousePointer className="w-5 h-5" />,
      color: "orange",
      description: "Total de cliques nos anúncios"
    },
    {
      title: "CTR",
      value: `${data.ctr.toFixed(2)}%`,
      change: calculateChange(data.ctr, previousData.ctr),
      icon: <Percent className="w-5 h-5" />,
      color: "indigo",
      description: "Taxa de cliques"
    },
    {
      title: "CPC",
      value: formatCurrency(data.cpc),
      change: calculateChange(data.cpc, previousData.cpc),
      icon: <BarChart3 className="w-5 h-5" />,
      color: "pink",
      description: "Custo por clique",
      invertChange: true // Para CPC, menor é melhor
    },
    {
      title: "Conversões",
      value: formatNumber(data.totalConversions),
      change: calculateChange(data.totalConversions, previousData.totalConversions),
      icon: <Target className="w-5 h-5" />,
      color: "emerald",
      description: "Total de conversões"
    },
    {
      title: "Taxa de Conversão",
      value: `${data.conversionRate.toFixed(1)}%`,
      change: calculateChange(data.conversionRate, previousData.conversionRate),
      icon: <Zap className="w-5 h-5" />,
      color: "yellow",
      description: "Conversões por clique"
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: "text-blue-600 bg-blue-100",
      green: "text-green-600 bg-green-100",
      purple: "text-purple-600 bg-purple-100",
      orange: "text-orange-600 bg-orange-100",
      indigo: "text-indigo-600 bg-indigo-100",
      pink: "text-pink-600 bg-pink-100",
      emerald: "text-emerald-600 bg-emerald-100",
      yellow: "text-yellow-600 bg-yellow-100"
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        const isPositiveChange = kpi.invertChange ? 
          !kpi.change.isPositive : kpi.change.isPositive;
        
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {kpi.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${getColorClasses(kpi.color)}`}>
                  {kpi.icon}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900">
                  {kpi.value}
                </div>
                
                <div className="flex items-center space-x-2">
                  {kpi.change.value > 0 && (
                    <>
                      {isPositiveChange ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${
                        isPositiveChange ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {kpi.change.value.toFixed(1)}%
                      </span>
                    </>
                  )}
                  <span className="text-xs text-gray-500">vs período anterior</span>
                </div>
                
                <p className="text-xs text-gray-500 mt-1">
                  {kpi.description}
                </p>

                {/* Barra de performance relativa */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Performance</span>
                    <span>
                      {kpi.title === 'ROAS' && data.roas >= 4 ? 'Excelente' :
                       kpi.title === 'ROAS' && data.roas >= 3 ? 'Boa' :
                       kpi.title === 'CTR' && data.ctr >= 3 ? 'Acima da média' :
                       kpi.title === 'Taxa de Conversão' && data.conversionRate >= 1.5 ? 'Boa' :
                       'Média'}
                    </span>
                  </div>
                  <Progress 
                    value={
                      kpi.title === 'ROAS' ? Math.min((data.roas / 5) * 100, 100) :
                      kpi.title === 'CTR' ? Math.min((data.ctr / 5) * 100, 100) :
                      kpi.title === 'Taxa de Conversão' ? Math.min((data.conversionRate / 3) * 100, 100) :
                      75
                    } 
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}