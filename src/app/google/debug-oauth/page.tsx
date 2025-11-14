'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface OAuthState {
  state: string;
  client_id: string;
  user_id: string;
  provider: string;
  expires_at: string;
  created_at: string;
}

interface GoogleConnection {
  id: string;
  client_id: string;
  customer_id: string;
  status: string;
  token_expires_at: string;
  created_at: string;
}

export default function GoogleOAuthDebugPage() {
  const [states, setStates] = useState<OAuthState[]>([]);
  const [connections, setConnections] = useState<GoogleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/google/debug-oauth-status');
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStates(data.states || []);
      setConnections(data.connections || []);
    } catch (err) {
      console.error('Erro ao buscar informações:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Debug Google OAuth</h1>
            <p className="text-muted-foreground">
              Diagnóstico em tempo real do fluxo OAuth do Google Ads
            </p>
          </div>
          <Button onClick={fetchDebugInfo} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {error && (
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Erro: {error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OAuth States */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              OAuth States ({states.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : states.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum state OAuth encontrado
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Clique em "Conectar Google Ads" para criar um novo state
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {states.map((state, index) => {
                  const expired = isExpired(state.expires_at);
                  return (
                    <div
                      key={state.state}
                      className={`p-4 border rounded-lg ${
                        expired ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            State #{index + 1}
                          </span>
                          {expired ? (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Expirado
                            </Badge>
                          ) : (
                            <Badge className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Válido
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">State:</span>
                          <p className="font-mono text-xs break-all">
                            {state.state.substring(0, 40)}...
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Client ID:</span>
                          <p className="font-mono text-xs">{state.client_id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Criado:</span>
                          <p className="text-xs">{formatDate(state.created_at)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expira:</span>
                          <p className="text-xs">{formatDate(state.expires_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Google Connections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Conexões Google Ads ({connections.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma conexão encontrada
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Complete o fluxo OAuth para criar uma conexão
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {connections.map((conn, index) => {
                  const tokenExpired = isExpired(conn.token_expires_at);
                  const isPending = conn.customer_id === 'pending';
                  
                  return (
                    <div
                      key={conn.id}
                      className={`p-4 border rounded-lg ${
                        isPending
                          ? 'bg-yellow-50 border-yellow-200'
                          : tokenExpired
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            Conexão #{index + 1}
                          </span>
                          {isPending ? (
                            <Badge variant="secondary">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          ) : tokenExpired ? (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Token Expirado
                            </Badge>
                          ) : (
                            <Badge className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ativa
                            </Badge>
                          )}
                          <Badge variant="outline">{conn.status}</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">ID:</span>
                          <p className="font-mono text-xs">{conn.id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Client ID:</span>
                          <p className="font-mono text-xs">{conn.client_id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Customer ID:</span>
                          <p className="font-mono text-xs">{conn.customer_id}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <p className="text-xs">{conn.status}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Criado:</span>
                          <p className="text-xs">{formatDate(conn.created_at)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Token expira:</span>
                          <p className="text-xs">{formatDate(conn.token_expires_at)}</p>
                        </div>
                      </div>
                      
                      {isPending && (
                        <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded">
                          <p className="text-sm font-medium text-yellow-800">
                            ⚠️ Conexão pendente - contas não selecionadas
                          </p>
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              window.location.href = `/google/select-accounts?connectionId=${conn.id}&clientId=${conn.client_id}`;
                            }}
                          >
                            Selecionar Contas Agora
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Como Usar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Verificar States OAuth</h3>
              <p className="text-sm text-muted-foreground">
                States válidos indicam que você iniciou o fluxo OAuth recentemente.
                Se não houver states válidos, clique em "Conectar Google Ads" no dashboard.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">2. Verificar Conexões</h3>
              <p className="text-sm text-muted-foreground">
                Conexões com status "pending" precisam ter as contas selecionadas.
                Conexões com token expirado precisam ser reconectadas.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">3. Completar Fluxo</h3>
              <p className="text-sm text-muted-foreground">
                Se houver uma conexão pendente, clique no botão "Selecionar Contas Agora"
                para completar o processo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
