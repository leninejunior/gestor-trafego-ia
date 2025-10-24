/**
 * Página de Verificação de Saldo - Admin
 * - Monitoramento de saldo das contas
 * - Alertas de saldo baixo
 * - Histórico de gastos
 * - Projeções de consumo
 * - Configuração de alertas
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  DollarSign, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  CreditCard,
  Calendar,
  Settings,
  Bell,
  RefreshCw,
  Wallet,
  BarChart3,
  Clock
} from 'lucide-react'

interface AccountBalance {
  account_id: string
  account_name: string
  currency: string
  balance: number
  daily_spend_limit: number
  account_spend_limit: number
  current_spend: number
  daily_spend: number
  projected_days_remaining: number
  status: 'healthy' | 'warning' | 'critical'
  last_updated: string
  client_id?: string
  client_name?: string
}

interface SpendHistory {
  date: string
  spend: number
  account_id: string
}

interface AlertConfig {
  id: string
  account_id: string
  threshold_percentage: number
  threshold_amount: number
  is_active: boolean
  notification_email: boolean
  notification_push: boolean
  notification_sms: boolean
}

export default function BalancePage() {
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [spendHistory, setSpendHistory] = useState<SpendHistory[]>([])
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAlertConfig, setShowAlertConfig] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string>('')

  // Configuração de alerta
  const [newAlert, setNewAlert] = useState({
    threshold_percentage: 20,
    threshold_amount: 1000,
    notification_email: true,
    notification_push: true,
    notification_sms: false
  })

  useEffect(() => {
    loadBalanceData()
    
    // Atualizar a cada 5 minutos
    const interval = setInterval(loadBalanceData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadBalanceData = async () => {
    try {
      setLoading(true)
      
      // Carregar saldos das contas
      const balancesResponse = await fetch('/api/admin/balance/accounts')
      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json()
        setBalances(balancesData.balances || [])
      }

      // Carregar histórico de gastos
      const historyResponse = await fetch('/api/admin/balance/history?days=30')
      if (historyResponse.ok) {
        const historyData = await historyResponse.json()
        setSpendHistory(historyData.history || [])
      }

      // Carregar configurações de alerta
      const alertsResponse = await fetch('/api/admin/balance/alerts')
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json()
        setAlertConfigs(alertsData.alerts || [])
      }

    } catch (error) {
      console.error('Error loading balance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createAlert = async () => {
    if (!selectedAccount) return

    try {
      // Buscar client_id da conta selecionada
      const selectedBalance = balances.find(b => b.account_id === selectedAccount)
      if (!selectedBalance) return

      const response = await fetch('/api/admin/balance/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccount,
          client_id: selectedBalance.client_id, // Adicionar client_id
          threshold_amount: newAlert.threshold_amount,
          notification_email: newAlert.notification_email,
          notification_push: newAlert.notification_push,
          notification_sms: newAlert.notification_sms
        })
      })

      if (response.ok) {
        await loadBalanceData()
        setShowAlertConfig(false)
        setSelectedAccount('')
      }
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  }

  const toggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/balance/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      })

      await loadBalanceData()
    } catch (error) {
      console.error('Error toggling alert:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <DollarSign className="h-4 w-4 text-gray-600" />
    }
  }

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value)
  }

  const totalBalance = balances.reduce((sum, account) => sum + account.balance, 0)
  const totalDailySpend = balances.reduce((sum, account) => sum + account.daily_spend, 0)
  const criticalAccounts = balances.filter(account => account.status === 'critical').length
  const warningAccounts = balances.filter(account => account.status === 'warning').length

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
          <h1 className="text-3xl font-bold">Verificação de Saldo</h1>
          <p className="text-muted-foreground">
            Monitoramento de saldo e alertas de contas publicitárias
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowAlertConfig(true)} variant="outline">
            <Bell className="h-4 w-4 mr-2" />
            Configurar Alertas
          </Button>
          <Button onClick={loadBalanceData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alertas Críticos */}
      {criticalAccounts > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>{criticalAccounts} conta(s)</strong> com saldo crítico. 
            Ação imediata necessária para evitar interrupção das campanhas.
          </AlertDescription>
        </Alert>
      )}

      {warningAccounts > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>{warningAccounts} conta(s)</strong> com saldo baixo. 
            Considere adicionar créditos em breve.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs de Saldo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground">
              {balances.length} contas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Diário</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDailySpend)}</div>
            <p className="text-xs text-muted-foreground">
              Média dos últimos 7 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAccounts}</div>
            <p className="text-xs text-muted-foreground">
              Saldo < 20% do limite
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dias Restantes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.min(...balances.map(b => b.projected_days_remaining)).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Projeção mais crítica
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Contas */}
      <Card>
        <CardHeader>
          <CardTitle>Saldo por Conta</CardTitle>
          <CardDescription>Status detalhado de cada conta publicitária</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {balances.map((account) => {
              const balancePercentage = (account.balance / account.account_spend_limit) * 100
              const dailySpendPercentage = (account.daily_spend / account.daily_spend_limit) * 100
              
              return (
                <div key={account.account_id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(account.status)}
                      <div>
                        <h3 className="font-semibold">{account.account_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          ID: {account.account_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(account.status)}>
                        {account.status.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(account.last_updated).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Saldo Atual</label>
                      <div className="text-lg font-semibold">
                        {formatCurrency(account.balance, account.currency)}
                      </div>
                      <Progress value={balancePercentage} className="mt-1" />
                      <span className="text-xs text-muted-foreground">
                        {balancePercentage.toFixed(1)}% do limite
                      </span>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground">Gasto Diário</label>
                      <div className="text-lg font-semibold">
                        {formatCurrency(account.daily_spend, account.currency)}
                      </div>
                      <Progress value={dailySpendPercentage} className="mt-1" />
                      <span className="text-xs text-muted-foreground">
                        {dailySpendPercentage.toFixed(1)}% do limite diário
                      </span>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground">Limite da Conta</label>
                      <div className="text-lg font-semibold">
                        {formatCurrency(account.account_spend_limit, account.currency)}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Gasto atual: {formatCurrency(account.current_spend, account.currency)}
                      </span>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground">Projeção</label>
                      <div className="text-lg font-semibold">
                        {account.projected_days_remaining.toFixed(0)} dias
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Com gasto atual
                      </span>
                    </div>
                  </div>

                  {/* Alertas configurados para esta conta */}
                  {alertConfigs.filter(alert => alert.account_id === account.account_id).map(alert => (
                    <div key={alert.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Bell className="h-4 w-4" />
                        <span className="text-sm">
                          Alerta: {alert.threshold_percentage}% ou {formatCurrency(alert.threshold_amount, account.currency)}
                        </span>
                      </div>
                      <Switch
                        checked={alert.is_active}
                        onCheckedChange={(checked) => toggleAlert(alert.id, checked)}
                      />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Configuração de Alerta */}
      {showAlertConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Configurar Alerta de Saldo</CardTitle>
              <CardDescription>
                Defina quando receber notificações sobre saldo baixo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="account">Conta</Label>
                <select
                  id="account"
                  className="w-full p-2 border rounded"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  <option value="">Selecione uma conta</option>
                  {balances.map(account => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.account_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="percentage">Limite Percentual (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  value={newAlert.threshold_percentage}
                  onChange={(e) => setNewAlert({
                    ...newAlert,
                    threshold_percentage: Number(e.target.value)
                  })}
                />
              </div>

              <div>
                <Label htmlFor="amount">Limite em Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={newAlert.threshold_amount}
                  onChange={(e) => setNewAlert({
                    ...newAlert,
                    threshold_amount: Number(e.target.value)
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipos de Notificação</Label>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newAlert.notification_email}
                    onCheckedChange={(checked) => setNewAlert({
                      ...newAlert,
                      notification_email: checked
                    })}
                  />
                  <Label>Email</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newAlert.notification_push}
                    onCheckedChange={(checked) => setNewAlert({
                      ...newAlert,
                      notification_push: checked
                    })}
                  />
                  <Label>Push Notification</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newAlert.notification_sms}
                    onCheckedChange={(checked) => setNewAlert({
                      ...newAlert,
                      notification_sms: checked
                    })}
                  />
                  <Label>SMS</Label>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={createAlert} className="flex-1">
                  Criar Alerta
                </Button>
                <Button 
                  onClick={() => setShowAlertConfig(false)} 
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}