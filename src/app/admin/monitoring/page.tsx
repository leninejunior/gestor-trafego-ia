/**
 * Dashboard de Monitoramento do Sistema
 * - Métricas em tempo real
 * - Health checks
 * - Alertas ativos
 * - Performance do sistema
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database,
  Server,
  Cpu,
  HardDrive,
  Network,
  RefreshCw
} from 'lucide-react'

interface HealthCheck {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  error?: string
  lastCheck: string
}

interface SystemAlert {
  id: string
  alert_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  created_at: string
  is_resolved: boolean
}

interface SystemMetric {
  metric_name: string
  metric_value: number
  metric_unit?: string
  recorded_at: string
  tags?: Record<string, string>
}

export default function MonitoringPage() {
  const [healthChecks, setHealthChecks] = useState<Record<string, HealthCheck>>({})
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [metrics, setMetrics] = useState<SystemMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    loadMonitoringData()
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadMonitoringData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadMonitoringData = async () => {
    try {
      // Carregar health checks
      const healthResponse = await fetch('/api/admin/monitoring/health')
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setHealthChecks(healthData)
      }

      // Carregar alertas ativos
      const alertsResponse = await fetch('/api/admin/monitoring/alerts')
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json()
        setAlerts(alertsData)
      }

      // Carregar métricas recentes
      const metricsResponse = await fetch('/api/admin/monitoring/metrics')
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setMetrics(metricsData)
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error loading monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'unhealthy': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getMetricValue = (metricName: string): SystemMetric | null => {
    return metrics.find(m => m.metric_name === metricName) || null
  }

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const memoryUsed = getMetricValue('nodejs_memory_heap_used')
  const memoryTotal = getMetricValue('nodejs_memory_heap_total')
  const uptime = getMetricValue('nodejs_uptime')
  const memoryUsagePercent = memoryUsed && memoryTotal ? 
    (memoryUsed.metric_value / memoryTotal.metric_value) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={loadMonitoringData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* System Status Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {Object.values(healthChecks).every(hc => hc.status === 'healthy') ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">All Systems Operational</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-yellow-600 font-medium">Some Issues Detected</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {memoryUsagePercent.toFixed(1)}%
                </div>
                <Progress value={memoryUsagePercent} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {memoryUsed ? formatBytes(memoryUsed.metric_value) : '0'} / {memoryTotal ? formatBytes(memoryTotal.metric_value) : '0'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {uptime ? formatDuration(uptime.metric_value) : '0m'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Since last restart
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {alerts.filter(a => !a.is_resolved).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {alerts.filter(a => !a.is_resolved && a.severity === 'critical').length} critical
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Alerts */}
          {alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest system alerts and notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className={`h-4 w-4 ${
                          alert.severity === 'critical' ? 'text-red-600' :
                          alert.severity === 'high' ? 'text-orange-600' :
                          alert.severity === 'medium' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`} />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(healthChecks).map(([service, check]) => (
              <Card key={service}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium capitalize">
                    {service.replace('_', ' ')}
                  </CardTitle>
                  {getStatusIcon(check.status)}
                </CardHeader>
                <CardContent>
                  <div className={`text-lg font-bold ${getStatusColor(check.status)}`}>
                    {check.status.toUpperCase()}
                  </div>
                  {check.responseTime && (
                    <p className="text-xs text-muted-foreground">
                      Response time: {check.responseTime}ms
                    </p>
                  )}
                  {check.error && (
                    <p className="text-xs text-red-600 mt-1">
                      Error: {check.error}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Last check: {new Date(check.lastCheck).toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>All system alerts and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium">No alerts</p>
                  <p className="text-muted-foreground">All systems are running normally</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <span className="font-medium">{alert.title}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {alert.is_resolved ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Active</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Type: {alert.alert_type}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Agrupar métricas por tipo */}
            {Array.from(new Set(metrics.map(m => m.metric_name))).map((metricName) => {
              const metric = getMetricValue(metricName)
              if (!metric) return null

              return (
                <Card key={metricName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {metricName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricName.includes('memory') || metricName.includes('bytes') ? 
                        formatBytes(metric.metric_value) :
                        metricName.includes('uptime') ?
                        formatDuration(metric.metric_value) :
                        metric.metric_value.toLocaleString()
                      }
                    </div>
                    {metric.metric_unit && (
                      <p className="text-xs text-muted-foreground">
                        {metric.metric_unit}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(metric.recorded_at).toLocaleTimeString()}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}