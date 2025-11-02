import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RealTimeInsights } from "@/components/dashboard/real-time-insights";
import { PlanLimitsIndicator } from "@/components/dashboard/plan-limits-indicator";
import { UnifiedMetricsCards } from "@/components/unified";
import { PlatformComparisonChart } from "@/components/unified";
import { ExportButton } from "@/components/exports/export-button";
import SetupChecklist from "@/components/onboarding/setup-checklist";
import Link from "next/link";
import { 
  Users, 
  Plus, 
  BarChart3, 
  TrendingUp,
  Eye,
  Zap,
  Target,

  Zap as ActivityIcon
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Buscar organizações do usuário primeiro
  const { data: userMemberships } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id);

  const orgIds = userMemberships?.map(m => m.organization_id) || [];

  // Buscar clientes das organizações do usuário
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .in("org_id", orgIds.length > 0 ? orgIds : ['']);

  // Buscar conexões apenas para clientes acessíveis pelo usuário
  const clientIds = clients?.map(client => client.id) || [];
  
  const { data: metaConnections } = await supabase
    .from("client_meta_connections")
    .select("*")
    .eq("is_active", true)
    .in("client_id", clientIds.length > 0 ? clientIds : ['']);

  const { data: googleConnections } = await supabase
    .from("google_ads_connections")
    .select("*")
    .eq("status", "active")
    .in("client_id", clientIds.length > 0 ? clientIds : ['']);

  const totalClients = clients?.length || 0;
  const totalMetaConnections = metaConnections?.length || 0;
  const totalGoogleConnections = googleConnections?.length || 0;
  const totalConnections = totalMetaConnections + totalGoogleConnections;

  // Verificar status das conexões
  const hasMetaConnections = totalMetaConnections > 0;
  const hasGoogleConnections = totalGoogleConnections > 0;
  const hasBothPlatforms = hasMetaConnections && hasGoogleConnections;

  // Verificar se precisa mostrar onboarding
  const needsOnboarding = totalClients === 0 || totalConnections === 0;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Bem-vindo ao Ads Manager! 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Olá, {user.email}. Aqui está um resumo das suas campanhas e clientes.
        </p>
      </div>

      {/* Onboarding Checklist */}
      {needsOnboarding && (
        <div className="mb-8">
          <SetupChecklist compact={false} />
        </div>
      )}

      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {totalClients > 0 ? "clientes ativos" : "nenhum cliente ainda"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Ads</CardTitle>
            <div className="flex items-center space-x-2">
              {hasMetaConnections && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
              <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">f</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetaConnections}</div>
            <p className="text-xs text-muted-foreground">
              {hasMetaConnections ? "contas conectadas" : "não conectado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google Ads</CardTitle>
            <div className="flex items-center space-x-2">
              {hasGoogleConnections && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
              <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">G</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGoogleConnections}</div>
            <p className="text-xs text-muted-foreground">
              {hasGoogleConnections ? "contas conectadas" : "não conectado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
            <ActivityIcon className={`h-4 w-4 ${totalConnections > 0 ? 'text-green-600' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConnections}</div>
            <p className="text-xs text-muted-foreground">
              {hasBothPlatforms ? "multi-plataforma" : totalConnections > 0 ? "plataforma única" : "sem conexões"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unified Metrics - Only show if there are connections and valid client */}
      {totalConnections > 0 && totalClients > 0 && clients?.[0]?.id && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Debug v2: totalConnections={totalConnections}, totalClients={totalClients}, clientId={clients[0].id}, timestamp={Date.now()}
          </p>
          <UnifiedMetricsCards 
            clientId={clients[0].id} 
            hasMetaConnections={hasMetaConnections}
            hasGoogleConnections={hasGoogleConnections}
          />
        </div>
      )}

      {/* Platform Comparison - Only show if both platforms are connected */}
      {hasBothPlatforms && totalClients > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Comparação de Plataformas
            </h2>
            <p className="text-gray-600">
              Análise comparativa entre Meta Ads e Google Ads
            </p>
          </div>
          <PlatformComparisonChart clientId={clients?.[0]?.id} />
        </div>
      )}

      {/* Plan Limits and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Limits Indicator */}
        <div className="lg:col-span-1">
          <PlanLimitsIndicator />
        </div>

        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Acesse rapidamente os dashboards e funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button asChild className="justify-start">
                <Link href="/dashboard/clients">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Cliente
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="justify-start">
                <Link href="/dashboard/reports">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Relatórios
                </Link>
              </Button>

              <ExportButton
                clientId={clients?.[0]?.id || ""}
                platform="unified"
                variant="outline"
                className="justify-start"
                disabled={totalConnections === 0 || !clients?.[0]?.id}
              />
            </div>

            {/* Platform-specific quick links */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Dashboards por Plataforma</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button 
                  asChild 
                  variant={hasMetaConnections ? "default" : "secondary"} 
                  className="justify-start"
                  disabled={!hasMetaConnections}
                >
                  <Link href="/dashboard/meta">
                    <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center mr-2">
                      <span className="text-white text-xs font-bold">f</span>
                    </div>
                    Meta Ads
                    <div className="ml-auto h-3 w-3">↗</div>
                  </Link>
                </Button>
                
                <Button 
                  asChild 
                  variant={hasGoogleConnections ? "default" : "secondary"} 
                  className="justify-start"
                  disabled={!hasGoogleConnections}
                >
                  <Link href="/dashboard/google">
                    <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center mr-2">
                      <span className="text-white text-xs font-bold">G</span>
                    </div>
                    Google Ads
                    <div className="ml-auto h-3 w-3">↗</div>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Analytics quick links */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Analytics Avançados</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button asChild variant="outline" className="justify-start" size="sm">
                  <Link href="/dashboard/analytics">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Insights Meta
                  </Link>
                </Button>
                
                <Button 
                  asChild 
                  variant="outline" 
                  className="justify-start" 
                  size="sm"
                  disabled={!hasGoogleConnections}
                >
                  <Link href="/dashboard/analytics/google">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Insights Google
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Primeiros Passos</CardTitle>
            <CardDescription>
              Configure seu sistema em poucos passos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {totalClients === 0 ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Adicione seu primeiro cliente</p>
                    <p className="text-sm text-gray-500">Comece criando um cliente</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 opacity-50">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-400 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-400">Conecte Meta ou Google Ads</p>
                    <p className="text-sm text-gray-400">Vincule as contas de anúncios</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 opacity-50">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-400 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-400">Visualize relatórios</p>
                    <p className="text-sm text-gray-400">Acompanhe performance das campanhas</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-medium">Cliente criado</p>
                    <p className="text-sm text-gray-500">{totalClients} cliente(s) adicionado(s)</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    totalConnections > 0 ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <span className={`font-semibold text-sm ${
                      totalConnections > 0 ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {totalConnections > 0 ? '✓' : '2'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">Conectar plataformas de anúncios</p>
                    <p className="text-sm text-gray-500">
                      {totalConnections > 0 
                        ? `${totalConnections} conexão(ões) ativa(s)` 
                        : 'Meta Ads e Google Ads'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Configurar relatórios automáticos</p>
                    <p className="text-sm text-gray-500">WhatsApp e análise com IA</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Real-time Insights */}
      {totalConnections > 0 && (
        <RealTimeInsights />
      )}

      {/* Recent Activity */}
      {totalClients > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Clientes Recentes</CardTitle>
            <CardDescription>
              Seus clientes adicionados recentemente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients?.slice(0, 3).map((client) => (
                <div key={client.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-gray-500">
                        Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/clients/${client.id}`}>
                      Ver Detalhes
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}