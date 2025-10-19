'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, RefreshCw, Calendar } from "lucide-react";
import { CampaignComparison } from "@/components/reports/campaign-comparison";
import { useClients } from "@/hooks/use-clients";
import { DateRangePicker } from "@/components/campaigns/date-range-picker";

export default function AnalyticsPage() {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [dateRange, setDateRange] = useState('this_month');
  const [refreshKey, setRefreshKey] = useState(0);
  const { clients, isLoading: clientsLoading } = useClients();

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">
          Análise detalhada de performance e métricas das campanhas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Escolha um cliente e período para ver os analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Select value={selectedClient} onValueChange={setSelectedClient} disabled={clientsLoading}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={clientsLoading ? "Carregando clientes..." : "Selecione um cliente"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={!selectedClient}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </CardContent>
      </Card>

      {selectedClient && (
        <CampaignComparison 
          key={`${selectedClient}-${dateRange}-${refreshKey}`}
          clientId={selectedClient} 
        />
      )}

      {!selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle>Selecione um Cliente</CardTitle>
            <CardDescription>
              Escolha um cliente acima para ver os analytics de suas campanhas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Analytics Detalhados
              </h3>
              <p className="text-gray-500 mb-4">
                Visualize métricas em tempo real, compare performance entre campanhas 
                e obtenha insights automáticos para otimizar seus resultados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}