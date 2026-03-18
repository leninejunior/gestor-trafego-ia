'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Filter, Download, RefreshCw, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react'
import { AuditLogEntry, AuditStatistics, AuditEventType, AuditEventCategory } from '@/lib/services/user-access-audit'

interface AuditDashboardProps {
  className?: string
}

interface AuditFilters {
  organizationId?: string
  actorUserId?: string
  targetUserId?: string
  eventType?: AuditEventType
  eventCategory?: AuditEventCategory
  success?: boolean
  startDate?: string
  endDate?: string
  limit: number
  offset: number
}

export function AuditDashboard({ className }: AuditDashboardProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [stats, setStats] = useState<AuditStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [filters, setFilters] = useState<AuditFilters>({
    limit: 50,
    offset: 0,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
    endDate: new Date().toISOString().split('T')[0]
  })

  // Load audit logs
  const loadAuditLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/super-admin/audit-logs?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar logs')
      }

      const data = await response.json()
      setLogs(data.logs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  // Load audit statistics
  const loadAuditStats = async () => {
    try {
      const params = new URLSearchParams()
      
      if (filters.organizationId) params.append('organizationId', filters.organizationId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/super-admin/audit-stats?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar estatísticas')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err)
    }
  }

  // Load data on mount and filter changes
  useEffect(() => {
    loadAuditLogs()
    loadAuditStats()
  }, [filters])

  // Handle filter changes
  const updateFilter = (key: keyof AuditFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: key !== 'offset' ? 0 : value // Reset offset when other filters change
    }))
  }

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // Get event type badge color
  const getEventTypeBadge = (eventType: AuditEventType, success: boolean) => {
    if (!success) return 'destructive'
    
    switch (eventType) {
      case AuditEventType.USER_CREATE:
      case AuditEventType.ACCESS_GRANT:
        return 'default'
      case AuditEventType.USER_DELETE:
      case AuditEventType.ACCESS_REVOKE:
        return 'secondary'
      case AuditEventType.ACCESS_DENIED:
      case AuditEventType.PLAN_LIMIT_EXCEEDED:
        return 'destructive'
      case AuditEventType.USER_TYPE_CHANGE:
        return 'outline'
      default:
        return 'outline'
    }
  }

  // Get success rate color
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600'
    if (rate >= 85) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Dashboard de Auditoria</h2>
            <p className="text-muted-foreground">
              Monitoramento completo de atividades do sistema de controle de acesso
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadAuditLogs()
                loadAuditStats()
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.totalEvents}</div>
                <p className="text-xs text-muted-foreground">
                  Últimos {Math.ceil((stats.period.endDate.getTime() - stats.period.startDate.getTime()) / (1000 * 60 * 60 * 24))} dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eventos Bem-sucedidos</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.summary.successfulEvents}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.summary.totalEvents > 0 
                    ? `${Math.round((stats.summary.successfulEvents / stats.summary.totalEvents) * 100)}% de sucesso`
                    : '0% de sucesso'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eventos Falhados</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.summary.failedEvents}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.summary.totalEvents > 0 
                    ? `${Math.round((stats.summary.failedEvents / stats.summary.totalEvents) * 100)}% de falhas`
                    : '0% de falhas'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.uniqueActors}</div>
                <p className="text-xs text-muted-foreground">
                  Usuários únicos com atividade
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logs">Logs de Auditoria</TabsTrigger>
            <TabsTrigger value="analytics">Análises</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventType">Tipo de Evento</Label>
                    <Select
                      value={filters.eventType || ''}
                      onValueChange={(value) => updateFilter('eventType', value || undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos os tipos</SelectItem>
                        <SelectItem value={AuditEventType.USER_CREATE}>Criação de Usuário</SelectItem>
                        <SelectItem value={AuditEventType.USER_UPDATE}>Atualização de Usuário</SelectItem>
                        <SelectItem value={AuditEventType.USER_DELETE}>Exclusão de Usuário</SelectItem>
                        <SelectItem value={AuditEventType.USER_TYPE_CHANGE}>Mudança de Tipo</SelectItem>
                        <SelectItem value={AuditEventType.ACCESS_GRANT}>Concessão de Acesso</SelectItem>
                        <SelectItem value={AuditEventType.ACCESS_REVOKE}>Revogação de Acesso</SelectItem>
                        <SelectItem value={AuditEventType.ACCESS_DENIED}>Acesso Negado</SelectItem>
                        <SelectItem value={AuditEventType.PLAN_LIMIT_EXCEEDED}>Limite Excedido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventCategory">Categoria</Label>
                    <Select
                      value={filters.eventCategory || ''}
                      onValueChange={(value) => updateFilter('eventCategory', value || undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas as categorias</SelectItem>
                        <SelectItem value={AuditEventCategory.USER_MANAGEMENT}>Gerenciamento de Usuários</SelectItem>
                        <SelectItem value={AuditEventCategory.ACCESS_CONTROL}>Controle de Acesso</SelectItem>
                        <SelectItem value={AuditEventCategory.AUTHENTICATION}>Autenticação</SelectItem>
                        <SelectItem value={AuditEventCategory.AUTHORIZATION}>Autorização</SelectItem>
                        <SelectItem value={AuditEventCategory.SECURITY}>Segurança</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="success">Status</Label>
                    <Select
                      value={filters.success?.toString() || ''}
                      onValueChange={(value) => updateFilter('success', value === '' ? undefined : value === 'true')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos os status</SelectItem>
                        <SelectItem value="true">Sucesso</SelectItem>
                        <SelectItem value="false">Falha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data Inicial</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => updateFilter('startDate', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Final</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => updateFilter('endDate', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Audit Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>Logs de Auditoria</CardTitle>
                <CardDescription>
                  {loading ? 'Carregando...' : `${logs.length} eventos encontrados`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getEventTypeBadge(log.eventType, log.success)}>
                            {log.eventType.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">
                            {log.eventCategory.replace('_', ' ')}
                          </Badge>
                          {log.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        
                        <div className="text-sm">
                          <strong>{log.action}</strong>
                          {log.metadata?.actorEmail && (
                            <span className="text-muted-foreground">
                              {' '}por {log.metadata.actorName || log.metadata.actorEmail}
                            </span>
                          )}
                          {log.metadata?.targetEmail && (
                            <span className="text-muted-foreground">
                              {' '}→ {log.metadata.targetName || log.metadata.targetEmail}
                            </span>
                          )}
                        </div>

                        {log.errorMessage && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {log.errorMessage}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatDate(log.createdAt!)}</span>
                          {log.metadata?.organizationName && (
                            <span>Org: {log.metadata.organizationName}</span>
                          )}
                          {log.metadata?.clientName && (
                            <span>Cliente: {log.metadata.clientName}</span>
                          )}
                          {log.ipAddress && (
                            <span>IP: {log.ipAddress}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {logs.length === 0 && !loading && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum log encontrado com os filtros aplicados
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {logs.length >= filters.limit && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFilter('offset', Math.max(0, filters.offset - filters.limit))}
                      disabled={filters.offset === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFilter('offset', filters.offset + filters.limit)}
                      disabled={logs.length < filters.limit}
                    >
                      Próximo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Event Types Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Análise por Tipo de Evento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.byEventType).map(([eventType, data]) => (
                        <div key={eventType} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {eventType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{data.total}</div>
                            <div className={`text-xs ${getSuccessRateColor(data.successRate)}`}>
                              {data.successRate}% sucesso
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Categories Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Análise por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.byCategory).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between">
                          <Badge variant="secondary">
                            {category.replace('_', ' ')}
                          </Badge>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}