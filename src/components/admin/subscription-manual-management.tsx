'use client';

// Forçar recompilação - timestamp: 2025-01-27 21:45

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings,
  Edit,
  Clock,
  CheckCircle,
  Calendar,
  Users,
  RefreshCw,
  Search
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface Organization {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  subscription?: {
    id: string;
    status: string;
    billing_cycle: string;
    current_period_start: string;
    current_period_end: string;
    plan_id: string;
    subscription_plans: {
      id: string;
      name: string;
      monthly_price: number;
      annual_price: number;
    };
  } | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  features: string[];
  max_clients: number;
  max_campaigns: number;
  is_active: boolean;
}

interface AuditLog {
  id: string;
  subscription_id: string;
  organization?: {
    id: string;
    name: string;
  } | null;
  admin_user: {
    id: string;
    email: string;
    full_name: string;
  };
  action_type: string;
  reason: string;
  notes?: string;
  previous_data: any;
  new_data: any;
  effective_date: string;
  created_at: string;
}

interface AdjustmentFormData {
  adjustmentType: 'plan_change' | 'manual_approval' | 'billing_adjustment' | 'status_change';
  newPlanId?: string;
  reason: string;
  notes?: string;
  effectiveDate?: string;
  amount?: number;
  billingCycle?: 'monthly' | 'annual';
}

