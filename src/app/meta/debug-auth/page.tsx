'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function MetaDebugAuthPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [tokenStatus, setTokenStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState('test-client-123');

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/meta/debug-auth?clientId=${clientId}`);
      const data = await response.json();
      setDiagnostics(data);
    } catch (error) {
      setDiagnostics({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const testToken = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/meta/test-token');
      const data = await response.json();
      setTokenStatus(data);
    } catch (error) {
      setTokenStatus({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = async () => {
    if (!clientId) {
      alert('Digite um Client ID');
      return;
    }
    window.location.href = `/api/meta/auth?clientId=${clientId}`;
  };

  useEffect(() => {
    runDiagnostics();
    testToken();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">🔍 Meta OAuth Debug</h1>

      <div className="space-y-6">
        {/* Token Status */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Token Status</h2>
          {tokenStatus ? (
            <div className="space-y-2">
              <div className={`p-3 rounded ${tokenStatus.status === 'valid' ? 'bg-green-100' : 'bg-red-100'}`}>
                <p className="font-bold">
                  {tokenStatus.status === 'valid' ? '✅ Token Válido' : '❌ Token Inválido'}
                </p>
                {tokenStatus.user && (
                  <p className="text-sm mt-2">Usuário: {tokenStatus.user.name}</p>
                )}
              </div>
              {tokenStatus.error && (
                <div className="bg-red-50 p-3 rounded text-sm">
                  <p className="font-bold">Erro: {tokenStatus.error}</p>
                  {tokenStatus.instructions && (
                    <div className="mt-3 space-y-1">
                      <p className="font-bold">Como gerar novo token:</p>
                      {tokenStatus.instructions.map((instruction: string, i: number) => (
                        <p key={i} className="text-xs">{instruction}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p>Carregando...</p>
          )}
          <Button onClick={testToken} disabled={loading} className="mt-4">
            Testar Token Novamente
          </Button>
        </Card>

        {/* Diagnostics */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Configuração OAuth</h2>
          {diagnostics ? (
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                <p><strong>API Version:</strong> {diagnostics.config?.API_VERSION}</p>
                <p><strong>OAuth URL:</strong> {diagnostics.config?.OAUTH_URL}</p>
                <p><strong>Redirect URI:</strong> {diagnostics.request?.redirectUri}</p>
                <p><strong>Scopes:</strong> {diagnostics.config?.SCOPES?.join(', ')}</p>
              </div>
              {diagnostics.authUrl && (
                <div className="bg-blue-50 p-3 rounded text-xs break-all">
                  <p className="font-bold mb-2">Auth URL:</p>
                  <p>{diagnostics.authUrl}</p>
                </div>
              )}
            </div>
          ) : (
            <p>Carregando...</p>
          )}
        </Card>

        {/* Test OAuth Flow */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Testar Fluxo OAuth</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Client ID (para teste):</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="test-client-123"
              />
            </div>
            <Button 
              onClick={startOAuth} 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Iniciar OAuth Flow
            </Button>
          </div>
        </Card>

        {/* Raw Diagnostics */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Dados Brutos</h2>
          <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify({ diagnostics, tokenStatus }, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
}
