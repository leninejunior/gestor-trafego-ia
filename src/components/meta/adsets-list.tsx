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

interface AdSetInsights {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  ctr: string;
  cpc: string;
  cpm: string;
  frequency: string;
  actions?: any[];
  cost_per_action_type?: any[];
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  created_time: string;
  insights?: AdSetInsights | null;
}

interface AdSetsListProps {
  campaignId: string;
  campaignName: string;
  clientId?: string;
  adAccountId?: string;
  dateRange?: { since: string; until: string };
}

export function AdSetsList({ campaignId, campaignName, clientId, adAccountId, dateRange }: AdSetsListProps) {
  const [adsets, setAdsets] = useState<MetaAdSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedAdSet, setSelectedAdSet] = useState<MetaAdSet | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [showOnlyWithResults, setShowOnlyWithResults] = useState(false);

  useEffect(() => {
    fetchAdSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, dateRange?.since, dateRange?.until]);

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
    console.log('🔍 [ADSETS LIST] Parâmetros:', { clientId, adAccountId, dateRange });
    
    try {
      let url = `/api/meta/adsets?campaignId=${campaignId}`;
      if (clientId && adAccountId) {
        url += `&clientId=${clientId}&adAccountId=${adAccountId}`;
      }
      if (dateRange) {
        url += `&since=${dateRange.since}&until=${dateRange.until}`;
      }
      console.log('🔗 [ADSETS LIST] URL completa:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 [ADSETS LIST] Resposta completa:', { 
        status: response.status, 
        ok: response.ok,
        dataKeys: Object.keys(data),
        adsetsCount: data.adsets?.length || 0,
        data 
      });

      if (response.ok) {
        const adsetsData = data.adsets || [];
        setAdsets(adsetsData);
        console.log('✅ [ADSETS LIST] Conjuntos carregados:', adsetsData.length);
        
        // Debug detalhado de cada conjunto
        adsetsData.forEach((adset: any, index: number) => {
          console.log(`🔍 [ADSETS LIST] Conjunto ${index + 1}:`, {
            id: adset.id,
            name: adset.name,
            status: adset.status,
            hasInsights: !!adset.insights,
            insightsKeys: adset.insights ? Object.keys(adset.insights) : [],
            spend: adset.insights?.spend,
            impressions: adset.insights?.impressions,
            clicks: adset.insights?.clicks
          });
        });
      } else {
        console.error('❌ [ADSETS LIST] Erro na resposta:', data.error);
        toast.error(data.error || 'Erro ao carregar conjuntos de anúncios');
        setAdsets([]);
      }
    } catch (error) {
      console.error('💥 [ADSETS LIST] Erro na requisição:', error);
      toast.error('Erro ao carregar conjuntos de anúncios');
      setAdsets([]);
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

  const formatCurrency = (value: string | undefined, divideBy100 = true) => {
    if (value === undefined || value === null || value === '') return 'R$ 0,00';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(divideBy100 ? numValue / 100 : numValue);
  };

  const formatNumber = (value: string | undefined) => {
    if (value === undefined || value === null || value === '') return '0';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '0';
    return new Intl.NumberFormat('pt-BR').format(numValue);
  };

  const formatPercent = (value: string | undefined) => {
    if (value === undefined || value === null || value === '') return '0,00%';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '0,00%';
    return `${numValue.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="ml-8 mt-2 border-l-2 border-border pl-4">
        <div className="text-center py-4 text-sm text-muted-foreground">
          Carregando conjuntos...
        </div>
      </div>
    );
  }

  if (adsets.length === 0) {
    return (
      <div className="ml-8 mt-2 border-l-2 border-border pl-4">
        <div className="text-center py-4 text-sm text-muted-foreground">
          Nenhum conjunto de anúncios encontrado
        </div>
      </div>
    );
  }

  // Filtrar conjuntos com resultados se necessário
  const filteredAdSets = showOnlyWithResults 
    ? adsets.filter(adset => {
        const insights = adset.insights;
        return insights && (
          parseFloat(insights.impressions || '0') > 0 ||
          parseFloat(insights.clicks || '0') > 0 ||
          parseFloat(insights.spend || '0') > 0
        );
      })
    : adsets;

  return (
    <div className="ml-8 mt-2 border-l-2 border-border pl-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          Conjuntos de Anúncios ({filteredAdSets.length}{showOnlyWithResults ? ` de ${adsets.length}` : ''}) - {campaignName}
        </div>
        <Button
          onClick={() => setShowOnlyWithResults(!showOnlyWithResults)}
          variant={showOnlyWithResults ? "default" : "outline"}
          size="sm"
        >
          {showOnlyWithResults ? "Mostrar Todos" : "Apenas com Resultados"}
        </Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Gasto</TableHead>
            <TableHead className="text-right">Impressões</TableHead>
            <TableHead className="text-right">Cliques</TableHead>
            <TableHead className="text-right">CTR</TableHead>
            <TableHead className="text-right">CPC</TableHead>
            <TableHead className="text-right">Alcance</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAdSets.map((adset) => {
            const insights = adset.insights;
            return (
              <React.Fragment key={adset.id}>
                <TableRow className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAdSetExpansion(adset.id)}
                        className="h-8 w-8 p-0 hover:bg-muted"
                        title={expandedAdSets.has(adset.id) ? "Colapsar" : "Expandir"}
                      >
                        {expandedAdSets.has(adset.id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </Button>
                      <div>
                        <div className="font-medium text-sm">{adset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {adset.optimization_goal || '-'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(adset.status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {insights && parseFloat(insights.spend || '0') > 0 ? (
                      formatCurrency(insights.spend, false)
                    ) : (
                      <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado. Tente um período maior ou verifique se o conjunto está ativo.">
                        Sem dados
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {insights && parseFloat(insights.impressions || '0') > 0 ? (
                      formatNumber(insights.impressions)
                    ) : (
                      <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {insights && parseFloat(insights.clicks || '0') > 0 ? (
                      formatNumber(insights.clicks)
                    ) : (
                      <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {insights && parseFloat(insights.ctr || '0') > 0 ? (
                      formatPercent(insights.ctr)
                    ) : (
                      <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {insights && parseFloat(insights.cpc || '0') > 0 ? (
                      formatCurrency(insights.cpc, false)
                    ) : (
                      <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {insights && parseFloat(insights.reach || '0') > 0 ? (
                      formatNumber(insights.reach)
                    ) : (
                      <span className="text-muted-foreground text-xs" title="Sem dados no período selecionado">-</span>
                    )}
                  </TableCell>
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
                    <TableCell colSpan={9} className="p-0">
                      <AdsList 
                        adsetId={adset.id} 
                        adsetName={adset.name}
                        clientId={clientId}
                        adAccountId={adAccountId}
                        dateRange={dateRange}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
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
          clientId={clientId}
          adAccountId={adAccountId}
          onSuccess={fetchAdSets}
        />
      )}
    </div>
  );
}
