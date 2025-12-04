'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AdSet {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  cpm: number
  reach: number
  frequency: number
}

interface AdSetComparisonProps {
  clientId: string
  campaignId: string
  campaignName: string
  dateRange: string
  selectedAdSets?: string[]
}

export function AdSetComparison({
  clientId,
  campaignId,
  campaignName,
  dateRange,
  selectedAdSets
}: AdSetComparisonProps) {
  const [adsets, setAdsets] = useState<AdSet[]>([])
  const [comparisonData, setComparisonData] = useState<AdSet[]>([])
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string>('')

  // Buscar todos os adsets da campanha
  useEffect(() => {
    fetchAdSets()
  }, [clientId, campaignId, dateRange])

  // Quando selectedAdSets mudar, atualizar comparação
  useEffect(() => {
    if (selectedAdSets && selectedAdSets.length > 0 && adsets.length > 0) {
      compareSelected(selectedAdSets)
    }
  }, [selectedAdSets, adsets])

  const fetchAdSets = async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        client_id: clientId,
        campaign_id: campaignId,
        date_range: dateRange
      })

      const response = await fetch(`/api/analytics/adsets?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar conjuntos')
      }

      const fetchedAdsets = data.adsets || []
      setAdsets(fetchedAdsets)
      
      // Se já temos adsets selecionados, filtrar imediatamente
      if (selectedAdSets && selectedAdSets.length > 0) {
        const filtered = fetchedAdsets.filter((a: AdSet) => selectedAdSets.includes(a.id))
        setComparisonData(filtered)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const compareSelected = async (adsetsToCompare: string[]) => {
    if (adsetsToCompare.length < 1) return

    setComparing(true)
    try {
      // Filtrar os adsets já carregados pelos IDs selecionados
      const filtered = adsets.filter(a => adsetsToCompare.includes(a.id))
      setComparisonData(filtered)
    } finally {
      setComparing(false)
    }
  }

  const handleRefresh = () => {
    fetchAdSets()
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      ACTIVE: 'default',
      PAUSED: 'secondary',
      ARCHIVED: 'destructive'
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const getTrend = (value: number, avg: number) => {
    if (value > avg * 1.1) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < avg * 0.9) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <span className="h-4 w-4 text-gray-400">—</span>
  }

  // Usar comparisonData para exibição (adsets filtrados pelos selecionados)
  const displayData = comparisonData.length > 0 ? comparisonData : adsets

  // Calcular médias baseado nos dados exibidos
  const avgSpend = displayData.reduce((sum, a) => sum + a.spend, 0) / (displayData.length || 1)
  const avgCtr = displayData.reduce((sum, a) => sum + a.ctr, 0) / (displayData.length || 1)
  const avgCpc = displayData.reduce((sum, a) => sum + a.cpc, 0) / (displayData.length || 1)

  // Dados para gráfico
  const chartData = displayData.map(adset => ({
    name: adset.name.length > 20 ? adset.name.substring(0, 20) + '...' : adset.name,
    Gasto: adset.spend,
    Conversões: adset.conversions,
    CTR: adset.ctr
  }))

  // Função para encontrar o melhor performer
  const getBestPerformer = (metric: keyof AdSet) => {
    if (displayData.length === 0) return null

    return displayData.reduce((best, current) => {
      const currentValue = Number(current[metric]) || 0
      const bestValue = Number(best[metric]) || 0

      // Para CTR, queremos o maior valor
      if (metric === 'ctr') {
        return currentValue > bestValue ? current : best
      }
      // Para CPM e CPC, queremos o menor valor (mais eficiente)
      if (metric === 'cpm' || metric === 'cpc') {
        if (bestValue === 0) return current
        if (currentValue === 0) return best
        return currentValue < bestValue ? current : best
      }
      // Para impressões, cliques, conversões, queremos o maior valor
      return currentValue > bestValue ? current : best
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (displayData.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Nenhum conjunto de anúncios encontrado para esta campanha.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Comparação de Conjuntos de Anúncios</CardTitle>
              <CardDescription>
                Campanha: {campaignName} • {displayData.length} conjunto{displayData.length > 1 ? 's' : ''} selecionado{displayData.length > 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || comparing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loading || comparing) ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Comparativa</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="Gasto" fill="#3b82f6" />
              <Bar yAxisId="right" dataKey="Conversões" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Comparativa (estilo similar ao CampaignComparison) */}
      {displayData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Tabela Comparativa</CardTitle>
            <CardDescription>Compare métricas lado a lado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 p-3 text-left">Métrica</th>
                    {displayData.map((adset) => (
                      <th key={adset.id} className="border border-gray-200 p-3 text-left">
                        <div className="truncate max-w-[150px]" title={adset.name}>
                          {adset.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Impressões</td>
                    {displayData.map((adset) => {
                      const best = getBestPerformer('impressions')
                      const isBest = best?.id === adset.id
                      return (
                        <td key={adset.id} className="border border-gray-200 p-3">
                          <div className="flex items-center">
                            {formatNumber(adset.impressions || 0)}
                            {isBest && displayData.length > 1 && <TrendingUp className="w-4 h-4 text-green-500 ml-2" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Cliques</td>
                    {displayData.map((adset) => {
                      const best = getBestPerformer('clicks')
                      const isBest = best?.id === adset.id
                      return (
                        <td key={adset.id} className="border border-gray-200 p-3">
                          <div className="flex items-center">
                            {formatNumber(adset.clicks || 0)}
                            {isBest && displayData.length > 1 && <TrendingUp className="w-4 h-4 text-green-500 ml-2" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">CTR</td>
                    {displayData.map((adset) => {
                      const best = getBestPerformer('ctr')
                      const isBest = best?.id === adset.id
                      return (
                        <td key={adset.id} className="border border-gray-200 p-3">
                          <div className="flex items-center">
                            {adset.ctr.toFixed(2)}%
                            {isBest && displayData.length > 1 && <TrendingUp className="w-4 h-4 text-green-500 ml-2" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Gasto</td>
                    {displayData.map((adset) => (
                      <td key={adset.id} className="border border-gray-200 p-3">
                        {formatCurrency(adset.spend || 0)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">CPM</td>
                    {displayData.map((adset) => {
                      const best = getBestPerformer('cpm')
                      const isBest = best?.id === adset.id
                      return (
                        <td key={adset.id} className="border border-gray-200 p-3">
                          <div className="flex items-center">
                            {formatCurrency(adset.cpm || 0)}
                            {isBest && displayData.length > 1 && <TrendingDown className="w-4 h-4 text-green-500 ml-2" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">CPC</td>
                    {displayData.map((adset) => {
                      const best = getBestPerformer('cpc')
                      const isBest = best?.id === adset.id
                      return (
                        <td key={adset.id} className="border border-gray-200 p-3">
                          <div className="flex items-center">
                            {formatCurrency(adset.cpc || 0)}
                            {isBest && displayData.length > 1 && <TrendingDown className="w-4 h-4 text-green-500 ml-2" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Conversões</td>
                    {displayData.map((adset) => {
                      const best = getBestPerformer('conversions')
                      const isBest = best?.id === adset.id
                      return (
                        <td key={adset.id} className="border border-gray-200 p-3">
                          <div className="flex items-center font-medium">
                            {formatNumber(adset.conversions || 0)}
                            {isBest && displayData.length > 1 && <TrendingUp className="w-4 h-4 text-green-500 ml-2" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Alcance</td>
                    {displayData.map((adset) => {
                      const best = getBestPerformer('reach')
                      const isBest = best?.id === adset.id
                      return (
                        <td key={adset.id} className="border border-gray-200 p-3">
                          <div className="flex items-center">
                            {formatNumber(adset.reach || 0)}
                            {isBest && displayData.length > 1 && <TrendingUp className="w-4 h-4 text-green-500 ml-2" />}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-3 font-medium">Frequência</td>
                    {displayData.map((adset) => (
                      <td key={adset.id} className="border border-gray-200 p-3">
                        {adset.frequency?.toFixed(2) || '0.00'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights da Comparação */}
      {displayData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>💡 Insights da Comparação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
              <ul className="text-sm space-y-1">
                <li>🏆 Melhor CTR: <strong>{getBestPerformer('ctr')?.name}</strong> ({getBestPerformer('ctr')?.ctr.toFixed(2)}%)</li>
                <li>💰 Menor CPM: <strong>{getBestPerformer('cpm')?.name}</strong> ({formatCurrency(getBestPerformer('cpm')?.cpm || 0)})</li>
                <li>🎯 Menor CPC: <strong>{getBestPerformer('cpc')?.name}</strong> ({formatCurrency(getBestPerformer('cpc')?.cpc || 0)})</li>
                <li>📈 Mais Conversões: <strong>{getBestPerformer('conversions')?.name}</strong> ({formatNumber(getBestPerformer('conversions')?.conversions || 0)})</li>
                <li>👥 Maior Alcance: <strong>{getBestPerformer('reach')?.name}</strong> ({formatNumber(getBestPerformer('reach')?.reach || 0)})</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela Detalhada (mantida para visualização individual) */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Conjuntos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((adset) => (
                  <TableRow key={adset.id}>
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="truncate" title={adset.name}>
                        {adset.name}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(adset.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getTrend(adset.spend, avgSpend)}
                        {formatCurrency(adset.spend)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(adset.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(adset.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getTrend(adset.ctr, avgCtr)}
                        {adset.ctr.toFixed(2)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getTrend(adset.cpc, avgCpc)}
                        {formatCurrency(adset.cpc)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(adset.cpm)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(adset.conversions)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Gasto Total</div>
              <div className="text-2xl font-bold">
                {formatCurrency(displayData.reduce((sum, a) => sum + a.spend, 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total de Cliques</div>
              <div className="text-2xl font-bold">
                {formatNumber(displayData.reduce((sum, a) => sum + a.clicks, 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">CTR Médio</div>
              <div className="text-2xl font-bold">{avgCtr.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total de Conversões</div>
              <div className="text-2xl font-bold">
                {formatNumber(displayData.reduce((sum, a) => sum + a.conversions, 0))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
