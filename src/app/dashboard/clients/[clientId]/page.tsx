import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  const supabase = createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .single();

  if (error || !client) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">{client.name}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conexões de Anúncios</CardTitle>
            <CardDescription>
              Conecte as contas de anúncio do seu cliente para sincronizar os dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* The Connect to Meta button will go here */}
            <p>Em breve: Botão para conectar ao Meta.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}