"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface BudgetEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  itemType: 'campaign' | 'adset';
  currentDailyBudget?: string;
  currentLifetimeBudget?: string;
  clientId?: string;
  adAccountId?: string;
  onSuccess?: () => void;
}

export function BudgetEditDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemType,
  currentDailyBudget,
  currentLifetimeBudget,
  clientId,
  adAccountId,
  onSuccess
}: BudgetEditDialogProps) {
  const [dailyBudget, setDailyBudget] = useState('');
  const [lifetimeBudget, setLifetimeBudget] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Resetar valores quando o diálogo abrir ou os valores mudarem
  useEffect(() => {
    if (open) {
      const dailyValue = currentDailyBudget ? parseFloat(currentDailyBudget) : NaN;
      const lifetimeValue = currentLifetimeBudget ? parseFloat(currentLifetimeBudget) : NaN;
      
      setDailyBudget(
        !isNaN(dailyValue) ? (dailyValue / 100).toFixed(2) : ''
      );
      setLifetimeBudget(
        !isNaN(lifetimeValue) ? (lifetimeValue / 100).toFixed(2) : ''
      );
    }
  }, [open, currentDailyBudget, currentLifetimeBudget]);

  const handleSubmit = async () => {
    if (!dailyBudget && !lifetimeBudget) {
      toast.error('Informe pelo menos um tipo de orçamento');
      return;
    }

    setIsLoading(true);

    try {
      // Usar rota com query params quando temos clientId e adAccountId
      let endpoint: string;
      if (itemType === 'campaign') {
        endpoint = `/api/campaigns/${itemId}/budget`;
      } else if (clientId && adAccountId) {
        // Rota alternativa para adsets com query params
        endpoint = `/api/meta/adsets/budget?adsetId=${itemId}&clientId=${clientId}&adAccountId=${adAccountId}`;
      } else {
        endpoint = `/api/adsets/${itemId}/budget`;
      }

      const body: any = {};
      if (dailyBudget) body.daily_budget = dailyBudget;
      if (lifetimeBudget) body.lifetime_budget = lifetimeBudget;
      
      // Adicionar contexto para rotas que não usam banco (apenas para rotas antigas)
      if (!clientId || !adAccountId) {
        if (clientId) body.clientId = clientId;
        if (adAccountId) body.adAccountId = adAccountId;
      }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Orçamento atualizado com sucesso!');
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.error || 'Erro ao atualizar orçamento');
      }
    } catch (error) {
      console.error('Erro ao atualizar orçamento:', error);
      toast.error('Erro ao atualizar orçamento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Editar Orçamento {itemType === 'campaign' ? 'da Campanha' : 'do Conjunto'}
          </DialogTitle>
          <DialogDescription>
            {itemName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="daily_budget">
              Orçamento Diário (R$)
            </Label>
            <Input
              id="daily_budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 50.00"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para manter o valor atual
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lifetime_budget">
              Orçamento Total (R$)
            </Label>
            <Input
              id="lifetime_budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 1500.00"
              value={lifetimeBudget}
              onChange={(e) => setLifetimeBudget(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para manter o valor atual
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium mb-1">💡 Dica:</p>
            <p>
              Você pode definir apenas orçamento diário OU orçamento total, 
              ou ambos dependendo da configuração da sua {itemType === 'campaign' ? 'campanha' : 'conjunto'}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
