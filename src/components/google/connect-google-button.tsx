'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface GoogleConnection {
  id: string;
  customer_id: string;
  status: 'active' | 'expired' | 'revoked';
  last_sync_at: string;
}

interface ConnectGoogleButtonProps {
  clientId: string;
  connection?: GoogleConnection;
  onConnectionUpdate?: () => void;
}

export function ConnectGoogleButton({ 
  clientId, 
  connection, 
  onConnectionUpdate 
}: ConnectGoogleButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      
      const response = await fetch('/api/google/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          redirectUri: `${window.location.origin}/api/google/callback`
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && !data.configured) {
          toast({
            title: 'Google Ads Não Configurado',
            description: 'As credenciais do Google Ads não foram configuradas. Entre em contato com o administrador do sistema.',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(data.message || 'Falha ao iniciar autenticação');
      }

      const { authUrl } = data;
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Erro ao conectar Google Ads:', error);
      toast({
        title: 'Erro de Conexão',
        description: error instanceof Error ? error.message : 'Não foi possível conectar com o Google Ads. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnect = async () => {
    try {
      setIsConnecting(true);
      
      // First disconnect existing connection
      if (connection) {
        await fetch('/api/google/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId,
            connectionId: connection.id
          }),
        });
      }

      // Then start new connection
      await handleConnect();
    } catch (error) {
      console.error('Erro ao reconectar Google Ads:', error);
      toast({
        title: 'Erro de Reconexão',
        description: 'Não foi possível reconectar com o Google Ads. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;

    try {
      setIsConnecting(true);
      
      const response = await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          connectionId: connection.id
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao desconectar');
      }

      toast({
        title: 'Desconectado',
        description: 'Conta Google Ads desconectada com sucesso.',
      });

      onConnectionUpdate?.();
    } catch (error) {
      console.error('Erro ao desconectar Google Ads:', error);
      toast({
        title: 'Erro ao Desconectar',
        description: 'Não foi possível desconectar a conta. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusBadge = () => {
    if (!connection) return null;

    switch (connection.status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Token Expirado
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Revogado
          </Badge>
        );
      default:
        return null;
    }
  };

  const getButtonText = () => {
    if (isConnecting) return 'Conectando...';
    
    if (!connection) return 'Conectar Google Ads';
    
    switch (connection.status) {
      case 'active':
        return 'Reconectar';
      case 'expired':
      case 'revoked':
        return 'Reconectar';
      default:
        return 'Conectar Google Ads';
    }
  };

  const getButtonAction = () => {
    if (!connection || connection.status !== 'active') {
      return handleConnect;
    }
    return handleReconnect;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-1">
        <Button
          onClick={getButtonAction()}
          disabled={isConnecting}
          variant={connection?.status === 'active' ? 'outline' : 'default'}
          size="sm"
        >
          {isConnecting ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {getButtonText()}
        </Button>
        
        {connection && (
          <Button
            onClick={handleDisconnect}
            disabled={isConnecting}
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
          >
            Desconectar
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {getStatusBadge()}
        {connection && (
          <span className="text-xs text-muted-foreground">
            ID: {connection.customer_id}
          </span>
        )}
      </div>

      {/* Account Selection Modal */}
      <Dialog open={showAccountSelector} onOpenChange={setShowAccountSelector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar Conta Google Ads</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {isLoadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Carregando contas...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {availableAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      // Handle account selection
                      setShowAccountSelector(false);
                    }}
                  >
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {account.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}