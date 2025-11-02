import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddClientButton } from "./add-client-button";
import Link from "next/link";
import { Eye, Settings, Facebook, Chrome } from "lucide-react";

export const dynamic = 'force-dynamic';

interface Client {
  id: string;
  name: string;
  created_at: string;
}

interface MetaConnection {
  id: string;
  client_id: string;
  account_name: string;
  is_active: boolean;
}

export default async function ClientsPage() {
  const supabase = await createClient();

  // Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Não autorizado</div>;
  }

  // Buscar clientes com tratamento de erro
  let clients = null;
  let metaConnections = null;
  let googleAccounts = null;
  let hasError = false;
  let errorMessage = "";

  try {
    // Buscar organização do usuário
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      console.log('⚠️ Membership não encontrada, usando fallback para super admin');
      // Fallback para super admin ou usuário sem organização
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Clientes</h1>
              <p className="text-muted-foreground">
                Gerencie seus clientes e suas integrações
              </p>
            </div>
            <AddClientButton />
          </div>

          <div className="grid gap-4">
            {clientsData && clientsData.length > 0 ? (
              clientsData.map((client) => (
                <div key={client.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{client.name}</h3>
                      <p className="text-sm text-gray-500">ID: {client.id}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/clients/${client.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum cliente encontrado</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Buscar clientes da organização
    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .eq("org_id", membership.organization_id)
      .order("created_at", { ascending: false });

    if (clientsError) {
      throw clientsError;
    }
    clients = clientsData;

    // Buscar conexões Meta para clientes da organização
    const { data: metaData } = await supabase
      .from("client_meta_connections")
      .select(`
        *,
        clients!inner (
          org_id
        )
      `)
      .eq("clients.org_id", membership.organization_id)
      .eq("is_active", true);
    metaConnections = metaData;

    // Buscar contas Google Ads da organização
    const { data: googleData } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("org_id", membership.organization_id)
      .eq("provider", "google");
    googleAccounts = googleData;

  } catch (error: any) {
    console.error("Error fetching clients:", error);
    hasError = true;
    errorMessage = error.message || "Erro ao conectar com o banco de dados.";
  }

  const getClientConnections = (clientId: string) => {
    const meta = metaConnections?.filter(conn => conn.client_id === clientId) || [];
    const google = googleAccounts?.filter(acc => acc.client_id === clientId) || [];
    return { meta, google };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-1">
            Gerencie seus clientes e suas conexões de anúncios
          </p>
        </div>
        <AddClientButton />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{clients?.length || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Facebook className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Meta Ads</p>
              <p className="text-2xl font-bold text-gray-900">{metaConnections?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Chrome className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Google Ads</p>
              <p className="text-2xl font-bold text-gray-900">{googleAccounts?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ativas</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metaConnections?.length || 0) + (googleAccounts?.length || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Lista de Clientes</h2>
        </div>
        
        {clients && clients.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Cliente</TableHead>
                <TableHead>Conexões</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client: Client) => {
                const connections = getClientConnections(client.id);
                const hasConnections = connections.meta.length > 0 || connections.google.length > 0;
                
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">{client.name}</div>
                      <div className="text-sm text-gray-500">ID: {client.id.slice(0, 8)}...</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {connections.meta.length > 0 && (
                          <Badge variant="default" className="bg-blue-100 text-blue-800">
                            <Facebook className="w-3 h-3 mr-1" />
                            Meta ({connections.meta.length})
                          </Badge>
                        )}
                        {connections.google.length > 0 && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <Chrome className="w-3 h-3 mr-1" />
                            Google ({connections.google.length})
                          </Badge>
                        )}
                        {!hasConnections && (
                          <Badge variant="outline">Sem conexões</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(client.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={hasConnections ? "default" : "secondary"}>
                        {hasConnections ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/clients/${client.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            Ver Detalhes
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Eye className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente encontrado</h3>
            <p className="text-gray-500 mb-6">
              Comece adicionando seu primeiro cliente para gerenciar campanhas de anúncios.
            </p>
            <AddClientButton />
          </div>
        )}
      </div>
    </div>
  );
}