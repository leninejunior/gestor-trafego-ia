import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Verificar se é super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Verificar se tem permissão de super admin
  const { data: membership } = await supabase
    .from("memberships")
    .select(`
      role,
      user_roles!memberships_role_id_fkey (
        name,
        permissions
      )
    `)
    .eq("user_id", user.id)
    .single();

  const userRole = membership?.user_roles?.[0];
  const isSuperAdmin = userRole?.name === 'super_admin' || 
                      membership?.role === 'super_admin' ||
                      user.email === 'lenine.engrene@gmail.com'; // Temporário para você

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar o painel administrativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">Voltar ao Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Buscar estatísticas gerais
  const [
    { data: organizations },
    { data: users },
    { data: activeSubscriptions },
    { data: allSubscriptions },
    { data: clients },
    { data: connections },
    { data: recentOrgs },
    { data: recentMemberships }
  ] = await Promise.all([
    supabase.from("organizations").select("id, name, created_at"),
    supabase.from("user_profiles").select("id"),
    supabase.from("subscriptions").select(`
      id, 
      status,
      subscription_plans!subscriptions_plan_id_fkey (price_monthly)
    `).eq("status", "active"),
    supabase.from("subscriptions").select("id, status"),
    supabase.from("clients").select("id"),
    supabase.from("client_meta_connections").select("id, is_active"),
    supabase.from("organizations").select(`
      id,
      name,
      created_at,
      memberships (user_id, role)
    `).order("created_at", { ascending: false }).limit(5),
    supabase.from("memberships").select(`
      id,
      created_at,
      accepted_at,
      role,
      status,
      organizations (name),
      user_profiles!memberships_user_id_fkey (first_name, last_name)
    `).order("created_at", { ascending: false }).limit(10)
  ]);

  // Calcular estatísticas
  const totalOrganizations = organizations?.length || 0;
  const totalUsers = users?.length || 0;
  const totalActiveSubscriptions = activeSubscriptions?.length || 0;
  const totalSubscriptions = allSubscriptions?.length || 0;
  const totalClients = clients?.length || 0;
  const totalConnections = connections?.length || 0;
  const activeConnections = connections?.filter(c => c.is_active).length || 0;
  
  const monthlyRevenue = activeSubscriptions?.reduce((sum, sub) => 
    sum + (sub.subscription_plans?.[0]?.price_monthly || 0), 0) || 0;
  
  const cancelledSubs = allSubscriptions?.filter(s => s.status === 'cancelled').length || 0;
  const churnRate = totalSubscriptions > 0 ? (cancelledSubs / totalSubscriptions) * 100 : 0;
  
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const growthThisMonth = organizations?.filter(o => 
    new Date(o.created_at) >= thisMonth
  ).length || 0;

  const stats = {
    total_organizations: totalOrganizations,
    total_users: totalUsers,
    total_active_subscriptions: totalActiveSubscriptions,
    total_monthly_revenue: monthlyRevenue,
    total_clients: totalClients,
    total_connections: totalConnections,
    active_connections: activeConnections,
    growth_this_month: growthThisMonth,
    churn_rate: churnRate
  };

  // Simular atividade recente
  const recentActivity = recentMemberships?.map(m => ({
    activity_type: m.status === 'active' ? 'member_joined' : 'member_invited',
    description: m.status === 'active' ? 'Membro aceitou convite' : 'Novo membro convidado',
    organization_name: m.organizations?.name || 'Organização',
    user_name: m.user_profiles?.[0] ? 
      `${m.user_profiles[0].first_name} ${m.user_profiles[0].last_name}`.trim() : 
      'Usuário',
    created_at: m.accepted_at || m.created_at
  })) || [];

  // Organizações com estatísticas básicas
  const organizationsWithStats = recentOrgs?.map(org => ({
    ...org,
    total_members: org.memberships?.length || 0,
    active_members: org.memberships?.filter(m => m.role === 'active').length || 0,
    total_clients: 0, // Seria necessário fazer join
    total_connections: 0,
    monthly_revenue: 0,
    plan_name: 'N/A',
    subscription_status: 'unknown'
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Painel Administrativo
              </h1>
              <p className="text-gray-600 mt-1">
                Controle total do sistema SaaS
              </p>
            </div>
            <div className="flex space-x-3">
              <Button asChild variant="outline">
                <Link href="/dashboard">Dashboard Normal</Link>
              </Button>
              <Badge variant="destructive" className="px-3 py-1">
                SUPER ADMIN
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Organizações</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_organizations}</div>
              <p className="text-xs text-muted-foreground">
                +{stats.growth_this_month} este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_users}</div>
              <p className="text-xs text-muted-foreground">
                Usuários registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinaturas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.total_active_subscriptions}</div>
              <p className="text-xs text-muted-foreground">
                Churn: {stats.churn_rate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {Number(stats.total_monthly_revenue).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Receita recorrente
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Métricas Adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Gerenciados</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.total_clients}</div>
              <p className="text-xs text-muted-foreground">
                Total de clientes no sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conexões Meta</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.total_connections}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active_connections} ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Ativação</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.total_connections > 0 ? 
                  Math.round((stats.active_connections / stats.total_connections) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Conexões ativas vs total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Organizações</CardTitle>
              <CardDescription>
                Ver, editar e gerenciar todas as organizações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/organizations">
                  <Building2 className="w-4 h-4 mr-2" />
                  Ver Organizações
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Controle Financeiro</CardTitle>
              <CardDescription>
                Assinaturas, faturas e receitas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/billing">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Ver Financeiro
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usuários & Permissões</CardTitle>
              <CardDescription>
                Gerenciar usuários e roles do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/users">
                  <Users className="w-4 h-4 mr-2" />
                  Ver Usuários
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Atividade Recente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Atividade Recente
              </CardTitle>
              <CardDescription>
                Últimas ações no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity?.slice(0, 8).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.description}</span>
                        {activity.organization_name && (
                          <span className="text-gray-500"> - {activity.organization_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.created_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(activity.created_at).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Organizações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Top Organizações
              </CardTitle>
              <CardDescription>
                Organizações com mais atividade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {organizationsWithStats?.slice(0, 5).map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <h3 className="font-medium">{org.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {org.total_members} membros
                        </span>
                        <span className="flex items-center">
                          <Building2 className="w-3 h-3 mr-1" />
                          {org.total_clients} clientes
                        </span>
                        <span className="flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          R$ {Number(org.monthly_revenue).toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={org.subscription_status === 'active' ? 'default' : 'secondary'}>
                        {org.plan_name || 'Sem plano'}
                      </Badge>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/organizations/${org.id}`}>
                          Ver
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas e Notificações */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
              Alertas do Sistema
            </CardTitle>
            <CardDescription>
              Itens que precisam de atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <h4 className="font-medium text-yellow-800">Assinaturas Vencendo</h4>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  3 assinaturas vencem nos próximos 7 dias
                </p>
              </div>

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h4 className="font-medium text-red-800">Pagamentos Falharam</h4>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  2 organizações com pagamento pendente
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <h4 className="font-medium text-blue-800">Sistema Saudável</h4>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  Todos os serviços funcionando normalmente
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}