interface AdjustmentFormProps {
  organization: Organization | null;
  plans: Plan[];
  onSubmit: (data: AdjustmentFormData) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function AdjustmentForm({ organization, plans, onSubmit, onCancel, submitting }: AdjustmentFormProps) {
  const [formData, setFormData] = useState<AdjustmentFormData>({
    adjustmentType: 'plan_change',
    reason: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.reason.trim()) {
      alert('Motivo é obrigatório');
      return;
    }

    if (formData.adjustmentType === 'plan_change' && !formData.newPlanId) {
      alert('Selecione um plano');
      return;
    }

    if (formData.adjustmentType === 'billing_adjustment' && !formData.amount) {
      alert('Valor do ajuste é obrigatório');
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="adjustmentType">Tipo de Ajuste</Label>
        <Select
          value={formData.adjustmentType}
          onValueChange={(value: AdjustmentFormData['adjustmentType']) => 
            setFormData(prev => ({ ...prev, adjustmentType: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plan_change">Mudança de Plano</SelectItem>
            <SelectItem value="manual_approval">Aprovação Manual</SelectItem>
            <SelectItem value="billing_adjustment">Ajuste de Cobrança</SelectItem>
            <SelectItem value="status_change">Mudança de Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.adjustmentType === 'plan_change' && (
        <div>
          <Label htmlFor="newPlanId">Novo Plano</Label>
          <Select
            value={formData.newPlanId || ''}
            onValueChange={(value) => 
              setFormData(prev => ({ ...prev, newPlanId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name} - {formatCurrency(plan.monthly_price)}/mês
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.adjustmentType === 'plan_change' && formData.newPlanId && (
        <div>
          <Label htmlFor="billingCycle">Ciclo de Cobrança</Label>
          <Select
            value={formData.billingCycle || 'monthly'}
            onValueChange={(value: 'monthly' | 'annual') => 
              setFormData(prev => ({ ...prev, billingCycle: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="annual">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.adjustmentType === 'billing_adjustment' && (
        <div>
          <Label htmlFor="amount">Valor do Ajuste (R$)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.amount || ''}
            onChange={(e) => 
              setFormData(prev => ({ 
                ...prev, 
                amount: parseFloat(e.target.value) || 0 
              }))
            }
          />
        </div>
      )}

      <div>
        <Label htmlFor="reason">Motivo *</Label>
        <Input
          id="reason"
          placeholder="Descreva o motivo do ajuste"
          value={formData.reason}
          onChange={(e) => 
            setFormData(prev => ({ ...prev, reason: e.target.value }))
          }
          required
        />
      </div>

      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          placeholder="Observações adicionais (opcional)"
          value={formData.notes}
          onChange={(e) => 
            setFormData(prev => ({ ...prev, notes: e.target.value }))
          }
        />
      </div>

      <div>
        <Label htmlFor="effectiveDate">Data de Vigência</Label>
        <Input
          id="effectiveDate"
          type="date"
          value={formData.effectiveDate || ''}
          onChange={(e) => 
            setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))
          }
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting || !formData.reason.trim()}
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Aplicando...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Aplicar Ajuste
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function SubscriptionManualManagement() {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar organizações com assinaturas
      const orgsResponse = await fetch('/api/admin/subscription-management/organizations');
      const orgsData = await orgsResponse.json();
      
      // Carregar planos disponíveis
      const plansResponse = await fetch('/api/admin/plans');
      const plansData = await plansResponse.json();
      
      // Carregar histórico de auditoria (últimos 50)
      const auditResponse = await fetch('/api/admin/subscriptions/audit-history?limit=50');
      const auditData = await auditResponse.json();
      
      if (orgsData.success && Array.isArray(orgsData.organizations)) {
        setOrganizations(orgsData.organizations);
      } else {
        setOrganizations([]);
      }
      
      if (plansData.success && Array.isArray(plansData.plans)) {
        setPlans(plansData.plans);
      } else {
        setPlans([]);
      }
      
      if (auditData.success && auditData.data?.logs && Array.isArray(auditData.data.logs)) {
        setAuditLogs(auditData.data.logs);
      } else {
        setAuditLogs([]);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setOrganizations([]);
      setPlans([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustment = (org: Organization) => {
    setSelectedOrg(org);
    setShowAdjustmentDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: { label: 'Ativo', variant: 'default' as const },
      inactive: { label: 'Inativo', variant: 'secondary' as const },
      pending: { label: 'Pendente', variant: 'outline' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento Manual de Assinaturas</h1>
          <p className="text-gray-600">Gerencie assinaturas e planos de organizações</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="organizations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organizations">Organizações</TabsTrigger>
          <TabsTrigger value="history">Histórico de Mudanças</TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organizações e Assinaturas</CardTitle>
              <CardDescription>
                Visualize e gerencie as assinaturas das organizações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar organização..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {filteredOrganizations.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhuma organização encontrada</p>
                  </div>
                ) : (
                  filteredOrganizations.map((org) => (
                    <Card key={org.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{org.name || 'Nome não disponível'}</h3>
                            {org.subscription ? (
                              getStatusBadge(org.subscription.status)
                            ) : (
                              <Badge variant="outline">Sem assinatura</Badge>
                            )}
                          </div>
                          
                          {org.subscription?.subscription_plans ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                              <div>
                                <p className="text-sm text-gray-600">Plano Atual</p>
                                <p className="font-medium">{org.subscription.subscription_plans.name}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Ciclo de Cobrança</p>
                                <p className="font-medium">
                                  {org.subscription.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Valor</p>
                                <p className="font-medium">
                                  {formatCurrency(
                                    org.subscription.billing_cycle === 'monthly'
                                      ? org.subscription.subscription_plans.monthly_price
                                      : org.subscription.subscription_plans.annual_price
                                  )}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-600">Esta organização não possui assinatura ativa</p>
                          )}
                        </div>
                        
                        <Button
                          onClick={() => handleAdjustment(org)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Ajustar
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Mudanças</CardTitle>
              <CardDescription>
                Registro de todas as alterações manuais realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhuma alteração registrada</p>
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <Card key={log.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{log.action_type}</Badge>
                            {log.organization && (
                              <span className="text-sm text-gray-600">
                                {log.organization.name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm mb-2">{log.reason}</p>
                          {log.notes && (
                            <p className="text-xs text-gray-600 mb-2">{log.notes}</p>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(log.created_at)}
                          </div>
                          {log.admin_user && (
                            <div className="flex items-center mt-1">
                              <Users className="w-3 h-3 mr-1" />
                              {log.admin_user.full_name || log.admin_user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Ajuste Manual - Funcional */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Assinatura</DialogTitle>
            <DialogDescription>
              {selectedOrg?.name && `Organização: ${selectedOrg.name}`}
            </DialogDescription>
          </DialogHeader>

          <AdjustmentForm 
            organization={selectedOrg}
            plans={plans}
            onSubmit={async (data) => {
              try {
                setSubmitting(true);
                
                const response = await fetch('/api/admin/subscriptions/manual-adjustment', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    organizationId: selectedOrg?.id,
                    ...data
                  }),
                });

                const result = await response.json();

                if (result.success) {
                  alert('Ajuste aplicado com sucesso!');
                  setShowAdjustmentDialog(false);
                  loadData(); // Recarregar dados
                } else {
                  alert(`Erro: ${result.error}`);
                }
              } catch (error) {
                console.error('Erro ao aplicar ajuste:', error);
                alert('Erro ao aplicar ajuste');
              } finally {
                setSubmitting(false);
              }
            }}
            onCancel={() => setShowAdjustmentDialog(false)}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}