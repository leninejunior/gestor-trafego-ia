import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  Calendar, 
  Users, 
  Building2, 
  Zap,
  Check,
  X
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Buscar organização do usuário
  const { data: membership } = await supabase
    .from("memberships")
    .select(`
      org_id,
      role,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return redirect("/dashboard");
  }

  // Buscar assinatura atual
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(`
      *,
      subscription_plans (
        name,
        description,
        price_monthly,
        price_yearly,
        max_ad_accounts,
        max_users,
        max_clients,
        features
      )
    `)
    .eq("org_id", membership.org_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Buscar todos os planos disponíveis
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("price_monthly");

  // Buscar uso atual
  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("org_id", membership.org_id);

  const { data: adAccounts } = await supabase
    .from("ad_accounts")
    .select("id")
    .eq("org_id", membership.org_id);

  const { data: users } = await supabase
    .from("memberships")
    .select("id")
    .eq("org_id", membership.org_id);

  const currentUsage = {
    clients: clients?.length || 0,
    adAccounts: adAccounts?.length || 0,
    users: users?.length || 0
  };

  const currentPlan = subscription?.subscription_plans;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Planos e Cobrança</h1>
        <p className="text-gray-600 mt-2">
          Gerencie sua assinatura e acompanhe o uso dos recursos
        </p>
      </div>

      {/* Plano Atual */}
      {currentPlan && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Plano Atual: {currentPlan.name}
                </CardTitle>
                <CardDescription>{currentPlan.description}</CardDescription>
              </div>
              <Badge variant={subscription?.status === 'active' ? 'default' : 'destructive'}>
                {subscription?.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Clientes</span>
                  <span className="text-sm text-gray-500">
                    {currentUsage.clients} / {currentPlan.max_clients}
                  </span>
                </div>
                <Progress 
                  value={(currentUsage.clients / currentPlan.max_clients) * 100} 
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Contas de Anúncios</span>
                  <span className="text-sm text-gray-500">
                    {currentUsage.adAccounts} / {currentPlan.max_ad_accounts}
                  </span>
                </div>
                <Progress 
                  value={(currentUsage.adAccounts / currentPlan.max_ad_accounts) * 100} 
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Usuários</span>
                  <span className="text-sm text-gray-500">
                    {currentUsage.users} / {currentPlan.max_users}
                  </span>
                </div>
                <Progress 
                  value={(currentUsage.users / currentPlan.max_users) * 100} 
                  className="h-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  Próxima cobrança: {new Date(subscription?.current_period_end).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  R$ {subscription?.billing_cycle === 'yearly' 
                    ? currentPlan.price_yearly.toFixed(2) 
                    : currentPlan.price_monthly.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  /{subscription?.billing_cycle === 'yearly' ? 'ano' : 'mês'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planos Disponíveis */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Planos Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans?.map((plan) => {
            const isCurrentPlan = currentPlan?.name === plan.name;
            const features = Array.isArray(plan.features) ? plan.features : [];
            
            return (
              <Card key={plan.id} className={`relative ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''}`}>
                {isCurrentPlan && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    Plano Atual
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">
                    {plan.description}
                  </CardDescription>
                  <div className="pt-4">
                    <div className="text-3xl font-bold">
                      R$ {plan.price_monthly.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-500">/mês</div>
                    {plan.price_yearly > 0 && (
                      <div className="text-sm text-green-600 mt-1">
                        R$ {plan.price_yearly.toFixed(0)}/ano (2 meses grátis)
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Clientes</span>
                      <span className="font-medium">{plan.max_clients}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contas de Anúncios</span>
                      <span className="font-medium">{plan.max_ad_accounts}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Usuários</span>
                      <span className="font-medium">{plan.max_users}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      {features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? "outline" : "default"}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? "Plano Atual" : "Escolher Plano"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Histórico de Faturas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Faturas</CardTitle>
          <CardDescription>
            Suas faturas e pagamentos recentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma fatura encontrada</p>
            <p className="text-sm">As faturas aparecerão aqui após o primeiro pagamento</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}