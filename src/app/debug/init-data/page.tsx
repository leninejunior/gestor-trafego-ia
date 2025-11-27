'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function InitDataPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/debug/init-minimal-data', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao inicializar dados');
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Inicializar Dados Mínimos</h1>
          
          <p className="text-gray-600 mb-6">
            Este formulário cria uma organização, cliente e membership para sua conta.
            Necessário para que o app funcione corretamente.
          </p>

          <Button 
            onClick={handleInitialize}
            disabled={loading}
            className="mb-6"
          >
            {loading ? 'Inicializando...' : 'Inicializar Dados'}
          </Button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
              <h3 className="font-semibold text-red-900 mb-2">Erro</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h3 className="font-semibold text-green-900 mb-2">✅ Sucesso!</h3>
              <p className="text-green-700 mb-4">{result.message}</p>
              
              <div className="bg-white rounded p-3 text-sm font-mono text-gray-700 overflow-auto max-h-64">
                <pre>{JSON.stringify(result.data, null, 2)}</pre>
              </div>

              <p className="text-green-700 mt-4 text-sm">
                Você pode agora acessar o <a href="/dashboard" className="underline font-semibold">dashboard</a>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
