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
import { toast } from "sonner";
import { BudgetEditDialog } from "./budget-edit-dialog";
import { Play, Pause, DollarSign, ChevronDown, ChevronRight } from "lucide-react";

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
}

export function AdSetsList({ campaignId, campaignName }: AdSetsListProps) {
  const [adsets, setAdsets] = useState<MetaAdSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedAdSet, setSelectedAdSet] = useState<MetaAdSet | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isExpanded && adsets.length === 0) {
      fetchAdSets();
    }
  }, [isExpanded]);

  const fetchAdSets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/meta/adsets?campaignId=${campaignId}`);
      const data = await response.json();

      if (response.ok) {
        setAdsets(data.adsets || []);
      } else {
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

    try {
      const response = await fetch(`/api/adsets/${adset.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchAdSets();
      } else {
        toast.error(data.error || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
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

  return (
    <div className="ml-8 mt-2 border-l-2 border-gray-200 pl-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mb-2"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 mr-2" />
        ) : (
          <ChevronRight className="h-4 w-4 mr-2" />
        )}
        Conjuntos de Anúncios ({campaignName})
      </Button>

      {isExpanded && (
        <>
          {isLoading ? (
            <div className="text-center py-4 text-sm text-gray-500">
              Carregando conjuntos...
            </div>
          ) : adsets.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-500">
              Nenhum conjunto de anúncios encontrado
            </div>
          ) : (
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
                  <TableRow key={adset.id}>
                    <TableCell className="font-medium">{adset.name}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          )}

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
        </>
      )}
    </div>
  );
}
