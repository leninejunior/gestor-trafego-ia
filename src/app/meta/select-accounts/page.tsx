"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name?: string;
  spend_cap?: string;
  balance?: string;
}

interface Page {
  id: string;
  name: string;
  category: string;
  followers_count?: number;
}

function SelectAccountsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const accessToken = searchParams.get('access_token');
  const clientId = searchParams.get('client_id');

  useEffect(() => {
    console.log('🔍 [SELECT ACCOUNTS] Parâmetros da URL:');
    console.log('- Access Token:', accessToken ? 'presente' : 'ausente');
    console.log('- Client ID:', clientId);
    console.log('- URL completa:', window.location.href);
    
    if (!accessToken || !clientId) {
      console.error('❌ [SELECT ACCOUNTS] Parâmetros inválidos');
      toast.error('Parâmetros inválidos - redirecionando...');
      setTimeout(() => {
        router.push('/dashboard/clients');
      }, 2000);
      return;
    }

    fetchAccounts();
  }, [accessToken, clientId, router]);

  const fetchAccounts = async () => {
    try {
      console.log('📡 [SELECT ACCOUNTS] Buscando contas Meta...');
      
      const response = await fetch('/api/meta/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      const data = await response.json();
      
      console.log('📊 [SELECT ACCOUNTS] Resposta da API:', {
        status: response.status,
        adAccounts: data.adAccounts?.length || 0,
        pages: data.pages?.length || 0,
        total: data.total,
        error: data.error || null
      });

      if (response.ok) {
        setAdAccounts(data.adAccounts || []);
        setPages(data.pages || []);
        
        if (data.adAccounts?.length === 0) {
          toast.warning('Nenhuma conta de anúncios encontrada');
        } else {
          const totalMsg = data.total 
            ? `${data.total.adAccounts} conta(s) de anúncios e ${data.total.pages} página(s) encontradas`
            : `${data.adAccounts.length} conta(s) encontrada(s)`;
          toast.success(totalMsg);
        }
      } else {
        console.error('❌ [SELECT ACCOUNTS] Erro na API:', data);
        toast.error(data.error || 'Erro ao carregar contas');
      }
    } catch (error) {
      console.error('💥 [SELECT ACCOUNTS] Erro ao buscar contas:', error);
      toast.error('Erro ao carregar contas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handlePageToggle = (pageId: string) => {
    setSelectedPages(prev => 
      prev.includes(pageId) 
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  };

  const handleSave = async () => {
    if (selectedAccounts.length === 0) {
      toast.error('Selecione pelo menos uma conta de anúncios');
      return;
    }

    setIsSaving(true);
    try {
      console.log('💾 [SELECT ACCOUNTS] Salvando conexões selecionadas...');
      console.log('📦 [SELECT ACCOUNTS] Dados:', {
        client_id: clientId,
        selected_accounts: selectedAccounts.length,
        ad_accounts: adAccounts.length
      });
      
      // Usar rota alternativa sem parâmetros dinâmicos
      const response = await fetch('/api/meta/save-connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          access_token: accessToken,
          selected_accounts: selectedAccounts,
          selected_pages: selectedPages,
          ad_accounts: adAccounts,
          pages: pages
        }),
      });

      console.log('📡 [SELECT ACCOUNTS] Resposta:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [SELECT ACCOUNTS] Conexões salvas com sucesso');
        toast.success(data.message || 'Contas conectadas com sucesso!');
        
        // Aguardar um pouco para mostrar o toast e depois redirecionar
        setTimeout(() => {
          console.log('🔄 [SELECT ACCOUNTS] Redirecionando para cliente...');
          // Usar replace para evitar problemas de histórico
          window.location.href = `/dashboard/clients/${clientId}?success=meta_connected`;
        }, 1500);
      } else {
        const data = await response.json();
        console.error('❌ [SELECT ACCOUNTS] Erro ao salvar:', data);
        toast.error(data.error || 'Erro ao salvar conexões');
      }
    } catch (error) {
      console.error('💥 [SELECT ACCOUNTS] Erro ao salvar:', error);
      toast.error('Erro ao salvar conexões');
    } finally {
      setIsSaving(false);
    }
  };

  const getAccountStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return <Badge variant="default">Ativa</Badge>;
      case 2:
        return <Badge variant="secondary">Desabilitada</Badge>;
      case 3:
        return <Badge variant="destructive">Não Aprovada</Badge>;
      default:
        return <Badge variant="outline">Desconhecida</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Facebook className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg font-medium">Carregando suas contas Meta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Selecionar Contas Meta Ads
          </h1>
          <p className="text-gray-600">
            Escolha as contas de anúncios e páginas que deseja conectar
          </p>
          
          {/* Debug Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
            <h3 className="font-medium text-blue-800 mb-2">🔍 Informações de Debug:</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>Client ID:</strong> {clientId || 'Não encontrado'}</p>
              <p><strong>Access Token:</strong> {accessToken ? 'Presente' : 'Ausente'}</p>
              <p><strong>Contas encontradas:</strong> {adAccounts.length}</p>
              <p><strong>Páginas encontradas:</strong> {pages.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Contas de Anúncios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                Contas de Anúncios ({adAccounts.length})
              </CardTitle>
              <CardDescription>
                Selecione as contas de anúncios que deseja gerenciar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {adAccounts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma conta de anúncios encontrada
                </p>
              ) : (
                adAccounts.map((account) => (
                  <div key={account.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={`account-${account.id}`}
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => handleAccountToggle(account.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{account.name}</h4>
                        {getAccountStatusBadge(account.account_status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        ID: {account.id} • {account.currency}
                      </p>
                      {account.timezone_name && (
                        <p className="text-xs text-gray-400">
                          Fuso: {account.timezone_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Páginas do Facebook */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Facebook className="w-5 h-5 mr-2 text-blue-600" />
                Páginas do Facebook ({pages.length})
              </CardTitle>
              <CardDescription>
                Selecione as páginas que deseja conectar (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pages.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma página encontrada
                </p>
              ) : (
                pages.map((page) => (
                  <div key={page.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      id={`page-${page.id}`}
                      checked={selectedPages.includes(page.id)}
                      onCheckedChange={() => handlePageToggle(page.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{page.name}</h4>
                        <Badge variant="outline">{page.category}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        ID: {page.id}
                      </p>
                      {page.followers_count && (
                        <p className="text-xs text-gray-400 flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {page.followers_count.toLocaleString()} seguidores
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumo da Seleção */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Resumo da Seleção</h3>
                <p className="text-sm text-gray-500">
                  {selectedAccounts.length} conta(s) de anúncios • {selectedPages.length} página(s)
                </p>
              </div>
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    console.log('🔄 [SELECT ACCOUNTS] Cancelando e redirecionando...');
                    router.push(`/dashboard/clients/${clientId}`);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={selectedAccounts.length === 0 || isSaving}
                >
                  {isSaving ? "Salvando..." : "Conectar Selecionadas"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SelectAccountsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Facebook className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg font-medium">Carregando...</p>
        </div>
      </div>
    }>
      <SelectAccountsContent />
    </Suspense>
  );
}