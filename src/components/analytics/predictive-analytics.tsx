'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";

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
  const hasData = data.totalSpend > 0 || data.totalImpressions > 0 || data.totalClicks > 0 || data.totalConversions > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="w-5 h-5 mr-2" />
          Analytics Preditivo
        </CardTitle>
        <CardDescription>
          Este módulo opera apenas com dados reais disponíveis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="py-8 text-center text-muted-foreground">
          {hasData
            ? 'Modelos preditivos com dados reais ainda não estão habilitados para este ambiente.'
            : 'Sem dados base suficientes para projeções.'}
        </div>
      </CardContent>
    </Card>
  );
}
