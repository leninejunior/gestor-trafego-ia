import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { 
  ArrowLeft,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  PieChart,
  Receipt,
  RefreshCw
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AdminBillingPage() {
  const supabase = await createClient();

  // Verificar se é super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Buscar dados financeiros
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select(`
      id,
      status,
      billing_cycle,
      current_period_start,
      current_period_end,
      stripe_customer_id,
      created_at,
      organization_id,
      organizations (
        name
      ),
      subscription_plans!subscriptions_plan_id_fkey (
        name,
        price_monthly,
        price_yearly,
        max_users,
        max_clients,
        max_ad_accounts
      )
    `)
    .order("created_at", { ascending: false });

  // Buscar planos disponíveis
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("price_monthly", { ascending: true });

  // Calcular métricas financeiras
  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];
  const cancelledSubscriptions = subscriptions?.filter(s => s.status === 'cancelled') || [];
  const pastDueSubscriptions = subscriptions?.filter(s => s.status === 'past_due') || [];
  
  const monthlyRevenue = activeSubscriptions.reduce((sum, sub) => 
    sum + (sub.subscription_plans?.[0]?.price_monthly || 0), 0);
  
  const yearlyRevenue = activeSubscriptions.reduce((sum, sub) => 
    sum + (sub.subscription_plans?.[0]?.price_yearly || 0), 0);

  const churnRate = subscriptions?.length ? 
    (cancelledSubscriptions.length / subscriptions.length) * 100 : 0;

  // Agrupar por plano
  const planStats = plans?.map(plan => {
    const planSubs = activeSubscriptions.filter(sub => 
      sub.subscription_plans?.[0]?.name === plan.name
    );
    return {
      ...plan,
      activeCount: planSubs.length,
      revenue: planSubs.length * plan.price_monthly
    };
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Controle Financeiro
                </h1>
                <p className="text-gray-600 mt-1">
                  Assinaturas, receitas e análise financeira
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="destructive">SUPER ADMIN</Badge>
              <Button size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sincronizar Stripe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                Receita Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {monthlyRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                MRR (Monthly Recurring Revenue)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                Receita Anual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {yearlyRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                ARR (Annual Recurring Revenue)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                Assinaturas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
              <p className="text-xs text-muted-foreground">
                Clientes pagantes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingDown className="w-4 h-4 mr-2 text-red-500" />
                Taxa de Churn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {churnRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Cancelamentos vs total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas Financeiros */}
        {(pastDueSubscriptions.length > 0 || churnRate > 10) && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center text-yellow-800">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Alertas Financeiros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pastDueSubscriptions.length > 0 && (
                  <div className="flex items-center space-x-2 text-yellow-700">
                    <XCircle className="w-4 h-4" />
                    <span>{pastDueSubscriptions.length} assinaturas com pagamento em atraso</span>
                  </div>
                )}
                {churnRate > 10 && (
                  <div className="flex items-center space-x-2 text-yellow-700">
                    <TrendingDown className="w-4 h-4" />
                    <span>Taxa de churn alta: {churnRate.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Distribuição por Plano */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="w-5 h-5 mr-2" />
                Distribuição por Plano
              </CardTitle>
              <CardDescription>
                Receita e clientes por tipo de plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {planStats.map((plan) => {
                  const percentage = activeSubscriptions.length ? 
                    (plan.activeCount / activeSubscriptions.length) * 100 : 0;
                  
                  return (
                    <div key={plan.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{plan.name}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            R$ {plan.price_monthly}/mês
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{plan.activeCount} clientes</div>
                          <div className="text-sm text-green-600">
                            R$ {plan.revenue.toFixed(2)}/mês
                          </div>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      <div className="text-xs text-gray-500">
                        {percentage.toFixed(1)}% do total
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Status das Assinaturas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Status das Assinaturas
              </CardTitle>
              <CardDescription>
                Visão geral do status de todas as assinaturas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Ativas</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {activeSubscriptions.length}
                    </div>
                    <div className="text-sm text-green-500">
                      R$ {monthlyRevenue.toFixed(2)}/mês
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium">Canceladas</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-600">
                      {cancelledSubscriptions.length}
                    </div>
                    <div className="text-sm text-red-500">
                      {churnRate.toFixed(1)}% churn
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium">Em Atraso</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-600">
                      {pastDueSubscriptions.length}
                    </div>
                    <div className="text-sm text-yellow-500">
                      Requer atenção
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Assinaturas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="w-5 h-5 mr-2" />
              Todas as Assinaturas
            </CardTitle>
            <CardDescription>
              Lista completa de assinaturas e seus status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Próxima Cobrança</TableHead>
                  <TableHead>Customer ID</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions?.map((subscription) => {
                  const plan = subscription.subscription_plans?.[0];
                  const nextBilling = new Date(subscription.current_period_end);
                  const isExpiringSoon = nextBilling.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
                  
                  return (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {subscription.organizations?.name}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">{plan?.name}</div>
                          <div className="text-sm text-gray-500">
                            {subscription.billing_cycle}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={
                          subscription.status === 'active' ? 'default' :
                          subscription.status === 'past_due' ? 'destructive' :
                          subscription.status === 'cancelled' ? 'secondary' : 'outline'
                        }>
                          {subscription.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {subscription.status === 'past_due' && <XCircle className="w-3 h-3 mr-1" />}
                          {subscription.status === 'cancelled' && <XCircle className="w-3 h-3 mr-1" />}
                          {subscription.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium text-green-600">
                          R$ {plan?.price_monthly?.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">
                          por mês
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className={isExpiringSoon ? 'text-yellow-600' : ''}>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span className="text-sm">
                              {nextBilling.toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          {isExpiringSoon && (
                            <div className="text-xs text-yellow-600">
                              Vence em breve
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {subscription.stripe_customer_id?.slice(0, 12)}...
                        </code>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" size="sm">
                            Ver no Stripe
                          </Button>
                          <Button variant="outline" size="sm">
                            <Link href={`/admin/organizations/${subscription.organization_id}`}>
                              Ver Org
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}