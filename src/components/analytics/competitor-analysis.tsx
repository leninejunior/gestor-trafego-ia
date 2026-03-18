'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";

export default function CompetitorAnalysis() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Eye className="w-5 h-5 mr-2" />
          Análise de Concorrentes
        </CardTitle>
        <CardDescription>
          Somente dados reais são exibidos neste módulo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="py-8 text-center text-muted-foreground">
          Não há fonte de dados de concorrência conectada para este painel.
        </div>
      </CardContent>
    </Card>
  );
}
