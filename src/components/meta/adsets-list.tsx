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
import { toast } from "sonner";
import { BudgetEditDialog } from "./budget-edit-dialog";
import { Play, Pause, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { AdsList } from "./ads-list";

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  created_time: string;
}

interface AdSetsListProps {
  campaignId: string;
  campaignName: string;
  clientId?: string;
  adAccountId?: string;
}

export function AdSetsList({ campaignId, campaignName, clientId, adAccountId }: AdSetsListProps) {
  const [adsets, setAdsets] = useState<MetaAdSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedAdSet, setSelectedAdSet] = useState<MetaAdSet | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAdSets();
  }, [campaignId]);

  const toggleAdSetExpansion = (adsetId: string) => {
    setExpandedAdSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(adsetId)) {
        newSet.delete(adsetId);
      } else {
        newSet.add(adsetId);
      }
      return newSet;
    });
  };

  const fetchAdSets = async () => {
    setIsLoading(true);
    console.log('🔍 [ADSETS LIST] Buscando conjuntos para campanha:', campaignId);
    try {
      let url = `/api/meta/adsets?campaignId=${campaignId}`;
      if (clientId && adAccountId) {
        url += `&clientId=${clientId}&adAccountId=${adAccountId}`;
      }
      console.log('🔗 [ADSETS LIST] URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 [ADSETS LIST] Resposta:', { status: response.status, data });

      if (response.ok) {
        setAdsets(data.adsets || []);
        console.log('✅ [ADSETS LIST] Conjuntos carregados:', data.adsets?.length || 0);
      } else {
        console.error('❌ [ADSETS LIST] Erro:', data.error);
        toast.error(data.error || 'Erro ao carregar conjuntos de anúncios');
      }
    } catch (error) {
      console.error('Erro ao carregar adsets:', error);
      toast.error('Erro ao carregar conjuntos de anúncios');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (adset: MetaAdSet) => {
    const newStatus = adset.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setUpdatingStatus(adset.id);

    console.log('🔄 Alterando status do adset:', {
      adsetId: adset.id,
      currentStatus: adset.status,
      newStatus
    });

    try {
      const response = await fetch(`/api/adsets/${adset.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      console.log('📊 Resposta da API:', { status: response.status, data });

      if (response.ok) {
        toast.success(data.message);
        fetchAdSets();
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

  const handleEditBudget = (adset: MetaAdSet) => {
    setSelectedAdSet(adset);
    setBudgetDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      ACTIVE: { label: 'Ativo', variant: 'default' as const },
      PAUSED: { label: 'Pausado', variant: 'secondary' as const },
      DELETED: { label: 'Excluído', variant: 'destructive' as const },
      ARCHIVED: { label: 'Arquivado', variant: 'outline' as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { 
      label: status, 
      variant: 'outline' as const 
    };
    
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
    return (
      <div className="ml-8 mt-2 border-l-2 border-gray-200 pl-4">
        <div className="text-center py-4 text-sm text-gray-500">
          Carregando conjuntos...
        </div>
      </div>
    );
  }

  if (adsets.length === 0) {
    return (
      <div className="ml-8 mt-2 border-l-2 border-gray-200 pl-4">
        <div className="text-center py-4 text-sm text-gray-500">
          Nenhum conjunto de anúncios encontrado
        </div>
      </div>
    );
  }

  return (
    <div className="ml-8 mt-2 border-l-2 border-gray-200 pl-4">
      <div className="mb-2 text-sm font-medium text-gray-700">
        Conjuntos de Anúncios ({campaignName})
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Orçamento Diário</TableHead>
            <TableHead>Objetivo</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adsets.map((adset) => (
            <React.Fragment key={adset.id}>
              <TableRow>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAdSetExpansion(adset.id)}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                      title={expandedAdSets.has(adset.id) ? "Colapsar" : "Expandir"}
                    >
                      {expandedAdSets.has(adset.id) ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </Button>
                    {adset.name}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(adset.status)}</TableCell>
                <TableCell>{formatCurrency(adset.daily_budget)}</TableCell>
                <TableCell>{adset.optimization_goal || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant={adset.status === 'ACTIVE' ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleStatus(adset)}
                      disabled={updatingStatus === adset.id}
                    >
                      {updatingStatus === adset.id ? (
                        'Atualizando...'
                      ) : adset.status === 'ACTIVE' ? (
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
                      onClick={() => handleEditBudget(adset)}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Orçamento
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedAdSets.has(adset.id) && (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <AdsList 
                      adsetId={adset.id} 
                      adsetName={adset.name}
                      clientId={clientId}
                      adAccountId={adAccountId}
                    />
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      {selectedAdSet && (
        <BudgetEditDialog
          open={budgetDialogOpen}
          onOpenChange={setBudgetDialogOpen}
          itemId={selectedAdSet.id}
          itemName={selectedAdSet.name}
          itemType="adset"
          currentDailyBudget={selectedAdSet.daily_budget}
          currentLifetimeBudget={selectedAdSet.lifetime_budget}
          onSuccess={fetchAdSets}
        />
      )}
    </div>
  );
}
