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
import { BudgetEditDialog } from "./budget-edit-dialog";
import { AdSetsList } from "./adsets-list";
import { Play, Pause, DollarSign, ChevronDown, ChevronRight } from "lucide-react";

interface CampaignsListProps {
  clientId: string;
  adAccountId: string;
}

export function CampaignsList({ clientId, adAccountId }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MetaCampaign | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());

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

  const handleToggleStatus = async (campaign: MetaCampaign) => {
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setUpdatingStatus(campaign.id);

    console.log('🔄 Alterando status da campanha:', {
      campaignId: campaign.id,
      currentStatus: campaign.status,
      newStatus,
      clientId,
      adAccountId
    });

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: newStatus,
          clientId,
          adAccountId
        })
      });

      const data = await response.json();

      console.log('📊 Resposta da API:', { status: response.status, data });

      if (response.ok) {
        toast.success(data.message);
        fetchCampaigns(); // Recarregar lista
      } else {
        console.error('❌ Erro ao atualizar status:', data);
        toast.error(data.error || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('💥 Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleEditBudget = (campaign: MetaCampaign) => {
    // Adicionar clientId e adAccountId à campanha para o diálogo
    const campaignWithContext = {
      ...campaign,
      clientId,
      adAccountId
    } as any;
    setSelectedCampaign(campaignWithContext);
    setBudgetDialogOpen(true);
  };

  const toggleCampaignExpansion = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
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
            <>
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCampaignExpansion(campaign.id)}
                      className="h-6 w-6 p-0"
                    >
                      {expandedCampaigns.has(campaign.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    {campaign.name}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                <TableCell>{campaign.objective}</TableCell>
                <TableCell>{formatCurrency(campaign.daily_budget)}</TableCell>
                <TableCell>
                  {new Date(campaign.created_time).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant={campaign.status === 'ACTIVE' ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleStatus(campaign)}
                      disabled={updatingStatus === campaign.id}
                    >
                      {updatingStatus === campaign.id ? (
                        'Atualizando...'
                      ) : campaign.status === 'ACTIVE' ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditBudget(campaign)}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Orçamento
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedCampaigns.has(campaign.id) && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <AdSetsList 
                      campaignId={campaign.id} 
                      campaignName={campaign.name}
                    />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      {selectedCampaign && (
        <BudgetEditDialog
          open={budgetDialogOpen}
          onOpenChange={setBudgetDialogOpen}
          itemId={selectedCampaign.id}
          itemName={selectedCampaign.name}
          itemType="campaign"
          currentDailyBudget={selectedCampaign.daily_budget}
          currentLifetimeBudget={selectedCampaign.lifetime_budget}
          clientId={clientId}
          adAccountId={adAccountId}
          onSuccess={fetchCampaigns}
        />
      )}
    </div>
  );
}