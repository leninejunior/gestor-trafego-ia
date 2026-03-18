'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Target } from "lucide-react";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function ROIAnalysis({ data }: ROIAnalysisProps) {
  const estimatedRevenue = data.totalSpend * data.roas;
  const estimatedProfit = estimatedRevenue - data.totalSpend;
  const profitMargin = estimatedRevenue > 0 ? (estimatedProfit / estimatedRevenue) * 100 : 0;
  const costPerConversion = data.totalConversions > 0 ? data.totalSpend / data.totalConversions : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Receita Estimada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <div className="text-2xl font-bold text-green-600">{formatCurrency(estimatedRevenue)}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Baseado no ROAS atual</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Lucro Estimado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(estimatedProfit)}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Margem estimada: {profitMargin.toFixed(2)}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Custo por Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-600" />
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(costPerConversion)}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Com base nas conversões do período</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">ROAS Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">{data.roas.toFixed(2)}x</div>
          <CardDescription className="mt-1 text-xs">
            Retorno por real investido
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
