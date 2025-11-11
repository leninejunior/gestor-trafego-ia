/**
 * Card de Status de Saldo
 * Exibe status visual do saldo de uma conta
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  DollarSign,
  Clock,
  Bell,
  BellOff
} from 'lucide-react'

interface BalanceStatusCardProps {
  accountId: string
  accountName: string
  balance: number
  currency: string
  threshold: number
  status: 'healthy' | 'warning' | 'critical'
  projectedDays: number
  dailySpend: number
  hasAlert: boolean
  onToggleAlert?: () => void
  onAddCredits?: () => void
}

export function BalanceStatusCard({
  accountId,
  accountName,
  balance,
  currency,
  threshold,
  status,
  projectedDays,
  dailySpend,
  hasAlert,
  onToggleAlert,
  onAddCredits
}: BalanceStatusCardProps) {
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL'
    }).format(value)
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'critical':
        return {
          icon: <TrendingDown className="h-5 w-5" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeClass: 'bg-red-100 text-red-800',
          label: 'CRÍTICO'
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badgeClass: 'bg-yellow-100 text-yellow-800',
          label: 'ATENÇÃO'
        }
      default:
        return {
          icon: <TrendingUp className="h-5 w-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeClass: 'bg-green-100 text-green-800',
          label: 'SAUDÁVEL'
        }
    }
  }

  const config = getStatusConfig()
  const balancePercentage = threshold > 0 ? (balance / threshold) * 100 : 100

  return (
    <Card className={`${config.borderColor} border-2`}>
      <CardHeader className={config.bgColor}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={config.color}>
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{accountName}</CardTitle>
              <p className="text-sm text-muted-foreground">ID: {accountId}</p>
            </div>
          </div>
          <Badge className={config.badgeClass}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Saldo Atual */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Saldo Atual
            </span>
            <span className={`text-2xl font-bold ${config.color}`}>
              {formatCurrency(balance)}
            </span>
          </div>
          <Progress 
            value={Math.min(balancePercentage, 100)} 
            className="h-2"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {balancePercentage.toFixed(1)}% do limite
            </span>
            <span className="text-xs text-muted-foreground">
              Limite: {formatCurrency(threshold)}
            </span>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Gasto Diário</p>
              <p className="text-sm font-semibold">{formatCurrency(dailySpend)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Dias Restantes</p>
              <p className="text-sm font-semibold">
                {projectedDays > 999 ? '∞' : Math.floor(projectedDays)}
              </p>
            </div>
          </div>
        </div>

        {/* Alertas Críticos */}
        {status === 'critical' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  {balance <= 0 ? 'Saldo Zerado!' : 'Saldo Crítico!'}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  {balance <= 0 
                    ? 'Suas campanhas podem ser pausadas a qualquer momento. Adicione créditos imediatamente!'
                    : 'Saldo muito baixo. Adicione créditos em breve para evitar interrupções.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex space-x-2">
          {onAddCredits && (
            <Button 
              onClick={onAddCredits}
              className="flex-1"
              variant={status === 'critical' ? 'default' : 'outline'}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Adicionar Créditos
            </Button>
          )}

          {onToggleAlert && (
            <Button
              onClick={onToggleAlert}
              variant="outline"
              size="icon"
              title={hasAlert ? 'Desativar alertas' : 'Ativar alertas'}
            >
              {hasAlert ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
