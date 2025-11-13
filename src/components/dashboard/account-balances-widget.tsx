/**
 * Widget de Saldo das Contas para o Dashboard
 * Mostra resumo do saldo para todos os usuários
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Wallet, 
  TrendingDown, 
  TrendingUp,
  AlertTriangle,
  DollarSign,
  RefreshCw
} from 'lucide-react'

interface AccountBalance {
  id: string
  ad_account_id: string
  ad_account_name: string
  balance: number
  currency: string
  account_spend_limit: number
  daily_spend: number
  status: 'healthy' | 'warning' | 'critical'
  client_id: string
  last_checked_at: string
  spend_cap?: number
  amount_spent?: number
  funding_source_type?: number
  funding_source_display?: string
}

interface BalanceSummary {
  total_accounts: number
  total_balance: number
  critical_accounts: number
  warning_accounts: number
  healthy_accounts: number
  total_daily_spend: number
}

export function AccountBalancesWidget() {
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [summary, setSummary] = useState<BalanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBalances()
  }, [])

  const loadBalances = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/balance/my-accounts')
      
      if (response.ok) {
        const data = await response.json()
        setBalances(data.balances || [])
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error loading balances:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <TrendingUp className="h-4 w-4 text-green-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Saldo das Contas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary || balances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Saldo das Contas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma conta conectada ainda
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Saldo das Contas</span>
          </CardTitle>
          <button 
            onClick={loadBalances}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Saldo Total</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.total_balance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Gasto Diário</p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.total_daily_spend)}
            </p>
          </div>
        </div>

        {/* Alertas */}
        {summary.critical_accounts > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                {summary.critical_accounts} conta(s) com saldo crítico
              </p>
            </div>
          </div>
        )}

        {summary.warning_accounts > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm font-medium text-yellow-800">
                {summary.warning_accounts} conta(s) com saldo baixo
              </p>
            </div>
          </div>
        )}

        {/* Lista de contas */}
        <div className="space-y-2">
          {balances.slice(0, 5).map((account) => (
            <div 
              key={account.id}
              className={`p-3 border rounded-lg ${getStatusColor(account.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(account.status)}
                  <div>
                    <p className="text-sm font-medium">{account.ad_account_name}</p>
                    <p className="text-xs text-muted-foreground">{account.ad_account_id}</p>
                    {account.funding_source_display && (
                      <p className="text-xs text-muted-foreground mt-1">
                        💳 {account.funding_source_display}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                  {account.daily_spend > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ~{Math.floor(account.balance / account.daily_spend)} dias
                    </p>
                  )}
                </div>
              </div>
              
              {account.spend_cap && account.spend_cap > 0 && (
                <div className="space-y-1">
                  <Progress 
                    value={Math.min((account.balance / account.spend_cap) * 100, 100)} 
                    className="h-1"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {((account.balance / account.spend_cap) * 100).toFixed(0)}% do limite
                    </span>
                    <span>
                      Limite: {formatCurrency(account.spend_cap, account.currency)}
                    </span>
                  </div>
                  {account.amount_spent && account.amount_spent > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Gasto total: {formatCurrency(account.amount_spent, account.currency)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {balances.length > 5 && (
          <p className="text-xs text-center text-muted-foreground">
            +{balances.length - 5} contas adicionais
          </p>
        )}
      </CardContent>
    </Card>
  )
}
