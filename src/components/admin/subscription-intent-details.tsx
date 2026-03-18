/**
 * Componente para exibir detalhes de um subscription intent
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Mail, 
  RefreshCw, 
  User, 
  CreditCard, 
  Calendar,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { SubscriptionIntentWithPlan } from '@/lib/types/subscription-intent';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionIntentDetailsProps {
  intentId: string;
  onAction?: (intentId: string, action: string) => void;
}

interface IntentDetails {
  intent: SubscriptionIntentWithPlan & {
    user?: {
      id: string;
      email: string;
      created_at: string;
      last_sign_in_at?: string;
    };
  };
  webhook_logs: Array<{
    id: string;
    event_type: string;
    status: string;
    created_at: string;
    error_message?: string;
    payload: any;
  }>;
  state_transitions: Array<{
    id: string;
    from_status: string;
    to_status: string;
    created_at: string;
    created_by?: string;
    reason?: string;
  }>;
}

export function SubscriptionIntentDetails({ 
  intentId, 
  onAction 
}: SubscriptionIntentDetailsProps) {
  const [details, setDetails] = useState<IntentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/subscription-intents/${intentId}`);
      const data = await response.json();

      if (response.ok) {
        setDetails(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching intent details:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar detalhes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (intentId) {
      fetchDetails();
    }
  }, [intentId]);

  const handleAction = (action: string) => {
    if (onAction) {
      onAction(intentId, action);
      // Refresh details after action
      setTimeout(fetchDetails, 1000);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
      received: 'bg-blue-100 text-blue-800',
      processed: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800'
    } as const;

    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p>Falha ao carregar detalhes</p>
        </div>
      </div>
    );
  }

  const { intent, webhook_logs, state_transitions } = details;

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">{intent.user_email}</h3>
          <p className="text-sm text-muted-foreground">{intent.organization_name}</p>
        </div>
        
        <div className="flex gap-2">
          {intent.status === 'pending' && (
            <Button
              size="sm"
              onClick={() => handleAction('activate')}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Ativar
            </Button>
          )}
          
          {['pending', 'processing'].includes(intent.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('cancel')}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('resend_email')}
          >
            <Mail className="h-4 w-4 mr-2" />
            Reenviar Email
          </Button>
          
          {intent.status === 'expired' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('regenerate_checkout')}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Nova URL
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Informações do Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm">{intent.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Nome</label>
                  <p className="text-sm">{intent.user_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Organização</label>
                  <p className="text-sm">{intent.organization_name}</p>
                </div>
                {intent.cpf_cnpj && (
                  <div>
                    <label className="text-sm font-medium">CPF/CNPJ</label>
                    <p className="text-sm">{intent.cpf_cnpj}</p>
                  </div>
                )}
                {intent.phone && (
                  <div>
                    <label className="text-sm font-medium">Telefone</label>
                    <p className="text-sm">{intent.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Informações do Plano */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Plano e Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Plano</label>
                  <p className="text-sm">{intent.plan?.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Ciclo de Cobrança</label>
                  <p className="text-sm capitalize">{intent.billing_cycle}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Preço</label>
                  <p className="text-sm">
                    R$ {intent.billing_cycle === 'monthly' 
                      ? intent.plan?.monthly_price 
                      : intent.plan?.annual_price}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Badge className={getStatusColor(intent.status)}>
                    {intent.status.toUpperCase()}
                  </Badge>
                </div>
                {intent.checkout_url && (
                  <div>
                    <label className="text-sm font-medium">URL de Checkout</label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(intent.checkout_url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Datas Importantes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Datas Importantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Criado em</label>
                  <p className="text-sm">
                    {new Date(intent.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Expira em</label>
                  <p className="text-sm">
                    {new Date(intent.expires_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                {intent.completed_at && (
                  <div>
                    <label className="text-sm font-medium">Completado em</label>
                    <p className="text-sm">
                      {new Date(intent.completed_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Última atualização</label>
                  <p className="text-sm">
                    {new Date(intent.updated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* IDs do Iugu */}
            {(intent.iugu_customer_id || intent.iugu_subscription_id) && (
              <Card>
                <CardHeader>
                  <CardTitle>IDs do Iugu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {intent.iugu_customer_id && (
                    <div>
                      <label className="text-sm font-medium">Customer ID</label>
                      <p className="text-sm font-mono">{intent.iugu_customer_id}</p>
                    </div>
                  )}
                  {intent.iugu_subscription_id && (
                    <div>
                      <label className="text-sm font-medium">Subscription ID</label>
                      <p className="text-sm font-mono">{intent.iugu_subscription_id}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Webhook</CardTitle>
            </CardHeader>
            <CardContent>
              {webhook_logs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum webhook processado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhook_logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.event_type}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(log.status)}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {log.error_message && (
                            <span className="text-red-600 text-sm">
                              {log.error_message}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Estados</CardTitle>
            </CardHeader>
            <CardContent>
              {state_transitions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhuma transição de estado registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De</TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state_transitions.map((transition) => (
                      <TableRow key={transition.id}>
                        <TableCell>
                          <Badge className={getStatusColor(transition.from_status)}>
                            {transition.from_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(transition.to_status)}>
                            {transition.to_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(transition.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {transition.reason || 'Automático'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}