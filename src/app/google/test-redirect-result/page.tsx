/**
 * Página de teste para verificar se parâmetros de redirect chegam corretamente
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

// Forçar renderização dinâmica (não fazer pre-render estático)
export const dynamic = 'force-dynamic';

function TestRedirectResultContent() {
  const searchParams = useSearchParams();
  const [params, setParams] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    console.log('[Test Redirect Result] 🧪 PÁGINA DE TESTE CARREGADA');
    console.log('[Test Redirect Result] Timestamp:', new Date().toISOString());
    
    // Coletar todos os parâmetros
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
      console.log(`[Test Redirect Result] - ${key}: ${value}`);
    });
    
    setParams(allParams);
    setLoaded(true);
  }, [searchParams]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  const hasAllParams = params.testId && params.connectionId && params.clientId;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Teste de Redirect com Parâmetros</h1>
          <p className="text-muted-foreground">
            Verificando se os parâmetros de URL chegam corretamente após redirect
          </p>
        </div>

        {hasAllParams ? (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ Todos os parâmetros foram recebidos corretamente!
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              ❌ Alguns parâmetros estão faltando
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Parâmetros Recebidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="border-b pb-3 last:border-b-0">
                  <div className="font-mono text-sm">
                    <span className="font-bold text-blue-600">{key}:</span>
                    <span className="ml-2 text-gray-700">{value}</span>
                  </div>
                </div>
              ))}
              
              {Object.keys(params).length === 0 && (
                <p className="text-muted-foreground">Nenhum parâmetro recebido</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Resumo do Teste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              {params.testId ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span>testId: {params.testId ? '✅ Recebido' : '❌ Faltando'}</span>
            </div>
            <div className="flex items-center gap-2">
              {params.connectionId ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span>connectionId: {params.connectionId ? '✅ Recebido' : '❌ Faltando'}</span>
            </div>
            <div className="flex items-center gap-2">
              {params.clientId ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span>clientId: {params.clientId ? '✅ Recebido' : '❌ Faltando'}</span>
            </div>
            <div className="flex items-center gap-2">
              {params.timestamp ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span>timestamp: {params.timestamp ? '✅ Recebido' : '❌ Faltando'}</span>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Como testar:</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Acesse: <code className="bg-white px-2 py-1 rounded">http://localhost:3000/api/google/test-redirect</code></li>
            <li>Você será redirecionado para esta página</li>
            <li>Verifique se todos os parâmetros aparecem acima</li>
            <li>Se todos aparecerem, o redirect funciona corretamente</li>
            <li>Se algum faltar, há um problema com a transferência de parâmetros</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function TestRedirectResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <TestRedirectResultContent />
    </Suspense>
  );
}
