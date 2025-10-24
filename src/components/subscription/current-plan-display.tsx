"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  Calendar, 
  Users, 
  Building2, 
  Zap,
  Check,
  Crown,
  ArrowUpRight
} from "lucide-react";
import { SubscriptionWithPlan, BillingCycleInfo } from "@/lib/types/subscription";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date-formatter";

interface CurrentPlanDisplayProps {
  subscription: SubscriptionWithPlan;
  billingInfo: BillingCycleInfo;
  currentUsage: {
    clients: number;
    campaigns: number;
    users: number;
  };
  onUpgrade?: () => void;
  onManageBilling?: () => void;
}

export function CurrentPlanDisplay({
  subscription,
  billingInfo,
  currentUsage,
  onUpgrade,
  onManageBilling
}: CurrentPlanDisplayProps) {
  const { plan } = subscription;
  const isAnnual = subscription.billing_cycle === 'annual';
  const currentPrice = isAnnual ? plan.annual_price : plan.monthly_price;
  
  // Calculate usage percentages
  const clientsUsage = (currentUsage.clients / plan.max_clients) * 100;
  const campaignsUsage = (currentUsage.campaigns / plan.max_campaigns) * 100;
  const usersUsage = currentUsage.users > 0 ? (currentUsage.users / 10) * 100 : 0; // Assuming max 10 users for display

  // Check if approaching limits
  const isApproachingLimits = clientsUsage > 80 || campaignsUsage > 80;

  return (
    <Card className="relative overflow-hidden">
      {/* Premium plan indicator */}
      {plan.name.toLowerCase() !== 'basic' && (
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
              Plano Atual: {plan.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {plan.description || `Plano ${plan.name} com recursos completos`}
            </CardDescription>
          </div>
          <div className="text-right">
            <Badge 
              variant={subscription.status === 'active' ? 'default' : 'destructive'}
              className="mb-2"
            >
              {subscription.status === 'active' ? 'Ativo' : 
               subscription.status === 'trialing' ? 'Período de Teste' :
               subscription.status === 'past_due' ? 'Pagamento Pendente' : 'Inativo'}
            </Badge>
            <div className="text-2xl font-bold">
              {formatCurrency(currentPrice)}
            </div>
            <div className="text-sm text-muted-foreground">
              /{isAnnual ? 'ano' : 'mês'}
            </div>
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
                {currentUsage.clients} / {plan.max_clients}
              </span>
            </div>
            <Progress 
              value={clientsUsage} 
              className="h-2"
              // Show warning color if approaching limit
              // @ts-ignore - Progress component accepts custom className
              indicatorClassName={clientsUsage > 80 ? "bg-orange-500" : clientsUsage > 95 ? "bg-red-500" : ""}
            />
            {clientsUsage > 80 && (
              <p className="text-xs text-orange-600">
                Próximo do limite
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Campanhas</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {currentUsage.campaigns} / {plan.max_campaigns}
              </span>
            </div>
            <Progress 
              value={campaignsUsage} 
              className="h-2"
              // @ts-ignore
              indicatorClassName={campaignsUsage > 80 ? "bg-orange-500" : campaignsUsage > 95 ? "bg-red-500" : ""}
            />
            {campaignsUsage > 80 && (
              <p className="text-xs text-orange-600">
                Próximo do limite
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Usuários</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {currentUsage.users}
              </span>
            </div>
            <Progress value={usersUsage} className="h-2" />
          </div>
        </div>

        {/* Plan Features */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Recursos do Plano</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className={plan.features.advancedAnalytics ? "" : "text-muted-foreground line-through"}>
                Analytics Avançados
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className={plan.features.customReports ? "" : "text-muted-foreground line-through"}>
                Relatórios Personalizados
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className={plan.features.apiAccess ? "" : "text-muted-foreground line-through"}>
                Acesso à API
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className={plan.features.whiteLabel ? "" : "text-muted-foreground line-through"}>
                White Label
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className={plan.features.prioritySupport ? "" : "text-muted-foreground line-through"}>
                Suporte Prioritário
              </span>
            </div>
          </div>
        </div>

        {/* Billing Information */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Próxima cobrança: {formatDate(billingInfo.next_billing_date)}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {billingInfo.days_until_renewal} dias restantes
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {isApproachingLimits && onUpgrade && (
            <Button onClick={onUpgrade} className="flex-1">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Fazer Upgrade
            </Button>
          )}
          {onManageBilling && (
            <Button 
              variant={isApproachingLimits ? "outline" : "default"} 
              onClick={onManageBilling}
              className={isApproachingLimits ? "" : "flex-1"}
            >
              Gerenciar Cobrança
            </Button>
          )}
        </div>

        {/* Trial Information */}
        {subscription.status === 'trialing' && subscription.trial_end && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-800">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Período de Teste</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Seu período de teste termina em {formatDate(subscription.trial_end)}. 
              Configure um método de pagamento para continuar usando todos os recursos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}