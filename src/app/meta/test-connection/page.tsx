'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function MetaTestConnectionPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runTests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/meta/test-connection');
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Erro ao executar testes:', error);
      setResults({ error: 'Falha ao executar testes' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status?.includes('✅')) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status?.includes('❌')) return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Diagnóstico Meta Ads</h1>
        <p className="text-muted-foreground">
          Teste a conexão e configuração da integração com Meta Marketing API
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Executar Testes</CardTitle>
          <CardDescription>
            Clique no botão abaixo para verificar a configuração do Meta Ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runTests} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Executando testes...' : 'Executar Diagnóstico'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <>
          {/* Variáveis de Ambiente */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Variáveis de Ambiente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(results.environment || {}).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between p-2 border rounded">
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
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Testes de Validação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(results.tests || {}).map(([testName, testResult]: [string, any]) => (
                  <div key={testName} className="border rounded p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(testResult.status)}
                      <h3 className="font-semibold capitalize">
                        {testName.replace(/([A-Z])/g, ' $1').trim()}
                      </h3>
                    </div>
                    
                    <div className="ml-7">
                      <p className="text-sm text-muted-foreground mb-2">{testResult.status}</p>
                      
                      {testResult.error && (
                        <Alert variant="destructive" className="mb-2">
                          <AlertDescription>
                            <pre className="text-xs overflow-auto">
                              {JSON.stringify(testResult.error, null, 2)}
                            </pre>
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {testResult.data && (
                        <div className="bg-muted p-2 rounded">
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(testResult.data, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {testResult.count !== undefined && (
                        <p className="text-sm">
                          <strong>Contas encontradas:</strong> {testResult.count}
                        </p>
                      )}
                      
                      {testResult.accounts && (
                        <div className="mt-2 space-y-1">
                          {testResult.accounts.map((account: any) => (
                            <div key={account.id} className="text-sm bg-muted p-2 rounded">
                              <strong>{account.name}</strong> ({account.id})
                              <br />
                              Status: {account.account_status} | Moeda: {account.currency}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {testResult.permissions && (
                        <div className="mt-2 space-y-1">
                          {testResult.permissions.map((perm: any) => (
                            <div key={perm.permission} className="text-sm">
                              {perm.permission}: {perm.status}
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

          {/* Timestamp */}
          <div className="text-center text-sm text-muted-foreground">
            Executado em: {new Date(results.timestamp).toLocaleString('pt-BR')}
          </div>
        </>
      )}
    </div>
  );
}
