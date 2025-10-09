import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chrome, Plus, BarChart3, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function GooglePage() {
  const supabase = await createClient();

  const { data: googleAccounts } = await supabase
    .from("ad_accounts")
    .select(`
      *,
      clients (
        id,
        name
      )
    `)
    .eq("provider", "google");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Chrome className="w-8 h-8 mr-3 text-green-600" />
            Google Ads
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie suas conexões e campanhas do Google Ads
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/clients">
            <Plus className="w-4 h-4 mr-2" />
            Conectar Nova Conta
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas Conectadas</CardTitle>
            <Chrome className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{googleAccounts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              contas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
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
              {googleAccounts ? new Set(googleAccounts.map(acc => acc.client_id)).size : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              com Google Ads
            </p>
          </CardContent>
        </Card>
      </div>

      {googleAccounts && googleAccounts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Contas Google Ads Conectadas</CardTitle>
            <CardDescription>
              Suas contas de anúncios do Google conectadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {googleAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Chrome className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{account.name}</h3>
                      <p className="text-sm text-gray-500">
                        Cliente: {account.clients?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        ID: {account.external_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/clients/${account.client_id}`}>
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
            <Chrome className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma conta Google Ads conectada
            </h3>
            <p className="text-gray-500 mb-6">
              Conecte suas primeiras contas do Google Ads para começar a gerenciar campanhas.
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