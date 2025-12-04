import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Plus, BarChart3, Users } from "lucide-react";
import Link from "next/link";
import { GeneralMetricsCards } from "@/components/dashboard";

export const dynamic = 'force-dynamic';

// Create date range outside the component to avoid recreation on every render
const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

export default async function MetaPage() {
  const supabase = await createClient();

  const { data: metaConnections } = await supabase
    .from("client_meta_connections")
    .select(`
      *,
      clients (
        id,
        name
      )
    `)
    .eq("is_active", true);

  // Get first client ID for general metrics
  const firstClient = metaConnections?.[0]?.client_id;
  
  // Get date range once
  const dateRange = getDefaultDateRange();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Facebook className="w-8 h-8 mr-3 text-blue-600" />
            Meta Ads
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie suas conexões e campanhas do Meta Ads (Facebook/Instagram)
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/clients">
            <Plus className="w-4 h-4 mr-2" />
            Conectar Nova Conta
          </Link>
        </Button>
      </div>

      {/* General Metrics - Show if there are connections */}
      {metaConnections && metaConnections.length > 0 && firstClient && (
        <GeneralMetricsCards
          clientId={firstClient}
          hasMetaConnections={true}
          hasGoogleConnections={false}
          dateRange={dateRange}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas Conectadas</CardTitle>
            <Facebook className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metaConnections?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              contas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              campanhas rodando
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metaConnections ? new Set(metaConnections.map(conn => conn.client_id)).size : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              com Meta Ads
            </p>
          </CardContent>
        </Card>
      </div>

      {metaConnections && metaConnections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Contas Meta Ads Conectadas</CardTitle>
            <CardDescription>
              Suas contas de anúncios do Meta conectadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metaConnections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Facebook className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{connection.account_name}</h3>
                      <p className="text-sm text-gray-500">
                        Cliente: {connection.clients?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        ID: {connection.ad_account_id} • {connection.currency}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/clients/${connection.client_id}`}>
                        Ver Campanhas
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Facebook className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma conta Meta Ads conectada
            </h3>
            <p className="text-gray-500 mb-6">
              Conecte suas primeiras contas do Meta Ads para começar a gerenciar campanhas.
            </p>
            <Button asChild>
              <Link href="/dashboard/clients">
                <Plus className="w-4 h-4 mr-2" />
                Conectar Primeira Conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}