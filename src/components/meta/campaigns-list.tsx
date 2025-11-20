"use client";

import React, { useState, useEffect } from "react";
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
import { Play, Pause, DollarSign, ChevronDown, ChevronRight, Facebook, RefreshCw } from "lucide-react";
import { translateMetaObjective } from "@/lib/utils/meta-translations";

interface CampaignsListProps {
  clientId: string;
  adAccountId?: string;
  campaigns?: any[]; // Campanhas externas (da página de dashboard)
  onRefresh?: () => void; // Callback para refresh externo
}

export function CampaignsList({ clientId, adAccountId, campaigns: externalCampaigns, onRefresh }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(!externalCampaigns);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MetaCampaign | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());

  // Se campanhas externas forem fornecidas, usar elas
  useEffect(() => {
    if (externalCampaigns) {
      // Converter campanhas do dashboard para o formato esperado
      const convertedCampaigns: MetaCampaign[] = externalCampaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status as 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
        objective: c.objective,
        daily_budget: c.daily_budget, // Já vem no formato correto da API
        lifetime_budget: c.lifetime_budget,
        created_time: c.created_time,
        updated_time: c.updated_time || c.created_time
      }));
      setCampaigns(convertedCampaigns);
      setIsLoading(false);
    } else if (adAccountId) {
      fetchCampaigns();
    }
  }, [clientId, adAccountId, externalCampaigns]);

  const fetchCampaigns = async () => {
    // Se há callback externo, usar ele
    if (onRefresh) {
      onRefresh();
      return;
    }

    // Caso contrário, buscar internamente
    if (!adAccountId) return;

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
        // Verificar se requer reconexão
        if (data.requiresReconnection) {
          toast.error(data.message, {
            description: data.detailedMessage,
            action: {
              label: data.actionLabel,
              onClick: () => window.location.href = '/dashboard/clients'
            }
          });
          setCampaigns([]);
          return;
        }
        
        // Não mostrar dados de teste - apenas dados reais
        if (data.isTestData) {
          setCampaigns([]);
          return;
        }
        
        setCampaigns(data.campaigns || []);
        console.log('✅ [CAMPAIGNS LIST] Dados reais carregados');
      } else {
        console.error('❌ [CAMPAIGNS LIST] Erro na resposta:', data.error);
        toast.error(data.error || 'Erro ao carregar campanhas');
        setCampaigns([]);
      }
    } catch (error) {
      console.error('💥 [CAMPAIGNS LIST] Erro na requisição:', error);
      toast.error('Erro ao carregar campanhas');
      setCampaigns([]);
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
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue / 100);
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
        
        // Atualizar localmente
        setCampaigns(prev => prev.map(c => 
          c.id === campaign.id ? { ...c, status: newStatus } : c
        ));
        
        // Se há callback externo, chamar também
        if (onRefresh) {
          onRefresh();
        } else {
          fetchCampaigns();
        }
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
      adAccountId: adAccountId || ''
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
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12z"/>
              </svg>
            </div>
            
            <h3 className="text-xl font-semibold text-blue-800 mb-2">Nenhuma Campanha Encontrada</h3>
            <p className="text-blue-700 mb-4">
              Não encontramos campanhas ativas na sua conta do Meta Ads.
            </p>
            
            <div className="text-left bg-white/50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Possíveis motivos:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-600">
                <li>Sua conta não tem campanhas ativas no momento</li>
                <li>Você pode ter conectado uma conta diferente</li>
                <li>O token de acesso pode ter expirado</li>
              </ul>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => window.location.href = '/dashboard/clients'} 
                variant="default"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reconectar Conta
              </Button>
              <Button 
                onClick={fetchCampaigns} 
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                Tentar Novamente
              </Button>
            </div>
            
            <p className="text-xs text-blue-500 mt-4">
              Ao reconectar, você poderá selecionar contas diferentes ou atualizar as permissões.
            </p>
          </div>
        </div>
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
            <React.Fragment key={campaign.id}>
              <TableRow>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCampaignExpansion(campaign.id)}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                      title={expandedCampaigns.has(campaign.id) ? "Colapsar" : "Expandir"}
                    >
                      {expandedCampaigns.has(campaign.id) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </Button>
                    {campaign.name}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                <TableCell>{translateMetaObjective(campaign.objective)}</TableCell>
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
                      clientId={clientId}
                      adAccountId={adAccountId || ''}
                    />
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
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
          adAccountId={adAccountId || ''}
          onSuccess={fetchCampaigns}
        />
      )}
    </div>
  );
}