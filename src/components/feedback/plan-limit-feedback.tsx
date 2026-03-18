'use client'

import { useState } from 'react'
import { 
  CreditCard, 
  Users, 
  Building, 
  Zap, 
  BarChart3, 
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PlanLimits, LimitedAction } from '@/lib/services/user-access-control'

interface PlanLimitFeedbackProps {
  limits: PlanLimits
  action?: LimitedAction
  onUpgrade?: () => void
  onDismiss?: () => void
  className?: string
  variant?: 'warning' | 'blocked' | 'info'
  showProgress?: boolean
  compact?: boolean
}

const actionLabels = {
  create_user: 'criar usuários',
  create_client: 'criar clientes',
  create_connection: 'criar conexões',
  create_campaign: 'criar campanhas'
}

const actionIcons = {
  create_user: Users,
  create_client: Building,
  create_connection: Zap,
  create_campaign: BarChart3
}

const limitLabels = {
  users: 'Usuários',
  clients: 'Clientes',
  connections: 'Conexões',
  campaigns: 'Campanhas'
}

const limitIcons = {
  users: Users,
  clients: Building,
  connections: Zap,
  campaigns: BarChart3
}

export function PlanLimitFeedback({
  limits,
  action,
  onUpgrade,
  onDismiss,
  className,
  variant = 'info',
  showProgress = true,
  compact = false
}: PlanLimitFeedbackProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  const handleUpgrade = () => {
    onUpgrade?.()
  }

  // Calcular estatísticas dos limites
  const limitStats = [
    {
      key: 'users' as const,
      label: limitLabels.users,
      icon: limitIcons.users,
      current: limits.currentUsage.users,
      max: limits.maxUsers,
      isUnlimited: limits.maxUsers === null
    },
    {
      key: 'clients' as const,
      label: limitLabels.clients,
      icon: limitIcons.clients,
      current: limits.currentUsage.clients,
      max: limits.maxClients,
      isUnlimited: limits.maxClients === null
    },
    {
      key: 'connections' as const,
      label: limitLabels.connections,
      icon: limitIcons.connections,
      current: limits.currentUsage.connections,
      max: limits.maxConnections,
      isUnlimited: limits.maxConnections === null
    },
    {
      key: 'campaigns' as const,
      label: limitLabels.campaigns,
      icon: limitIcons.campaigns,
      current: limits.currentUsage.campaigns,
      max: limits.maxCampaigns,
      isUnlimited: limits.maxCampaigns === null
    }
  ]

  // Encontrar limites próximos do máximo (>80%)
  const nearLimits = limitStats.filter(stat => 
    !stat.isUnlimited && stat.max && stat.current / stat.max > 0.8
  )

  // Encontrar limites atingidos
  const reachedLimits = limitStats.filter(stat => 
    !stat.isUnlimited && stat.max && stat.current >= stat.max
  )

  // Determinar variante baseada no estado
  const effectiveVariant = reachedLimits.length > 0 ? 'blocked' : 
                          nearLimits.length > 0 ? 'warning' : variant

  const variantStyles = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    blocked: 'bg-red-50 border-red-200'
  }

  const variantColors = {
    info: 'text-blue-600',
    warning: 'text-yellow-600',
    blocked: 'text-red-600'
  }

  if (compact) {
    return (
      <Alert className={`${variantStyles[effectiveVariant]} ${className}`}>
        <CreditCard className={`h-4 w-4 ${variantColors[effectiveVariant]}`} />
        <AlertDescription className="flex items-center justify-between">
          <div>
            {effectiveVariant === 'blocked' ? (
              <span>Limite atingido. Faça upgrade para continuar.</span>
            ) : effectiveVariant === 'warning' ? (
              <span>Próximo do limite. Considere fazer upgrade.</span>
            ) : (
              <span>Uso atual do plano dentro dos limites.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onUpgrade && (
              <Button size="sm" variant="outline" onClick={handleUpgrade}>
                Upgrade
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className={`${variantStyles[effectiveVariant]} ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className={`h-5 w-5 ${variantColors[effectiveVariant]}`} />
            <CardTitle className="text-base">
              {effectiveVariant === 'blocked' ? 'Limite do Plano Atingido' :
               effectiveVariant === 'warning' ? 'Próximo do Limite' :
               'Uso do Plano'}
            </CardTitle>
            {effectiveVariant !== 'info' && (
              <Badge variant={effectiveVariant === 'blocked' ? 'destructive' : 'secondary'}>
                {effectiveVariant === 'blocked' ? 'Bloqueado' : 'Atenção'}
              </Badge>
            )}
          </div>
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <CardDescription>
          {effectiveVariant === 'blocked' ? (
            <>Você atingiu o limite do seu plano. Faça upgrade para continuar {action ? actionLabels[action] : 'criando recursos'}.</>
          ) : effectiveVariant === 'warning' ? (
            <>Você está próximo do limite do seu plano. Considere fazer upgrade em breve.</>
          ) : (
            <>Acompanhe o uso dos recursos do seu plano atual.</>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bars */}
        {showProgress && (
          <div className="space-y-3">
            {limitStats.map((stat) => {
              if (stat.isUnlimited) return null
              
              const percentage = stat.max ? Math.min((stat.current / stat.max) * 100, 100) : 0
              const isNearLimit = percentage > 80
              const isAtLimit = percentage >= 100
              
              const StatIcon = stat.icon
              
              return (
                <div key={stat.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <StatIcon className="h-4 w-4 text-gray-500" />
                      <span>{stat.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={isAtLimit ? 'text-red-600 font-medium' : isNearLimit ? 'text-yellow-600' : 'text-gray-600'}>
                        {stat.current} / {stat.max || '∞'}
                      </span>
                      {isAtLimit && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </div>
                  </div>
                  <Progress 
                    value={percentage} 
                    className={`h-2 ${isAtLimit ? 'bg-red-100' : isNearLimit ? 'bg-yellow-100' : 'bg-gray-100'}`}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Action Specific Message */}
        {action && (
          <Alert className="bg-white/50">
            {(() => {
              const ActionIcon = actionIcons[action]
              return <ActionIcon className="h-4 w-4" />
            })()}
            <AlertDescription className="text-sm">
              <strong>Ação solicitada:</strong> {actionLabels[action]}
              {effectiveVariant === 'blocked' && (
                <span className="block mt-1 text-red-600">
                  Esta ação está bloqueada devido ao limite atingido.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Upgrade CTA */}
        {(effectiveVariant === 'blocked' || effectiveVariant === 'warning') && (
          <div className="bg-white/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-medium">Faça upgrade do seu plano</h4>
            </div>
            
            <p className="text-xs text-gray-600">
              {effectiveVariant === 'blocked' ? 
                'Desbloqueie recursos ilimitados e continue crescendo sem interrupções.' :
                'Evite interrupções futuras e tenha mais flexibilidade para crescer.'
              }
            </p>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleUpgrade}
                className="flex items-center gap-2"
              >
                <CreditCard className="h-3 w-3" />
                Ver Planos
                <ExternalLink className="h-3 w-3" />
              </Button>
              
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => window.open('/help/plan-limits', '_blank')}
              >
                Saiba Mais
              </Button>
            </div>
          </div>
        )}

        {/* Unlimited Features */}
        {limitStats.some(stat => stat.isUnlimited) && (
          <div className="bg-white/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              ✨ Recursos ilimitados no seu plano:
            </h4>
            <div className="flex flex-wrap gap-2">
              {limitStats
                .filter(stat => stat.isUnlimited)
                .map(stat => (
                  <Badge key={stat.key} variant="secondary" className="text-xs">
                    {stat.label}
                  </Badge>
                ))
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Hook para usar o componente de feedback de limites
 */
export function usePlanLimitFeedback() {
  const [isVisible, setIsVisible] = useState(true)

  const showFeedback = () => setIsVisible(true)
  const hideFeedback = () => setIsVisible(false)

  return {
    isVisible,
    showFeedback,
    hideFeedback
  }
}