'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, RefreshCw, Lock, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useUserAccessNew } from '@/hooks/use-user-access-new';
import { UserType } from '@/lib/services/user-access-control';

interface GoogleConnection {
  id: string;
  customer_id: string;
  status: 'active' | 'expired' | 'revoked';
  last_sync_at?: string | null;
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
  const { 
    userType, 
    canCreateConnections, 
    hasActiveSubscription 
  } = useUserAccessNew();

  const getErrorMessageFromResponse = async (
    response: Response,
    fallbackMessage: string
  ): Promise<string> => {
    try {
      const raw = await response.text();

      if (!raw) return fallbackMessage;

      try {
        const data = JSON.parse(raw);
        return data?.error || data?.message || fallbackMessage;
      } catch {
        return raw.slice(0, 200);
      }
    } catch {
      return fallbackMessage;
    }
  };

  const disconnectCurrentConnection = async () => {
    if (!connection) return;

    // Endpoint principal: respeita middleware de acesso já padronizado no sistema
    const deleteResponse = await fetch(
      `/api/google/connections?connectionId=${connection.id}`,
      { method: 'DELETE' }
    );

    if (deleteResponse.ok) {
      return;
    }

    const deleteErrorMessage = await getErrorMessageFromResponse(
      deleteResponse,
      'Falha ao remover conexão'
    );

    throw new Error(`${deleteErrorMessage} (status ${deleteResponse.status})`);
  };

  // Common users cannot create connections
  if (userType === UserType.COMMON_USER) {
    return (
      <Button variant="outline" disabled>
        <Lock className="w-4 h-4 mr-2" />
        Sem Permissão
      </Button>
    );
  }

  const handleConnect = async () => {
    // Check permissions before connecting
    if (!canCreateConnections && userType !== UserType.SUPER_ADMIN) {
      if (!hasActiveSubscription) {
        toast({
          title: 'Assinatura Expirada',
          description: 'Renove seu plano para conectar contas.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Limite Atingido',
          description: 'Limite de conexões atingido. Faça upgrade do seu plano.',
          variant: 'destructive',
        });
      }
      return;
    }

    try {
      setIsConnecting(true);
      
      console.log('[Connect Google Button] Iniciando conexão para clientId:', clientId);
      
      // Use o endpoint correto de auth (POST)
      const response = await fetch('/api/google/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId }),
      });
      
      const data = await response.json();
      console.log('[Connect Google Button] Resposta da API:', data);

      if (!response.ok) {
        if (response.status === 503 && !data.configured) {
          toast({
            title: 'Google Ads Não Configurado',
            description: 'As credenciais do Google Ads não foram configuradas. Entre em contato com o administrador do sistema.',
            variant: 'destructive',
          });
          return;
        }
        
        if (response.status === 401) {
          toast({
            title: 'Não Autorizado',
            description: 'Você precisa estar logado para conectar o Google Ads.',
            variant: 'destructive',
          });
          return;
        }
        
        throw new Error(data.error || data.message || 'Falha ao iniciar autenticação');
      }

      const { authUrl } = data;
      console.log('[Connect Google Button] Redirecionando para:', authUrl);
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('[Connect Google Button] Erro ao conectar Google Ads:', error);
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
      
      if (connection) {
        try {
          await disconnectCurrentConnection();
        } catch (disconnectError) {
          console.warn(
            '[Connect Google Button] Falha ao desconectar antes da reconexão, seguindo para OAuth:',
            disconnectError
          );
          toast({
            title: 'Aviso de Reconexão',
            description:
              'Não foi possível remover a conexão anterior. Vamos tentar reconectar mesmo assim.',
            variant: 'destructive',
          });
        }
      }

      await handleConnect();
    } catch (error) {
      console.error('Erro ao reconectar Google Ads:', error);
      toast({
        title: 'Erro de Reconexão',
        description: error instanceof Error
          ? error.message
          : 'Não foi possível reconectar com o Google Ads. Tente novamente.',
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

      await disconnectCurrentConnection();

      toast({
        title: 'Desconectado',
        description: 'Conta Google Ads desconectada com sucesso.',
      });

      onConnectionUpdate?.();
    } catch (error) {
      console.error('Erro ao desconectar Google Ads:', error);
      toast({
        title: 'Erro ao Desconectar',
        description: error instanceof Error
          ? error.message
          : 'Não foi possível desconectar a conta. Tente novamente.',
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
    
    // Check permissions for button text
    if (!canCreateConnections && userType !== UserType.SUPER_ADMIN) {
      if (!hasActiveSubscription) {
        return 'Plano Expirado';
      }
      return 'Limite Atingido';
    }
    
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
    if (!connection) {
      return handleConnect;
    }
    return handleReconnect;
  };

  const isButtonDisabled = () => {
    if (isConnecting) return true;
    if (userType === UserType.SUPER_ADMIN) return false;
    return !canCreateConnections;
  };

  const getButtonVariant = () => {
    if (!canCreateConnections && userType !== UserType.SUPER_ADMIN) {
      return 'secondary';
    }
    return connection?.status === 'active' ? 'outline' : 'default';
  };

  const getButtonIcon = () => {
    if (!canCreateConnections && userType !== UserType.SUPER_ADMIN) {
      if (!hasActiveSubscription) {
        return <Lock className="w-4 h-4 mr-2" />;
      }
      return <Crown className="w-4 h-4 mr-2" />;
    }
    
    return isConnecting ? (
      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
    ) : (
      <RefreshCw className="w-4 h-4 mr-2" />
    );
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-1">
        <Button
          onClick={getButtonAction()}
          disabled={isButtonDisabled()}
          variant={getButtonVariant()}
          size="sm"
        >
          {getButtonIcon()}
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
                    className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
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
