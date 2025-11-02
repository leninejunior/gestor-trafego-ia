'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  HardDrive
} from 'lucide-react';

interface SyncMetrics {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  success_rate: number;
  avg_duration_ms: number;
  last_sync_at: string | null;
}

interface StorageMetrics {
  total_records: number;
  total_size_mb: number;
  records_by_platform: {
    meta: number;
    google: number;
  };
  oldest_record_date: string | null;
  newest_record_date: string | null;
}

interface ClientUsage {
  client_id: string;
  client_name: string;
  organization_name: string;
  plan_name: string;
  total_records: number;
  storage_mb: number;
  last_sync_at: string | null;
  sync_status: 'active' | 'pending' | 'failed';
}

interface Alert {
  id: string;
  type: 'storage' | 'sync_failure' | 'token_expired';
  severity: 'warning' | 'critical';
  message: string;
  client_id?: string;
  client_name?: string;
  created_at: string;
}

export default function CacheMonitoringPage() {
  const [syncMetrics, setSyncMetrics] = useState<SyncMetrics | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [clientUsage, setClientUsage] = useState<ClientUsage[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonitoringData();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar métricas de sincronização
      const syncResponse = await fetch('/api/admin/monitoring/sync-metrics', {
        cache: 'no-store',
      });
      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        setSyncMetrics(syncData.metrics);
      }

      // Buscar métricas de storage
      const storageResponse = await fetch('/api/admin/monitoring/storage-metrics', {
        cache: 'no-store',
      });
      if (storageResponse.ok) {
        const storageData = await storageResponse.json();
        setStorageMetrics(storageData.metrics);
      }

      // Buscar uso por cliente
      const usageResponse = await fetch('/api/admin/monitoring/client-usage', {
        cache: 'no-store',
      });
      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        setClientUsage(usageData.clients);
      }

      // Buscar alertas
      const alertsResponse = await fetch('/api/admin/monitoring/alerts', {
        cache: 'no-store',
      });
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts);
      }
    } catch (err) {
      console.error('Erro ao buscar dados de monitoramento:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}min`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  if (loading && !syncMetrics) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Monitoramento de Cache
              </h1>
              <p className="text-gray-600 mt-1">
                Métricas de sincronização, uso de storage e alertas do sistema
              </p>
            </div>
            <Button onClick={fetchMonitoringData} variant="outline" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Alertas Ativos */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <CardTitle>Alertas Ativos</CardTitle>
                </div>
                <Badge variant="destructive">{alerts.length}</Badge>
              </div>
              <CardDescription>
                Problemas que requerem atenção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge
                            variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                          >
                            {alert.severity === 'critical' ? 'Crítico' : 'Aviso'}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {formatDate(alert.created_at)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                        {alert.client_name && (
                          <p className="text-sm text-gray-600 mt-1">
                            Cliente: {alert.client_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas de Sincronização */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Sincronizações</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {syncMetrics?.total_syncs || 0}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Última: {formatDate(syncMetrics?.last_sync_at || null)}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Taxa de Sucesso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-3xl font-bold">
                    {syncMetrics?.success_rate.toFixed(1) || 0}%
                  </div>
                  <Progress 
                    value={syncMetrics?.success_rate || 0} 
                    className="mt-2"
                  />
                </div>
                <CheckCircle className="h-8 w-8 text-green-600 ml-4" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Tempo Médio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {formatDuration(syncMetrics?.avg_duration_ms || 0)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Por sincronização
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Storage Total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {formatBytes((storageMetrics?.total_size_mb || 0) * 1024 * 1024)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {storageMetrics?.total_records.toLocaleString() || 0} registros
                  </p>
                </div>
                <HardDrive className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribuição por Plataforma */}
        {storageMetrics && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <CardTitle>Distribuição por Plataforma</CardTitle>
              </div>
              <CardDescription>
                Registros armazenados por plataforma de anúncios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Meta Ads</span>
                    <span className="text-sm text-gray-600">
                      {storageMetrics.records_by_platform.meta.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={
                      (storageMetrics.records_by_platform.meta /
                        storageMetrics.total_records) *
                      100
                    }
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Google Ads</span>
                    <span className="text-sm text-gray-600">
                      {storageMetrics.records_by_platform.google.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={
                      (storageMetrics.records_by_platform.google /
                        storageMetrics.total_records) *
                      100
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Uso por Cliente */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <CardTitle>Uso por Cliente</CardTitle>
            </div>
            <CardDescription>
              Storage e status de sincronização por cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Storage</TableHead>
                  <TableHead>Última Sync</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientUsage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  clientUsage.map((client) => (
                    <TableRow key={client.client_id}>
                      <TableCell className="font-medium">
                        {client.client_name}
                      </TableCell>
                      <TableCell>{client.organization_name}</TableCell>
                      <TableCell>{client.plan_name}</TableCell>
                      <TableCell className="text-right">
                        {client.total_records.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBytes(client.storage_mb * 1024 * 1024)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(client.last_sync_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            client.sync_status === 'active'
                              ? 'default'
                              : client.sync_status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {client.sync_status === 'active'
                            ? 'Ativo'
                            : client.sync_status === 'pending'
                            ? 'Pendente'
                            : 'Falhou'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="h-8 bg-gray-200 rounded w-96 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse mt-2"></div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
