"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  CreditCard, 
  Receipt, 
  AlertTriangle,
  ArrowLeft
} from "lucide-react";

// Import our new subscription components
import { CurrentPlanDisplay } from "@/components/subscription/current-plan-display";
import { PlanComparison } from "@/components/subscription/plan-comparison";
import { BillingHistoryTable } from "@/components/subscription/billing-history-table";
import { PaymentMethodForm } from "@/components/subscription/payment-method-form";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";

// Import subscription hook
import { useSubscription } from "@/hooks/use-subscription";
import { useUser } from "@/hooks/use-user";

interface CancellationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

function CancellationDialog({ open, onOpenChange, onConfirm, loading }: CancellationDialogProps) {
  const [reason, setReason] = useState("");
  const [selectedReason, setSelectedReason] = useState("");

  const predefinedReasons = [
    "Muito caro",
    "Não uso mais",
    "Encontrei uma alternativa melhor",
    "Problemas técnicos",
    "Mudança de estratégia",
    "Outro"
  ];

  const handleConfirm = () => {
    const finalReason = selectedReason === "Outro" ? reason : selectedReason;
    onConfirm(finalReason);
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Cancelar Assinatura
            </CardTitle>
            <CardDescription>
              Lamentamos ver você partir. Sua assinatura permanecerá ativa até o final do período atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Por que está cancelando?</label>
              <div className="mt-2 space-y-2">
                {predefinedReasons.map((reasonOption) => (
                  <label key={reasonOption} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="reason"
                      value={reasonOption}
                      checked={selectedReason === reasonOption}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm">{reasonOption}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === "Outro" && (
              <div>
                <label className="text-sm font-medium">Descreva o motivo:</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-md"
                  rows={3}
                  placeholder="Conte-nos mais sobre sua decisão..."
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="flex-1"
              >
                Manter Assinatura
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirm}
                disabled={loading || !selectedReason}
                className="flex-1"
              >
                {loading ? "Cancelando..." : "Confirmar Cancelamento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [organizationId, setOrganizationId] = useState<string>("");
  const [currentUsage, setCurrentUsage] = useState({
    clients: 0,
    campaigns: 0,
    users: 0
  });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const {
    subscription,
    billingInfo,
    availablePlans,
    loading: subscriptionLoading,
    error,
    refreshSubscription,
    upgradeSubscription,
    cancelSubscription,
  } = useSubscription({ organizationId });

  // Get organization ID and current usage
  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user) return;

      try {
        const supabase = createClient();

        // Get user's organization
        const { data: membership } = await supabase
          .from("memberships")
          .select(`
            organization_id,
            role,
            organizations (
              id,
              name
            )
          `)
          .eq("user_id", user.id)
          .single();

        if (!membership) {
          router.push("/dashboard");
          return;
        }

        setOrganizationId(membership.organization_id);

        // Get current usage
        const [clientsResult, campaignsResult, usersResult] = await Promise.all([
          supabase.from("clients").select("id").eq("organization_id", membership.organization_id),
          supabase.from("campaigns").select("id").eq("organization_id", membership.organization_id),
          supabase.from("memberships").select("id").eq("organization_id", membership.organization_id)
        ]);

        setCurrentUsage({
          clients: clientsResult.data?.length || 0,
          campaigns: campaignsResult.data?.length || 0,
          users: usersResult.data?.length || 0
        });
      } catch (err) {
        console.error("Error fetching organization data:", err);
      }
    };

    if (!userLoading && user) {
      fetchOrganizationData();
    }
  }, [user, userLoading, router]);

  const handlePlanSelect = async (planId: string, billingCycle: 'monthly' | 'annual') => {
    try {
      setUpgrading(true);
      await upgradeSubscription(planId, billingCycle);
      // Show success message or redirect
    } catch (err) {
      console.error("Upgrade error:", err);
      // Show error message
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async (reason: string) => {
    try {
      setCanceling(true);
      await cancelSubscription(reason);
      setShowCancellationDialog(false);
      // Show success message
    } catch (err) {
      console.error("Cancellation error:", err);
      // Show error message
    } finally {
      setCanceling(false);
    }
  };

  if (userLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Planos e Cobrança</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie sua assinatura e acompanhe o uso dos recursos
          </p>
        </div>
        <Card>
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={refreshSubscription} variant="outline">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos e Cobrança</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie sua assinatura e acompanhe o uso dos recursos
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
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
            <Receipt className="h-4 w-4" />
            Cobrança
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {subscription && billingInfo ? (
            <CurrentPlanDisplay
              subscription={subscription}
              billingInfo={billingInfo}
              currentUsage={currentUsage}
              onUpgrade={() => setShowUpgradePrompt(true)}
              onManageBilling={() => setShowCancellationDialog(true)}
            />
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">Nenhuma assinatura ativa encontrada</p>
                <Button onClick={() => setShowUpgradePrompt(true)}>
                  Escolher Plano
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowUpgradePrompt(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Alterar Plano
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowCancellationDialog(true)}
                  disabled={!subscription}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Cancelar Assinatura
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Suporte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Precisa de ajuda com sua assinatura? Entre em contato conosco.
                </p>
                <Button variant="outline" className="w-full">
                  Contatar Suporte
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <PlanComparison
            plans={availablePlans}
            currentPlanId={subscription?.plan_id}
            onSelectPlan={handlePlanSelect}
            loading={upgrading}
          />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <BillingHistoryTable organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <PaymentMethodForm 
            organizationId={organizationId}
            // paymentMethods would be fetched and managed here
          />
        </TabsContent>
      </Tabs>

      {/* Upgrade Prompt Dialog */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        feature="subscription"
        title="Escolher Plano"
        description="Selecione o plano ideal para suas necessidades"
      />

      {/* Cancellation Dialog */}
      <CancellationDialog
        open={showCancellationDialog}
        onOpenChange={setShowCancellationDialog}
        onConfirm={handleCancelSubscription}
        loading={canceling}
      />
    </div>
  );
}