'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { CreativeThumbnail } from './creative-thumbnail'
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

interface Ad {
  id: string
  name: string
  status: string
  creative: {
    id: string
    title?: string
    body?: string
    image_url?: string
    thumbnail_url?: string
  }
  spend: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  cpm: number
}

interface AdComparisonProps {
  clientId: string
  campaignId: string
  campaignName: string
  adsetId: string
  adsetName: string
  dateRange: string
  selectedAds?: string[]
}

export function AdComparison({
  clientId,
  campaignId,
  campaignName,
  adsetId,
  adsetName,
  dateRange,
  selectedAds
}: AdComparisonProps) {
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchAds()
  }, [clientId, campaignId, adsetId, dateRange, selectedAds])

  const fetchAds = async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        client_id: clientId,
        campaign_id: campaignId,
        adset_id: adsetId,
        date_range: dateRange
      })

      if (selectedAds && selectedAds.length > 0) {
        params.append('ad_ids', selectedAds.join(','))
      }

      const response = await fetch(`/api/analytics/ads?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar anúncios')
      }

      setAds(data.ads || [])
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

  const avgCtr = ads.reduce((sum, a) => sum + a.ctr, 0) / (ads.length || 1)
  const avgCpc = ads.reduce((sum, a) => sum + a.cpc, 0) / (ads.length || 1)

  const chartData = ads.map(ad => ({
    name: ad.name.length > 15 ? ad.name.substring(0, 15) + '...' : ad.name,
    Gasto: ad.spend,
    Conversões: ad.conversions,
    CTR: ad.ctr
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

  if (ads.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Nenhum anúncio encontrado para este conjunto.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Comparação de Anúncios</CardTitle>
          <CardDescription>
            Campanha: {campaignName} • Conjunto: {adsetName} • {ads.length} anúncio{ads.length > 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Anúncios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criativo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <CreativeThumbnail
                        imageUrl={ad.creative.image_url}
                        thumbnailUrl={ad.creative.thumbnail_url}
                        title={ad.creative.title}
                        body={ad.creative.body}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="space-y-1">
                        <div className="font-medium truncate" title={ad.name}>
                          {ad.name}
                        </div>
                        {ad.creative.title && (
                          <div className="text-xs text-muted-foreground truncate">
                            {ad.creative.title}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(ad.status)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(ad.spend)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(ad.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(ad.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getTrend(ad.ctr, avgCtr)}
                        {ad.ctr.toFixed(2)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getTrend(ad.cpc, avgCpc)}
                        {formatCurrency(ad.cpc)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(ad.conversions)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Gasto Total</div>
              <div className="text-2xl font-bold">
                {formatCurrency(ads.reduce((sum, a) => sum + a.spend, 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total de Cliques</div>
              <div className="text-2xl font-bold">
                {formatNumber(ads.reduce((sum, a) => sum + a.clicks, 0))}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">CTR Médio</div>
              <div className="text-2xl font-bold">{avgCtr.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total de Conversões</div>
              <div className="text-2xl font-bold">
                {formatNumber(ads.reduce((sum, a) => sum + a.conversions, 0))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
