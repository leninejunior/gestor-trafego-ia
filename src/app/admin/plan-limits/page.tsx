'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PlanLimitsForm } from '@/components/admin/plan-limits-form';
import { 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Save,
  AlertTriangle,
  Users,
  Download
} from 'lucide-react';
import { PlanLimits, formatLimit } from '@/lib/types/plan-limits';
import { formatCurrency } from '@/lib/utils/currency';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  is_active: boolean;
}

interface PlanWithLimits extends SubscriptionPlan {
  limits?: PlanLimits;
}

export default function PlanLimitsConfigPage() {
  const [plans, setPlans] = useState<PlanWithLimits[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Modal states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanWithLimits | null>(null);
  const [editedLimits, setEditedLimits] = useState<Partial<PlanLimits>>({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPlansWithLimits();
  }, []);

  const fetchPlansWithLimits = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar planos
      const plansResponse = await fetch('/api/admin/plans', {
        cache: 'no-store',
      });

      if (!plansResponse.ok) {
        throw new Error('Falha ao buscar planos');
      }

      const plansData = await plansResponse.json();
      const plansList: SubscriptionPlan[] = plansData.plans || [];

      // Buscar limites para cada plano
      const plansWithLimits = await Promise.all(
        plansList.map(async (plan) => {
          try {
            const limitsResponse = await fetch(`/api/admin/plans/${plan.id}/limits`, {
              cache: 'no-store',
            });

            if (limitsResponse.ok) {
              const limitsData = await limitsResponse.json();
              return {
                ...plan,
                limits: limitsData.limits,
              };
            }
          } catch (err) {
            console.error(`Erro ao buscar limites do plano ${plan.id}:`, err);
          }

          return plan;
        })
      );

      setPlans(plansWithLimits);
    } catch (err) {
      console.error('Erro ao buscar planos:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar planos');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (plan: PlanWithLimits) => {
    setSelectedPlan(plan);
    setEditedLimits(plan.limits || {});
    setValidationErrors({});
    setIsEditDialogOpen(true);
  };

  const handleSaveClick = () => {
    // Validar antes de abrir confirmação
    const errors = validateLimits(editedLimits);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsEditDialogOpen(false);
    setIsConfirmDialogOpen(true);
  };

  const validateLimits = (limits: Partial<PlanLimits>): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (limits.max_clients !== undefined && limits.max_clients < -1) {
      errors.max_clients = 'Deve ser -1 (ilimitado) ou maior que 0';
    }

    if (limits.max_campaigns_per_client !== undefined && limits.max_campaigns_per_client < -1) {
      errors.max_campaigns_per_client = 'Deve ser -1 (ilimitado) ou maior que 0';
    }

    if (limits.data_retention_days !== undefined) {
      if (limits.data_retention_days < 30 || limits.data_retention_days > 3650) {
        errors.data_retention_days = 'Deve estar entre 30 e 3650 dias';
      }
    }

    if (limits.sync_interval_hours !== undefined) {
      if (limits.sync_interval_hours < 1 || limits.sync_interval_hours > 168) {
        errors.sync_interval_hours = 'Deve estar entre 1 e 168 horas';
      }
    }

    return errors;
  };

  const handleConfirmSave = async () => {
    if (!selectedPlan) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/plans/${selectedPlan.id}/limits`, {
        method: selectedPlan.limits ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedLimits),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao salvar limites');
      }

      setSuccessMessage(`Limites do plano "${selectedPlan.name}" atualizados com sucesso!`);
      await fetchPlansWithLimits();
      setIsConfirmDialogOpen(false);
      setSelectedPlan(null);
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar limites:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar limites');
      setIsConfirmDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Configuração de Limites de Planos
              </h1>
              <p className="text-gray-600 mt-1">
                Configure limites de recursos, cache e exportação para cada plano
              </p>
            </div>
            <Button onClick={fetchPlansWithLimits} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-sm text-green-600 font-medium">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Plans List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {formatCurrency(plan.monthly_price)}/mês
                    </CardDescription>
                  </div>
                  <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                    {plan.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {plan.limits ? (
                  <>
                    {/* Limites de Recursos */}
                    <div className="space-y-2">
                      <div className="flex items-center text-sm font-medium text-gray-700">
                        <Users className="w-4 h-4 mr-2 text-blue-600" />
                        Recursos
                      </div>
                      <div className="pl-6 space-y-1 text-sm text-gray-600">
                        <div>Clientes: {formatLimit(plan.limits.max_clients)}</div>
                        <div>Campanhas: {formatLimit(plan.limits.max_campaigns_per_client)}</div>
                      </div>
                    </div>

                    {/* Cache e Sincronização */}
                    <div className="space-y-2">
                      <div className="flex items-center text-sm font-medium text-gray-700">
                        <Save className="w-4 h-4 mr-2 text-green-600" />
                        Cache
                      </div>
                      <div className="pl-6 space-y-1 text-sm text-gray-600">
                        <div>Retenção: {plan.limits.data_retention_days} dias</div>
                        <div>Sync: {plan.limits.sync_interval_hours}h</div>
                      </div>
                    </div>

                    {/* Exportação */}
                    <div className="space-y-2">
                      <div className="flex items-center text-sm font-medium text-gray-700">
                        <Download className="w-4 h-4 mr-2 text-purple-600" />
                        Exportação
                      </div>
                      <div className="pl-6 space-y-1 text-sm text-gray-600">
                        <div>CSV: {plan.limits.allow_csv_export ? '✓' : '✗'}</div>
                        <div>JSON: {plan.limits.allow_json_export ? '✓' : '✗'}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Limites não configurados
                  </div>
                )}

                <Button
                  onClick={() => openEditDialog(plan)}
                  className="w-full"
                  variant="outline"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configurar Limites
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configurar Limites - {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription>
              Ajuste os limites de recursos, cache e exportação para este plano.
              As alterações serão aplicadas imediatamente para novos usuários.
            </DialogDescription>
          </DialogHeader>

          <PlanLimitsForm
            limits={editedLimits}
            onChange={setEditedLimits}
            errors={validationErrors}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveClick}>
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a atualizar os limites do plano "{selectedPlan?.name}".
              As alterações serão aplicadas imediatamente para novos usuários.
              <br /><br />
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="h-8 bg-gray-200 rounded w-96 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse mt-2"></div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mt-2"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-16 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
