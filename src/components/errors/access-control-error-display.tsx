'use client'

import { useState } from 'react'
import { 
  Shield, 
  ShieldX, 
  CreditCard, 
  Users, 
  Building, 
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Mail,
  ExternalLink,
  Crown,
  Lock,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  AccessControlError, 
  AccessControlErrorAction, 
  AccessControlErrorCode,
  AccessControlErrorHandler 
} from '@/lib/errors/access-control-errors'
import { UserType } from '@/lib/services/user-access-control'

interface AccessControlErrorDisplayProps {
  error: AccessControlError
  onRetry?: () => void | Promise<void>
  onBack?: () => void
  onUpgrade?: () => void
  onLogin?: () => void
  onContact?: () => void
  className?: string
}

const errorIcons = {
  [AccessControlErrorCode.UNAUTHORIZED]: Lock,
  [AccessControlErrorCode.TOKEN_EXPIRED]: Clock,
  [AccessControlErrorCode.FORBIDDEN]: ShieldX,
  [AccessControlErrorCode.USER_TYPE_NOT_ALLOWED]: Shield,
  [AccessControlErrorCode.ACCESS_DENIED]: ShieldX,
  [AccessControlErrorCode.CLIENT_ACCESS_DENIED]: Building,
  [AccessControlErrorCode.PLAN_LIMIT_EXCEEDED]: CreditCard,
  [AccessControlErrorCode.SUBSCRIPTION_EXPIRED]: CreditCard,
  [AccessControlErrorCode.SUBSCRIPTION_INACTIVE]: CreditCard,
  [AccessControlErrorCode.CLIENT_ID_REQUIRED]: Building,
  [AccessControlErrorCode.INVALID_ORGANIZATION]: Building,
  [AccessControlErrorCode.NO_ORGANIZATION]: Users,
  [AccessControlErrorCode.SAME_ORG_VIOLATION]: Building,
  [AccessControlErrorCode.DUPLICATE_MEMBERSHIP]: Users,
  [AccessControlErrorCode.INTERNAL_ERROR]: AlertTriangle,
  [AccessControlErrorCode.SERVICE_UNAVAILABLE]: AlertTriangle
}

const errorColors = {
  low: 'text-yellow-600',
  medium: 'text-orange-600',
  high: 'text-red-600',
  critical: 'text-red-700'
}

