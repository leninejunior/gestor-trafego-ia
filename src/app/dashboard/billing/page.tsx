"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  CreditCard,
  ArrowLeft,
  Check,
  Crown,
  Calendar,
  Users,
  Building2,
  Zap,
  Plus,
  Trash2
} from "lucide-react";

interface PlanLimits {
  max_clients: number;
  max_campaigns: number;
  max_users: number;
  features: {
    advancedAnalytics: boolean;
    customReports: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    prioritySupport: boolean;
  };
}

interface Usage {
  clients: number;
  campaigns: number;
  users: number;
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [usage, setUsage] = useState<Usage>({ clients: 0, campaigns: 0, users: 0 });
  const [canAddClients, setCanAddClients] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Carregar dados reais dos limites do plano
  useEffect(() => {
    const loadPlanData = async () => {
      try {
        setLoading(true);
        
        const response = await fetch('/api/plan-limits');
        if (response.ok) {
          const data = await response.json();
          setPlanLimits(data.limits);
          setUsage(data.usage);
          setCanAddClients(data.canAddClients);
          setWarnings(data.warnings);
        } else {
          console.error('Erro ao carregar dados do plano');
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlanData();
  }, []);

  const handleUpgrade = async (planId: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Erro: ${error.error || 'Falha ao fazer upgrade'}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      alert(`Sucesso! ${data.message}`);
      
      // Recarregar dados do plano
      const planResponse = await fetch('/api/plan-limits');
      if (planResponse.ok) {
        const planData = await planResponse.json();
        setPlanLimits(planData.limits);
        setUsage(planData.usage);
        setCanAddClients(planData.canAddClients);
        setWarnings(planData.warnings);
      }
    } catch (error) {
      console.error('Erro ao fazer upgrade:', error);
      alert('Erro ao processar upgrade');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (confirm("Tem certeza que deseja cancelar sua assinatura?")) {
      alert("Funcionalidade de cancelamento será implementada em breve!");
    }
  };

  const handleAddCard = async () => {
    alert("Funcionalidade de adicionar cartão será implementada em breve!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!planLimits) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">Erro ao carregar informações do plano</p>
          <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
        </div>
      </div>
    );
  }

  // Calcular percentuais de uso
  const clientsUsage = planLimits.max_clients === -1 ? 0 : (usage.clients / planLimits.max_clients) * 100;
  const campaignsUsage = planLimits.max_campaigns === -1 ? 0 : (usage.campaigns / planLimits.max_campaigns) * 100;
  const usersUsage = planLimits.max_users === -1 ? 0 : (usage.users / planLimits.max_users) * 100;

  // Determinar nome do plano baseado nos limites
  const getPlanName = () => {
    if (planLimits.max_clients === 1) return "Básico";
    if (planLimits.max_clients === 10) return "Pro";
    if (planLimits.max_clients === -1) return "Enterprise";
    return "Personalizado";
  };

  const getPlanPrice = () => {
    const planName = getPlanName();
    switch (planName) {
      case "Básico": return "49.90";
      case "Pro": return "99.90";
      case "Enterprise": return "199.90";
      default: return "0.00";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos e Cobrança</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie sua assinatura e acompanhe o uso dos recursos
          </p>
        </div>
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Cobrança
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="relative overflow-hidden">
            {getPlanName() !== 'Básico' && (
              <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-400 to-orange-500 text-white px-3 py-1 text-xs font-medium">
                <Crown className="w-3 h-3 inline mr-1" />
                Premium
              </div>
            )}

            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <CreditCard className="h-5 w-5" />
                    Plano Atual: {getPlanName()}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Seu plano atual com recursos {getPlanName().toLowerCase()}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <Badge variant="default" className="mb-2">
                    Ativo
                  </Badge>
                  <div className="text-2xl font-bold">R$ {getPlanPrice()}</div>
                  <div className="text-sm text-muted-foreground">/mês</div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Usage Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Clientes</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage.clients} / {planLimits.max_clients === -1 ? '∞' : planLimits.max_clients}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${clientsUsage > 80 ? 'bg-orange-500' : 'bg-blue-600'}`}
                      style={{ width: `${Math.min(clientsUsage, 100)}%` }}
                    ></div>
                  </div>
                  {clientsUsage > 80 && (
                    <p className="text-xs text-orange-600">Próximo do limite</p>
                  )}
                  {!canAddClients && (
                    <p className="text-xs text-red-600">Limite atingido - Faça upgrade!</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Campanhas</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage.campaigns} / {planLimits.max_campaigns === -1 ? '∞' : planLimits.max_campaigns}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${campaignsUsage > 80 ? 'bg-orange-500' : 'bg-blue-600'}`}
                      style={{ width: planLimits.max_campaigns === -1 ? '20%' : `${Math.min(campaignsUsage, 100)}%` }}
                    ></div>
                  </div>
                  {campaignsUsage > 80 && planLimits.max_campaigns !== -1 && (
                    <p className="text-xs text-orange-600">Próximo do limite</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Usuários</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage.users} / {planLimits.max_users === -1 ? '∞' : planLimits.max_users}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${usersUsage > 80 ? 'bg-orange-500' : 'bg-blue-600'}`}
                      style={{ width: `${Math.min(usersUsage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Plan Features */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Recursos do Plano</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${planLimits.features.advancedAnalytics ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className={planLimits.features.advancedAnalytics ? "" : "text-muted-foreground line-through"}>
                      Analytics Avançados
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${planLimits.features.customReports ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className={planLimits.features.customReports ? "" : "text-muted-foreground line-through"}>
                      Relatórios Personalizados
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${planLimits.features.apiAccess ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className={planLimits.features.apiAccess ? "" : "text-muted-foreground line-through"}>
                      Acesso à API
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${planLimits.features.whiteLabel ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className={planLimits.features.whiteLabel ? "" : "text-muted-foreground line-through"}>
                      White Label
                    </span>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-medium text-orange-800 mb-2">⚠️ Atenção aos Limites</h4>
                  <p className="text-sm text-orange-700">
                    Você está próximo do limite em: {warnings.join(', ')}. 
                    Considere fazer upgrade do seu plano.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button onClick={() => handleUpgrade('Enterprise')} className="flex-1">
                  {getPlanName() === 'Enterprise' ? 'Plano Máximo' : 'Fazer Upgrade'}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar Assinatura
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plano Básico */}
            <Card className={`relative ${getPlanName() === 'Básico' ? 'border-blue-500' : ''}`}>
              {getPlanName() === 'Básico' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                  Atual
                </div>
              )}
              <CardHeader>
                <CardTitle>Básico</CardTitle>
                <CardDescription>Para pequenas empresas</CardDescription>
                <div className="text-2xl font-bold">R$ 49,90/mês</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mb-4">
                  <li>• Até 1 cliente</li>
                  <li>• Até 3 campanhas</li>
                  <li>• Relatórios básicos</li>
                </ul>
                <Button 
                  className="w-full" 
                  disabled={getPlanName() === 'Básico'}
                  onClick={() => handleUpgrade('Basic')}
                >
                  {getPlanName() === 'Básico' ? 'Plano Atual' : 'Escolher Plano'}
                </Button>
              </CardContent>
            </Card>

            {/* Plano Pro */}
            <Card className={`relative ${getPlanName() === 'Pro' ? 'border-blue-500' : ''}`}>
              {getPlanName() === 'Pro' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                  Atual
                </div>
              )}
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>Para agências em crescimento</CardDescription>
                <div className="text-2xl font-bold">R$ 99,90/mês</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mb-4">
                  <li>• Até 10 clientes</li>
                  <li>• Campanhas ilimitadas</li>
                  <li>• Analytics avançados</li>
                  <li>• Relatórios personalizados</li>
                  <li>• Acesso à API</li>
                </ul>
                <Button 
                  className="w-full" 
                  disabled={getPlanName() === 'Pro'}
                  onClick={() => handleUpgrade('Pro')}
                >
                  {getPlanName() === 'Pro' ? 'Plano Atual' : 'Escolher Plano'}
                </Button>
              </CardContent>
            </Card>

            {/* Plano Enterprise */}
            <Card className={`relative ${getPlanName() === 'Enterprise' ? 'border-blue-500' : ''}`}>
              {getPlanName() === 'Enterprise' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                  Atual
                </div>
              )}
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <CardDescription>Para grandes agências</CardDescription>
                <div className="text-2xl font-bold">R$ 199,90/mês</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mb-4">
                  <li>• Clientes ilimitados</li>
                  <li>• Campanhas ilimitadas</li>
                  <li>• Todos os recursos Pro</li>
                  <li>• White label</li>
                  <li>• Suporte prioritário</li>
                </ul>
                <Button 
                  className="w-full" 
                  disabled={getPlanName() === 'Enterprise'}
                  onClick={() => handleUpgrade('Enterprise')}
                >
                  {getPlanName() === 'Enterprise' ? 'Plano Atual' : 'Fazer Upgrade'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Cobrança</CardTitle>
              <CardDescription>Suas faturas e pagamentos anteriores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Funcionalidade de histórico de cobrança será implementada em breve.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Métodos de Pagamento</CardTitle>
                  <CardDescription>Gerencie seus cartões e formas de pagamento</CardDescription>
                </div>
                <Button onClick={handleAddCard}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cartão
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Funcionalidade de métodos de pagamento será implementada em breve.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}