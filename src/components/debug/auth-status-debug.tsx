'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AuthStatus {
  authenticated: boolean;
  user: any;
  isAdmin: boolean;
  checks: any;
  error?: string;
}

export function AuthStatusDebug() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/auth-status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setStatus({
        authenticated: false,
        user: null,
        isAdmin: false,
        checks: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (loading) {
    return (
      <Card className="p-4">
        <p>Verificando status de autenticação...</p>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="p-4">
        <p className="text-red-600">Erro ao verificar status</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Status de Autenticação</h3>
        <Button onClick={checkStatus} variant="outline" size="sm">
          Atualizar
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Autenticado:</span>
          <span className={status.authenticated ? 'text-green-600' : 'text-red-600'}>
            {status.authenticated ? '✅ Sim' : '❌ Não'}
          </span>
        </div>

        {status.user && (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium">Email:</span>
              <span>{status.user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">ID:</span>
              <span className="text-xs font-mono">{status.user.id}</span>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <span className="font-medium">É Admin:</span>
          <span className={status.isAdmin ? 'text-green-600' : 'text-red-600'}>
            {status.isAdmin ? '✅ Sim' : '❌ Não'}
          </span>
        </div>

        {status.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-600">{status.error}</p>
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer font-medium">Detalhes das Verificações</summary>
          <pre className="mt-2 p-3 bg-muted/50 rounded text-xs overflow-auto">
            {JSON.stringify(status.checks, null, 2)}
          </pre>
        </details>
      </div>

      {!status.authenticated && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800 mb-3">
            Você não está autenticado. Por favor, faça login.
          </p>
          <Button asChild variant="default" size="sm">
            <a href="/login">
              Ir para Login
            </a>
          </Button>
        </div>
      )}

      {status.authenticated && !status.isAdmin && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            Você está autenticado mas não tem permissões de administrador.
          </p>
        </div>
      )}
    </Card>
  );
}
