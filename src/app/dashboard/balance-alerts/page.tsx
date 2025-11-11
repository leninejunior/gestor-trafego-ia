'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Edit, Trash2, Facebook, Plus, AlertCircle, Copy, Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BalanceAlert {
  id: string;
  client_name: string;
  ad_account_id: string;
  ad_account_name: string;
  balance: number;
  threshold_amount: number;
  alert_type: 'low_balance' | 'critical_balance' | 'zero_balance';
  is_active: boolean;
  status: 'active' | 'warning' | 'critical';
  projected_days_remaining: number | null;
}

interface AdAccount {
  client_id: string;
  client_name: string;
  ad_account_id: string;
  ad_account_name: string;
  balance: number;
  status: string;
  has_alert: boolean;
}

export default function BalanceAlertsPage() {
  const [alerts, setAlerts] = useState<BalanceAlert[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/balance/alerts');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar alertas');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os alertas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const response = await fetch('/api/admin/balance/accounts');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar contas');
      }

      const data = await response.json();
      console.log('📊 Dados recebidos da API:', data);
      console.log('📊 Contas:', data.accounts?.length || 0);
      
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as contas',
        variant: 'destructive',
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    loadAccounts();
  }, []);

  const toggleAlert = async (alertId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/balance/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar alerta');
      }

      toast({
        title: 'Sucesso',
        description: `Alerta ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`,
      });

      loadAlerts();
    } catch (error) {
      console.error('Erro ao atualizar alerta:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o alerta',
        variant: 'destructive',
      });
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Tem certeza que deseja excluir este alerta?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/balance/alerts/${alertId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir alerta');
      }

      toast({
        title: 'Sucesso',
        description: 'Alerta excluído com sucesso',
      });

      loadAlerts();
    } catch (error) {
      console.error('Erro ao excluir alerta:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o alerta',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      active: { label: 'Normal', className: 'bg-green-500/20 text-green-500 border-green-500/50' },
      warning: { label: 'Atenção', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' },
      critical: { label: 'Crítico', className: 'bg-red-500/20 text-red-500 border-red-500/50' },
    };

    const config = variants[status] || variants.active;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getAlertTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      low_balance: 'Saldo Baixo',
      critical_balance: 'Saldo Crítico',
      zero_balance: 'Saldo Zerado',
    };
    return types[type] || type;
  };

  const createAlert = async (accountId: string, clientId: string) => {
    try {
      const response = await fetch('/api/admin/balance/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          ad_account_id: accountId,
          threshold_amount: 100,
          alert_type: 'low_balance',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar alerta');
      }

      toast({
        title: 'Sucesso',
        description: 'Alerta criado com sucesso',
      });

      loadAlerts();
      loadAccounts();
    } catch (error) {
      console.error('Erro ao criar alerta:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o alerta',
        variant: 'destructive',
      });
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.ad_account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.ad_account_id.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    const matchesType = typeFilter === 'all' || alert.alert_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredAccounts = accounts.filter((account) => {
    return (
      account.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.ad_account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.ad_account_id.includes(searchTerm)
    );
  });

  // Debug
  console.log('🔍 Debug - Contas:', accounts.length);
  console.log('🔍 Debug - Contas filtradas:', filteredAccounts.length);
  console.log('🔍 Debug - Termo de busca:', searchTerm);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Alertas de Saldo
          </h1>
          <p className="text-muted-foreground mt-1">
            {accounts.length} conta(s) conectada(s) • {alerts.length} alerta(s) configurado(s)
          </p>
        </div>
        <Button onClick={() => { loadAlerts(); loadAccounts(); }} disabled={loading || loadingAccounts}>
          <RefreshCw className={`h-4 w-4 mr-2 ${(loading || loadingAccounts) ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="accounts">
            <Facebook className="h-4 w-4 mr-2" />
            Contas Conectadas ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alertas Configurados ({alerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>Contas Meta Ads Conectadas</CardTitle>
              <CardDescription>
                Configure alertas de saldo para suas contas de anúncios
              </CardDescription>
              <div className="flex flex-col md:flex-row gap-4 mt-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar contas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingAccounts ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Carregando contas...</p>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium mb-2">Nenhuma conta conectada</p>
                  <p className="text-sm text-muted-foreground">
                    Conecte contas Meta Ads para configurar alertas de saldo
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Cliente</th>
                        <th className="text-left p-3 font-medium">Conta de Anúncio</th>
                        <th className="text-left p-3 font-medium">Saldo Atual</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((account) => (
                        <tr key={account.ad_account_id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3">
                            <div className="font-medium">{account.client_name}</div>
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{account.ad_account_name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Facebook className="h-3 w-3 text-blue-500" />
                                <span className="font-mono text-xs text-muted-foreground">
                                  {account.ad_account_id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
                              R$ {account.balance.toFixed(2)}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {account.has_alert ? (
                              <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/50">
                                <Bell className="h-3 w-3 mr-1" />
                                Alerta Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500/20 text-gray-500 border-gray-500/50">
                                Sem Alerta
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              {!account.has_alert ? (
                                <Button
                                  size="sm"
                                  onClick={() => createAlert(account.ad_account_id, account.client_id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Criar Alerta
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" disabled>
                                  <Bell className="h-4 w-4 mr-1" />
                                  Configurado
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alertas Configurados</CardTitle>
              <CardDescription>
                Gerencie os alertas de saldo das suas contas
              </CardDescription>
              <div className="flex flex-col md:flex-row gap-4 mt-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar alertas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="all">Todos os status</option>
                    <option value="active">Normal</option>
                    <option value="warning">Atenção</option>
                    <option value="critical">Crítico</option>
                  </select>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="low_balance">Saldo Baixo</option>
                    <option value="critical_balance">Saldo Crítico</option>
                    <option value="zero_balance">Saldo Zerado</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Carregando alertas...</p>
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium mb-2">Nenhum alerta configurado</p>
                  <p className="text-sm text-muted-foreground">
                    Vá para a aba "Contas Conectadas" para criar alertas
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Ativo</th>
                        <th className="text-left p-3 font-medium">Nome</th>
                        <th className="text-left p-3 font-medium">Conta de Anúncio</th>
                        <th className="text-left p-3 font-medium">Saldo Atual</th>
                        <th className="text-left p-3 font-medium">Tipo de Alerta</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.map((alert) => (
                        <tr key={alert.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3">
                            <Switch
                              checked={alert.is_active}
                              onCheckedChange={() => toggleAlert(alert.id, alert.is_active)}
                            />
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{alert.client_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {alert.ad_account_name}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Facebook className="h-4 w-4 text-blue-500" />
                              <span className="font-mono text-sm">{alert.ad_account_id}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(alert.ad_account_id);
                                  toast({
                                    title: 'Copiado!',
                                    description: 'ID da conta copiado para a área de transferência',
                                  });
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                alert.balance > alert.threshold_amount
                                  ? 'bg-green-500/20 text-green-500 border-green-500/50'
                                  : alert.balance > alert.threshold_amount * 0.5
                                  ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                                  : 'bg-red-500/20 text-red-500 border-red-500/50'
                              }
                            >
                              R$ {alert.balance.toFixed(2)}
                            </Badge>
                            {alert.projected_days_remaining !== null && (
                              <div className="text-xs text-muted-foreground mt-1">
                                ~{alert.projected_days_remaining} dias restantes
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{getAlertTypeLabel(alert.alert_type)}</div>
                              <div className="text-sm text-muted-foreground">
                                Limite: R$ {alert.threshold_amount.toFixed(2)}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">{getStatusBadge(alert.status)}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" title="Atualizar">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Copiar">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Excluir"
                                onClick={() => deleteAlert(alert.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
