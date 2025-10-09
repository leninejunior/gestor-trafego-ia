import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectMetaButton } from "./connect-meta-button";
import { SyncButton } from "./sync-button";
import { ConnectGoogleButton } from "./connect-google-button";
import { SyncGoogleButton } from "./sync-google-button";
import { CampaignsList } from "@/components/meta/campaigns-list";
import { ManageConnections } from "@/components/meta/manage-connections";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    notFound();
  }

  // Buscar conexões Meta para este cliente
  const { data: metaConnections, error: metaError } = await supabase
    .from("client_meta_connections")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true);

  // Buscar contas de anúncio conectadas para este cliente (Google)
  const { data: adAccounts, error: adAccountsError } = await supabase
    .from("ad_accounts")
    .select("*")
    .eq("client_id", clientId);

  if (adAccountsError) {
    console.error("Error fetching ad accounts:", adAccountsError);
  }

  const googleAdAccounts = adAccounts?.filter(acc => acc.provider === 'google') || [];
  const hasMetaConnection = metaConnections && metaConnections.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{client.name}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card do Meta Ads */}
        <Card>
          <CardHeader>
            <CardTitle>Meta Ads</CardTitle>
            <CardDescription>
              Conecte as contas de anúncio do seu cliente no Meta para sincronizar os dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasMetaConnection ? (
              <ManageConnections 
                clientId={client.id} 
                connections={metaConnections || []}
              />
            ) : (
              <div className="text-center py-6">
                <ConnectMetaButton clientId={client.id} />
                <p className="text-sm text-gray-500 mt-2">
                  Conecte sua conta Meta Ads para gerenciar campanhas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card do Google Ads */}
        <Card>
          <CardHeader>
            <CardTitle>Google Ads</CardTitle>
            <CardDescription>
              Conecte as contas de anúncio do seu cliente no Google para sincronizar os dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {googleAdAccounts.length > 0 ? (
              <div className="space-y-4">
                {googleAdAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-2 border rounded-md">
                    <span>{account.name} ({account.external_id})</span>
                    <SyncGoogleButton adAccountId={account.id} clientId={client.id} />
                  </div>
                ))}
              </div>
            ) : (
              <ConnectGoogleButton clientId={client.id} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de Campanhas Meta */}
      {hasMetaConnection && metaConnections && metaConnections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campanhas Meta Ads</CardTitle>
            <CardDescription>
              Visualize e gerencie as campanhas do Meta Ads do seu cliente.
              {metaConnections.length > 1 && (
                <span className="block text-sm text-orange-600 mt-1">
                  ⚠️ {metaConnections.length} contas conectadas - considere usar "Reconectar" para selecionar apenas as necessárias
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mostrar apenas a primeira conexão para evitar muitas chamadas */}
            <CampaignsList 
              clientId={client.id} 
              adAccountId={metaConnections[0].ad_account_id} 
            />
            {metaConnections.length > 1 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Dica:</strong> Você tem {metaConnections.length} contas conectadas. 
                  Para melhor performance, use o botão "Reconectar" para selecionar apenas as contas que realmente precisa.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}