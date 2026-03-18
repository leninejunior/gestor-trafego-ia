'use client'

import { ReactNode } from 'react'
import { 
  Shield, 
  ShieldX, 
  CreditCard, 
  Users, 
  Building, 
  Crown,
  Lock,
  AlertTriangle,
  Info
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserType, LimitedAction } from '@/lib/services/user-access-control'
import { AccessControlErrorCode } from '@/lib/errors/access-control-errors'

interface RestrictionTooltipProps {
  children: ReactNode
  restrictionType: 'user_type' | 'plan_limit' | 'client_access' | 'subscription' | 'permission'
  userType?: UserType
  requiredUserType?: UserType
  planLimitAction?: LimitedAction
  currentUsage?: number
  limit?: number
  clientName?: string
  customMessage?: string
  onUpgrade?: () => void
  onRequestAccess?: () => void
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

const userTypeLabels = {
  [UserType.SUPER_ADMIN]: 'Super Admin',
  [UserType.ORG_ADMIN]: 'Admin da Organização',
  [UserType.COMMON_USER]: 'Usuário Comum'
}

const userTypeIcons = {
  [UserType.SUPER_ADMIN]: Crown,
  [UserType.ORG_ADMIN]: Shield,
  [UserType.COMMON_USER]: Users
}

const actionLabels = {
  create_user: 'criar usuários',
  create_client: 'criar clientes',
  create_connection: 'criar conexões',
  create_campaign: 'criar campanhas'
}

export function RestrictionTooltip({
  children,
  restrictionType,
  userType,
  requiredUserType,
  planLimitAction,
  currentUsage,
  limit,
  clientName,
  customMessage,
  onUpgrade,
  onRequestAccess,
  className,
  side = 'top'
}: RestrictionTooltipProps) {
  const getTooltipContent = () => {
    switch (restrictionType) {
      case 'user_type':
        return (
          <div className="space-y-3 max-w-xs">
            <div className="flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-red-500" />
              <span className="font-medium text-sm">Acesso Restrito</span>
            </div>
            
            <div className="space-y-2 text-xs">
              {userType && (
                <div className="flex items-center justify-between">
                  <span>Seu tipo:</span>
                  <Badge variant="outline" className="text-xs">
                    {userTypeLabels[userType]}
                  </Badge>
                </div>
              )}
              
              {requiredUserType && (
                <div className="flex items-center justify-between">
                  <span>Necessário:</span>
                  <Badge variant="secondary" className="text-xs">
                    {userTypeLabels[requiredUserType]}
                  </Badge>
                </div>
              )}
            </div>
            
            <p className="text-xs text-gray-600">
              {customMessage || 
               `Esta funcionalidade requer permissões de ${requiredUserType ? userTypeLabels[requiredUserType] : 'administrador'}.`}
            </p>
            
            {onRequestAccess && (
              <Button size="sm" variant="outline" onClick={onRequestAccess} className="w-full text-xs">
                Solicitar Acesso
              </Button>
            )}
          </div>
        )

      case 'plan_limit':
        return (
          <div className="space-y-3 max-w-xs">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-sm">Limite do Plano</span>
            </div>
            
            {currentUsage !== undefined && limit !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Uso atual:</span>
                  <span className="font-mono">{currentUsage} / {limit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-orange-500 h-1.5 rounded-full" 
                    style={{ width: `${Math.min((currentUsage / limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-600">
              {customMessage || 
               `Você atingiu o limite para ${planLimitAction ? actionLabels[planLimitAction] : 'este recurso'}. Faça upgrade para continuar.`}
            </p>
            
            {onUpgrade && (
              <Button size="sm" onClick={onUpgrade} className="w-full text-xs">
                Fazer Upgrade
              </Button>
            )}
          </div>
        )

      case 'client_access':
        return (
          <div className="space-y-3 max-w-xs">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">Acesso ao Cliente</span>
            </div>
            
            {clientName && (
              <div className="text-xs">
                <span className="text-gray-600">Cliente: </span>
                <span className="font-medium">{clientName}</span>
              </div>
            )}
            
            <p className="text-xs text-gray-600">
              {customMessage || 
               'Você não tem acesso a este cliente. Solicite permissão ao administrador da organização.'}
            </p>
            
            {onRequestAccess && (
              <Button size="sm" variant="outline" onClick={onRequestAccess} className="w-full text-xs">
                Solicitar Acesso
              </Button>
            )}
          </div>
        )

      case 'subscription':
        return (
          <div className="space-y-3 max-w-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-medium text-sm">Assinatura Expirada</span>
            </div>
            
            <p className="text-xs text-gray-600">
              {customMessage || 
               'Sua assinatura expirou. Renove para continuar usando todas as funcionalidades.'}
            </p>
            
            {onUpgrade && (
              <Button size="sm" onClick={onUpgrade} className="w-full text-xs">
                Renovar Assinatura
              </Button>
            )}
          </div>
        )

      case 'permission':
        return (
          <div className="space-y-3 max-w-xs">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-sm">Permissão Necessária</span>
            </div>
            
            <p className="text-xs text-gray-600">
              {customMessage || 
               'Você não tem permissão para realizar esta ação.'}
            </p>
            
            {onRequestAccess && (
              <Button size="sm" variant="outline" onClick={onRequestAccess} className="w-full text-xs">
                Solicitar Permissão
              </Button>
            )}
          </div>
        )

      default:
        return (
          <div className="space-y-2 max-w-xs">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">Informação</span>
            </div>
            <p className="text-xs text-gray-600">
              {customMessage || 'Esta funcionalidade está restrita.'}
            </p>
          </div>
        )
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild className={className}>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} className="p-3">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Componente específico para tooltip de tipo de usuário
 */
export function UserTypeRestrictionTooltip({
  children,
  userType,
  requiredUserType,
  customMessage,
  onRequestAccess,
  ...props
}: Omit<RestrictionTooltipProps, 'restrictionType'>) {
  return (
    <RestrictionTooltip
      restrictionType="user_type"
      userType={userType}
      requiredUserType={requiredUserType}
      customMessage={customMessage}
      onRequestAccess={onRequestAccess}
      {...props}
    >
      {children}
    </RestrictionTooltip>
  )
}

/**
 * Componente específico para tooltip de limite de plano
 */
export function PlanLimitRestrictionTooltip({
  children,
  planLimitAction,
  currentUsage,
  limit,
  customMessage,
  onUpgrade,
  ...props
}: Omit<RestrictionTooltipProps, 'restrictionType'>) {
  return (
    <RestrictionTooltip
      restrictionType="plan_limit"
      planLimitAction={planLimitAction}
      currentUsage={currentUsage}
      limit={limit}
      customMessage={customMessage}
      onUpgrade={onUpgrade}
      {...props}
    >
      {children}
    </RestrictionTooltip>
  )
}

/**
 * Componente específico para tooltip de acesso a cliente
 */
export function ClientAccessRestrictionTooltip({
  children,
  clientName,
  customMessage,
  onRequestAccess,
  ...props
}: Omit<RestrictionTooltipProps, 'restrictionType'>) {
  return (
    <RestrictionTooltip
      restrictionType="client_access"
      clientName={clientName}
      customMessage={customMessage}
      onRequestAccess={onRequestAccess}
      {...props}
    >
      {children}
    </RestrictionTooltip>
  )
}

/**
 * Componente específico para tooltip de assinatura
 */
export function SubscriptionRestrictionTooltip({
  children,
  customMessage,
  onUpgrade,
  ...props
}: Omit<RestrictionTooltipProps, 'restrictionType'>) {
  return (
    <RestrictionTooltip
      restrictionType="subscription"
      customMessage={customMessage}
      onUpgrade={onUpgrade}
      {...props}
    >
      {children}
    </RestrictionTooltip>
  )
}