'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  AccessControlErrorHandler,
  AccessControlErrorCode,
  AccessControlErrorDisplay,
  PlanLimitFeedback,
  RestrictionTooltip,
  UserTypeRestrictionTooltip,
  PlanLimitRestrictionTooltip,
  ClientAccessRestrictionTooltip,
  PermissionNotificationProvider,
  PermissionNotificationList,
  usePermissionNotifications,
  usePermissionNotificationHelpers
} from '@/components/errors'
import { UserType, PlanLimits } from '@/lib/services/user-access-control'

// Example data for demonstration
const examplePlanLimits: PlanLimits = {
  maxUsers: 5,
  maxClients: 10,
  maxConnections: 3,
  maxCampaigns: 50,
  currentUsage: {
    users: 4,
    clients: 8,
    connections: 3,
    campaigns: 45
  }
}

const examplePlanLimitsExceeded: PlanLimits = {
  maxUsers: 5,
  maxClients: 10,
  maxConnections: 3,
  maxCampaigns: 50,
  currentUsage: {
    users: 5,
    clients: 10,
    connections: 3,
    campaigns: 50
  }
}

function ErrorHandlingDemoContent() {
  const [selectedError, setSelectedError] = useState<any>(null)
  const [showPlanFeedback, setShowPlanFeedback] = useState(false)
  const { addNotification } = usePermissionNotifications()
  const notificationHelpers = usePermissionNotificationHelpers()

  const simulateError = (errorCode: AccessControlErrorCode, details?: any) => {
    const exampleError = {
      response: {
        status: errorCode === AccessControlErrorCode.UNAUTHORIZED ? 401 : 
                errorCode === AccessControlErrorCode.PLAN_LIMIT_EXCEEDED ? 402 : 403,
        data: {
          code: errorCode,
          error: 'Example error for demonstration',
          details: {
            userType: UserType.COMMON_USER,
            ...details
          }
        }
      }
    }

    const accessControlError = AccessControlErrorHandler.handleError(exampleError)
    setSelectedError(accessControlError)
  }

  const simulateNotification = (type: string) => {
    switch (type) {
      case 'permission_granted':
        notificationHelpers.notifyPermissionGranted('Acesso a relatórios avançados')
        break
      case 'permission_revoked':
        notificationHelpers.notifyPermissionRevoked('Criação de campanhas')
        break
      case 'user_type_changed':
        notificationHelpers.notifyUserTypeChanged(UserType.ORG_ADMIN, UserType.COMMON_USER)
        break
      case 'client_access_granted':
        notificationHelpers.notifyClientAccessGranted('Empresa ABC', 'client-123')
        break
      case 'client_access_revoked':
        notificationHelpers.notifyClientAccessRevoked('Empresa XYZ', 'client-456')
        break
      case 'plan_upgraded':
        notificationHelpers.notifyPlanUpgraded('Plano Professional')
        break
      case 'subscription_expired':
        notificationHelpers.notifySubscriptionExpired()
        break
    }
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Sistema de Tratamento de Erros e Feedback</h1>
        <p className="text-gray-600">
          Demonstração completa do sistema de controle de acesso com tratamento de erros,
          feedback ao usuário e notificações de mudanças de permissão.
        </p>
      </div>

      {/* Error Display Demo */}
      <Card>
        <CardHeader>
          <CardTitle>1. Exibição de Erros de Controle de Acesso</CardTitle>
          <CardDescription>
            Teste diferentes tipos de erro e veja como são apresentados ao usuário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateError(AccessControlErrorCode.UNAUTHORIZED)}
            >
              Não Autorizado
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateError(AccessControlErrorCode.USER_TYPE_NOT_ALLOWED, {
                requiredPermission: 'admin'
              })}
            >
              Tipo de Usuário
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateError(AccessControlErrorCode.CLIENT_ACCESS_DENIED, {
                clientId: 'client-123'
              })}
            >
              Acesso Cliente
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateError(AccessControlErrorCode.PLAN_LIMIT_EXCEEDED, {
                currentUsage: 5,
                limit: 5,
                planLimitAction: 'create_user'
              })}
            >
              Limite Plano
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateError(AccessControlErrorCode.SUBSCRIPTION_EXPIRED)}
            >
              Assinatura Expirada
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSelectedError(null)}
            >
              Limpar
            </Button>
          </div>

          {selectedError && (
            <div className="mt-4">
              <AccessControlErrorDisplay
                error={selectedError}
                onRetry={() => console.log('Retry clicked')}
                onBack={() => console.log('Back clicked')}
                onUpgrade={() => console.log('Upgrade clicked')}
                onLogin={() => console.log('Login clicked')}
                onContact={() => console.log('Contact clicked')}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Limit Feedback Demo */}
      <Card>
        <CardHeader>
          <CardTitle>2. Feedback de Limites de Plano</CardTitle>
          <CardDescription>
            Componentes para mostrar uso atual e limites do plano
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowPlanFeedback(!showPlanFeedback)}
            >
              {showPlanFeedback ? 'Ocultar' : 'Mostrar'} Feedback
            </Button>
          </div>

          {showPlanFeedback && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Plano Normal (Próximo do Limite)</h4>
                <PlanLimitFeedback
                  limits={examplePlanLimits}
                  variant="warning"
                  onUpgrade={() => console.log('Upgrade clicked')}
                  onDismiss={() => console.log('Dismissed')}
                />
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Plano Atingido (Bloqueado)</h4>
                <PlanLimitFeedback
                  limits={examplePlanLimitsExceeded}
                  action="create_user"
                  variant="blocked"
                  onUpgrade={() => console.log('Upgrade clicked')}
                />
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Versão Compacta</h4>
                <PlanLimitFeedback
                  limits={examplePlanLimits}
                  variant="warning"
                  compact={true}
                  onUpgrade={() => console.log('Upgrade clicked')}
                  onDismiss={() => console.log('Dismissed')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restriction Tooltips Demo */}
      <Card>
        <CardHeader>
          <CardTitle>3. Tooltips de Restrição</CardTitle>
          <CardDescription>
            Tooltips explicativos para funcionalidades restritas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <UserTypeRestrictionTooltip
              userType={UserType.COMMON_USER}
              requiredUserType={UserType.ORG_ADMIN}
              onRequestAccess={() => console.log('Request access clicked')}
            >
              <Button variant="outline" disabled className="w-full">
                Criar Usuário
                <Badge variant="secondary" className="ml-2">Admin</Badge>
              </Button>
            </UserTypeRestrictionTooltip>

            <PlanLimitRestrictionTooltip
              planLimitAction="create_client"
              currentUsage={10}
              limit={10}
              onUpgrade={() => console.log('Upgrade clicked')}
            >
              <Button variant="outline" disabled className="w-full">
                Criar Cliente
                <Badge variant="destructive" className="ml-2">Limite</Badge>
              </Button>
            </PlanLimitRestrictionTooltip>

            <ClientAccessRestrictionTooltip
              clientName="Empresa ABC"
              onRequestAccess={() => console.log('Request client access')}
            >
              <Button variant="outline" disabled className="w-full">
                Ver Campanhas
                <Badge variant="outline" className="ml-2">Restrito</Badge>
              </Button>
            </ClientAccessRestrictionTooltip>

            <RestrictionTooltip
              restrictionType="subscription"
              customMessage="Sua assinatura expirou. Renove para continuar."
              onUpgrade={() => console.log('Renew subscription')}
            >
              <Button variant="outline" disabled className="w-full">
                Exportar Dados
                <Badge variant="destructive" className="ml-2">Expirado</Badge>
              </Button>
            </RestrictionTooltip>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Demo */}
      <Card>
        <CardHeader>
          <CardTitle>4. Notificações de Mudanças de Permissão</CardTitle>
          <CardDescription>
            Sistema de notificações para mudanças de acesso e permissões
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateNotification('permission_granted')}
            >
              Permissão Concedida
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateNotification('permission_revoked')}
            >
              Permissão Revogada
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateNotification('user_type_changed')}
            >
              Tipo Alterado
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateNotification('client_access_granted')}
            >
              Acesso Cliente +
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateNotification('client_access_revoked')}
            >
              Acesso Cliente -
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateNotification('plan_upgraded')}
            >
              Plano Upgrade
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => simulateNotification('subscription_expired')}
            >
              Assinatura Expirada
            </Button>
          </div>

          <Separator />

          <PermissionNotificationList />
        </CardContent>
      </Card>

      {/* Integration Example */}
      <Card>
        <CardHeader>
          <CardTitle>5. Exemplo de Integração</CardTitle>
          <CardDescription>
            Como integrar os componentes em uma aplicação real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
{`// 1. Wrap your app with providers
<PermissionNotificationProvider>
  <AccessControlErrorWrapper redirectOnError={true}>
    <YourApp />
  </AccessControlErrorWrapper>
</PermissionNotificationProvider>

// 2. Use error handling in API calls
try {
  const response = await api.createUser(userData)
} catch (error) {
  if (isAccessControlError(error)) {
    const accessError = AccessControlErrorHandler.handleError(error)
    // Error will be handled by boundary or redirect
  }
}

// 3. Add tooltips to restricted buttons
<UserTypeRestrictionTooltip
  userType={currentUserType}
  requiredUserType={UserType.ORG_ADMIN}
>
  <Button disabled={!canCreateUsers}>
    Criar Usuário
  </Button>
</UserTypeRestrictionTooltip>

// 4. Show plan feedback
<PlanLimitFeedback
  limits={planLimits}
  action="create_client"
  onUpgrade={() => router.push('/billing')}
/>`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ErrorHandlingDemo() {
  return (
    <PermissionNotificationProvider>
      <ErrorHandlingDemoContent />
    </PermissionNotificationProvider>
  )
}
