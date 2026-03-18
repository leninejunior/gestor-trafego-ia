'use client'

import { AlertTriangle, Crown, Zap, ChevronRight } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserType, usePlanLimits } from "@/hooks/use-user-access";
import { UserType } from '@/lib/services/user-access-control'
import Link from 'next/link'

interface PlanLimitMessageProps {
  feature: 'clients' | 'users' | 'connections' | 'campaigns'
  action?: string // e.g., "criar cliente", "adicionar usuário"
  variant?: 'alert' | 'card' | 'inline'
  className?: string
}

export function PlanLimitMessage({ 
  feature, 
  action,
  variant = 'alert',
  className 
}: PlanLimitMessageProps) {
  const { userType } = useUserType()
  const { 
    planLimits, 
    hasActiveSubscription,
    canCreateClients,
    canCreateUsers,
    canCreateConnections
  } = usePlanLimits()

  // Don't show for super admins or if userType is not loaded
  if (!userType || userType === UserType.SUPER_ADMIN) {
    return null
  }

  // Check if user has hit the limit for this feature
  const isAtLimit = () => {
    if (!planLimits) return false
    
    switch (feature) {
      case 'clients':
        return !canCreateClients && hasActiveSubscription
      case 'users':
        return !canCreateUsers && hasActiveSubscription
      case 'connections':
        return !canCreateConnections && hasActiveSubscription
      case 'campaigns':
        return planLimits.maxCampaigns !== null && 
               planLimits.currentUsage.campaigns >= planLimits.maxCampaigns
      default:
        return false
    }
  }

  // Check if subscription is expired
  const isSubscriptionExpired = !hasActiveSubscription

  if (!isAtLimit() && !isSubscriptionExpired) {
    return null
  }

  const getFeatureLabel = () => {
    switch (feature) {
      case 'clients': return 'clientes'
      case 'users': return 'usuários'
      case 'connections': return 'conexões'
      case 'campaigns': return 'campanhas'
      default: return 'recursos'
    }
  }

  const getCurrentUsage = () => {
    if (!planLimits) return { current: 0, max: 0 }
    
    switch (feature) {
      case 'clients':
        return { 
          current: planLimits.currentUsage.clients, 
          max: planLimits.maxClients || 0 
        }
      case 'users':
        return { 
          current: planLimits.currentUsage.users, 
          max: planLimits.maxUsers || 0 
        }
      case 'connections':
        return { 
          current: planLimits.currentUsage.connections, 
          max: planLimits.maxConnections || 0 
        }
      case 'campaigns':
        return { 
          current: planLimits.currentUsage.campaigns, 
          max: planLimits.maxCampaigns || 0 
        }
      default:
        return { current: 0, max: 0 }
    }
  }

  const usage = getCurrentUsage()
  const featureLabel = getFeatureLabel()

  if (isSubscriptionExpired) {
    const content = (
      <>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Assinatura Expirada</span>
        </div>
        <p className="text-sm mt-1">
          Sua assinatura expirou. Renove seu plano para {action || `gerenciar ${featureLabel}`}.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/dashboard/billing">
            <Zap className="h-4 w-4 mr-2" />
            Renovar Plano
          </Link>
        </Button>
      </>
    )

    if (variant === 'card') {
      return (
        <Card className={`border-destructive ${className}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Assinatura Expirada
            </CardTitle>
            <CardDescription>
              Renove seu plano para continuar usando o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/billing">
                <Zap className="h-4 w-4 mr-2" />
                Renovar Plano
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (variant === 'inline') {
      return (
        <div className={`flex items-center gap-2 text-sm text-destructive ${className}`}>
          <AlertTriangle className="h-4 w-4" />
          <span>Assinatura expirada</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/billing">Renovar</Link>
          </Button>
        </div>
      )
    }

    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Assinatura Expirada</AlertTitle>
        <AlertDescription className="mt-2">
          <p>Sua assinatura expirou. Renove seu plano para {action || `gerenciar ${featureLabel}`}.</p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/dashboard/billing">
              <Zap className="h-4 w-4 mr-2" />
              Renovar Plano
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Plan limit reached
  const content = (
    <>
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4" />
        <span className="font-medium">Limite Atingido</span>
      </div>
      <p className="text-sm mt-1">
        Você atingiu o limite de {featureLabel} do seu plano ({usage.current}/{usage.max}). 
        {action && ` Para ${action}, `}Faça upgrade para continuar.
      </p>
      <Button asChild size="sm" className="mt-3">
        <Link href="/dashboard/billing">
          <Crown className="h-4 w-4 mr-2" />
          Fazer Upgrade
        </Link>
      </Button>
    </>
  )

  if (variant === 'card') {
    return (
      <Card className={`border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-orange-700 dark:text-orange-400 flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Limite de {featureLabel.charAt(0).toUpperCase() + featureLabel.slice(1)} Atingido
          </CardTitle>
          <CardDescription>
            {usage.current} de {usage.max} {featureLabel} utilizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {action && `Para ${action}, `}faça upgrade do seu plano para aumentar os limites.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard/billing">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 ${className}`}>
        <Crown className="h-4 w-4" />
        <span>Limite atingido ({usage.current}/{usage.max})</span>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/billing">Upgrade</Link>
        </Button>
      </div>
    )
  }

  return (
    <Alert className={`border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 ${className}`}>
      <Crown className="h-4 w-4" />
      <AlertTitle className="text-orange-700 dark:text-orange-400">
        Limite de {featureLabel.charAt(0).toUpperCase() + featureLabel.slice(1)} Atingido
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p>
          Você está usando {usage.current} de {usage.max} {featureLabel} disponíveis no seu plano.
          {action && ` Para ${action}, `} faça upgrade para aumentar os limites.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/dashboard/billing">
            <Crown className="h-4 w-4 mr-2" />
            Fazer Upgrade
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Specific components for common use cases
 */
export function ClientLimitMessage({ className }: { className?: string }) {
  return (
    <PlanLimitMessage 
      feature="clients" 
      action="adicionar mais clientes"
      className={className} 
    />
  )
}

export function UserLimitMessage({ className }: { className?: string }) {
  return (
    <PlanLimitMessage 
      feature="users" 
      action="criar novos usuários"
      className={className} 
    />
  )
}

export function ConnectionLimitMessage({ className }: { className?: string }) {
  return (
    <PlanLimitMessage 
      feature="connections" 
      action="conectar mais contas"
      className={className} 
    />
  )
}

export function CampaignLimitMessage({ className }: { className?: string }) {
  return (
    <PlanLimitMessage 
      feature="campaigns" 
      action="criar mais campanhas"
      className={className} 
    />
  )
}