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
  Users, 
  Building2, 
  CreditCard, 
  Calendar,
  Eye,
  Settings,
  AlertTriangle,
  TrendingUp,
  Activity,
  DollarSign,
  UserCheck,
  UserX,
  Mail,
  Shield,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3
} from "lucide-react";

export const dynamic = 'force-dynamic';

interface OrganizationDetailsProps {
  params: Promise<{
    orgId: string;
  }>;
}

export default async function OrganizationDetailsPage({ params }: OrganizationDetailsProps) {
  const { orgId } = await params;
  const supabase = await createClient();

  // Verificar se é super admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect("/login");
  }

  // Buscar dados completos da organização
  const { data: organization } = await supabase
    .from("organizations")
    .select(`
      id,
      name,
      created_at,
      memberships (
        id,
        role,
        status,
        created_at,
        accepted_at,
        user_id,
        user_profiles!memberships_user_id_fkey (
          first_name,
          last_name,
          email
        )
      ),
      clients (
        id,
        name,
        created_at,
        client_meta_connections (
          id,
          account_name,
          is_active,
          created_at
        )
      ),
      subscriptions (
        id,
        status,
        billing_cycle,
        current_period_start,
        current_period_end,
        stripe_customer_id,
        created_at,
        subscription_plans!subscriptions_plan_id_fkey (
          name,
          price_monthly,
          price_yearly,
          max_ad_accounts,
          max_users,
          max_clients
        )
      )
    `)
    .eq("id", orgId)
    .single();

  // Estatísticas calculadas localmente (sem função SQL)
  const stats = null;
  
  // Buscar atividade recente
  const { data: recentActivity } = await supabase
    .from("memberships")
    .select(`
      id,
      created_at,
      accepted_at,
      role,
      status,
      user_profiles!memberships_user_id_fkey (
        first_name,
        last_name
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Organização Não Encontrada</CardTitle>
            <CardDescription>
              A organização solicitada não foi encontrada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/organizations">Voltar à Lista</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeSubscription = organization.subscriptions?.find(sub => sub.status === 'active');
  const totalConnections = organization.clients?.reduce((sum, client) => 
    sum + (client.client_meta_connections?.length || 0), 0) || 0;
  
  // Calcular métricas
  const totalMembers = organization.memberships?.length || 0;
  const activeMembers = organization.memberships?.filter(m => m.status === 'active').length || 0;
  const pendingInvites = organization.memberships?.filter(m => m.status === 'pending').length || 0;
  const totalClients = organization.clients?.length || 0;
  const activeConnections = organization.clients?.reduce((sum, client) => 
    sum + (client.client_meta_connections?.filter(conn => conn.is_active).length || 0), 0) || 0;
  
  // Calcular uso vs limites do plano
  const planLimits = activeSubscription?.subscription_plans;
  const userUsage = planLimits ? (totalMembers / planLimits.max_users) * 100 : 0;
  const clientUsage = planLimits ? (totalClients / planLimits.max_clients) * 100 : 0;
  const connectionUsage = planLimits ? (totalConnections / planLimits.max_ad_accounts) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/organizations">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {organization.name}
                </h1>
                <p className="text-gray-600 mt-1">
                  Detalhes completos da organização
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="destructive">SUPER ADMIN</Badge>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/organizations/${orgId}/edit`}>
                  <Settings className="w-4 h-4 mr-2" />
                  Editar
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Membros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMembers}</div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                <span className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                  {activeMembers} ativos
                </span>
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-yellow-500" />
                  {pendingInvites} pendentes
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Building2 className="w-4 h-4 mr-2" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClients}</div>
              <p className="text-xs text-muted-foreground">
                {activeConnections} com conexões ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Conexões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalConnections}</div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                <span className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                  {activeConnections} ativas
                </span>
                <span className="flex items-center">
                  <XCircle className="w-3 h-3 mr-1 text-red-500" />
                  {totalConnections - activeConnections} inativas
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Receita Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {activeSubscription?.subscription_plans?.[0]?.price_monthly?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeSubscription?.subscription_plans?.[0]?.name || 'Sem plano ativo'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Uso do Plano */}
        {planLimits && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Uso do Plano - {planLimits[0]?.name}
              </CardTitle>
              <CardDescription>
                Acompanhe o uso dos recursos em relação aos limites do plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usuários</span>
                    <span>{totalMembers} / {planLimits[0]?.max_users}</span>
                  </div>
                  <Progress value={userUsage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {userUsage.toFixed(1)}% utilizado
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Clientes</span>
                    <span>{totalClients} / {planLimits[0]?.max_clients}</span>
                  </div>
                  <Progress value={clientUsage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {clientUsage.toFixed(1)}% utilizado
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Contas de Anúncios</span>
                    <span>{totalConnections} / {planLimits[0]?.max_ad_accounts}</span>
                  </div>
                  <Progress value={connectionUsage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {connectionUsage.toFixed(1)}% utilizado
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Membros */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Membros da Organização
                </span>
                <Button size="sm" variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Convidar Membro
                </Button>
              </CardTitle>
              <CardDescription>
                Gerenciar todos os usuários com acesso a esta organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {organization.memberships?.map((member) => {
                  const profile = member.user_profiles?.[0];
                  const fullName = profile ? 
                    `${profile.first_name} ${profile.last_name}`.trim() : 
                    'Usuário';
                  const email = profile?.email || 'Email não disponível';
                  
                  return (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {fullName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium">{fullName}</h4>
                          <p className="text-sm text-gray-500">{email}</p>
                          <p className="text-xs text-gray-400">
                            {member.status === 'active' ? 'Ativo desde' : 'Convidado em'} {' '}
                            {new Date(member.accepted_at || member.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                          <Shield className="w-3 h-3 mr-1" />
                          {member.role}
                        </Badge>
                        <Badge variant={member.status === 'active' ? 'default' : 
                          member.status === 'pending' ? 'secondary' : 'destructive'}>
                          {member.status === 'active' && <UserCheck className="w-3 h-3 mr-1" />}
                          {member.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {member.status === 'suspended' && <UserX className="w-3 h-3 mr-1" />}
                          {member.status}
                        </Badge>
                        <Button size="sm" variant="ghost">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Atividade Recente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Atividade Recente
              </CardTitle>
              <CardDescription>
                Últimas ações na organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity?.map((activity) => {
                  const profile = activity.user_profiles?.[0];
                  const name = profile ? 
                    `${profile.first_name} ${profile.last_name}`.trim() : 
                    'Usuário';
                  
                  return (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{name}</span>
                          {activity.status === 'active' ? ' aceitou o convite' : ' foi convidado'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.accepted_at || activity.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">

          {/* Assinatura */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Assinatura & Cobrança
              </CardTitle>
              <CardDescription>
                Detalhes do plano e histórico de pagamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSubscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-green-800">
                        {activeSubscription.subscription_plans?.[0]?.name}
                      </h4>
                      <p className="text-sm text-green-600">
                        R$ {activeSubscription.subscription_plans?.[0]?.price_monthly}/mês
                      </p>
                      <p className="text-xs text-green-500 mt-1">
                        Ativo desde {new Date(activeSubscription.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Ativo
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Ciclo de Cobrança:</span>
                      <span className="font-medium">{activeSubscription.billing_cycle}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500 block">Próxima Cobrança:</span>
                      <span className="font-medium">
                        {new Date(activeSubscription.current_period_end).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {activeSubscription.subscription_plans?.[0]?.max_users || 'N/A'}
                      </div>
                      <div className="text-xs text-blue-500">Max Usuários</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-lg font-bold text-purple-600">
                        {activeSubscription.subscription_plans?.[0]?.max_clients || 'N/A'}
                      </div>
                      <div className="text-xs text-purple-500">Max Clientes</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">
                        {activeSubscription.subscription_plans?.[0]?.max_ad_accounts || 'N/A'}
                      </div>
                      <div className="text-xs text-orange-500">Max Contas</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Customer ID:</span>
                      <span className="text-sm font-mono">{activeSubscription.stripe_customer_id}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">Sem Assinatura Ativa</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Esta organização não possui plano ativo
                  </p>
                  <Button size="sm">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Ativar Plano
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métricas Financeiras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Métricas Financeiras
              </CardTitle>
              <CardDescription>
                Resumo financeiro da organização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="text-sm text-green-600">Receita Mensal</p>
                    <p className="text-lg font-bold text-green-700">
                      R$ {activeSubscription?.subscription_plans?.[0]?.price_monthly?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-500" />
                </div>

                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm text-blue-600">Receita Anual</p>
                    <p className="text-lg font-bold text-blue-700">
                      R$ {activeSubscription?.subscription_plans?.[0]?.price_yearly?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-500" />
                </div>

                <div className="pt-4 border-t">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">Tempo como cliente</p>
                    <p className="text-sm font-medium">
                      {organization.created_at ? 
                        Math.floor((new Date().getTime() - new Date(organization.created_at).getTime()) / (1000 * 60 * 60 * 24))
                        : 0} dias
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clientes */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Clientes da Organização</CardTitle>
            <CardDescription>
              Todos os clientes gerenciados por esta organização
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organization.clients && organization.clients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Cliente</TableHead>
                    <TableHead>Conexões Meta</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organization.clients.map((client) => {
                    const metaConnections = client.client_meta_connections?.length || 0;
                    const hasConnections = metaConnections > 0;
                    
                    return (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-gray-500">
                              ID: {client.id.slice(0, 8)}...
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                              <span className="text-white text-xs font-bold">f</span>
                            </div>
                            <span>{metaConnections}</span>
                            {hasConnections && (
                              <Badge variant="default" className="text-xs">
                                Ativo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">
                              {new Date(client.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge variant={hasConnections ? 'default' : 'secondary'}>
                            {hasConnections ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/clients/${client.id}`}>
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Detalhes
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">Nenhum cliente</h3>
                <p className="text-sm text-gray-500">
                  Esta organização ainda não possui clientes cadastrados
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Ações Administrativas
            </CardTitle>
            <CardDescription>
              Controles avançados para gerenciar esta organização
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button variant="outline" className="justify-start">
                <CreditCard className="w-4 h-4 mr-2" />
                Gerenciar Cobrança
              </Button>
              <Button variant="outline" className="justify-start">
                <Users className="w-4 h-4 mr-2" />
                Gerenciar Membros
              </Button>
              <Button variant="outline" className="justify-start">
                <Mail className="w-4 h-4 mr-2" />
                Enviar Comunicado
              </Button>
              <Button variant="outline" className="justify-start">
                <BarChart3 className="w-4 h-4 mr-2" />
                Relatório Completo
              </Button>
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium text-red-600 mb-4 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Zona de Perigo
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="destructive" size="sm" className="justify-start">
                  <Ban className="w-4 h-4 mr-2" />
                  Suspender Organização
                </Button>
                <Button variant="destructive" size="sm" className="justify-start">
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar Assinatura
                </Button>
                <Button variant="destructive" size="sm" className="justify-start">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Excluir Organização
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}