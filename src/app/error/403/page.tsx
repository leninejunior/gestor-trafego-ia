'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Shield, 
  ShieldX, 
  CreditCard, 
  Users, 
  Building, 
  Crown,
  ArrowLeft,
  Home,
  Mail,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AccessControlErrorHandler, AccessControlErrorCode } from '@/lib/errors/access-control-errors'
import { UserType } from '@/lib/services/user-access-control'

const contextualMessages = {
  [AccessControlErrorCode.USER_TYPE_NOT_ALLOWED]: {
    title: 'Permissões Insuficientes',
    description: 'Seu tipo de usuário não tem acesso a esta funcionalidade',
    icon: Shield,
    suggestions: [
      'Entre em contato com o administrador da sua organização',
      'Solicite upgrade de permissões se necessário',
      'Verifique se você está logado na conta correta'
    ]
  },
  [AccessControlErrorCode.CLIENT_ACCESS_DENIED]: {
    title: 'Acesso ao Cliente Negado',
    description: 'Você não tem permissão para acessar este cliente',
    icon: Building,
    suggestions: [
      'Solicite acesso ao administrador da organização',
      'Verifique se o cliente ainda está ativo',
      'Confirme se você está na organização correta'
    ]
  },
  [AccessControlErrorCode.PLAN_LIMIT_EXCEEDED]: {
    title: 'Limite do Plano Atingido',
    description: 'Sua organização atingiu o limite do plano atual',
    icon: CreditCard,
    suggestions: [
      'Faça upgrade do plano para continuar',
      'Remova recursos não utilizados',
      'Entre em contato com o time de vendas'
    ]
  },
  [AccessControlErrorCode.SUBSCRIPTION_EXPIRED]: {
    title: 'Assinatura Expirada',
    description: 'A assinatura da sua organização expirou',
    icon: CreditCard,
    suggestions: [
      'Renove a assinatura para continuar',
      'Entre em contato com o suporte',
      'Seus dados permanecem seguros'
    ]
  },
  [AccessControlErrorCode.FORBIDDEN]: {
    title: 'Acesso Negado',
    description: 'Você não tem permissão para acessar este recurso',
    icon: ShieldX,
    suggestions: [
      'Verifique se você está logado',
      'Entre em contato com o administrador',
      'Tente acessar através do menu principal'
    ]
  }
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

export default function Error403Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)

  // Extrair parâmetros da URL
  const errorCode = searchParams.get('code') as AccessControlErrorCode || AccessControlErrorCode.FORBIDDEN
  const userType = searchParams.get('userType') as UserType
  const requiredUserType = searchParams.get('requiredUserType') as UserType
  const clientId = searchParams.get('clientId')
  const clientName = searchParams.get('clientName')
  const currentUsage = searchParams.get('currentUsage')
  const limit = searchParams.get('limit')
  const customMessage = searchParams.get('message')
  const returnUrl = searchParams.get('returnUrl')

  // Obter contexto da mensagem
  const context = contextualMessages[errorCode] || contextualMessages[AccessControlErrorCode.FORBIDDEN]
  const ContextIcon = context.icon

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      // Tentar recarregar a página original ou voltar
      if (returnUrl) {
        window.location.href = returnUrl
      } else {
        window.location.reload()
      }
    } catch (error) {
      console.error('Retry failed:', error)
    } finally {
      setTimeout(() => setIsRetrying(false), 2000)
    }
  }

  const handleGoHome = () => {
    router.push('/dashboard')
  }

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      handleGoHome()
    }
  }

  const handleContact = () => {
    const subject = encodeURIComponent(`Erro de Acesso - ${errorCode}`)
    const body = encodeURIComponent(
      `Olá,\n\nEncontrei um erro de acesso:\n\n` +
      `Código: ${errorCode}\n` +
      `Página: ${window.location.href}\n` +
      `Tipo de usuário: ${userType || 'N/A'}\n` +
      `Cliente: ${clientName || clientId || 'N/A'}\n\n` +
      `Por favor, me ajudem a resolver este problema.\n\n` +
      `Obrigado!`
    )
    window.location.href = `mailto:suporte@exemplo.com?subject=${subject}&body=${body}`
  }

  const handleUpgrade = () => {
    router.push('/dashboard/billing/upgrade')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center pb-6">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ContextIcon className="h-10 w-10 text-red-600" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-2xl">{context.title}</CardTitle>
              <Badge variant="outline" className="text-xs">
                403
              </Badge>
            </div>
            
            <CardDescription className="text-base">
              {customMessage || context.description}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* User Context */}
          {userType && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Informações da Conta</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Seu tipo de usuário:</span>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const UserTypeIcon = userTypeIcons[userType]
                      return <UserTypeIcon className="h-4 w-4" />
                    })()}
                    <Badge variant="outline">
                      {userTypeLabels[userType]}
                    </Badge>
                  </div>
                </div>
                
                {requiredUserType && (
                  <div className="flex items-center justify-between">
                    <span>Tipo necessário:</span>
                    <Badge variant="secondary">
                      {userTypeLabels[requiredUserType]}
                    </Badge>
                  </div>
                )}
                
                {clientName && (
                  <div className="flex items-center justify-between">
                    <span>Cliente solicitado:</span>
                    <span className="font-medium">{clientName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plan Limit Details */}
          {errorCode === AccessControlErrorCode.PLAN_LIMIT_EXCEEDED && currentUsage && limit && (
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Limite do Plano</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uso atual:</span>
                  <span className="font-mono">{currentUsage} / {limit}</span>
                </div>
                <div className="w-full bg-orange-200 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full" 
                    style={{ width: `${Math.min((parseInt(currentUsage) / parseInt(limit)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">O que você pode fazer:</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button onClick={handleGoBack} variant="outline" className="justify-start">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              
              <Button onClick={handleGoHome} variant="outline" className="justify-start">
                <Home className="h-4 w-4 mr-2" />
                Ir para Dashboard
              </Button>
              
              <Button 
                onClick={handleRetry} 
                variant="outline" 
                className="justify-start"
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {isRetrying ? 'Tentando...' : 'Tentar Novamente'}
              </Button>
              
              <Button onClick={handleContact} variant="outline" className="justify-start">
                <Mail className="h-4 w-4 mr-2" />
                Contatar Suporte
              </Button>
            </div>

            {/* Upgrade button for plan limits */}
            {errorCode === AccessControlErrorCode.PLAN_LIMIT_EXCEEDED && (
              <Button onClick={handleUpgrade} className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                Fazer Upgrade do Plano
              </Button>
            )}
          </div>

          <Separator />

          {/* Suggestions */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-3">
              💡 Sugestões para resolver:
            </h4>
            <ul className="text-sm text-blue-800 space-y-2">
              {context.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Error Code */}
          <div className="text-center text-xs text-gray-500">
            Código do erro: <code className="bg-gray-100 px-2 py-1 rounded">{errorCode}</code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}