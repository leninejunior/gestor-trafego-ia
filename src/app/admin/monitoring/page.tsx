/**
 * Admin Monitoring Dashboard
 * 
 * Dashboard completo de monitoramento técnico e de negócio
 * Requirements: 4.4, 6.2 - Dashboards de monitoramento e KPIs
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Zap,
  RefreshCw,
  Bell,
  BarChart3,
  Shield,
  Server
} from 'lucide-react'

interface SystemMetrics {
  checkout: {
    checkouts_started: number
    checkouts_completed: number
    conversion_rate: number
    abandonment_rate: number
    avg_checkout_duration_ms: number
    total_revenue: number
    avg_order_value: number
  }
  payment: {
    webhooks_received: number
    webhooks_processed: number
    webhooks_failed: number
    webhook_processing_rate: number
    avg_webhook_processing_time_ms: number
    payment_failures: number
    error_rate: number
  }
  performance: {
    api_response_time_ms: number
    api_error_rate: number
    api_throughput_rps: number
    memory_usage_mb: number
    cpu_usage_percent: number
  }
  alerts: {
    active_alerts: number
    critical_alerts: number
    high_alerts: number
    medium_alerts: number
    low_alerts: number
  }
}

interface AlertInstance {
  id: string
  title: string
  severity: string
  message: string
  triggered_at: string
  metric_value: number
  threshold: number
  is_resolved: boolean
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [alerts, setAlerts] = useState<AlertInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/metrics')
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/alerts')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data.alerts || [])
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  }

  const refreshData = async () => {
    setLoading(true)
    await Promise.all([fetchMetrics(), fetchAlerts()])
    setLoading(false)
  }

  useEffect(() => {
    refreshData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshData()
    }, 30000) // Atualizar a cada 30 segundos

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600'
      case 'high':
        return 'text-orange-600'
      case 'medium':
        return 'text-yellow-600'
      case 'low':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Carregando métricas...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento do Sistema</h1>
          <p className="text-muted-foreground">
            Dashboard de métricas técnicas e de negócio
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          {lastUpdate && (
            <span className="text-sm text-muted-foreground">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* Alertas Críticos */}
      {alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Alertas Críticos Ativos:</strong> {alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length} alertas críticos precisam de atenção imediata.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="technical">Técnico</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPIs Principais */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics ? formatPercentage(metrics.checkout.conversion_rate) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Últimas 24 horas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics ? formatCurrency(metrics.checkout.total_revenue) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Últimas 24 horas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Webhooks Processados</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics ? formatPercentage(metrics.payment.webhook_processing_rate) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Taxa de sucesso
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics ? metrics.alerts.active_alerts : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics && metrics.alerts.critical_alerts > 0 && (
                    <span className="text-red-600">
                      {metrics.alerts.critical_alerts} críticos
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status do Sistema */}
          <Card>
            <CardHeader>
              <CardTitle>Status do Sistema</CardTitle>
              <CardDescription>
                Visão geral da saúde dos componentes principais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    metrics && metrics.checkout.conversion_rate > 30 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">Sistema de Checkout</p>
                    <p className="text-sm text-muted-foreground">
                      {metrics && metrics.checkout.conversion_rate > 30 ? 'Operacional' : 'Degradado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    metrics && metrics.payment.webhook_processing_rate > 95 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">Processamento de Pagamentos</p>
                    <p className="text-sm text-muted-foreground">
                      {metrics && metrics.payment.webhook_processing_rate > 95 ? 'Operacional' : 'Degradado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    metrics && metrics.performance.api_error_rate < 5 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">APIs</p>
                    <p className="text-sm text-muted-foreground">
                      {metrics && metrics.performance.api_error_rate < 5 ? 'Operacional' : 'Degradado'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dashboard de Checkout */}
        <TabsContent value="checkout" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Checkouts Iniciados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics ? metrics.checkout.checkouts_started.toLocaleString() : '--'}
                </div>
                <p className="text-sm text-muted-foreground">Últimas 24 horas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Checkouts Completados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics ? metrics.checkout.checkouts_completed.toLocaleString() : '--'}
                </div>
                <p className="text-sm text-muted-foreground">Últimas 24 horas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Abandono</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics ? formatPercentage(metrics.checkout.abandonment_rate) : '--'}
                </div>
                <p className="text-sm text-muted-foreground">
                  {metrics && metrics.checkout.abandonment_rate > 70 && (
                    <span className="text-red-600">Acima do limite</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tempo Médio de Checkout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics ? formatDuration(metrics.checkout.avg_checkout_duration_ms) : '--'}
                </div>
                <p className="text-sm text-muted-foreground">Tempo médio para completar</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ticket Médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics ? formatCurrency(metrics.checkout.avg_order_value) : '--'}
                </div>
                <p className="text-sm text-muted-foreground">Valor médio por pedido</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receita Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics ? formatCurrency(metrics.checkout.total_revenue) : '--'}
                </div>
                <p className="text-sm text-muted-foreground">Últimas 24 horas</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dashboard Técnico */}
        <TabsContent value="technical" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Métricas de Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="h-5 w-5" />
                  <span>Performance da API</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Tempo de Resposta</span>
                  <span className="font-mono">
                    {metrics ? formatDuration(metrics.performance.api_response_time_ms) : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Taxa de Erro</span>
                  <span className={`font-mono ${
                    metrics && metrics.performance.api_error_rate > 5 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {metrics ? formatPercentage(metrics.performance.api_error_rate) : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Throughput</span>
                  <span className="font-mono">
                    {metrics ? `${metrics.performance.api_throughput_rps.toFixed(2)} req/s` : '--'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Métricas de Webhook */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Processamento de Webhooks</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Webhooks Recebidos</span>
                  <span className="font-mono">
                    {metrics ? metrics.payment.webhooks_received.toLocaleString() : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Taxa de Sucesso</span>
                  <span className={`font-mono ${
                    metrics && metrics.payment.webhook_processing_rate < 95 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {metrics ? formatPercentage(metrics.payment.webhook_processing_rate) : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tempo de Processamento</span>
                  <span className="font-mono">
                    {metrics ? formatDuration(metrics.payment.avg_webhook_processing_time_ms) : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Falhas de Pagamento</span>
                  <span className={`font-mono ${
                    metrics && metrics.payment.payment_failures > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {metrics ? metrics.payment.payment_failures.toLocaleString() : '--'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Recursos do Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Uso de Memória</span>
                    <span className="font-mono">
                      {metrics ? `${metrics.performance.memory_usage_mb.toFixed(0)} MB` : '--'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ 
                        width: metrics ? `${Math.min(metrics.performance.memory_usage_mb / 1024 * 100, 100)}%` : '0%' 
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Uso de CPU</span>
                    <span className="font-mono">
                      {metrics ? formatPercentage(metrics.performance.cpu_usage_percent) : '--'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ 
                        width: metrics ? `${Math.min(metrics.performance.cpu_usage_percent, 100)}%` : '0%' 
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dashboard de Alertas */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alerts.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-600">Críticos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-600">Altos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {alerts.filter(a => a.severity === 'high' && !a.is_resolved).length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-yellow-600">Médios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {alerts.filter(a => a.severity === 'medium' && !a.is_resolved).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Alertas */}
          <Card>
            <CardHeader>
              <CardTitle>Alertas Recentes</CardTitle>
              <CardDescription>
                Últimos alertas disparados pelo sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>Nenhum alerta ativo no momento</p>
                  </div>
                ) : (
                  alerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">{alert.title}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={getSeverityTextColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            {alert.is_resolved && (
                              <Badge variant="outline" className="text-green-600">
                                RESOLVIDO
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(alert.triggered_at).toLocaleString('pt-BR')}</span>
                          </span>
                          <span>
                            Valor: {alert.metric_value} | Limite: {alert.threshold}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}