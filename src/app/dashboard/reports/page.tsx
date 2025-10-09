'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Calendar, BarChart3 } from "lucide-react";
import { CampaignSelector } from "@/components/reports/campaign-selector";
import { InsightsChart } from "@/components/reports/insights-chart";
import { PDFGenerator } from "@/components/reports/pdf-generator";
import { ExecutiveSummary } from "@/components/reports/executive-summary";
import { useClients } from "@/hooks/use-clients";

export default function ReportsPage() {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedCampaignName, setSelectedCampaignName] = useState<string>('');
  const [selectedDateRange, setSelectedDateRange] = useState<{ since: string; until: string } | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { clients, isLoading: clientsLoading } = useClients();

  const handleCampaignSelect = async (campaignId: string, dateRange: { since: string; until: string }) => {
    setIsLoading(true);
    setSelectedDateRange(dateRange);
    
    try {
      // Buscar nome da campanha
      const campaignsResponse = await fetch(`/api/meta/campaigns?clientId=${selectedClient}`);
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json();
        const campaign = campaignsData.campaigns?.find((c: any) => c.id === campaignId);
        setSelectedCampaignName(campaign?.name || 'Campanha');
      }

      // Buscar insights
      const response = await fetch(
        `/api/meta/insights?clientId=${selectedClient}&campaignId=${campaignId}&since=${dateRange.since}&until=${dateRange.until}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights[0]); // Pegar o primeiro insight
      } else {
        console.error('Erro ao buscar insights');
      }
    } catch (error) {
      console.error('Erro ao buscar insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-600 mt-1">
          Gere e visualize relatórios detalhados das suas campanhas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar Cliente</CardTitle>
          <CardDescription>
            Primeiro, selecione o cliente para ver suas campanhas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedClient} onValueChange={setSelectedClient} disabled={clientsLoading}>
            <SelectTrigger>
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
        </CardContent>
      </Card>

      {selectedClient && (
        <CampaignSelector
          clientId={selectedClient}
          onCampaignSelect={handleCampaignSelect}
          isLoading={isLoading}
        />
      )}

      {insights && selectedDateRange && (
        <div className="space-y-6">
          <ExecutiveSummary
            insights={insights}
            campaignName={selectedCampaignName}
            dateRange={selectedDateRange}
          />

          <Card>
            <CardHeader>
              <CardTitle>Métricas da Campanha</CardTitle>
              <CardDescription>
                Dados de performance do período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InsightsChart data={insights} isLoading={isLoading} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gerar Relatório</CardTitle>
              <CardDescription>
                Baixe ou compartilhe o relatório da campanha
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PDFGenerator
                insights={insights}
                campaignName={selectedCampaignName}
                clientName={clients.find(c => c.id === selectedClient)?.name || 'Cliente'}
                dateRange={selectedDateRange}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Relatório de Performance
            </CardTitle>
            <CardDescription>
              Análise completa de todas as campanhas ativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={!insights}>
              <Download className="w-4 h-4 mr-2" />
              Gerar Relatório PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Relatório Mensal
            </CardTitle>
            <CardDescription>
              Resumo das atividades do último mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled={!insights}>
              <Download className="w-4 h-4 mr-2" />
              Baixar Excel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Enviar WhatsApp
            </CardTitle>
            <CardDescription>
              Envie o relatório diretamente para o cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled={!insights}>
              Enviar Relatório
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}