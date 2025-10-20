'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { formatters } from '@/lib/utils/date-formatter'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchAdSets()
  }, [clientId, campaignId, dateRange, selectedAdSets])

  const fetchAdSets = async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        client_id: clientId,
        campaign_id: campaignId,
        date_range: dateRange
      })

      if (selectedAdSets && selectedAdSets.length > 0) {
        params.append('adset_ids', selectedAdSets.join(','))
      }

      const response = await fetch(`/api/analytics/adsets?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar conjuntos')
      }

      setAdsets(data.adsets || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
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
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  // Calcular médias
  const avgSpend = adsets.reduce((sum, a) => sum + a.spend, 0) / (adsets.length || 1)
  const avgCtr = adsets.reduce((sum, a) => sum + a.ctr, 0) / (adsets.length || 1)
  const avgCpc = adsets.reduce((sum, a) => sum + a.cpc, 0) / (adsets.length || 1)

  // Dados para gráfico
  const chartData = adsets.map(adset => ({
    name: adset.name.length > 20 ? adset.name.substring(0, 20) + '...' : adset.name,
    Gasto: adset.spend,
    Conversões: adset.conversions,
    CTR: adset.ctr
  }))

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

  if (adsets.length === 0) {
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
          <CardTitle>Comparação de Conjuntos de Anúncios</CardTitle>
          <CardDescription>
            Campanha: {campaignName} • {adsets.length} conjunto{adsets.length > 1 ? 's' : ''}
          </CardDescription>
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

      {/* Tabela */}
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
                {adsets.map((adset) => (
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
                {formatCurrency(adsets.reduce((sum, a) => sum + a.spend, 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total de Cliques</div>
              <div className="text-2xl font-bold">
                {formatNumber(adsets.reduce((sum, a) => sum + a.clicks, 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">CTR Médio</div>
              <div className="text-2xl font-bold">{avgCtr.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total de Conversões</div>
              <div className="text-2xl font-bold">
                {formatNumber(adsets.reduce((sum, a) => sum + a.conversions, 0))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
