'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Chrome,
  Plus,
  BarChart3,
  Users,
  DollarSign,
  Target,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { ConnectGoogleButton } from "@/components/google/connect-google-button";
import { GoogleSyncStatus } from "@/components/google/sync-status";
import { ExportButton } from "@/components/exports/export-button";
import { GoogleMetricsCards } from "@/components/google/google-metrics-cards";
import { GoogleFiltersHeader } from "@/components/google/google-filters-header";
import { GoogleDashboardComplete } from "@/components/google/google-dashboard-complete";
import { useToast } from "@/hooks/use-toast";

interface GoogleConnection {
  id: string;
  customer_id: string;
  status: 'active' | 'expired' | 'revoked';
  last_sync_at: string;
}

interface Client {
  id: string;
  name: string;
  googleConnections?: GoogleConnection[];
}

interface KPIData {
  totalSpend: number;
  totalConversions: number;
  averageRoas: number;
  averageCpa: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalClients: number;
  connectedClients: number;
}

interface DateFilter {
  value: string;
  label: string;
  days: number;
}

const DATE_FILTERS: DateFilter[] = [
  { value: 'today', label: 'Hoje', days: 1 },
  { value: 'yesterday', label: 'Ontem', days: 1 },
  { value: 'last_7_days', label: 'Últimos 7 dias', days: 7 },
  { value: 'last_14_days', label: 'Últimos 14 dias', days: 14 },
  { value: 'last_30_days', label: 'Últimos 30 dias', days: 30 },
  { value: 'last_90_days', label: 'Últimos 90 dias', days: 90 },
  { value: 'custom', label: 'Personalizado', days: 0 },
];


