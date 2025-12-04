"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, RefreshCw, Facebook } from "lucide-react";
import { toast } from "sonner";

interface MetaConnection {
  id: string;
  ad_account_id: string;
  account_name: string;
  currency: string;
  is_active: boolean;
  created_at: string;
}

interface ManageConnectionsProps {
  clientId: string;
  connections: MetaConnection[];
}

export function ManageConnections({ clientId, connections }: ManageConnectionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<MetaConnection | null>(null);
  const router = useRouter();

  const handleDisconnect = async (connectionId: string) => {
    setIsLoading(true);
    try {
      console.log('Removendo conexão:', connectionId);
      
      const response = await fetch(`/api/meta/connections/${connectionId}`, {
        method: 'DELETE',
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Sucesso:', data);
        toast.success("Conexão removida com sucesso!");
        router.refresh();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('Erro na resposta:', errorData);
        toast.error(errorData.error || "Erro ao remover conexão");
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast.error(`Erro ao remover conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    setIsLoading(true);
    try {
      console.log('Limpando todas as conexões...');
      
      const response = await fetch(`/api/meta/connections/clear-all?clientId=${clientId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Todas as conexões foram removidas!");
        router.refresh();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao limpar conexões");
      }
      
    } catch (error) {
      console.error('Erro ao limpar conexões:', error);
      toast.error('Erro ao limpar conexões');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = async () => {
    setIsLoading(true);
    try {
      console.log('Iniciando reconexão para cliente:', clientId);
      
      // Gerar URL de autorização
      const response = await fetch(`/api/meta/auth?clientId=${clientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Auth URL gerada:', data.authUrl ? 'sim' : 'não');
      
      if (data.authUrl) {
        // Avisar que as conexões antigas serão substituídas
        toast.info('Redirecionando para Meta... As conexões antigas serão substituídas.');
        
        // Pequeno delay para mostrar o toast
        setTimeout(() => {
          window.location.href = data.authUrl;
        }, 1000);
      } else {
        toast.error('Erro ao gerar URL de autorização');
      }
    } catch (error) {
      console.error('Erro ao reconectar:', error);
      toast.error(`Erro ao reconectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (connections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Conexões Meta Ads</h3>
        <div className="flex space-x-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Todas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar Todas as Conexões</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá remover TODAS as {connections.length} conexões Meta Ads deste cliente. 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Limpar Todas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reconectar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reconectar Meta Ads</DialogTitle>
                <DialogDescription>
                  Isso irá remover todas as conexões atuais e permitir que você selecione 
                  novas contas de anúncios. Deseja continuar?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>
                  Cancelar
                </Button>
                <Button onClick={handleReconnect} disabled={isLoading}>
                  {isLoading ? "Reconectando..." : "Sim, Reconectar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {connections.map((connection) => (
          <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Facebook className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium">{connection.account_name}</h4>
                <p className="text-sm text-muted-foreground">
                  ID: {connection.ad_account_id} • {connection.currency}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Conectado em {new Date(connection.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Badge variant={connection.is_active ? "default" : "secondary"}>
                {connection.is_active ? "Ativa" : "Inativa"}
              </Badge>
            </div>

            <div className="flex space-x-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover Conexão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover a conexão com "{connection.account_name}"? 
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDisconnect(connection.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
        <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">💡 Dica:</p>
        <p className="text-blue-700 dark:text-blue-400">
          Use "Reconectar" para escolher contas específicas. O Meta mostrará todas as suas 
          contas disponíveis e você poderá selecionar apenas as que deseja conectar.
        </p>
      </div>
    </div>
  );
}