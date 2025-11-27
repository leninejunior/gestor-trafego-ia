"use client";

import { useState, useEffect, Suspense } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Calendar, RefreshCw, Users, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const Loader2 = RefreshCw;
const Building2 = Users;
import { ConnectMetaButton } from "./connect-meta-button";
import { CampaignsList } from "@/components/meta/campaigns-list";
import { ManageConnections } from "@/components/meta/manage-connections";
import { GoogleAdsCard } from "@/components/google/google-ads-card";
import { GoogleCampaignsList } from "@/components/google/google-campaigns-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import { translateMetaObjective } from "@/lib/utils/meta-translations";

interface Client {
  id: string;
  name: string;
  org_id: string;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
  };
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

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  created_time: string;
}

// Componente de Seção de Campanhas com Filtros
function CampaignsSection({ 
  clientId, 
  adAccountId,
  metaConnectionsCount 
}: { 
  clientId: string; 
  adAccountId: string;
  metaConnectionsCount: number;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, [clientId, adAccountId]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const url = `/api/meta/campaigns?clientId=${clientId}&adAccountId=${adAccountId}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        // Não mostrar dados de teste - apenas dados reais
        if (data.isTestData) {
          setCampaigns([]);
        } else {
          setCampaigns(data.campaigns || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  // Extrair objetivos únicos das campanhas carregadas
  const availableObjectives = Array.from(new Set(campaigns.map(c => c.objective))).sort();

  // Filtrar campanhas
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesObjective = objectiveFilter === 'all' || campaign.objective === objectiveFilter;
    return matchesStatus && matchesObjective;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campanhas Meta Ads</CardTitle>
        <CardDescription>
          Visualize e gerencie as campanhas do Meta Ads do seu cliente.
          {metaConnectionsCount > 1 && (
            <span className="block text-sm text-orange-600 mt-1">
              ⚠️ {metaConnectionsCount} contas conectadas - considere usar "Reconectar" para selecionar apenas as necessárias
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <Card className="bg-gray-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos ({campaigns.length})</SelectItem>
                    <SelectItem value="ACTIVE">
                      Ativo ({campaigns.filter(c => c.status === 'ACTIVE').length})
                    </SelectItem>
                    <SelectItem value="PAUSED">
                      Pausado ({campaigns.filter(c => c.status === 'PAUSED').length})
                    </SelectItem>
                    <SelectItem value="ARCHIVED">
                      Arquivado ({campaigns.filter(c => c.status === 'ARCHIVED').length})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Objetivo</label>
                <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os objetivos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos ({campaigns.length})</SelectItem>
                    {availableObjectives.length > 0 ? (
                      availableObjectives.map(objective => {
                        const count = campaigns.filter(c => c.objective === objective).length;
                        return (
                          <SelectItem key={objective} value={objective}>
                            {translateMetaObjective(objective)} ({count})
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>
                        Nenhum objetivo disponível
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resumo dos filtros */}
            {(statusFilter !== 'all' || objectiveFilter !== 'all') && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Mostrando {filteredCampaigns.length} de {campaigns.length} campanhas
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setObjectiveFilter('all');
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Campanhas ou Mensagem de Reconexão */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Carregando campanhas...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8">
            <div className="max-w-md mx-auto">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12z"/>
                  </svg>
                </div>
                
                <h3 className="text-xl font-semibold text-blue-800 mb-2">Nenhuma Campanha Encontrada</h3>
                <p className="text-blue-700 mb-4">
                  Não encontramos campanhas ativas na sua conta do Meta Ads.
                </p>
                
                <div className="text-left bg-white/50 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Possíveis motivos:
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-600">
                    <li>Sua conta não tem campanhas ativas no momento</li>
                    <li>Você pode ter conectado uma conta diferente</li>
                    <li>O token de acesso pode ter expirado</li>
                  </ul>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => window.location.href = '/dashboard/clients'} 
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reconectar Conta
                  </Button>
                  <Button 
                    onClick={loadCampaigns} 
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    Tentar Novamente
                  </Button>
                </div>
                
                <p className="text-xs text-blue-500 mt-4">
                  Ao reconectar, você poderá selecionar contas diferentes ou atualizar as permissões.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <CampaignsList 
            clientId={clientId} 
            adAccountId={adAccountId}
            campaigns={filteredCampaigns}
            onRefresh={loadCampaigns}
          />
        )}

        {metaConnectionsCount > 1 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Dica:</strong> Você tem {metaConnectionsCount} contas conectadas. 
              Para melhor performance, use o botão "Reconectar" para selecionar apenas as contas que realmente precisa.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  
  const [client, setClient] = useState<Client | null>(null);
  const [metaConnections, setMetaConnections] = useState<MetaConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Verificar se há mensagens de erro ou sucesso na URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const successParam = searchParams.get('success');
    
    if (errorParam === 'user_cancelled') {
      toast({
        title: 'Conexão cancelada',
        description: 'Você cancelou a conexão com o Meta Ads. Tente novamente quando quiser.'
      });
    } else if (errorParam === 'authorization_failed') {
      toast({
        title: 'Falha na autorização',
        description: 'Não foi possível autorizar a conexão com o Meta Ads.',
        variant: 'destructive'
      });
    } else if (errorParam === 'no_ad_accounts') {
      toast({
        title: 'Nenhuma conta encontrada',
        description: 'Não encontramos contas de anúncios vinculadas à sua conta Meta.'
      });
    } else if (successParam === 'meta_connected') {
      toast({
        title: 'Conectado com sucesso!',
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

      // Buscar dados do cliente com informações da organização
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select(`
          *,
          organization:organizations(id, name)
        `)
        .eq("id", clientId);

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

      const client = clientData?.[0];
      if (!client) {
        console.error('❌ [CLIENT PAGE] Cliente não encontrado ou sem permissão');
        setError('Cliente não encontrado ou você não tem permissão para acessá-lo');
        return;
      }

      console.log('✅ [CLIENT PAGE] Cliente encontrado:', client.name);
      setClient(client);

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

  const handleDeleteClient = async () => {
    if (!client) return;
    
    setDeleting(true);
    
    try {
      const response = await fetch(`/api/clients?id=${client.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Cliente excluído",
          description: `${data.clientName || client.name} foi excluído com sucesso.`,
        });
        // Redirecionar para a lista de clientes
        router.push('/dashboard/clients');
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro ao excluir cliente",
          description: errorData.error || "Ocorreu um erro inesperado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        title: "Erro ao excluir cliente",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
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
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-client-name={client.name}>{client.name}</h1>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-1">
              <Building2 className="h-4 w-4" />
              <span>
                {client.organization?.name || 'Organização não encontrada'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>
                Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              ID: {client.id.slice(0, 8)}...
            </Badge>
            {hasMetaConnection && (
              <Badge variant="default">
                {metaConnections.length} conexão(ões) Meta
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={loadClientData}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando...
              </>
            ) : (
              'Recarregar'
            )}
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="default">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Cliente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    <p>
                      Tem certeza que deseja excluir o cliente <strong>{client.name}</strong>? 
                      Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos permanentemente, incluindo:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Todas as campanhas e métricas</li>
                      <li>Conexões com Meta Ads e Google Ads</li>
                      <li>Histórico de dados e relatórios</li>
                    </ul>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteClient}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    'Excluir Permanentemente'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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

        {/* Card do Google Ads */}
        <GoogleAdsCard clientId={clientId} showCampaigns={false} />
      </div>

      {/* Aviso de Problemas de Conexão */}
      {!hasMetaConnection && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-800 mb-1">
                  Conexão com Meta Ads Necessária
                </h3>
                <p className="text-sm text-orange-700 mb-3">
                  Este cliente ainda não tem uma conexão ativa com o Meta Ads. Para visualizar e gerenciar campanhas, 
                  é necessário conectar uma conta do Meta Ads.
                </p>
                <div className="bg-white/50 rounded-lg p-3 mb-3">
                  <h4 className="font-medium text-orange-800 mb-1">Próximos passos:</h4>
                  <ol className="text-sm text-orange-700 list-decimal list-inside space-y-1">
                    <li>Clique no botão "Conectar Meta Ads" acima</li>
                    <li>Autentique-se com sua conta do Facebook/Meta</li>
                    <li>Selecione as contas de anúncios desejadas</li>
                    <li>Conclua o processo de conexão</li>
                  </ol>
                </div>
                <ConnectMetaButton clientId={client.id} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Campanhas Meta com Filtros */}
      {hasMetaConnection && metaConnections && metaConnections.length > 0 && (
        <CampaignsSection 
          clientId={client.id} 
          adAccountId={metaConnections[0].ad_account_id}
          metaConnectionsCount={metaConnections.length}
        />
      )}

      {/* Lista de Campanhas Google Ads */}
      <GoogleCampaignsList clientId={client.id} />
    </div>
  );
}

export default function ClientDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    }>
      <ClientDetailContent />
    </Suspense>
  );
}
