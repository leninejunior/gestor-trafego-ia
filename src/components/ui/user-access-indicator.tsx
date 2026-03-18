'use client'

import { useUserType, usePlanLimits } from '@/hooks/use-user-access'
import { UserType } from '@/lib/services/user-access-control'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Crown, Users, UserCheck, AlertTriangle, Zap, Lock, Shield } from 'lucide-react'

interface UserAccessIndicatorProps {
  showLimits?: boolean
  showUpgradePrompt?: boolean
  compact?: boolean
}

export function UserAccessIndicator({ 
  showLimits = true, 
  showUpgradePrompt = true,
  compact = false 
}: UserAccessIndicatorProps) {
  const { 
    userType, 
    loading, 
    error, 
    isSuperAdmin, 
    isOrgAdmin, 
    isCommonUser 
  } = useUserType()

  const {
    planLimits,
    hasActiveSubscription,
    canCreateUsers,
    canCreateClients,
    canCreateConnections,
    loading: planLoading
  } = usePlanLimits()

  if (loading || planLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar informações de acesso: {error}
        </AlertDescription>
      </Alert>
    )
  }

  if (!userType) {
    return null
  }

  const getUserTypeBadge = () => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return (
          <Badge variant="destructive" className="gap-1">
            <Crown className="w-3 h-3" />
            Super Admin
          </Badge>
        )
      case UserType.ORG_ADMIN:
        return (
          <Badge variant="default" className="gap-1">
            <Shield className="w-3 h-3" />
            Admin
          </Badge>
        )
      case UserType.COMMON_USER:
        return (
          <Badge variant="secondary" className="gap-1">
            <UserCheck className="w-3 h-3" />
            Usuário
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            Indefinido
          </Badge>
        )
    }
  }

  const getAccessDescription = () => {
    switch (userType) {
      case UserType.SUPER_ADMIN:
        return 'Acesso ilimitado a todas as funcionalidades'
      case UserType.ORG_ADMIN:
        return 'Administrador da organização com acesso completo'
      case UserType.COMMON_USER:
        return 'Acesso restrito aos clientes autorizados'
      default:
        return 'Tipo de acesso não definido'
    }
  }

  // Compact version - just the badge
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {getUserTypeBadge()}
        {isSuperAdmin && <Zap className="w-4 h-4 text-yellow-500" />}
        {!hasActiveSubscription && userType !== UserType.SUPER_ADMIN && (
          <Lock className="w-4 h-4 text-gray-500" />
        )}
      </div>
    )
  }

  // Full card version
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getUserTypeBadge()}
            <CardTitle className="text-sm">Tipo de Acesso</CardTitle>
          </div>
          {isSuperAdmin && <Zap className="w-4 h-4 text-yellow-500" />}
        </div>
        <CardDescription className="text-xs">
          {getAccessDescription()}
        </CardDescription>
      </CardHeader>

      {showLimits && userType !== UserType.SUPER_ADMIN && (
        <CardContent className="pt-0">
          {!hasActiveSubscription ? (
            <Alert variant="destructive" className="mb-4">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Plano expirado. Funcionalidades limitadas.
              </AlertDescription>
            </Alert>
          ) : planLimits ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                Limites do Plano
              </div>
              
              {planLimits.maxUsers !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Usuários</span>
                    <span>{planLimits.currentUsage.users}/{planLimits.maxUsers}</span>
                  </div>
                  <Progress 
                    value={(planLimits.currentUsage.users / planLimits.maxUsers) * 100} 
                    className="h-1"
                  />
                </div>
              )}

              {planLimits.maxClients !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Clientes</span>
                    <span>{planLimits.currentUsage.clients}/{planLimits.maxClients}</span>
                  </div>
                  <Progress 
                    value={(planLimits.currentUsage.clients / planLimits.maxClients) * 100} 
                    className="h-1"
                  />
                </div>
              )}

              {planLimits.maxConnections !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Conexões</span>
                    <span>{planLimits.currentUsage.connections}/{planLimits.maxConnections}</span>
                  </div>
                  <Progress 
                    value={(planLimits.currentUsage.connections / planLimits.maxConnections) * 100} 
                    className="h-1"
                  />
                </div>
              )}

              {planLimits.maxCampaigns !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Campanhas</span>
                    <span>{planLimits.currentUsage.campaigns}/{planLimits.maxCampaigns}</span>
                  </div>
                  <Progress 
                    value={(planLimits.currentUsage.campaigns / planLimits.maxCampaigns) * 100} 
                    className="h-1"
                  />
                </div>
              )}
            </div>
          ) : null}

          {showUpgradePrompt && !hasActiveSubscription && userType !== UserType.SUPER_ADMIN && (
            <div className="mt-4 pt-3 border-t">
              <Button size="sm" className="w-full">
                Renovar Plano
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

/**
 * Componente compacto para mostrar apenas o badge do tipo de usuário
 */
export function UserTypeBadge() {
  return <UserAccessIndicator compact showLimits={false} showUpgradePrompt={false} />
}

/**
 * Componente para mostrar apenas os limites sem informações de tipo
 */
export function UserLimitsIndicator() {
  const { planLimits, hasActiveSubscription } = usePlanLimits()
  const { isSuperAdmin } = useUserType()

  if (isSuperAdmin || !planLimits || !hasActiveSubscription) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Limites do Plano</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {planLimits.maxUsers !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Usuários</span>
                <span>{planLimits.currentUsage.users}/{planLimits.maxUsers}</span>
              </div>
              <Progress 
                value={(planLimits.currentUsage.users / planLimits.maxUsers) * 100} 
                className="h-1"
              />
            </div>
          )}

          {planLimits.maxClients !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Clientes</span>
                <span>{planLimits.currentUsage.clients}/{planLimits.maxClients}</span>
              </div>
              <Progress 
                value={(planLimits.currentUsage.clients / planLimits.maxClients) * 100} 
                className="h-1"
              />
            </div>
          )}

          {planLimits.maxConnections !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Conexões</span>
                <span>{planLimits.currentUsage.connections}/{planLimits.maxConnections}</span>
              </div>
              <Progress 
                value={(planLimits.currentUsage.connections / planLimits.maxConnections) * 100} 
                className="h-1"
              />
            </div>
          )}

          {planLimits.maxCampaigns !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Campanhas</span>
                <span>{planLimits.currentUsage.campaigns}/{planLimits.maxCampaigns}</span>
              </div>
              <Progress 
                value={(planLimits.currentUsage.campaigns / planLimits.maxCampaigns) * 100} 
                className="h-1"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}