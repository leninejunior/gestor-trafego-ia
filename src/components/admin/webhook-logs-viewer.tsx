/**
 * Visualizador de logs de webhook para troubleshooting
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Eye, 
  PlayCircle,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WebhookLog {
  id: string;
  event_type: string;
  event_id: string;
  subscription_intent_id?: string;
  payload: any;
  status: 'received' | 'processing' | 'processed' | 'failed' | 'retrying';
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

interface WebhookLogsViewerProps {
  intentId?: string;
  className?: string;
}

export function WebhookLogsViewer({ intentId, className }: WebhookLogsViewerProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    event_type: '',
    date_range: '7'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (intentId) params.append('subscription_intent_id', intentId);
      if (filters.status) params.append('status', filters.status);
      if (filters.event_type) params.append('event_type', filters.event_type);
      
      if (filters.date_range !== 'all') {
        const days = parseInt(filters.date_range);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('created_after', startDate.toISOString());
      }

      const response = await fetch(`/api/admin/webhook-logs?${params}`);
      const data = await response.json();

      if (response.ok) {
        setLogs(data.logs);
        setPagination(prev => ({ ...prev, total: data.total }));
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar logs de webhook',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters, intentId]);

  const getStatusBadge = (status: string) => {
    const variants = {
      received: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      processing: { color: 'bg-yellow-100 text-yellow-800', icon: RefreshCw },
      processed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      retrying: { color: 'bg-orange-100 text-orange-800', icon: RefreshCw }
    };

    const variant = variants[status as keyof typeof variants] || variants.received;
    const Icon = variant.icon;

    return (
      <Badge className={variant.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const handleReprocess = async (logId: string) => {
    try {
      const response = await fetch(`/api/admin/webhook-logs/${logId}/reprocess`, {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Webhook reprocessado com sucesso'
        });
        fetchLogs();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error reprocessing webhook:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao reprocessar webhook',
        variant: 'destructive'
      });
    }
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (intentId) params.append('subscription_intent_id', intentId);
      if (filters.status) params.append('status', filters.status);
      if (filters.event_type) params.append('event_type', filters.event_type);
      
      const response = await fetch(`/api/admin/webhook-logs/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webhook-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: 'Sucesso',
          description: 'Logs exportados com sucesso'
        });
      } else {
        throw new Error('Falha ao exportar logs');
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao exportar logs',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Logs de Webhook</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportLogs}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      {!intentId && (
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="received">Recebido</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="processed">Processado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="retrying">Tentando</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.event_type}
            onValueChange={(value) => setFilters(prev => ({ ...prev, event_type: value }))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo de Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="invoice.status_changed">Status da Fatura</SelectItem>
              <SelectItem value="subscription.activated">Assinatura Ativada</SelectItem>
              <SelectItem value="subscription.suspended">Assinatura Suspensa</SelectItem>
              <SelectItem value="payment.confirmed">Pagamento Confirmado</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.date_range}
            onValueChange={(value) => setFilters(prev => ({ ...prev, date_range: value }))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último dia</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Processado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Nenhum log encontrado
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{log.event_type}</div>
                      {log.event_id && (
                        <div className="text-sm text-muted-foreground">
                          ID: {log.event_id}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(log.status)}
                    {log.error_message && (
                      <div className="text-xs text-red-600 mt-1 truncate max-w-[200px]">
                        {log.error_message}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {log.retry_count}/5
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {log.processed_at ? 
                      new Date(log.processed_at).toLocaleString('pt-BR') : 
                      '-'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Detalhes do Webhook</DialogTitle>
                          </DialogHeader>
                          {selectedLog && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Tipo de Evento</label>
                                  <p className="text-sm">{selectedLog.event_type}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <p className="text-sm">{getStatusBadge(selectedLog.status)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Tentativas</label>
                                  <p className="text-sm">{selectedLog.retry_count}/5</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Criado em</label>
                                  <p className="text-sm">
                                    {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                              
                              {selectedLog.error_message && (
                                <div>
                                  <label className="text-sm font-medium text-red-600">Erro</label>
                                  <p className="text-sm bg-red-50 p-2 rounded border">
                                    {selectedLog.error_message}
                                  </p>
                                </div>
                              )}
                              
                              <div>
                                <label className="text-sm font-medium">Payload</label>
                                <pre className="text-xs bg-gray-50 p-4 rounded border overflow-auto max-h-96">
                                  {JSON.stringify(selectedLog.payload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {log.status === 'failed' && log.retry_count < 5 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReprocess(log.id)}
                        >
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
            {pagination.total} resultados
          </p>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}