import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RealTimeInsights } from "@/components/dashboard/real-time-insights";
import Link from "next/link";
import { 
  Users, 
  Facebook, 
  Chrome, 
  Plus, 
  BarChart3, 
  TrendingUp,
  DollarSign,
  Eye
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

  // Buscar estatísticas
  const { data: clients } = await supabase
    .from("clients")
    .select("*");

  const { data: metaConnections } = await supabase
    .from("client_meta_connections")
    .select("*")
    .eq("is_active", true);

  const { data: googleAccounts } = await supabase
    .from("ad_accounts")
    .select("*")
    .eq("provider", "google");

  const totalClients = clients?.length || 0;
  const totalMetaConnections = metaConnections?.length || 0;
  const totalGoogleConnections = googleAccounts?.length || 0;
  const totalConnections = totalMetaConnections + totalGoogleConnections;

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

      {/* Quick Stats */}
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
            <Facebook className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetaConnections}</div>
            <p className="text-xs text-muted-foreground">
              contas conectadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google Ads</CardTitle>
            <Chrome className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGoogleConnections}</div>
            <p className="text-xs text-muted-foreground">
              contas conectadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conexões</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConnections}</div>
            <p className="text-xs text-muted-foreground">
              plataformas ativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Comece rapidamente com as tarefas mais comuns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full justify-start">
              <Link href="/dashboard/clients">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Novo Cliente
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/dashboard/clients">
                <Eye className="mr-2 h-4 w-4" />
                Ver Todos os Clientes
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/dashboard/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Gerar Relatório
              </Link>
            </Button>
          </CardContent>
        </Card>

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