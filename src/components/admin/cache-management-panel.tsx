'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  RefreshCw, 
  Trash2, 
  Zap, 
  Activity, 
  Database, 
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp
} from 'lucide-react'
import { useCacheManagement } from '@/hooks/use-cache-management'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Cache Management Panel
 * 
 * Provides interface for monitoring and managing the user access control cache
 */
export function CacheManagementPanel() {
  const {
    stats,
    health,
    loading,
    error,
    getCacheStats,
    clearCache,
    cleanupCache
  } = useCacheManagement()

  const [autoRefresh, setAutoRefresh] = useState(false)

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      getCacheStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh, getCacheStats])

  // Load initial stats
  useEffect(() => {
    getCacheStats()
  }, [getCacheStats])

  const handleClearCache = async () => {
    if (confirm('Tem certeza que deseja limpar todo o cache? Esta ação não pode ser desfeita.')) {
      try {
        await clearCache()
        alert('Cache limpo com sucesso!')
      } catch (error) {
        alert('Erro ao limpar cache: ' + (error as Error).message)
      }
    }
  }

  const handleCleanupCache = async () => {
    try {
      const result = await cleanupCache()
      alert(`Limpeza concluída! ${result.cleanedCount} entradas expiradas foram removidas.`)
    } catch (error) {
      alert('Erro na limpeza: ' + (error as Error).message)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatPercentage = (value: number) => {
    return (value * 100).toFixed(1) + '%'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Cache</h2>
          <p className="text-muted-foreground">
            Monitore e gerencie o cache do sistema de controle de acesso
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={getCacheStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {health.isHealthy ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              Status do Cache
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={health.isHealthy ? "default" : "secondary"}>
                  {health.isHealthy ? 'Saudável' : 'Atenção Necessária'}
                </Badge>
              </div>

              {health.issues.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Problemas Identificados:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {health.issues.map((issue, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {health.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recomendações:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {health.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <TrendingUp className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cache Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <Database className="h-3 w-3 inline mr-1" />
                Entradas ativas
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(stats.hitRate)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                {stats.totalHits} hits / {stats.totalMisses} misses
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Uso de Memória</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.memoryUsageMB.toFixed(1)} MB</div>
              <div className="text-xs text-muted-foreground mt-1">
                <Activity className="h-3 w-3 inline mr-1" />
                Estimativa
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Entrada Mais Antiga</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sm">
                {stats.oldestEntry ? formatDistanceToNow(stats.oldestEntry, { 
                  addSuffix: true, 
                  locale: ptBR 
                }) : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3 inline mr-1" />
                Tempo de vida
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cache Types Breakdown */}
      {stats && Object.keys(stats.entriesByType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo</CardTitle>
            <CardDescription>
              Número de entradas por tipo de cache
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats.entriesByType).map(([type, count]) => (
                <div key={type} className="text-center">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {type.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cache Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações de Manutenção</CardTitle>
          <CardDescription>
            Gerencie o cache do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={handleCleanupCache}
              disabled={loading}
            >
              <Zap className="h-4 w-4 mr-2" />
              Limpar Expirados
            </Button>

            <Button
              variant="destructive"
              onClick={handleClearCache}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Todo Cache
            </Button>
          </div>

          <Separator className="my-4" />

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Limpar Expirados:</strong> Remove apenas entradas que já expiraram naturalmente.
            </p>
            <p>
              <strong>Limpar Todo Cache:</strong> Remove todas as entradas do cache. Use com cuidado, 
              pois pode impactar temporariamente a performance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}