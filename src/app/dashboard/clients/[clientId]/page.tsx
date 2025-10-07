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

export default async function ClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  const supabase = createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .single();

  if (clientError || !client) {
    notFound();
  }

  // Buscar contas de anúncio conectadas para este cliente
  const { data: adAccounts, error: adAccountsError } = await supabase
    .from("ad_accounts")
    .select("*")
    .eq("client_id", params.clientId);

  if (adAccountsError) {
    console.error("Error fetching ad accounts:", adAccountsError);
  }

  const metaAdAccounts = adAccounts?.filter(acc => acc.provider === 'meta') || [];
  const googleAdAccounts = adAccounts?.filter(acc => acc.provider === 'google') || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{client.name}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card do Meta Ads */}
        <Card>
          <CardHeader>
            <CardTitle>Conexões de Anúncios Meta</CardTitle>
            <CardDescription>
              Conecte as contas de anúncio do seu cliente no Meta para sincronizar os dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metaAdAccounts.length > 0 ? (
              <div className="space-y-4">
                {metaAdAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-2 border rounded-md">
                    <span>{account.name} ({account.external_id})</span>
                    <SyncButton adAccountId={account.id} clientId={client.id} />
                  </div>
                ))}
              </div>
            ) : (
              <ConnectMetaButton clientId={client.id} />
            )}
          </CardContent>
        </Card>

        {/* Card do Google Ads */}
        <Card>
          <CardHeader>
            <CardTitle>Conexões de Anúncios Google</CardTitle>
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
    </div>
  );
}