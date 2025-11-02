/**
 * Ferramentas de troubleshooting para resolução de problemas
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { 
  CheckCircle, 
  RefreshCw, 
  Play, 
  Settings,
  AlertCircle,
  BarChart3,
  Database,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Activity } from 'lucide-react';

interface TroubleshootingToolsProps {
  intentId?: string;
  className?: string;
}

export function TroubleshootingTools({ intentId, className }: TroubleshootingToolsProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [manualAction, setManualAction] = useState({
    type: '',
    intentId: intentId || '',
    reason: '',
    notes: ''
  });

  const { toast } = useToast();

  const runDiagnostic = async (type: string) => {
    try {
      setLoading(true);
      setResults(null);

      const response = await fetch('/api/admin/troubleshooting/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          intent_id: intentId 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data);
        toast({
          title: 'Diagnóstico Concluído',
          description: `Diagnóstico ${type} executado com sucesso`
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error running diagnostic:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao executar diagnóstico',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const executeManualAction = async () => {
    if (!manualAction.type || !manualAction.intentId || !manualAction.reason) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/admin/troubleshooting/manual-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualAction)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: data.message
        });
        setManualAction({
          type: '',
          intentId: intentId || '',
          reason: '',
          notes: ''
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error executing manual action:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao executar ação manual',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const reprocessWebhooks = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/admin/troubleshooting/reprocess-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_id: intentId })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: `${data.processed} webhooks reprocessados`
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error reprocessing webhooks:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao reprocessar webhooks',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const syncWithIugu = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/admin/troubleshooting/sync-iugu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_id: intentId })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: 'Sincronização com Iugu concluída'
        });
        setResults(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error syncing with Iugu:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao sincronizar com Iugu',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Ferramentas de Troubleshooting</h3>
      </div>

      <Tabs defaultValue="diagnostics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="diagnostics">Diagnósticos</TabsTrigger>
          <TabsTrigger value="manual">Ações Manuais</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Diagnósticos Automáticos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => runDiagnostic('payment_flow')}
                  disabled={loading}
                  className="h-20 flex-col"
                >
                  <BarChart3 className="h-6 w-6 mb-2" />
                  Fluxo de Pagamento
                </Button>

                <Button
                  variant="outline"
                  onClick={() => runDiagnostic('webhook_status')}
                  disabled={loading}
                  className="h-20 flex-col"
                >
                  <Zap className="h-6 w-6 mb-2" />
                  Status dos Webhooks
                </Button>

                <Button
                  variant="outline"
                  onClick={() => runDiagnostic('database_integrity')}
                  disabled={loading}
                  className="h-20 flex-col"
                >
                  <Database className="h-6 w-6 mb-2" />
                  Integridade do Banco
                </Button>

                <Button
                  variant="outline"
                  onClick={() => runDiagnostic('iugu_connection')}
                  disabled={loading}
                  className="h-20 flex-col"
                >
                  <CheckCircle className="h-6 w-6 mb-2" />
                  Conexão Iugu
                </Button>
              </div>

              {results && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Resultados do Diagnóstico</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-4 rounded border overflow-auto max-h-96">
                      {JSON.stringify(results, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ações Manuais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tipo de Ação</label>
                  <Select
                    value={manualAction.type}
                    onValueChange={(value) => setManualAction(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma ação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="force_activate">Forçar Ativação</SelectItem>
                      <SelectItem value="force_cancel">Forçar Cancelamento</SelectItem>
                      <SelectItem value="reset_status">Resetar Status</SelectItem>
                      <SelectItem value="regenerate_urls">Regenerar URLs</SelectItem>
                      <SelectItem value="resend_notifications">Reenviar Notificações</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Intent ID</label>
                  <Input
                    value={manualAction.intentId}
                    onChange={(e) => setManualAction(prev => ({ ...prev, intentId: e.target.value }))}
                    placeholder="ID do subscription intent"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Motivo *</label>
                <Input
                  value={manualAction.reason}
                  onChange={(e) => setManualAction(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Motivo para a ação manual"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Observações</label>
                <Textarea
                  value={manualAction.notes}
                  onChange={(e) => setManualAction(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações adicionais (opcional)"
                  rows={3}
                />
              </div>

              <Button
                onClick={executeManualAction}
                disabled={loading || !manualAction.type || !manualAction.intentId || !manualAction.reason}
                className="w-full"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Executar Ação Manual
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Webhooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <Button
                  variant="outline"
                  onClick={reprocessWebhooks}
                  disabled={loading}
                  className="h-16 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Reprocessar Webhooks Falhados</div>
                    <div className="text-sm text-muted-foreground">
                      Tenta reprocessar todos os webhooks com falha
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => runDiagnostic('webhook_queue')}
                  disabled={loading}
                  className="h-16 flex items-center justify-center gap-2"
                >
                  <Activity className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Verificar Fila de Webhooks</div>
                    <div className="text-sm text-muted-foreground">
                      Analisa o status da fila de processamento
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sincronização com Iugu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <Button
                  variant="outline"
                  onClick={syncWithIugu}
                  disabled={loading}
                  className="h-16 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Sincronizar com Iugu</div>
                    <div className="text-sm text-muted-foreground">
                      Busca atualizações no Iugu para este intent
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => runDiagnostic('iugu_status')}
                  disabled={loading}
                  className="h-16 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Verificar Status no Iugu</div>
                    <div className="text-sm text-muted-foreground">
                      Consulta o status atual no gateway de pagamento
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}