"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectMetaButton } from "./connect-meta-button";
import { CampaignsList } from "@/components/meta/campaigns-list";
import { ManageConnections } from "@/components/meta/manage-connections";

interface Client {
  id: string;
  name: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

interface MetaConnection {
  id: string;
  client_id: string;
  ad_account_id: string;
  account_name: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  
  const [client, setClient] = useState<Client | null>(null);
  const [metaConnections, setMetaConnections] = useState<MetaConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar se há mensagens de erro ou sucesso na URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const successParam = searchParams.get('success');
    
    if (errorParam === 'user_cancelled') {
      toast.info('Conexão cancelada', {
        description: 'Você cancelou a conexão com o Meta Ads. Tente novamente quando quiser.'
      });
    } else if (errorParam === 'authorization_failed') {
      toast.error('Falha na autorização', {
        description: 'Não foi possível autorizar a conexão com o Meta Ads.'
      });
    } else if (errorParam === 'no_ad_accounts') {
      toast.warning('Nenhuma conta encontrada', {
        description: 'Não encontramos contas de anúncios vinculadas à sua conta Meta.'
      });
    } else if (successParam === 'meta_connected') {
      toast.success('Conectado com sucesso!', {
        description: 'Sua conta Meta Ads foi conectada. As campanhas serão sincronizadas em breve.'
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      console.log('🔍 [CLIENT PAGE] Carregando dados do cliente:', clientId);

      // Verificar autenticação
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ [CLIENT PAGE] Erro de autenticação:', authError);
        setError('Usuário não autenticado');
        return;
      }
      console.log('✅ [CLIENT PAGE] Usuário autenticado:', user.id);

      // Buscar dados do cliente
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (clientError) {
        console.error('❌ [CLIENT PAGE] Erro ao buscar cliente:', {
          error: clientError,
          code: clientError.code,
          message: clientError.message,
          details: clientError.details,
          hint: clientError.hint
        });
        setError(`Erro ao buscar cliente: ${clientError.message || 'Desconhecido'}`);
        return;
      }

      if (!clientData) {
        console.error('❌ [CLIENT PAGE] Cliente não encontrado');
        setError('Cliente não encontrado');
        return;
      }

      console.log('✅ [CLIENT PAGE] Cliente encontrado:', clientData.name);
      setClient(clientData);

      // Buscar conexões Meta
      const { data: connections, error: connectionsError } = await supabase
        .from("client_meta_connections")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true);

      if (connectionsError) {
        console.error('❌ [CLIENT PAGE] Erro ao buscar conexões:', connectionsError);
      } else {
        console.log('✅ [CLIENT PAGE] Conexões encontradas:', connections?.length || 0);
        setMetaConnections(connections || []);
      }

    } catch (err) {
      console.error('💥 [CLIENT PAGE] Erro geral:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(`Erro ao carregar dados do cliente: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Erro</h2>
        <p className="text-gray-600">{error || 'Cliente não encontrado'}</p>
      </div>
    );
  }

  const hasMetaConnection = metaConnections && metaConnections.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{client.name}</h1>
        <button
          onClick={loadClientData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Recarregar'}
        </button>
      </div>

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

        {/* Card do Google Ads - Temporariamente desabilitado */}
        <Card>
          <CardHeader>
            <CardTitle>Google Ads</CardTitle>
            <CardDescription>
              Integração com Google Ads em desenvolvimento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 text-gray-500">
              <p>Google Ads em breve...</p>
            </div>
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