/**
 * Dashboard Avançado de Campanhas - Admin
 * - KPIs detalhados de campanhas
 * - Filtros avançados
 * - Dados demográficos
 * - Análise semanal
 * - Funil de conversão
 * - Métricas com cores
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
  Globe,
  Smartphone,
  Monitor,
  RefreshCw
} from 'lucide-react'

interface CampaignKPI {
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

interface ConversionFunnel {
  stage: string
  count: number
  percentage: number
  color: string
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignKPI[]>([])
  const [demographics, setDemographics] = useState<DemographicData[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('this_month')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('spend')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadCampaignData()
  }, [statusFilter, objectiveFilter, dateRange, sortBy, sortOrder])

  const loadCampaignData = async () => {
    try {
      setLoading(true)
      
      // Carregar campanhas com filtros
      const campaignsResponse = await fetch(`/api/admin/campaigns?status=${statusFilter}&objective=${objectiveFilter}&days=${dateRange}&sort=${sortBy}&order=${sortOrder}`)
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json()
        setCampaigns(campaignsData.campaigns || [])
      }

      // Carregar dados demográficos
      const demographicsResponse = await fetch(`/api/admin/campaigns/demographics?days=${dateRange}`)
      if (demographicsResponse.ok) {
        const demographicsData = await demographicsResponse.json()
        setDemographics(demographicsData.demographics || [])
      }

      // Carregar dados semanais
      const weeklyResponse = await fetch(`/api/admin/campaigns/weekly?days=${dateRange}`)
      if (weeklyResponse.ok) {
        const weeklyDataResponse = await weeklyResponse.json()
        setWeeklyData(weeklyDataResponse.weekly || [])
      }

      // Carregar funil de conversão
      const funnelResponse = await fetch(`/api/admin/campaigns/funnel?days=${dateRange}`)
      if (funnelResponse.ok) {
        const funnelData = await funnelResponse.json()
        setConversionFunnel(funnelData.funnel || [])
      }

    } catch (error) {
      console.error('Error loading campaign data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => 
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.account_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalMetrics = filteredCampaigns.reduce((acc, campaign) => ({
    spend: acc.spend + campaign.spend,
    impressions: acc.impressions + campaign.impressions,
    clicks: acc.clicks + campaign.clicks,
    conversions: acc.conversions + campaign.conversions,
    reach: acc.reach + campaign.reach
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 })

  const avgCTR = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions * 100) : 0
  const avgCPC = totalMetrics.clicks > 0 ? (totalMetrics.spend / totalMetrics.clicks) : 0
  const avgROAS = totalMetrics.spend > 0 ? (totalMetrics.conversions * 50 / totalMetrics.spend) : 0 // Assumindo valor médio de conversão de $50

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
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
            Análise avançada de performance de campanhas
          </p>
        </div>
        <Button onClick={loadCampaignData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filtros Avançados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filtros Avançados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <Input
                placeholder="Nome da campanha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CONVERSIONS">Conversões</SelectItem>
                  <SelectItem value="TRAFFIC">Tráfego</SelectItem>
                  <SelectItem value="REACH">Alcance</SelectItem>
                  <SelectItem value="BRAND_AWARENESS">Brand Awareness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="365">1 ano</SelectItem>
                </SelectContent>
              </Select>
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
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="demographics">Demografia</TabsTrigger>
          <TabsTrigger value="weekly">Análise Semanal</TabsTrigger>
          <TabsTrigger value="funnel">Funil de Conversão</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Campanhas</CardTitle>
              <CardDescription>Performance detalhada de cada campanha</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredCampaigns.map((campaign) => (
                  <div key={campaign.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Funil de Conversão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversionFunnel.map((stage, index) => (
                  <div key={stage.stage} className="relative">
                    <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: `${stage.color}20` }}>
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-medium">{stage.stage}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="font-semibold">{formatNumber(stage.count)}</span>
                        <span className="text-sm text-muted-foreground">
                          {stage.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={stage.percentage} 
                      className="mt-2"
                      style={{ 
                        '--progress-background': stage.color 
                      } as React.CSSProperties}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}