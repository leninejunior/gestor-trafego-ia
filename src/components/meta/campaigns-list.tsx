"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetaCampaign } from "@/lib/meta/types";
import { toast } from "sonner";

interface CampaignsListProps {
  clientId: string;
  adAccountId: string;
}

export function CampaignsList({ clientId, adAccountId }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, [clientId, adAccountId]);

  const fetchCampaigns = async () => {
    console.log('🚀 [CAMPAIGNS LIST] Iniciando busca de campanhas...');
    console.log('📋 [CAMPAIGNS LIST] Parâmetros:', { clientId, adAccountId });
    
    try {
      const url = `/api/meta/campaigns?clientId=${clientId}&adAccountId=${adAccountId}`;
      console.log('🔗 [CAMPAIGNS LIST] URL da requisição:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 [CAMPAIGNS LIST] Resposta da API:', { 
        status: response.status, 
        data,
        isTestData: data.isTestData 
      });
      
      if (response.ok) {
        setCampaigns(data.campaigns || []);
        
        if (data.isTestData) {
          toast.info(data.message || 'Exibindo dados de teste');
          console.log('🧪 [CAMPAIGNS LIST] Dados de teste carregados');
        } else {
          console.log('✅ [CAMPAIGNS LIST] Dados reais carregados');
        }
      } else {
        console.error('❌ [CAMPAIGNS LIST] Erro na resposta:', data.error);
        toast.error(data.error || 'Erro ao carregar campanhas');
      }
    } catch (error) {
      console.error('💥 [CAMPAIGNS LIST] Erro na requisição:', error);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setIsLoading(false);
      console.log('🏁 [CAMPAIGNS LIST] Busca finalizada');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      ACTIVE: { label: 'Ativa', variant: 'default' as const },
      PAUSED: { label: 'Pausada', variant: 'secondary' as const },
      DELETED: { label: 'Excluída', variant: 'destructive' as const },
      ARCHIVED: { label: 'Arquivada', variant: 'outline' as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatCurrency = (value: string | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(parseFloat(value) / 100);
  };

  if (isLoading) {
    return <div className="text-center py-4">Carregando campanhas...</div>;
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Nenhuma campanha encontrada</p>
        <Button onClick={fetchCampaigns} className="mt-4">
          Recarregar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Campanhas Meta Ads</h3>
        <Button onClick={fetchCampaigns} variant="outline" size="sm">
          Atualizar
        </Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Objetivo</TableHead>
            <TableHead>Orçamento Diário</TableHead>
            <TableHead>Criada em</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>{getStatusBadge(campaign.status)}</TableCell>
              <TableCell>{campaign.objective}</TableCell>
              <TableCell>{formatCurrency(campaign.daily_budget)}</TableCell>
              <TableCell>
                {new Date(campaign.created_time).toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // TODO: Implementar visualização de insights
                    toast.info('Visualização de insights em desenvolvimento');
                  }}
                >
                  Ver Insights
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}