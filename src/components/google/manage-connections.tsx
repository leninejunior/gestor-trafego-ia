'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GoogleConnection {
  id: string;
  customer_id: string;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  last_sync_at: string | null;
}

interface ManageConnectionsProps {
  clientId: string;
}

export function ManageConnections({ clientId }: ManageConnectionsProps) {
  const [connections, setConnections] = useState<GoogleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/google/connections?clientId=${clientId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar conexões');
      }

      setConnections(data.connections || []);
    } catch (err) {
      console.error('Erro ao buscar conexões:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Tem certeza que deseja desconectar esta conta?')) {
      return;
    }

    try {
      setDeletingId(connectionId);
      setError(null);

      const response = await fetch(`/api/google/connections?connectionId=${connectionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao desconectar conta');
      }

      // Atualizar lista
      await fetchConnections();
    } catch (err) {
      console.error('Erro ao desconectar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao desconectar');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReconnect = async (customerId: string) => {
    // Redirecionar para o fluxo OAuth
    window.location.href = `/api/google/auth?clientId=${clientId}`;
  };

  useEffect(() => {
    if (clientId) {
      fetchConnections();
    }
  }, [clientId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Ativo</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expirado</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revogado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status das Conexões</CardTitle>
          <CardDescription>Carregando conexões...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Status das Conexões</CardTitle>
            <CardDescription>
              Status das contas Google Ads conectadas
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConnections}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma conta conectada</p>
            <p className="text-sm mt-2">
              Conecte uma conta Google Ads para começar
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              {connections.length} {connections.length === 1 ? 'conta conectada' : 'contas conectadas'}
            </div>

            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(connection.status)}
                    <span className="font-mono text-sm">
                      ID: {connection.customer_id}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Conectado em: {new Date(connection.created_at).toLocaleDateString('pt-BR')}
                    {connection.last_sync_at && (
                      <span className="ml-4">
                        Última sincronização: {new Date(connection.last_sync_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {connection.status !== 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReconnect(connection.customer_id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reconectar
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(connection.id)}
                    disabled={deletingId === connection.id}
                  >
                    {deletingId === connection.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Desconectar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
