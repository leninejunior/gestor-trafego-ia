'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Play,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SyncStatus {
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'error' | 'success';
  progress?: number;
  nextScheduledSync: string;
  error?: string;
  campaignsSynced?: number;
  metricsUpdated?: number;
}

interface SyncStatusProps {
  clientId: string;
  compact?: boolean;
  autoRefresh?: boolean;
}

export function GoogleSyncStatus({ 
  clientId, 
  compact = false, 
  autoRefresh = true 
}: SyncStatusProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    status: 'idle',
    nextScheduledSync: '',
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch(`/api/google/sync/status?clientId=${clientId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar status de sincronização');
      }

      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
      setSyncStatus(prev => ({
        ...prev,
        status: 'error',
        error: 'Não foi possível carregar o status de sincronização'
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setIsManualSyncing(true);
      
      const response = await fetch('/api/google/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          fullSync: false
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao iniciar sincronização');
      }

      const data = await response.json();
      
      toast({
        title: 'Sincronização Iniciada',
        description: 'A sincronização manual foi iniciada com sucesso.',
      });

      // Update status to syncing
      setSyncStatus(prev => ({
        ...prev,
        status: 'syncing',
        progress: 0
      }));

      // Poll for updates
      const pollInterval = setInterval(async () => {
        await fetchSyncStatus();
        
        // Stop polling when sync is complete
        if (syncStatus.status !== 'syncing') {
          clearInterval(pollInterval);
        }
      }, 2000);

    } catch (error) {
      console.error('Erro ao iniciar sync:', error);
      toast({
        title: 'Erro na Sincronização',
        description: 'Não foi possível iniciar a sincronização manual.',
        variant: 'destructive',
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchSyncStatus();
    }
  }, [clientId]);

  useEffect(() => {
    if (!autoRefresh || !clientId) return;

    const interval = setInterval(fetchSyncStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, clientId]);

  const getStatusIcon = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'idle':
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return <Badge className="bg-blue-100 text-blue-800">Sincronizando</Badge>;
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'idle':
      default:
        return <Badge variant="secondary">Aguardando</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora mesmo';
    if (diffInMinutes < 60) return `${diffInMinutes} min atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNextSync = (dateString: string) => {
    if (!dateString) return 'Não agendado';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((date.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 0) return 'Em breve';
    if (diffInMinutes < 60) return `Em ${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `Em ${Math.floor(diffInMinutes / 60)}h`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card className={compact ? 'p-4' : ''}>
        <CardContent className={compact ? 'p-0' : 'p-6'}>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {getStatusBadge()}
        </div>
        
        <div className="flex-1 text-sm">
          <div>Última sync: {formatDate(syncStatus.lastSync)}</div>
          {syncStatus.status === 'syncing' && syncStatus.progress !== undefined && (
            <Progress value={syncStatus.progress} className="w-full mt-1" />
          )}
        </div>
        
        <Button
          onClick={handleManualSync}
          disabled={isManualSyncing || syncStatus.status === 'syncing'}
          variant="outline"
          size="sm"
        >
          {isManualSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            Status de Sincronização
          </div>
          <Button
            onClick={fetchSyncStatus}
            variant="ghost"
            size="sm"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status Atual:</span>
          {getStatusBadge()}
        </div>

        {/* Progress Bar for Active Sync */}
        {syncStatus.status === 'syncing' && syncStatus.progress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso da Sincronização</span>
              <span>{syncStatus.progress}%</span>
            </div>
            <Progress value={syncStatus.progress} className="w-full" />
          </div>
        )}

        {/* Last Sync Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Última Sincronização:</span>
            <div className="font-medium">{formatDate(syncStatus.lastSync)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Próxima Sincronização:</span>
            <div className="font-medium">{formatNextSync(syncStatus.nextScheduledSync)}</div>
          </div>
        </div>

        {/* Sync Results */}
        {(syncStatus.campaignsSynced !== undefined || syncStatus.metricsUpdated !== undefined) && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {syncStatus.campaignsSynced !== undefined && (
              <div>
                <span className="text-muted-foreground">Campanhas Sincronizadas:</span>
                <div className="font-medium">{syncStatus.campaignsSynced}</div>
              </div>
            )}
            {syncStatus.metricsUpdated !== undefined && (
              <div>
                <span className="text-muted-foreground">Métricas Atualizadas:</span>
                <div className="font-medium">{syncStatus.metricsUpdated}</div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {syncStatus.status === 'error' && syncStatus.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {syncStatus.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Manual Sync Button */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleManualSync}
            disabled={isManualSyncing || syncStatus.status === 'syncing'}
            className="flex-1"
          >
            {isManualSyncing || syncStatus.status === 'syncing' ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Sincronizar Agora
              </>
            )}
          </Button>
          
          <Button
            onClick={fetchSyncStatus}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Info Note */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            A sincronização automática ocorre a cada 6 horas. 
            Use a sincronização manual apenas quando necessário para evitar limites de API.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}