export default function GooglePageContent() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('last_30_days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateInputs, setShowCustomDateInputs] = useState<boolean>(false);
  const [currentDateRange, setCurrentDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: ''
  });
  const [kpiData, setKpiData] = useState<KPIData>({
    totalSpend: 0,
    totalConversions: 0,
    averageRoas: 0,
    averageCpa: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalClients: 0,
    connectedClients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGoogleAdsConfigured, setIsGoogleAdsConfigured] = useState<boolean | null>(null);
  const { toast } = useToast();

  const getDateRange = (filter: string) => {
    const today = new Date();
    const filterConfig = DATE_FILTERS.find(f => f.value === filter);
    
    if (!filterConfig) {
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      return {
        from: from.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };
    }
    
    if (filter === 'custom') {
      return {
        from: customStartDate || getDefaultDateRange().startDate,
        to: customEndDate || getDefaultDateRange().endDate,
      };
    }
    
    if (filter === 'today') {
      return {
        from: today.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      };
    }
    
    if (filter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return {
        from: yesterday.toISOString().split('T')[0],
        to: yesterday.toISOString().split('T')[0],
      };
    }
    
    const from = new Date(today);
    from.setDate(today.getDate() - filterConfig.days);
    return {
      from: from.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
    };
  };

  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients?includeGoogleConnections=true');
      if (!response.ok) throw new Error('Falha ao carregar clientes');
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('[Google Dashboard] Erro ao carregar clientes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os clientes.',
        variant: 'destructive',
      });
    }
  };

  const fetchKPIData = async () => {
    try {
      setRefreshing(true);
      const dateFrom = currentDateRange.startDate || getDateRange(dateFilter).from;
      const dateTo = currentDateRange.endDate || getDateRange(dateFilter).to;
      const clientParam = selectedClient !== 'all' ? `&clientId=${selectedClient}` : '';
      const apiUrl = `/api/google/metrics-simple?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=campaign${clientParam}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 503 && !data.configured) return;
        if (response.status === 400 && data.error?.includes('Parâmetros obrigatórios')) return;
        throw new Error(data.message || 'Falha ao carregar métricas');
      }
      
      const kpis: KPIData = {
        totalSpend: data.summary?.totalCost || 0,
        totalConversions: data.summary?.totalConversions || 0,
        averageRoas: 0,
        averageCpa: data.summary?.averageCpc || 0,
        totalCampaigns: data.campaigns?.length || 0,
        activeCampaigns: data.campaigns?.filter((c: any) => c.status === 'ENABLED').length || 0,
        totalClients: clients.length,
        connectedClients: clients.filter(c => c.googleConnections?.some(conn => conn.status === 'active')).length,
      };
      
      setKpiData(kpis);
    } catch (error) {
      console.error('[Google Dashboard] Erro ao carregar KPIs:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    if (value === 'custom') {
      setShowCustomDateInputs(true);
    } else {
      setShowCustomDateInputs(false);
      const range = getDateRange(value);
      setCurrentDateRange({ startDate: range.from, endDate: range.to });
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setCurrentDateRange({ startDate: customStartDate, endDate: customEndDate });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  const handleRefresh = async () => {
    await Promise.all([fetchClients(), fetchKPIData()]);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchClients();
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    const range = getDateRange(dateFilter);
    setCurrentDateRange({ startDate: range.from, endDate: range.to });
  }, []);

  useEffect(() => {
    const success = searchParams.get('success');
    const accounts = searchParams.get('accounts');
    
    if (success === 'connected' && accounts === '1') {
      const redirectTimer = setTimeout(() => {
        if (clients.length > 0) {
          const clientWithGoogle = clients.find(c => c.googleConnections && c.googleConnections.length > 0);
          if (clientWithGoogle) {
            window.location.href = `/dashboard/clients/${clientWithGoogle.id}/google`;
          }
        }
      }, 2000);
      return () => clearTimeout(redirectTimer);
    }
  }, [searchParams, clients]);

  useEffect(() => {
    if (clients.length > 0) {
      fetchKPIData();
    }
  }, [clients, selectedClient, currentDateRange]);

  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const testClientId = '00000000-0000-0000-0000-000000000000';
        const response = await fetch(`/api/google/auth-simple?clientId=${testClientId}`);
        const data = await response.json();
        setIsGoogleAdsConfigured(response.status !== 503 && data.configured);
      } catch {
        setIsGoogleAdsConfigured(false);
      }
    };
    checkConfiguration();
  }, []);

  const connectedClients = clients.filter(c =>
    c.googleConnections && c.googleConnections.length > 0 &&
    c.googleConnections.some(conn => conn.status === 'active')
  );
  const hasConnections = connectedClients.length > 0;
  const firstConnectedClient = connectedClients.length > 0 ? connectedClients[0].id : null;
  const isSuccess = searchParams.get('success') === 'connected';
  const accounts = searchParams.get('accounts');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Carregando dashboard...
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Success Message */}
      {isSuccess && accounts === '1' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Chrome className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-medium text-green-800">Conta Google Ads Conectada com Sucesso!</h3>
                <p className="text-sm text-green-700">Você será redirecionado para a página de campanhas em instantes...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Chrome className="w-8 h-8 mr-3 text-green-600" />
            Google Ads
          </h1>
          <p className="text-gray-600 mt-1">Gerencie suas conexões e campanhas do Google Ads</p>
        </div>
        
        <div className="flex items-center gap-3">
          <ExportButton
            clientId={selectedClient !== 'all' ? selectedClient : ''}
            platform="google"
            disabled={selectedClient === 'all' || !clients.find(c => c.id === selectedClient)?.googleConnections?.length}
            variant="outline"
          />
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => window.location.href = '/dashboard/clients'} variant="outline">
            <Users className="w-4 h-4 mr-2" />
            Ver Todos os Clientes
          </Button>
          <Button asChild>
            <Link href="/dashboard/clients">
              <Plus className="w-4 h-4 mr-2" />
              Conectar Nova Conta
            </Link>
          </Button>
        </div>
      </div>

      {/* Google-specific Metrics */}
      {hasConnections && currentDateRange.startDate && currentDateRange.endDate && (
        <GoogleMetricsCards
          clientId={selectedClient !== 'all' ? selectedClient : firstConnectedClient ?? undefined}
          dateFilter={dateFilter}
          startDate={currentDateRange.startDate}
          endDate={currentDateRange.endDate}
        />
      )}

      {/* Configuration Warning */}
      {isGoogleAdsConfigured === false && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-800 mb-1">Google Ads Não Configurado</h3>
                <p className="text-sm text-amber-700 mb-3">
                  As credenciais do Google Ads não foram configuradas. Configure as seguintes variáveis de ambiente:
                </p>
                <ul className="text-sm text-amber-700 space-y-1 mb-4 ml-4">
                  <li>• <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code></li>
                  <li>• <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code></li>
                  <li>• <code className="bg-amber-100 px-1 rounded">GOOGLE_DEVELOPER_TOKEN</code></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters Header */}
      {hasConnections && isGoogleAdsConfigured && (
        <GoogleFiltersHeader
          selectedClient={selectedClient}
          onClientChange={setSelectedClient}
          dateFilter={dateFilter}
          onDateFilterChange={handleDateFilterChange}
          clients={clients}
          connectedClients={connectedClients}
          showCustomDateInputs={showCustomDateInputs}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomStartDateChange={setCustomStartDate}
          onCustomEndDateChange={setCustomEndDate}
          onCustomDateApply={handleCustomDateApply}
        />
      )}

      {/* KPI Cards */}
      {isGoogleAdsConfigured && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpiData.totalSpend)}</div>
              <p className="text-xs text-muted-foreground">
                {DATE_FILTERS.find(f => f.value === dateFilter)?.label.toLowerCase()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversões</CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.totalConversions.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">conversões totais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPA Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpiData.averageCpa)}</div>
              <p className="text-xs text-muted-foreground">custo por aquisição</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.activeCampaigns}</div>
              <p className="text-xs text-muted-foreground">de {kpiData.totalCampaigns} campanhas</p>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Connection Status and Sync */}
      {hasConnections && isGoogleAdsConfigured && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status das Conexões</CardTitle>
              <CardDescription>Status das contas Google Ads conectadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connectedClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Chrome className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {client.googleConnections && client.googleConnections.length > 0 ? (
                            <>
                              {client.googleConnections.length} conta{client.googleConnections.length > 1 ? 's' : ''} conectada{client.googleConnections.length > 1 ? 's' : ''}
                              {client.googleConnections.length === 1 && (
                                <> (ID: {client.googleConnections[0].customer_id})</>
                              )}
                            </>
                          ) : 'Nenhuma conta conectada'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={client.googleConnections?.[0]?.status === 'active' ? 'default' : 'destructive'}
                        className={client.googleConnections?.[0]?.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {client.googleConnections?.[0]?.status === 'active' ? 'Conectado' : 'Desconectado'}
                      </Badge>
                      <ConnectGoogleButton
                        clientId={client.id}
                        connection={client.googleConnections?.[0]}
                        onConnectionUpdate={fetchClients}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedClient !== 'all' ? (
            <GoogleSyncStatus clientId={selectedClient} compact={false} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Sincronização</CardTitle>
                <CardDescription>Sincronize os dados do Google Ads</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione um Cliente</h3>
                  <p className="text-gray-500 mb-4">Para sincronizar dados, selecione um cliente específico no filtro acima.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dashboard Completo */}
      {hasConnections && isGoogleAdsConfigured ? (
        selectedClient !== 'all' && currentDateRange.startDate && currentDateRange.endDate ? (
          <GoogleDashboardComplete
            clientId={selectedClient}
            startDate={currentDateRange.startDate}
            endDate={currentDateRange.endDate}
            onRefresh={handleRefresh}
          />
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione um Cliente</h3>
              <p className="text-gray-500">Para visualizar o dashboard completo, selecione um cliente específico no filtro acima.</p>
            </CardContent>
          </Card>
        )
      ) : isGoogleAdsConfigured === false ? (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Google Ads Não Configurado</h3>
            <p className="text-gray-500 mb-6">Configure as credenciais do Google Ads para começar a usar esta funcionalidade.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Chrome className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma conta Google Ads conectada</h3>
            <p className="text-gray-500 mb-6">Conecte suas primeiras contas do Google Ads para começar a gerenciar campanhas.</p>
            
            {clients.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">Selecione um cliente para conectar:</div>
                <div className="grid gap-3 max-w-md mx-auto">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="font-medium">{client.name}</div>
                      <ConnectGoogleButton clientId={client.id} onConnectionUpdate={fetchClients} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-amber-600 mb-4">
                  <AlertCircle className="w-5 h-5" />
                  <span>Nenhum cliente cadastrado</span>
                </div>
                <Button asChild>
                  <Link href="/dashboard/clients/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Cliente
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
