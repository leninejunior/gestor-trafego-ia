'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Chrome, 
  Plus, 
  BarChart3, 
  Users, 
  DollarSign, 
  Target, 
  TrendingUp,
  Calendar,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { GoogleCampaignsList } from "@/components/google/campaigns-list";
import { ConnectGoogleButton } from "@/components/google/connect-google-button";
import { GoogleSyncStatus } from "@/components/google/sync-status";
import { ExportButton } from "@/components/exports/export-button";
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
  google_connection?: GoogleConnection;
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
];

export default function GooglePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('last_30_days');
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
  const { toast } = useToast();

  const fetchClients = async () => {
    try {
      // Fetch clients and their Google connections in a single optimized request
      const response = await fetch('/api/clients?includeGoogleConnections=true');
      if (!response.ok) throw new Error('Falha ao carregar clientes');
      
      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
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
      
      const dateRange = getDateRange(dateFilter);
      const clientParam = selectedClient !== 'all' ? `&clientId=${selectedClient}` : '';
      
      const response = await fetch(
        `/api/google/metrics?dateFrom=${dateRange.from}&dateTo=${dateRange.to}&groupBy=campaign${clientParam}`
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 503 && !data.configured) {
          // Google Ads not configured - this is expected, don't show error
          return;
        }
        throw new Error(data.message || 'Falha ao carregar métricas');
      }
      
      // Calculate KPIs from metrics data
      const kpis: KPIData = {
        totalSpend: data.summary?.totalCost || 0,
        totalConversions: data.summary?.totalConversions || 0,
        averageRoas: 0, // Would need conversion value to calculate
        averageCpa: data.summary?.averageCpa || 0,
        totalCampaigns: data.summary?.campaignCount || 0,
        activeCampaigns: data.metrics?.filter((m: any) => m.campaignStatus === 'ENABLED').length || 0,
        totalClients: clients.length,
        connectedClients: clients.filter(c => c.google_connection?.status === 'active').length,
      };
      
      setKpiData(kpis);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      // Don't show error toast for KPI data as it's not critical
    } finally {
      setRefreshing(false);
    }
  };

  const getDateRange = (filter: string) => {
    const today = new Date();
    const filterConfig = DATE_FILTERS.find(f => f.value === filter);
    
    if (!filterConfig) {
      // Default to last 30 days
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      return {
        from: from.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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
    if (clients.length > 0) {
      fetchKPIData();
    }
  }, [clients, selectedClient, dateFilter]);

  const connectedClients = clients.filter(c => c.google_connection?.status === 'active');
  const hasConnections = connectedClients.length > 0;

  // Check if Google Ads is configured
  const [isGoogleAdsConfigured, setIsGoogleAdsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    // Check configuration status
    const checkConfiguration = async () => {
      try {
        const response = await fetch('/api/google/auth?clientId=test');
        const data = await response.json();
        setIsGoogleAdsConfigured(response.status !== 503);
      } catch (error) {
        setIsGoogleAdsConfigured(false);
      }
    };
    
    checkConfiguration();
  }, []);

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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Chrome className="w-8 h-8 mr-3 text-green-600" />
            Google Ads
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie suas conexões e campanhas do Google Ads
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <ExportButton
            clientId={selectedClient !== 'all' ? selectedClient : ''}
            platform="google"
            disabled={selectedClient === 'all' || !clients.find(c => c.id === selectedClient)?.google_connection}
            variant="outline"
          />
          <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button asChild>
            <Link href="/dashboard/clients">
              <Plus className="w-4 h-4 mr-2" />
              Conectar Nova Conta
            </Link>
          </Button>
        </div>
      </div>

      {/* Configuration Warning */}
      {isGoogleAdsConfigured === false && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-800 mb-1">
                  Google Ads Não Configurado
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  As credenciais do Google Ads não foram configuradas. Para habilitar a integração com Google Ads, 
                  configure as seguintes variáveis de ambiente:
                </p>
                <ul className="text-sm text-amber-700 space-y-1 mb-4 ml-4">
                  <li>• <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code></li>
                  <li>• <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code></li>
                  <li>• <code className="bg-amber-100 px-1 rounded">GOOGLE_DEVELOPER_TOKEN</code></li>
                </ul>
                <p className="text-xs text-amber-600">
                  Entre em contato com o administrador do sistema para configurar essas credenciais.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {hasConnections && isGoogleAdsConfigured && (
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecionar período" />
              </SelectTrigger>
              <SelectContent>
                {DATE_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {connectedClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
            <p className="text-xs text-muted-foreground">
              conversões totais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPA Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpiData.averageCpa)}</div>
            <p className="text-xs text-muted-foreground">
              custo por aquisição
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              de {kpiData.totalCampaigns} campanhas
            </p>
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
              <CardDescription>
                Status das contas Google Ads conectadas
              </CardDescription>
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
                          ID: {client.google_connection?.customer_id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={client.google_connection?.status === 'active' ? 'default' : 'destructive'}
                        className={client.google_connection?.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {client.google_connection?.status === 'active' ? 'Conectado' : 'Desconectado'}
                      </Badge>
                      <ConnectGoogleButton
                        clientId={client.id}
                        connection={client.google_connection}
                        onConnectionUpdate={fetchClients}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <GoogleSyncStatus 
            clientId={selectedClient !== 'all' ? selectedClient : connectedClients[0]?.id || ''}
            compact={false}
          />
        </div>
      )}

      {/* Campaigns List */}
      {hasConnections && isGoogleAdsConfigured ? (
        <GoogleCampaignsList
          clientId={selectedClient !== 'all' ? selectedClient : ''}
        />
      ) : isGoogleAdsConfigured === false ? (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Google Ads Não Configurado
            </h3>
            <p className="text-gray-500 mb-6">
              Configure as credenciais do Google Ads para começar a usar esta funcionalidade.
            </p>
            <div className="text-sm text-muted-foreground">
              Entre em contato com o administrador do sistema para configurar as credenciais necessárias.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Chrome className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma conta Google Ads conectada
            </h3>
            <p className="text-gray-500 mb-6">
              Conecte suas primeiras contas do Google Ads para começar a gerenciar campanhas.
            </p>
            
            {clients.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Selecione um cliente para conectar:
                </div>
                <div className="grid gap-3 max-w-md mx-auto">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="font-medium">{client.name}</div>
                      <ConnectGoogleButton
                        clientId={client.id}
                        onConnectionUpdate={fetchClients}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-amber-600 mb-4">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">Nenhum cliente encontrado</span>
                </div>
                <Button asChild>
                  <Link href="/dashboard/clients">
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