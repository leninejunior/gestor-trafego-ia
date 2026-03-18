'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  DollarSign,
  Eye,
  MousePointer,
  Target,
  Percent,
  BarChart3,
  Zap,
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

export default function AdvancedKPICards({ data }: AdvancedKPICardsProps) {
  const kpis = [
    {
      title: 'Investimento Total',
      value: formatCurrency(data.totalSpend),
      icon: <DollarSign className="w-5 h-5" />,
      description: 'Gasto total em anúncios',
      color: 'text-blue-600 bg-blue-100',
    },
    {
      title: 'ROAS',
      value: `${data.roas.toFixed(2)}x`,
      icon: <TrendingUp className="w-5 h-5" />,
      description: 'Retorno sobre investimento',
      color: 'text-green-600 bg-green-100',
    },
    {
      title: 'Impressões',
      value: formatNumber(data.totalImpressions),
      icon: <Eye className="w-5 h-5" />,
      description: 'Total de visualizações',
      color: 'text-purple-600 bg-purple-100',
    },
    {
      title: 'Cliques',
      value: formatNumber(data.totalClicks),
      icon: <MousePointer className="w-5 h-5" />,
      description: 'Total de cliques',
      color: 'text-orange-600 bg-orange-100',
    },
    {
      title: 'CTR',
      value: `${data.ctr.toFixed(2)}%`,
      icon: <Percent className="w-5 h-5" />,
      description: 'Taxa de cliques',
      color: 'text-indigo-600 bg-indigo-100',
    },
    {
      title: 'CPC',
      value: formatCurrency(data.cpc),
      icon: <BarChart3 className="w-5 h-5" />,
      description: 'Custo por clique',
      color: 'text-pink-600 bg-pink-100',
    },
    {
      title: 'Conversões',
      value: formatNumber(data.totalConversions),
      icon: <Target className="w-5 h-5" />,
      description: 'Total de conversões',
      color: 'text-emerald-600 bg-emerald-100',
    },
    {
      title: 'Taxa de Conversão',
      value: `${data.conversionRate.toFixed(2)}%`,
      icon: <Zap className="w-5 h-5" />,
      description: 'Conversões por clique',
      color: 'text-yellow-700 bg-yellow-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">{kpi.title}</CardTitle>
              <div className={`p-2 rounded-lg ${kpi.color}`}>{kpi.icon}</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <p className="text-xs text-gray-500 mt-1">{kpi.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
