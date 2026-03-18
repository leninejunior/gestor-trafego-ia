'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function AudienceInsights() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Insights de Audiência
        </CardTitle>
        <CardDescription>
          Este módulo agora exibe apenas dados reais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="py-8 text-center text-muted-foreground">
          Não há integração ativa de audiência para este dashboard no momento.
        </div>
      </CardContent>
    </Card>
  );
}