const errorBgColors = {
  low: 'bg-yellow-50 border-yellow-200',
  medium: 'bg-orange-50 border-orange-200',
  high: 'bg-red-50 border-red-200',
  critical: 'bg-red-100 border-red-300'
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

export function AccessControlErrorDisplay({ 
  error, 
  onRetry, 
  onBack, 
  onUpgrade, 
  onLogin, 
  onContact,
  className 
}: AccessControlErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const ErrorIcon = errorIcons[error.code] || AlertTriangle
  const iconColor = errorColors[error.severity] || 'text-red-600'
  const bgColor = errorBgColors[error.severity] || 'bg-red-50 border-red-200'

  const handleAction = async (action: AccessControlErrorAction) => {
    switch (action.type) {
      case 'retry':
        if (onRetry) {
          setIsRetrying(true)
          try {
            await onRetry()
            setRetryCount(prev => prev + 1)
          } catch (retryError) {
            console.error('Retry failed:', retryError)
          } finally {
            setIsRetrying(false)
          }
        }
        break
        
      case 'back':
        if (onBack) {
          onBack()
        } else {
          window.history.back()
        }
        break

      case 'upgrade':
        if (onUpgrade) {
          onUpgrade()
        } else if (action.url) {
          window.location.href = action.url
        }
        break

      case 'login':
        if (onLogin) {
          onLogin()
        } else {
          window.location.href = '/auth/login'
        }
        break

      case 'contact':
        if (onContact) {
          onContact()
        } else {
          const subject = encodeURIComponent(`Erro de Acesso - ${error.code}`)
          const body = encodeURIComponent(
            `Olá,\n\nEncontrei um erro de acesso:\n\n` +
            `Código: ${error.code}\n` +
            `Mensagem: ${error.message}\n` +
            `Tipo de usuário: ${error.details?.userType || 'N/A'}\n\n` +
            `Por favor, me ajudem a resolver este problema.\n\n` +
            `Obrigado!`
          )
          window.location.href = `mailto:suporte@exemplo.com?subject=${subject}&body=${body}`
        }
        break
        
      case 'redirect':
        if (action.url) {
          window.location.href = action.url
        }
        break

      case 'request_access':
        if (action.handler) {
          await action.handler()
        } else {
          // Implementar modal de solicitação de acesso
          console.log('Solicitar acesso:', error.details)
        }
        break
        
      default:
        if (action.handler) {
          await action.handler()
        }
    }
  }

  const helpMessages = AccessControlErrorHandler.getHelpMessage(error)

  return (
    <Card className={`${bgColor} ${className}`}>
      <CardHeader className="text-center pb-4">
        <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm`}>
          <ErrorIcon className={`h-8 w-8 ${iconColor}`} />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <CardTitle className="text-lg">Acesso Restrito</CardTitle>
            <Badge variant="outline" className="text-xs">
              {error.severity}
            </Badge>
          </div>
          
          <CardDescription className="text-base">
            {error.userMessage}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* User Context */}
        {error.details?.userType && (
          <Alert className="bg-white/50">
            <div className="flex items-center gap-2">
              {(() => {
                const UserTypeIcon = userTypeIcons[error.details.userType]
                return <UserTypeIcon className="h-4 w-4" />
              })()}
              <AlertDescription className="text-sm">
                <strong>Seu tipo de usuário:</strong> {userTypeLabels[error.details.userType]}
                {error.details.requiredPermission && (
                  <span className="block mt-1">
                    <strong>Permissão necessária:</strong> {error.details.requiredPermission}
                  </span>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Plan Limit Details */}
        {error.code === AccessControlErrorCode.PLAN_LIMIT_EXCEEDED && error.details && (
          <Alert className="bg-white/50">
            <CreditCard className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Limite do plano atingido:</strong>
              <div className="mt-2 space-y-1">
                {error.details.currentUsage !== undefined && error.details.limit !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span>Uso atual:</span>
                    <span>{error.details.currentUsage} / {error.details.limit}</span>
                  </div>
                )}
                {error.details.planLimitAction && (
                  <div className="text-xs text-gray-600">
                    Ação bloqueada: {error.details.planLimitAction.replace('create_', 'criar ')}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Details */}
        <Alert className="bg-white/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Detalhes técnicos:</strong> {error.message}
            {retryCount > 0 && (
              <span className="block mt-1 text-xs text-gray-500">
                Tentativas realizadas: {retryCount}
              </span>
            )}
            {error.details?.clientId && (
              <span className="block mt-1 text-xs text-gray-500">
                Cliente: {error.details.clientId}
              </span>
            )}
          </AlertDescription>
        </Alert>

        <Separator />

        {/* Recovery Actions */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            O que você pode fazer:
          </p>
          
          <div className="space-y-2">
            {error.actions.map((action, index) => {
              const isRetryAction = action.type === 'retry'
              const disabled = isRetryAction && isRetrying
              
              return (
                <Button
                  key={index}
                  onClick={() => handleAction(action)}
                  variant={action.primary ? 'default' : 'outline'}
                  className="w-full justify-start"
                  disabled={disabled}
                >
                  {isRetryAction && isRetrying ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ActionIcon actionType={action.type} className="h-4 w-4 mr-2" />
                  )}
                  {disabled ? 'Tentando...' : action.label}
                  {action.type === 'redirect' && <ExternalLink className="h-3 w-3 ml-auto" />}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Help Tips */}
        {error.recoverable && helpMessages.length > 0 && (
          <>
            <Separator />
            <div className="bg-white/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                💡 Dicas para resolver:
              </h4>
              <ul className="text-xs text-gray-600 space-y-1">
                {helpMessages.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Error Code */}
        <div className="text-center pt-2">
          <p className="text-xs text-gray-500">
            Código do erro: <code className="bg-white/50 px-1 rounded">{error.code}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionIcon({ actionType, className }: { actionType: string; className?: string }) {
  switch (actionType) {
    case 'retry':
      return <RefreshCw className={className} />
    case 'back':
      return <ArrowLeft className={className} />
    case 'upgrade':
      return <CreditCard className={className} />
    case 'login':
      return <Lock className={className} />
    case 'contact':
      return <Mail className={className} />
    case 'redirect':
      return <ExternalLink className={className} />
    case 'request_access':
      return <Shield className={className} />
    default:
      return <AlertTriangle className={className} />
  }
}