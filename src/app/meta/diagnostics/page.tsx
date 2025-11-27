'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function MetaDiagnosticsPage() {
  const [loading, setLoading] = useState(false);
  const [apiTest, setApiTest] = useState<any>(null);
  const [connectionsTest, setConnectionsTest] = useState<any>(null);

  const runApiTests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/meta/test-connection');
      const data = await response.json();
      setApiTest(data);
    } catch (error) {
      console.error('Erro ao executar testes de API:', error);
      setApiTest({ error: 'Falha ao executar testes' });
    } finally {
      setLoading(false);
    }
  };

  const runConnectionsTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/meta/check-connections');
      const data = await response.json();
      setConnectionsTest(data);
    } catch (error) {
      console.error('Erro ao verificar conexões:', error);
      setConnectionsTest({ error: 'Falha ao verificar conexões' });
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    await runApiTests();
    await runConnectionsTest();
  };

  const getStatusIcon = (status: string | boolean) => {
    if (status === true || status?.toString().includes('✅') || status?.toString().includes('Sucesso')) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (status === false || status?.toString().includes('❌') || status?.toString().includes('Falhou')) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Diagnóstico Completo - Meta Ads</h1>
        <p className="text-muted-foreground">
          Ferramenta de diagnóstico para identificar e resolver problemas com a integração Meta Ads
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Executar Diagnóstico</CardTitle>
          <CardDescription>
            Execute todos os testes para verificar a saúde da integração
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={runAllTests} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Executando...' : 'Executar Todos os Testes'}
          </Button>
          <Button onClick={runApiTests} variant="outline" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Testar API
          </Button>
          <Button onClick={runConnectionsTest} variant="outline" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Verificar Conexões
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="api" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api">Testes de API</TabsTrigger>
          <TabsTrigger value="connections">Conexões do Usuário</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          {apiTest && (
            <>
              {/* Variáveis de Ambiente */}
              <Card>
                <CardHeader>
                  <CardTitle>Variáveis de Ambiente</CardTitle>
                  <CardDescription>Configuração do Meta Ads no servidor</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(apiTest.environment || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between p-3 border rounded">
                        <span className="font-mono text-sm">{key}</span>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(value)}
                          <span className="text-sm">{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Testes de Validação */}
              <Card>
                <CardHeader>
                  <CardTitle>Testes de Validação da API</CardTitle>
                  <CardDescription>Verificação de credenciais e permissões</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(apiTest.tests || {}).map(([testName, testResult]: [string, any]) => (
                      <div key={testName} className="border rounded p-4">
                        <div className="flex items-center gap-2 mb-3">
                          {getStatusIcon(testResult.status)}
                          <h3 className="font-semibold capitalize">
                            {testName.replace(/([A-Z])/g, ' $1').trim()}
                          </h3>
                        </div>
                        
                        <div className="ml-7 space-y-2">
                          {testResult.error && (
                            <Alert variant="destructive">
                              <AlertTitle>Erro</AlertTitle>
                              <AlertDescription>
                                <pre className="text-xs overflow-auto mt-2">
                                  {JSON.stringify(testResult.error, null, 2)}
                                </pre>
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {testResult.data && (
                            <div className="bg-muted p-3 rounded">
                              <p className="text-xs font-semibold mb-2">Dados retornados:</p>
                              <pre className="text-xs overflow-auto">
                                {JSON.stringify(testResult.data, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {testResult.count !== undefined && (
                            <Alert>
                              <AlertDescription>
                                <strong>Contas de anúncios encontradas:</strong> {testResult.count}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {testResult.accounts && testResult.accounts.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold">Contas disponíveis:</p>
                              {testResult.accounts.map((account: any) => (
                                <div key={account.id} className="bg-muted p-3 rounded">
                                  <p className="font-semibold">{account.name}</p>
                                  <p className="text-sm text-muted-foreground">ID: {account.id}</p>
                                  <p className="text-sm">Status: {account.account_status} | Moeda: {account.currency}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {testResult.permissions && (
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">Permissões:</p>
                              {testResult.permissions.map((perm: any) => (
                                <div key={perm.permission} className="flex items-center gap-2 text-sm">
                                  {getStatusIcon(perm.status === 'granted')}
                                  <span>{perm.permission}: {perm.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!apiTest && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhum teste executado</AlertTitle>
              <AlertDescription>
                Clique em "Executar Todos os Testes" ou "Testar API" para começar
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          {connectionsTest && !connectionsTest.error && (
            <>
              {/* Resumo */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumo</CardTitle>
                  <CardDescription>Visão geral das suas conexões Meta Ads</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border rounded text-center">
                      <p className="text-2xl font-bold">{connectionsTest.summary?.organizations || 0}</p>
                      <p className="text-sm text-muted-foreground">Organizações</p>
                    </div>
                    <div className="p-4 border rounded text-center">
                      <p className="text-2xl font-bold">{connectionsTest.summary?.clients || 0}</p>
                      <p className="text-sm text-muted-foreground">Clientes</p>
                    </div>
                    <div className="p-4 border rounded text-center">
                      <p className="text-2xl font-bold">{connectionsTest.summary?.connections || 0}</p>
                      <p className="text-sm text-muted-foreground">Conexões Meta</p>
                    </div>
                    <div className="p-4 border rounded text-center">
                      <p className="text-2xl font-bold">{connectionsTest.summary?.campaigns || 0}</p>
                      <p className="text-sm text-muted-foreground">Campanhas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Clientes e Conexões */}
              <Card>
                <CardHeader>
                  <CardTitle>Clientes e Conexões</CardTitle>
                  <CardDescription>Detalhes das conexões Meta por cliente</CardDescription>
                </CardHeader>
                <CardContent>
                  {connectionsTest.clients && connectionsTest.clients.length > 0 ? (
                    <div className="space-y-4">
                      {connectionsTest.clients.map((client: any) => (
                        <div key={client.id} className="border rounded p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">{client.name}</h3>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>{client.connections} conexões</span>
                              <span>{client.campaigns} campanhas</span>
                            </div>
                          </div>
                          
                          {client.connectionDetails && client.connectionDetails.length > 0 ? (
                            <div className="space-y-2 ml-4">
                              {client.connectionDetails.map((conn: any) => (
                                <div key={conn.id} className="bg-muted p-3 rounded">
                                  <div className="flex items-center gap-2 mb-1">
                                    {getStatusIcon(conn.is_active)}
                                    <p className="font-medium">{conn.account_name}</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    ID: {conn.ad_account_id}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Criado: {new Date(conn.created_at).toLocaleString('pt-BR')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Alert>
                              <AlertDescription>
                                Nenhuma conexão Meta configurada para este cliente
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Nenhum cliente encontrado</AlertTitle>
                      <AlertDescription>
                                Você não possui clientes cadastrados ou não tem permissão para visualizá-los
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {connectionsTest?.error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Erro ao verificar conexões</AlertTitle>
              <AlertDescription>
                {connectionsTest.error}
                {connectionsTest.details && (
                  <pre className="mt-2 text-xs overflow-auto">
                    {connectionsTest.details}
                  </pre>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!connectionsTest && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhuma verificação executada</AlertTitle>
              <AlertDescription>
                Clique em "Executar Todos os Testes" ou "Verificar Conexões" para começar
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {(apiTest || connectionsTest) && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Última execução: {new Date().toLocaleString('pt-BR')}
        </div>
      )}
    </div>
  );
}
