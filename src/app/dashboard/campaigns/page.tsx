/**
 * Dashboard de Campanhas - Menu Principal
 * - Super admin: escolhe cliente e vê todas as campanhas
 * - Usuário comum: vê apenas campanhas dos seus clientes
 * - Análises completas: diária, semanal, mensal
 * - KPIs detalhados e insights
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  DollarSign,
  Eye,
  MousePointer,
  ShoppingCart,
  Filter,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Building2,
  Search,
  Power,
  Loader2,
  Crown
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { ClientSearch } from '@/components/clients/client-search'
import { CampaignSearch } from '@/components/campaigns/campaign-search'
import { DateRangePicker } from '@/components/campaigns/date-range-picker'
import { useFeatureGate } from '@/hooks/use-feature-gate'
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt'

interface Client {
  id: string
  name: string
  organization_name: string
}

interface Campaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  spend: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  roas: number
  reach: number
  frequency: number
  account_name: string
  objective: string
  created_time: string
  client_name: string
}

interface DemographicData {
  age_range: string
  gender: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
}

interface WeeklyData {
  week: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  roas: number
}

export default function CampaignsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [demographics, setDemographics] = useState<DemographicData[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { toast } = useToast()
  
  // Feature gating for campaigns
  const { withinLimit, currentUsage, limit, loading: featureLoading } = useFeatureGate('maxCampaigns')
  
  // Filtros
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('this_month')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('spend')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Mapeamento de objetivos para português
  const objectiveLabels: Record<string, string> = {
    'APP_INSTALLS': 'Instalações de App',
    'BRAND_AWARENESS': 'Reconhecimento de Marca',
    'CONVERSIONS': 'Conversões',
    'EVENT_RESPONSES': 'Respostas a Eventos',
    'LEAD_GENERATION': 'Geração de Leads',
    'LINK_CLICKS': 'Cliques no Link',
    'LOCAL_AWARENESS': 'Reconhecimento Local',
    'MESSAGES': 'Mensagens',
    'OFFER_CLAIMS': 'Reivindicações de Ofertas',
    'OUTCOME_APP_PROMOTION': 'Promoção de App',
    'OUTCOME_AWARENESS': 'Reconhecimento',
    'OUTCOME_ENGAGEMENT': 'Engajamento',
    'OUTCOME_LEADS': 'Leads',
    'OUTCOME_SALES': 'Vendas',
    'OUTCOME_TRAFFIC': 'Tráfego',
    'PAGE_LIKES': 'Curtidas na Página',
    'POST_ENGAGEMENT': 'Engajamento com Publicação',
    'PRODUCT_CATALOG_SALES': 'Vendas do Catálogo',
    'REACH': 'Alcance',
    'STORE_VISITS': 'Visitas à Loja',
    'VIDEO_VIEWS': 'Visualizações de Vídeo'
  }

  // Extrair objetivos únicos das campanhas carregadas
  const availableObjectives = Array.from(new Set(campaigns.map(c => c.objective))).sort()

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (clients.length > 0 && selectedClient !== 'all') {
      loadCampaignData()
    }
  }, [selectedClient, statusFilter, objectiveFilter, dateRange, sortBy, sortOrder, clients.length])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      
      // Carregar clientes disponíveis
      const clientsResponse = await fetch('/api/dashboard/clients')
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json()
        setClients(clientsData.clients || [])
        setIsSuperAdmin(clientsData.isSuperAdmin || false)
        
        // Se for usuário comum e tiver clientes, selecionar automaticamente o primeiro
        if (!clientsData.isSuperAdmin && clientsData.clients?.length > 0) {
          setSelectedClient(clientsData.clients[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncCampaigns = async () => {
    if (selectedClient === 'all') return;
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/meta/sync-campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId: selectedClient }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Sincronização de campanhas REAIS concluída:', data);
        alert(`✅ ${data.totalCampaignsSynced} campanhas reais sincronizadas!`);
        // Recarregar campanhas após sincronização
        await loadCampaignData();
      } else {
        console.error('❌ Erro na sincronização:', data.error);
        alert(`❌ Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('💥 Erro ao sincronizar:', error);
      alert('💥 Erro ao sincronizar campanhas');
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignData = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        client_id: selectedClient,
        status: statusFilter,
        objective: objectiveFilter,
        days: dateRange,
        sort: sortBy,
        order: sortOrder
      })

      // Carregar campanhas - usando API original
      const campaignsResponse = await fetch(`/api/dashboard/campaigns?${params}`)
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json()
        const loadedCampaigns = campaignsData.campaigns || []
        setCampaigns(loadedCampaigns)
        
        // Atualizar contador de campanhas no cliente selecionado
        if (selectedClient !== 'all') {
          setClients(prevClients => 
            prevClients.map(client => 
              client.id === selectedClient 
                ? { ...client, campaigns_count: loadedCampaigns.length }
                : client
            )
          )
        }
        
        // Log para debug
        if (campaignsData.message) {
          console.log('API Message:', campaignsData.message)
        }
      } else {
        console.error('Error loading campaigns:', campaignsResponse.status)
        setCampaigns([])
      }

      // Carregar dados demográficos
      const demographicsResponse = await fetch(`/api/dashboard/campaigns/demographics?${params}`)
      if (demographicsResponse.ok) {
        const demographicsData = await demographicsResponse.json()
        setDemographics(demographicsData.demographics || [])
      }

      // Carregar dados semanais
      const weeklyResponse = await fetch(`/api/dashboard/campaigns/weekly?${params}`)
      if (weeklyResponse.ok) {
        const weeklyDataResponse = await weeklyResponse.json()
        setWeeklyData(weeklyDataResponse.weekly || [])
      }

    } catch (error) {
      console.error('Error loading campaign data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    // Filtro por campanha específica selecionada
    if (selectedCampaign && selectedCampaign !== '') {
      return campaign.id === selectedCampaign;
    }
    
    // Filtro por termo de busca (mantido para compatibilidade)
    return campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           campaign.account_name.toLowerCase().includes(searchTerm.toLowerCase());
  })

  const totalMetrics = filteredCampaigns.reduce((acc, campaign) => ({
    spend: acc.spend + campaign.spend,
    impressions: acc.impressions + campaign.impressions,
    clicks: acc.clicks + campaign.clicks,
    conversions: acc.conversions + campaign.conversions,
    reach: acc.reach + campaign.reach
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 })

  const avgCTR = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions * 100) : 0
  const avgCPC = totalMetrics.clicks > 0 ? (totalMetrics.spend / totalMetrics.clicks) : 0
  const avgROAS = totalMetrics.spend > 0 ? (totalMetrics.conversions * 50 / totalMetrics.spend) : 0

  const getMetricColor = (value: number, type: 'ctr' | 'cpc' | 'roas') => {
    switch (type) {
      case 'ctr':
        if (value >= 2) return 'text-green-600'
        if (value >= 1) return 'text-yellow-600'
        return 'text-red-600'
      case 'cpc':
        if (value <= 1) return 'text-green-600'
        if (value <= 3) return 'text-yellow-600'
        return 'text-red-600'
      case 'roas':
        if (value >= 4) return 'text-green-600'
        if (value >= 2) return 'text-yellow-600'
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800'
      case 'ARCHIVED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const toggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    try {
      setTogglingCampaign(campaignId)
      
      const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
      
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao alterar status')
      }

      // Atualizar campanha localmente
      setCampaigns(prevCampaigns =>
        prevCampaigns.map(campaign =>
          campaign.id === campaignId
            ? { ...campaign, status: newStatus as 'ACTIVE' | 'PAUSED' }
            : campaign
        )
      )

      toast({
        title: 'Status atualizado!',
        description: data.message,
      })

    } catch (error) {
      console.error('Erro ao alterar status:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao alterar status da campanha',
        variant: 'destructive'
      })
    } finally {
      setTogglingCampaign(null)
    }
  }

  const selectedClientName = clients.find(c => c.id === selectedClient)?.name || 'Todos os clientes'

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Se não há clientes, mostrar mensagem
  if (!loading && clients.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard de Campanhas</h1>
            <p className="text-muted-foreground">
              Análise completa de performance de campanhas
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nenhum cliente encontrado
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Você precisa ter clientes cadastrados para visualizar campanhas. 
                Vá para a seção de clientes para adicionar seu primeiro cliente.
              </p>
              <Button asChild>
                <Link href="/dashboard/clients">
                  <Users className="w-4 h-4 mr-2" />
                  Gerenciar Clientes
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Campanhas</h1>
          <p className="text-muted-foreground">
            Análise completa de performance - {selectedClientName}
          </p>
          {!featureLoading && (
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant={withinLimit ? "default" : "destructive"}>
                {currentUsage} / {limit} campanhas
              </Badge>
              {!withinLimit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUpgradeOpen(true)}
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade
                </Button>
              )}
            </div>
          )}
        </div>
        <Button onClick={loadCampaignData} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Seletor de Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            {isSuperAdmin ? 'Seleção de Cliente' : 'Cliente Atual'}
          </CardTitle>
          <CardDescription>
            {isSuperAdmin 
              ? 'Escolha o cliente para visualizar as campanhas'
              : 'Visualizando campanhas dos seus clientes'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cliente</label>
              <ClientSearch
                clients={clients}
                selectedClient={selectedClient}
                onClientSelect={setSelectedClient}
                placeholder="Selecione um cliente..."
                showAllOption={false}
                isSuperAdmin={isSuperAdmin}
              />
            </div>
            <div className="flex items-end space-x-2">
              <Button 
                onClick={loadCampaignData} 
                className="flex-1"
                disabled={selectedClient === 'all' || loading}
              >
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Carregando...' : 'Carregar Campanhas'}
              </Button>
              <Button 
                onClick={syncCampaigns} 
                variant="outline"
                disabled={selectedClient === 'all' || loading}
                title="Sincronizar campanhas reais do Meta Ads"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {selectedClient === 'all' && isSuperAdmin && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Selecione um cliente específico para visualizar as campanhas
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros Avançados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filtros e Busca
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar Campanha</label>
              <CampaignSearch
                campaigns={campaigns}
                selectedCampaign={selectedCampaign}
                onCampaignSelect={setSelectedCampaign}
                placeholder="Buscar campanha..."
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="PAUSED">Pausado</SelectItem>
                  <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Objetivo</label>
              <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os objetivos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({campaigns.length})</SelectItem>
                  {availableObjectives.length > 0 ? (
                    availableObjectives.map(objective => {
                      const count = campaigns.filter(c => c.objective === objective).length
                      return (
                        <SelectItem key={objective} value={objective}>
                          {objectiveLabels[objective] || objective} ({count})
                        </SelectItem>
                      )
                    })
                  ) : (
                    <SelectItem value="none" disabled>
                      Nenhum objetivo disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Ordenar por</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spend">Gasto</SelectItem>
                  <SelectItem value="impressions">Impressões</SelectItem>
                  <SelectItem value="clicks">Cliques</SelectItem>
                  <SelectItem value="conversions">Conversões</SelectItem>
                  <SelectItem value="ctr">CTR</SelectItem>
                  <SelectItem value="roas">ROAS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Ordem</label>
              <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Maior para menor</SelectItem>
                  <SelectItem value="asc">Menor para maior</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMetrics.spend)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredCampaigns.length} campanhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impressões</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalMetrics.impressions)}</div>
            <p className="text-xs text-muted-foreground">
              Alcance: {formatNumber(totalMetrics.reach)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalMetrics.clicks)}</div>
            <p className={`text-xs ${getMetricColor(avgCTR, 'ctr')}`}>
              CTR: {avgCTR.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversões</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalMetrics.conversions)}</div>
            <p className={`text-xs ${getMetricColor(avgCPC, 'cpc')}`}>
              CPC: {formatCurrency(avgCPC)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROAS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(avgROAS, 'roas')}`}>
              {avgROAS.toFixed(2)}x
            </div>
            <p className="text-xs text-muted-foreground">
              Retorno sobre investimento
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Lista de Campanhas</TabsTrigger>
          <TabsTrigger value="demographics">Demografia</TabsTrigger>
          <TabsTrigger value="weekly">Análise Semanal</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campanhas Ativas</CardTitle>
              <CardDescription>Performance detalhada de cada campanha</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedClient === 'all' ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600">Selecione um cliente</p>
                  <p className="text-gray-500">
                    Escolha um cliente no seletor acima para visualizar as campanhas
                  </p>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600">Nenhuma campanha encontrada</p>
                  <p className="text-gray-500 mb-4">
                    Este cliente ainda não possui campanhas do Meta Ads sincronizadas.
                  </p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Para ver campanhas aqui, você precisa:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Conectar uma conta Meta Ads para este cliente</li>
                      <li>Executar a sincronização das campanhas</li>
                      <li>Verificar se as campanhas estão ativas no Meta</li>
                    </ul>
                  </div>
                  <div className="mt-6 space-x-4">
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/clients/${selectedClient}`}>
                        <Building2 className="w-4 h-4 mr-2" />
                        Gerenciar Cliente
                      </Link>
                    </Button>
                    <Button 
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const response = await fetch('/api/fix-campaigns-now', { method: 'POST' });
                          const data = await response.json();
                          if (response.ok) {
                            alert(`✅ ${data.message}`);
                            await loadCampaignData();
                          } else {
                            alert(`❌ ${data.error}`);
                          }
                        } catch (error) {
                          alert('❌ Erro ao criar campanhas');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      {loading ? 'Criando...' : 'RESOLVER AGORA'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCampaigns.map((campaign) => (
                    <div key={campaign.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center gap-2">
                            {togglingCampaign === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Switch
                                checked={campaign.status === 'ACTIVE'}
                                onCheckedChange={() => toggleCampaignStatus(campaign.id, campaign.status)}
                                disabled={togglingCampaign !== null || campaign.status === 'ARCHIVED'}
                                title={campaign.status === 'ARCHIVED' ? 'Campanhas arquivadas não podem ser alteradas' : 'Ativar/Pausar campanha'}
                              />
                            )}
                          </div>
                          <h3 className="font-semibold">{campaign.name}</h3>
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {campaign.account_name}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {campaign.objective}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Gasto</span>
                          <div className="font-semibold">{formatCurrency(campaign.spend)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Impressões</span>
                          <div className="font-semibold">{formatNumber(campaign.impressions)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliques</span>
                          <div className="font-semibold">{formatNumber(campaign.clicks)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Conversões</span>
                          <div className="font-semibold">{formatNumber(campaign.conversions)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTR</span>
                          <div className={`font-semibold ${getMetricColor(campaign.ctr, 'ctr')}`}>
                            {campaign.ctr.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CPC</span>
                          <div className={`font-semibold ${getMetricColor(campaign.cpc, 'cpc')}`}>
                            {formatCurrency(campaign.cpc)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">ROAS</span>
                          <div className={`font-semibold ${getMetricColor(campaign.roas, 'roas')}`}>
                            {campaign.roas.toFixed(2)}x
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Frequência</span>
                          <div className="font-semibold">{campaign.frequency.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Por Faixa Etária
                </CardTitle>
              </CardHeader>
              <CardContent>
                {demographics.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Dados demográficos não disponíveis
                  </p>
                ) : (
                  <div className="space-y-3">
                    {demographics
                      .reduce((acc: any[], demo) => {
                        const existing = acc.find(item => item.age_range === demo.age_range)
                        if (existing) {
                          existing.impressions += demo.impressions
                          existing.clicks += demo.clicks
                          existing.spend += demo.spend
                          existing.conversions += demo.conversions
                        } else {
                          acc.push({ ...demo })
                        }
                        return acc
                      }, [])
                      .map((demo) => (
                        <div key={demo.age_range} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="font-medium">{demo.age_range}</span>
                            <Progress 
                              value={(demo.impressions / totalMetrics.impressions) * 100} 
                              className="w-20" 
                            />
                          </div>
                          <div className="text-sm space-x-4">
                            <span>{formatNumber(demo.impressions)} imp</span>
                            <span>{formatNumber(demo.clicks)} clicks</span>
                            <span>{formatCurrency(demo.spend)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Por Gênero
                </CardTitle>
              </CardHeader>
              <CardContent>
                {demographics.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Dados demográficos não disponíveis
                  </p>
                ) : (
                  <div className="space-y-3">
                    {demographics
                      .reduce((acc: any[], demo) => {
                        const existing = acc.find(item => item.gender === demo.gender)
                        if (existing) {
                          existing.impressions += demo.impressions
                          existing.clicks += demo.clicks
                          existing.spend += demo.spend
                          existing.conversions += demo.conversions
                        } else {
                          acc.push({ ...demo })
                        }
                        return acc
                      }, [])
                      .map((demo) => (
                        <div key={demo.gender} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="font-medium capitalize">{demo.gender}</span>
                            <Progress 
                              value={(demo.impressions / totalMetrics.impressions) * 100} 
                              className="w-20" 
                            />
                          </div>
                          <div className="text-sm space-x-4">
                            <span>{formatNumber(demo.impressions)} imp</span>
                            <span>{formatNumber(demo.clicks)} clicks</span>
                            <span>{formatCurrency(demo.spend)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Performance Semanal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyData.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Dados semanais não disponíveis
                </p>
              ) : (
                <div className="space-y-4">
                  {weeklyData.map((week) => (
                    <div key={week.week} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{week.week}</h3>
                        <div className={`text-sm font-medium ${getMetricColor(week.roas, 'roas')}`}>
                          ROAS: {week.roas.toFixed(2)}x
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Gasto</span>
                          <div className="font-semibold">{formatCurrency(week.spend)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Impressões</span>
                          <div className="font-semibold">{formatNumber(week.impressions)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliques</span>
                          <div className="font-semibold">{formatNumber(week.clicks)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Conversões</span>
                          <div className="font-semibold">{formatNumber(week.conversions)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Insights e Recomendações
              </CardTitle>
              <CardDescription>
                Análise inteligente baseada nas campanhas filtradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredCampaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600">Nenhuma campanha para analisar</p>
                  <p className="text-gray-500">
                    Ajuste os filtros para ver insights das campanhas
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Insight de Performance Geral */}
                  {avgROAS >= 4 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <h4 className="font-medium text-green-800">Performance Excelente</h4>
                      </div>
                      <p className="text-sm text-green-700">
                        Suas campanhas filtradas estão com ROAS de {avgROAS.toFixed(2)}x. Excelente retorno sobre investimento!
                      </p>
                    </div>
                  )}

                  {avgROAS < 2 && avgROAS > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        <h4 className="font-medium text-red-800">Atenção Necessária</h4>
                      </div>
                      <p className="text-sm text-red-700">
                        ROAS atual de {avgROAS.toFixed(2)}x está abaixo do ideal. Considere revisar segmentação e criativos.
                      </p>
                    </div>
                  )}

                  {/* Insight de CTR */}
                  {avgCTR < 1 && totalMetrics.impressions > 0 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Target className="h-5 w-5 text-yellow-600" />
                        <h4 className="font-medium text-yellow-800">Oportunidade de Melhoria</h4>
                      </div>
                      <p className="text-sm text-yellow-700">
                        CTR de {avgCTR.toFixed(2)}% está baixo. Considere testar novos criativos e mensagens mais impactantes.
                      </p>
                    </div>
                  )}

                  {avgCTR >= 2 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <MousePointer className="h-5 w-5 text-green-600" />
                        <h4 className="font-medium text-green-800">Engajamento Excelente</h4>
                      </div>
                      <p className="text-sm text-green-700">
                        CTR de {avgCTR.toFixed(2)}% indica que seus anúncios estão muito relevantes para o público.
                      </p>
                    </div>
                  )}

                  {/* Insight de Demografia */}
                  {demographics.length > 0 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium text-blue-800">Insight de Audiência</h4>
                      </div>
                      <p className="text-sm text-blue-700">
                        {(() => {
                          const topAge = demographics
                            .reduce((acc: any[], demo) => {
                              const existing = acc.find(item => item.age_range === demo.age_range)
                              if (existing) {
                                existing.conversions += demo.conversions
                              } else {
                                acc.push({ age_range: demo.age_range, conversions: demo.conversions })
                              }
                              return acc
                            }, [])
                            .sort((a, b) => b.conversions - a.conversions)[0]
                          
                          if (topAge) {
                            const percentage = ((topAge.conversions / totalMetrics.conversions) * 100).toFixed(0)
                            return `Faixa etária ${topAge.age_range} representa ${percentage}% das conversões. Considere aumentar o investimento neste segmento.`
                          }
                          return 'Analise os dados demográficos para otimizar sua segmentação.'
                        })()}
                      </p>
                    </div>
                  )}

                  {/* Insight de Investimento */}
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                      <h4 className="font-medium text-purple-800">Resumo de Investimento</h4>
                    </div>
                    <p className="text-sm text-purple-700">
                      Investimento total de {formatCurrency(totalMetrics.spend)} em {filteredCampaigns.length} campanha(s), 
                      gerando {formatNumber(totalMetrics.conversions)} conversões com CPC médio de {formatCurrency(avgCPC)}.
                    </p>
                  </div>

                  {/* Insight de Frequência */}
                  {filteredCampaigns.some(c => c.frequency > 3) && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Eye className="h-5 w-5 text-orange-600" />
                        <h4 className="font-medium text-orange-800">Atenção à Frequência</h4>
                      </div>
                      <p className="text-sm text-orange-700">
                        Algumas campanhas têm frequência acima de 3. Considere expandir o público ou pausar temporariamente para evitar fadiga de anúncio.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="maxCampaigns"
        currentUsage={currentUsage}
        limit={limit}
        title="Limite de Campanhas Atingido"
        description="Você atingiu o limite de campanhas do seu plano atual. Faça upgrade para gerenciar mais campanhas."
      />
    </div>
  )
}