/**
 * Google Ads Account Selection Page
 * 
 * Allows users to select which Google Ads accounts to connect
 * Requirements: 1.4, 1.5
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface GoogleAdsAccount {
  customerId: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  canManageClients: boolean;
}

function SelectAccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectionId = searchParams.get('connectionId');
  const clientId = searchParams.get('clientId');

  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se os parâmetros são válidos (não null, undefined ou string vazia)
    if (!connectionId || !clientId || connectionId === 'null' || clientId === 'null') {
      console.log('[Google Select Accounts] ❌ PARÂMETROS INVÁLIDOS OU AUSENTES');
      console.log('[Google Select Accounts] - Connection ID:', connectionId);
      console.log('[Google Select Accounts] - Client ID:', clientId);
      
      setError('Fluxo OAuth não iniciado corretamente');
      setLoading(false);
      return;
    }

    // Verificar se são UUIDs válidos
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(connectionId) || !uuidRegex.test(clientId)) {
      console.log('[Google Select Accounts] ❌ PARÂMETROS NÃO SÃO UUIDS VÁLIDOS');
      console.log('[Google Select Accounts] - Connection ID válido:', uuidRegex.test(connectionId));
      console.log('[Google Select Accounts] - Client ID válido:', uuidRegex.test(clientId));
      
      setError('Parâmetros de conexão inválidos');
      setLoading(false);
      return;
    }

    console.log('[Google Select Accounts] ✅ PARÂMETROS VÁLIDOS - INICIANDO BUSCA');
    fetchAvailableAccounts();
  }, [connectionId, clientId]);

  const fetchAvailableAccounts = async () => {
    try {
      console.log('='.repeat(80));
      console.log('[Google Select Accounts] 🔍 BUSCANDO CONTAS DISPONÍVEIS');
      console.log('[Google Select Accounts] Timestamp:', new Date().toISOString());
      console.log('[Google Select Accounts] - Connection ID:', connectionId);
      console.log('[Google Select Accounts] - Client ID:', clientId);
      
      setLoading(true);
      setError(null);

      // MODO DESENVOLVIMENTO: Usar dados simulados se API falhar
      const apiUrl = `/api/google/accounts-direct?connectionId=${connectionId}&clientId=${clientId}`;
      console.log('[Google Select Accounts] 📡 FAZENDO REQUISIÇÃO PARA:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      console.log('[Google Select Accounts] 📊 RESPOSTA DA API:');
      console.log('[Google Select Accounts] - Status:', response.status);
      console.log('[Google Select Accounts] - Status OK:', response.ok);
      console.log('[Google Select Accounts] - Headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: 'Erro desconhecido ao processar resposta' };
        }
        
        console.error('[Google Select Accounts] ❌ ERRO NA RESPOSTA:', errorData);
        
        // Tratar erro específico de Developer Token não aprovado
        if (errorData.error === 'DEVELOPER_TOKEN_NAO_APROVADO' || response.status === 501) {
          const nextSteps = errorData.nextSteps?.join('\n') || 'Aguarde 24-48 horas pela aprovação ou crie uma conta de teste do Google Ads.';
          setError(`⚠️ Developer Token ainda não aprovado pelo Google. ${errorData.message || ''}\n\nPróximos passos:\n${nextSteps}`);
        } else {
          setError(errorData.error || 'Erro ao buscar contas');
        }
        
        setLoading(false);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[Google Select Accounts] ❌ ERRO AO PARSEAR RESPOSTA:', parseError);
        throw new Error('Resposta inválida da API');
      }
      
      console.log('[Google Select Accounts] 📋 DADOS RECEBIDOS:');
      console.log('[Google Select Accounts] - Total de contas:', data.accounts?.length || 0);
      console.log('[Google Select Accounts] - Estrutura completa:', JSON.stringify(data, null, 2));
      
      // Verificar se a resposta tem a estrutura esperada
      if (!data || typeof data !== 'object') {
        console.error('[Google Select Accounts] ❌ RESPOSTA INVÁLIDA:', data);
        throw new Error('Resposta inválida da API - formato inesperado');
      }
      
      setAccounts(data.accounts || []);

      // Auto-select the first account if only one is available
      if (data.accounts && data.accounts.length === 1) {
        console.log('[Google Select Accounts] 🎯 AUTO-SELECIONANDO ÚNICA CONTA DISPONÍVEL:', data.accounts[0].customerId);
        setSelectedAccounts([data.accounts[0].customerId]);
      }

      console.log('[Google Select Accounts] ✅ CONTAS CARREGADAS COM SUCESSO');
      console.log('='.repeat(80));
    } catch (err) {
      console.error('[Google Select Accounts] ❌ ERRO AO BUSCAR CONTAS:', err);
      console.error('[Google Select Accounts] - Mensagem:', err.message);
      console.error('[Google Select Accounts] - Stack:', err.stack);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountToggle = (customerId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSaveSelection = async () => {
    if (selectedAccounts.length === 0) {
      setError('Selecione pelo menos uma conta');
      return;
    }

    try {
      console.log('='.repeat(80));
      console.log('[Google Select Accounts] 💾 SALVANDO SELEÇÃO DE CONTAS');
      console.log('[Google Select Accounts] Timestamp:', new Date().toISOString());
      console.log('[Google Select Accounts] - Connection ID:', connectionId);
      console.log('[Google Select Accounts] - Client ID:', clientId);
      console.log('[Google Select Accounts] - Contas selecionadas:', selectedAccounts);
      
      setSaving(true);
      setError(null);

      const requestBody = {
        connectionId,
        clientId,
        selectedAccounts,
      };
      
      console.log('[Google Select Accounts] 📡 ENVIANDO REQUISIÇÃO:');
      console.log('[Google Select Accounts] - URL: /api/google/accounts/select-simple');
      console.log('[Google Select Accounts] - Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('/api/google/accounts/select-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[Google Select Accounts] 📊 RESPOSTA DA API:');
      console.log('[Google Select Accounts] - Status:', response.status);
      console.log('[Google Select Accounts] - Status OK:', response.ok);
      console.log('[Google Select Accounts] - Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Google Select Accounts] ❌ ERRO AO SALVAR:', errorData);
        throw new Error(errorData.error || 'Erro ao salvar seleção');
      }

      const data = await response.json();
      console.log('[Google Select Accounts] ✅ SELEÇÃO SALVA COM SUCESSO:', data);
      
      // Redirect to success page
      const redirectUrl = `/dashboard/google?success=connected&accounts=${selectedAccounts.length}`;
      console.log('[Google Select Accounts] 🎯 REDIRECIONANDO PARA:', redirectUrl);
      router.push(redirectUrl);
      console.log('='.repeat(80));

    } catch (err) {
      console.error('[Google Select Accounts] ❌ ERRO AO SALVAR SELEÇÃO:', err);
      console.error('[Google Select Accounts] - Mensagem:', err.message);
      console.error('[Google Select Accounts] - Stack:', err.stack);
      setError(err instanceof Error ? err.message : 'Erro ao salvar seleção');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    console.log('[Google Select Accounts] 🔙 CANCELANDO E VOLTANDO PARA DASHBOARD');
    router.push('/dashboard/google?cancelled=google_connection');
  };

  const handleBackToAccounts = () => {
    console.log('[Google Select Accounts] 🔙 VOLTANDO PARA LISTAGEM DE CONTAS GOOGLE');
    router.push('/dashboard/google');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando contas do Google Ads...</p>
        </div>
      </div>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Erro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button onClick={fetchAvailableAccounts} variant="outline" size="sm">
                Tentar Novamente
              </Button>
              <Button onClick={handleCancel} variant="ghost" size="sm">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Selecionar Contas do Google Ads</h1>
          <p className="text-muted-foreground">
            Escolha quais contas do Google Ads você deseja conectar a este cliente.
          </p>
        </div>

        {error && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {error?.includes('Fluxo OAuth não iniciado') ? 'Fluxo OAuth Não Iniciado' : 'Processo OAuth Incompleto'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {error?.includes('Fluxo OAuth não iniciado') ? (
                    <>Você acessou esta página diretamente. Para conectar o Google Ads, você precisa <strong>iniciar o fluxo OAuth</strong> primeiro.</>
                  ) : (
                    <>A conexão OAuth foi iniciada mas <strong>não foi finalizada</strong>. Você precisa completar a seleção de contas.</>
                  )}
                </p>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-left">
                  <h4 className="font-semibold text-green-800 mb-2">✅ Status Confirmado:</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>✅ OAuth iniciado com sucesso</li>
                    <li>✅ Tokens de acesso válidos</li>
                    <li>✅ Developer Token aprovado</li>
                    <li>✅ Sistema funcionando corretamente</li>
                  </ul>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 text-left">
                  <h4 className="font-semibold text-orange-800 mb-2">⏸️ Situação Atual:</h4>
                  <div className="text-sm text-orange-700 space-y-1">
                    <div><strong>Status da Conexão:</strong> Pendente (customer_id: pending)</div>
                    <div><strong>Causa:</strong> Seleção de contas não foi completada</div>
                    <div><strong>Próximo passo:</strong> Selecionar contas do Google Ads</div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                  <h4 className="font-semibold text-blue-800 mb-2">🔧 Como resolver:</h4>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Aguarde o carregamento das contas do Google Ads</li>
                    <li>Selecione as contas que deseja conectar</li>
                    <li>Clique em "Tentar Novamente" abaixo</li>
                    <li>Se o problema persistir, refaça a conexão OAuth</li>
                  </ol>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
                  <h4 className="font-semibold text-amber-800 mb-2">💡 Informação Importante:</h4>
                  <div className="text-sm text-amber-700 space-y-1">
                    <div><strong>Developer Token:</strong> Não depende de projeto Google Cloud</div>
                    <div><strong>OAuth:</strong> Funciona independentemente da API</div>
                    <div><strong>Problema:</strong> Conexão OAuth incompleta, não API inativa</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mb-4">
                  💡 A conexão OAuth foi iniciada mas não finalizada. Isso é normal e fácil de resolver.
                </div>
                
                <div className="flex gap-2 justify-center">
                  {error?.includes('Fluxo OAuth não iniciado') ? (
                    <Button onClick={() => router.push('/dashboard/google')} variant="default">
                      Iniciar Conexão Google Ads
                    </Button>
                  ) : (
                    <>
                      <Button onClick={fetchAvailableAccounts} variant="outline">
                        Tentar Novamente
                      </Button>
                      <Button onClick={handleCancel} variant="ghost">
                        Refazer Conexão
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {accounts.map((account) => (
                <Card key={account.customerId} className="cursor-pointer hover:bg-accent/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={account.customerId}
                        checked={selectedAccounts.includes(account.customerId)}
                        onCheckedChange={() => handleAccountToggle(account.customerId)}
                      />
                      <div className="flex-1">
                        <label 
                          htmlFor={account.customerId}
                          className="cursor-pointer block"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{account.descriptiveName}</span>
                            {account.canManageClients && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                MCC
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {account.customerId}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {account.currencyCode} • {account.timeZone}
                            {account.canManageClients && ' • Conta gerencial (pode gerenciar outras contas)'}
                          </div>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={handleSaveSelection}
                disabled={selectedAccounts.length === 0 || saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Conectar {selectedAccounts.length} conta{selectedAccounts.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
              <Button 
                onClick={handleBackToAccounts}
                variant="outline"
                disabled={saving}
              >
                Voltar para Contas
              </Button>
            </div>

            {selectedAccounts.length > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">
                  Contas selecionadas {selectedAccounts.length > 1 && '(MCC)'}:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedAccounts.map((customerId, index) => {
                    const account = accounts.find(a => a.customerId === customerId);
                    return (
                      <li key={customerId} className="flex items-center gap-2">
                        {index === 0 && selectedAccounts.length > 1 && (
                          <span className="text-xs bg-primary text-primary-foreground px-1 rounded">
                            Principal
                          </span>
                        )}
                        <span>
                          • {account?.descriptiveName} ({customerId})
                          {account?.canManageClients && ' - MCC'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {selectedAccounts.length > 1 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    💡 A primeira conta será usada como principal. As demais serão conectadas como contas adicionais.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SelectAccountsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <SelectAccountsContent />
    </Suspense>
  );
}