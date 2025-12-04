"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RealTimeInsights } from "@/components/dashboard/real-time-insights";
import { PlanLimitsIndicator } from "@/components/dashboard/plan-limits-indicator";
import { AccountBalancesWidget } from "@/components/dashboard/account-balances-widget";
import { GeneralMetricsCards } from "@/components/dashboard";
import { ExportButton } from "@/components/exports/export-button";
import SetupChecklist from "@/components/onboarding/setup-checklist";
import Link from "next/link";
import { 
  Users, 
  Plus, 
  BarChart3, 
  TrendingUp,
  Eye,
  Zap,
  Target,
  Calendar,
  DollarSign,
  Chrome,
  Facebook,
  Zap as ActivityIcon
} from "lucide-react";

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

interface Client {
  id: string;
  name: string;
  created_at: string;
}

interface DashboardPageClientProps {
  user: {
    email: string;
  };
  clients: Client[];
  totalMetaConnections: number;
  totalGoogleConnections: number;
  totalClients: number;
  totalConnections: number;
  hasMetaConnections: boolean;
  hasGoogleConnections: boolean;
  hasBothPlatforms: boolean;
  needsOnboarding: boolean;
  firstClient: string;
}

export default function DashboardPageClient({
  user,
  clients,
  totalMetaConnections,
  totalGoogleConnections,
  totalClients,
  totalConnections,
  hasMetaConnections,
  hasGoogleConnections,
  hasBothPlatforms,
  needsOnboarding,
  firstClient,
}: DashboardPageClientProps) {
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('last_30_days');
  const [selectedClient, setSelectedClient] = useState<string>(firstClient || 'all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateInputs, setShowCustomDateInputs] = useState<boolean>(false);
  const [currentDateRange, setCurrentDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: ''
  });

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

  const handleDateFilterChange = (value: string) => {
    setSelectedDateFilter(value);
    if (value === 'custom') {
      setShowCustomDateInputs(true);
    } else {
      setShowCustomDateInputs(false);
      const range = getDateRange(value);
      setCurrentDateRange({
        startDate: range.from,
        endDate: range.to
      });
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      setCurrentDateRange({
        startDate: customStartDate,
        endDate: customEndDate
      });
    }
  };

  const handleClientChange = (value: string) => {
    setSelectedClient(value);
  };

  // Initialize date range on mount
  useEffect(() => {
    const range = getDateRange(selectedDateFilter);
    setCurrentDateRange({
      startDate: range.from,
      endDate: range.to
    });
  }, []);

  // Get the actual client ID to use
  const effectiveClientId = selectedClient === 'all' ? firstClient : selectedClient;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Bem-vindo ao Ads Manager! 👋
        </h1>
        <p className="text-muted-foreground mt-2">
          Olá, {user.email}. Aqui está um resumo das suas campanhas e clientes.
        </p>
      </div>

      {/* Onboarding Checklist */}
      {needsOnboarding && (
        <div className="mb-8">
          <SetupChecklist compact={false} />
        </div>
      )}

      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {totalClients > 0 ? "clientes ativos" : "nenhum cliente ainda"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta Ads</CardTitle>
            <div className="flex items-center space-x-2">
              {hasMetaConnections && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
              <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">f</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetaConnections}</div>
            <p className="text-xs text-muted-foreground">
              {hasMetaConnections ? "contas conectadas" : "não conectado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google Ads</CardTitle>
            <div className="flex items-center space-x-2">
              {hasGoogleConnections && (
                <div className="w-2 h-2 bg-green-500 rounded-full" />
              )}
              <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">G</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGoogleConnections}</div>
            <p className="text-xs text-muted-foreground">
              {hasGoogleConnections ? "contas conectadas" : "não conectado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
            <ActivityIcon className={`h-4 w-4 ${totalConnections > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConnections}</div>
            <p className="text-xs text-muted-foreground">
              {hasBothPlatforms ? "multi-plataforma" : totalConnections > 0 ? "plataforma única" : "sem conexões"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unified Filters - Only show if there are connections */}
      {totalConnections > 0 && totalClients > 0 && firstClient && (
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedDateFilter} onValueChange={handleDateFilterChange}>
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
              <Users className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedClient} onValueChange={handleClientChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Custom Date Inputs */}
          {showCustomDateInputs && (
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">Data Inicial:</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">Data Final:</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button 
                onClick={handleCustomDateApply}
                size="sm"
                className="mt-0"
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* General Metrics - Only show if there are connections and valid client */}
      {totalConnections > 0 && totalClients > 0 && firstClient && currentDateRange.startDate && currentDateRange.endDate && (
        <GeneralMetricsCards
          clientId={effectiveClientId || ''}
          hasMetaConnections={hasMetaConnections}
          hasGoogleConnections={hasGoogleConnections}
          dateRange={currentDateRange}
        />
      )}

      {/* Message when no connections available for selected client */}
      {effectiveClientId && (
        <NoClientConnectionsMessage clientId={effectiveClientId} />
      )}

      {/* Platform-specific KPIs - Separated */}
      {hasBothPlatforms && totalClients > 0 && firstClient && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Meta Ads KPIs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Facebook className="w-5 h-5 mr-2 text-blue-600" />
                KPIs Meta Ads
              </CardTitle>
              <CardDescription>
                Indicadores específicos do Meta Ads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contas Ativas</span>
                    <span className="font-semibold">{totalMetaConnections}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm text-green-600">Conectado</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plataforma</span>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">f</span>
                      </div>
                      <span className="text-sm">Meta</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tipo</span>
                    <span className="text-sm text-blue-600">Social Media</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Google Ads KPIs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Chrome className="w-5 h-5 mr-2 text-green-600" />
                KPIs Google Ads
              </CardTitle>
              <CardDescription>
                Indicadores específicos do Google Ads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contas Ativas</span>
                    <span className="font-semibold">{totalGoogleConnections}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm text-green-600">Conectado</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plataforma</span>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">G</span>
                      </div>
                      <span className="text-sm">Google</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tipo</span>
                    <span className="text-sm text-green-600">Search Ads</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Saldo das Contas e Plan Limits */}
      {totalConnections > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Saldo das Contas */}
          <AccountBalancesWidget />
          
          {/* Plan Limits Indicator */}
          <PlanLimitsIndicator />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Acesse rapidamente os dashboards e funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button asChild className="justify-start">
                <Link href="/dashboard/clients">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Cliente
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="justify-start">
                <Link href="/dashboard/reports">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Relatórios
                </Link>
              </Button>

              <ExportButton
                clientId={effectiveClientId || ""}
                platform="unified"
                variant="outline"
                className="justify-start"
                disabled={totalConnections === 0 || !effectiveClientId}
              />
            </div>

            {/* Platform-specific quick links */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Dashboards Específicos</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button 
                  asChild 
                  variant={hasMetaConnections ? "default" : "secondary"} 
                  className="justify-start"
                  disabled={!hasMetaConnections}
                >
                  <Link href="/dashboard/meta">
                    <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center mr-2">
                      <span className="text-white text-xs font-bold">f</span>
                    </div>
                    Dashboard Meta Ads
                    <div className="ml-auto h-3 w-3">↗</div>
                  </Link>
                </Button>
                 
                <Button 
                  asChild 
                  variant={hasGoogleConnections ? "default" : "secondary"} 
                  className="justify-start"
                  disabled={!hasGoogleConnections}
                >
                  <Link href="/dashboard/google">
                    <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center mr-2">
                      <span className="text-white text-xs font-bold">G</span>
                    </div>
                    Dashboard Google Ads
                    <div className="ml-auto h-3 w-3">↗</div>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Analytics quick links */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Analytics e Relatórios</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button asChild variant="outline" className="justify-start" size="sm">
                  <Link href="/dashboard/analytics">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Relatórios Meta
                  </Link>
                </Button>
                 
                <Button 
                  asChild 
                  variant="outline" 
                  className="justify-start" 
                  size="sm"
                  disabled={!hasGoogleConnections}
                >
                  <Link href="/dashboard/analytics/google">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Relatórios Google
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Primeiros Passos</CardTitle>
            <CardDescription>
              Configure seu sistema em poucos passos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {totalClients === 0 ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Adicione seu primeiro cliente</p>
                    <p className="text-sm text-muted-foreground">Comece criando um cliente</p>
                  </div>
                </div>
                 
                <div className="flex items-center space-x-3 opacity-50">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-muted-foreground font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Conecte Meta ou Google Ads</p>
                    <p className="text-sm text-muted-foreground">Vincule as contas de anúncios</p>
                  </div>
                </div>
                 
                <div className="flex items-center space-x-3 opacity-50">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-muted-foreground font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Visualize relatórios</p>
                    <p className="text-sm text-muted-foreground">Acompanhe performance das campanhas</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-medium">Cliente criado</p>
                    <p className="text-sm text-muted-foreground">{totalClients} cliente(s) adicionado(s)</p>
                  </div>
                </div>
                 
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    totalConnections > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    <span className={`font-semibold text-sm ${
                      totalConnections > 0 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {totalConnections > 0 ? '✓' : '2'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">Conectar plataformas de anúncios</p>
                    <p className="text-sm text-muted-foreground">
                      {totalConnections > 0 
                        ? `${totalConnections} conexão(ões) ativa(s)` 
                        : 'Meta Ads e Google Ads'
                      }
                    </p>
                  </div>
                </div>
                 
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Configurar relatórios automáticos</p>
                    <p className="text-sm text-muted-foreground">WhatsApp e análise com IA</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Real-time Insights */}
      {totalConnections > 0 && (
        <RealTimeInsights />
      )}

      {/* Recent Activity */}
      {totalClients > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Clientes Recentes</CardTitle>
            <CardDescription>
              Seus clientes adicionados recentemente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients?.slice(0, 3).map((client) => (
                <div key={client.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/clients/${client.id}`}>
                      Ver Detalhes
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Component to show when selected client has no connections
function NoClientConnectionsMessage({ clientId }: { clientId: string }) {
  const [hasConnections, setHasConnections] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkClientConnections = async () => {
      try {
        const response = await fetch(`/api/unified/metrics?clientId=${clientId}&startDate=2025-01-01&endDate=2025-01-01&_t=${Date.now()}`);
        const data = await response.json();
        
        if (data.success && data.data) {
          const hasMeta = data.data.dataQuality.metaDataAvailable;
          const hasGoogle = data.data.dataQuality.googleDataAvailable;
          setHasConnections(hasMeta || hasGoogle);
        } else {
          setHasConnections(false);
        }
      } catch (error) {
        console.error('Error checking client connections:', error);
        setHasConnections(false);
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
      checkClientConnections();
    }
  }, [clientId]);

  // ✅ CORREÇÃO: Sempre renderiza algo, nunca retorna null
  // Usamos renderização condicional dentro do return
  const shouldShow = !loading && hasConnections === false;

  return shouldShow ? (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhuma conexão para este cliente
          </h3>
          <p className="text-muted-foreground mb-4">
            O cliente selecionado não possui conexões ativas com Meta Ads ou Google Ads.
            Selecione outro cliente ou conecte uma plataforma para ver as métricas.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/clients">
                <Users className="mr-2 h-4 w-4" />
                Gerenciar Clientes
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/connections">
                <Plus className="mr-2 h-4 w-4" />
                Conectar Plataforma
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;
}
