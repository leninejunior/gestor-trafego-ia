# Sistema de Tratamento de Erros e Feedback do Usuário

Este sistema implementa o **Requisito 15** do sistema de controle de acesso hierárquico, fornecendo tratamento abrangente de erros e feedback ao usuário para diferentes tipos de restrições.

## Funcionalidades Implementadas

### ✅ Mensagens de erro específicas por tipo de restrição
- Erros de autenticação (401)
- Erros de autorização (403) 
- Erros de limite de plano (402)
- Erros de validação (400)
- Erros de sistema (500)

### ✅ Componentes de feedback para limites de plano
- Visualização de uso atual vs limites
- Alertas de proximidade do limite
- Bloqueios quando limite é atingido
- CTAs para upgrade de plano

### ✅ Tooltips explicativos em funcionalidades restritas
- Tooltips contextuais por tipo de restrição
- Explicações claras do motivo da restrição
- Ações sugeridas para resolver

### ✅ Notificações de mudanças de permissão
- Sistema de notificações em tempo real
- Notificações para mudanças de tipo de usuário
- Notificações para concessão/revogação de acesso
- Notificações para mudanças de plano

### ✅ Página de erro 403 customizada por contexto
- Página dedicada com contexto específico
- Informações detalhadas sobre o erro
- Sugestões de resolução
- Ações disponíveis baseadas no contexto

## Arquitetura do Sistema

```
src/components/errors/
├── access-control-errors.ts          # Tipos e handler de erros
├── access-control-error-display.tsx  # Componente principal de exibição
├── access-control-error-boundary.tsx # Error boundary para React
├── index.ts                          # Exports centralizados
└── README.md                         # Esta documentação

src/components/feedback/
├── plan-limit-feedback.tsx           # Feedback de limites de plano
└── restriction-tooltip.tsx           # Tooltips de restrição

src/components/notifications/
└── permission-notifications.tsx      # Sistema de notificações

src/app/error/403/
└── page.tsx                          # Página de erro 403 customizada

src/lib/utils/
└── error-redirect.ts                 # Utilitários de redirecionamento

src/hooks/
└── use-user-access-enhanced.ts       # Hook integrado com error handling
```

## Guia de Uso

### 1. Configuração Básica

```tsx
import { 
  PermissionNotificationProvider,
  AccessControlErrorWrapper 
} from '@/components/errors'

function App() {
  return (
    <PermissionNotificationProvider>
      <AccessControlErrorWrapper redirectOnError={true}>
        <YourApp />
      </AccessControlErrorWrapper>
    </PermissionNotificationProvider>
  )
}
```

### 2. Tratamento de Erros em APIs

```tsx
import { 
  AccessControlErrorHandler,
  isAccessControlError,
  redirectTo403 
} from '@/components/errors'

async function createUser(userData) {
  try {
    const response = await api.post('/users', userData)
    return response.data
  } catch (error) {
    if (isAccessControlError(error)) {
      const accessError = AccessControlErrorHandler.handleError(error)
      
      // Opção 1: Redirecionar para página 403
      redirectTo403({ error: accessError })
      
      // Opção 2: Mostrar erro inline
      setError(accessError)
    }
    throw error
  }
}
```

### 3. Tooltips de Restrição

```tsx
import { 
  UserTypeRestrictionTooltip,
  PlanLimitRestrictionTooltip 
} from '@/components/errors'

function CreateUserButton() {
  const { userType, canCreateUsers, planLimits } = useUserAccess()
  
  if (!canCreateUsers) {
    return (
      <UserTypeRestrictionTooltip
        userType={userType}
        requiredUserType={UserType.ORG_ADMIN}
        onRequestAccess={() => requestPermission('create_users')}
      >
        <Button disabled>
          Criar Usuário
          <Badge variant="secondary">Admin</Badge>
        </Button>
      </UserTypeRestrictionTooltip>
    )
  }
  
  if (planLimits?.currentUsage.users >= planLimits?.maxUsers) {
    return (
      <PlanLimitRestrictionTooltip
        planLimitAction="create_user"
        currentUsage={planLimits.currentUsage.users}
        limit={planLimits.maxUsers}
        onUpgrade={() => router.push('/billing')}
      >
        <Button disabled>
          Criar Usuário
          <Badge variant="destructive">Limite</Badge>
        </Button>
      </PlanLimitRestrictionTooltip>
    )
  }
  
  return <Button onClick={createUser}>Criar Usuário</Button>
}
```

### 4. Feedback de Limites de Plano

```tsx
import { PlanLimitFeedback } from '@/components/errors'

function Dashboard() {
  const { planLimits } = useUserAccess()
  
  return (
    <div>
      <PlanLimitFeedback
        limits={planLimits}
        variant="warning"
        onUpgrade={() => router.push('/billing/upgrade')}
        onDismiss={() => setShowLimitFeedback(false)}
      />
      
      {/* Versão compacta */}
      <PlanLimitFeedback
        limits={planLimits}
        compact={true}
        onUpgrade={() => router.push('/billing')}
      />
    </div>
  )
}
```

### 5. Sistema de Notificações

```tsx
import { 
  usePermissionNotificationHelpers,
  PermissionNotificationList,
  PermissionNotificationBadge 
} from '@/components/errors'

function Header() {
  const { unreadCount } = usePermissionNotifications()
  
  return (
    <div className="header">
      <Button variant="ghost" onClick={openNotifications}>
        <Bell className="h-4 w-4" />
        <PermissionNotificationBadge />
      </Button>
    </div>
  )
}

function NotificationPanel() {
  return (
    <div className="notification-panel">
      <PermissionNotificationList />
    </div>
  )
}

// Disparar notificações programaticamente
function usePermissionChanges() {
  const helpers = usePermissionNotificationHelpers()
  
  const grantClientAccess = async (userId, clientId, clientName) => {
    await api.grantAccess(userId, clientId)
    helpers.notifyClientAccessGranted(clientName, clientId)
  }
  
  return { grantClientAccess }
}
```

### 6. Hook Integrado

```tsx
import { useUserAccessEnhanced } from '@/hooks/use-user-access-enhanced'

function MyComponent() {
  const {
    userType,
    planLimits,
    canCreateUsers,
    hasClientAccess,
    validatePlanLimit,
    lastError,
    clearError
  } = useUserAccessEnhanced({
    enableNotifications: true,
    enableErrorHandling: true,
    autoRefresh: true
  })
  
  const handleCreateUser = async () => {
    const validation = await validatePlanLimit('create_user')
    if (!validation.valid) {
      // Error será tratado automaticamente
      return
    }
    
    // Prosseguir com criação
    await createUser()
  }
  
  return (
    <div>
      {lastError && (
        <AccessControlErrorDisplay
          error={lastError}
          onRetry={clearError}
        />
      )}
      
      <Button 
        onClick={handleCreateUser}
        disabled={!canCreateUsers}
      >
        Criar Usuário
      </Button>
    </div>
  )
}
```

## Tipos de Erro Suportados

### Códigos de Erro

```typescript
enum AccessControlErrorCode {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Authorization  
  FORBIDDEN = 'FORBIDDEN',
  USER_TYPE_NOT_ALLOWED = 'USER_TYPE_NOT_ALLOWED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  CLIENT_ACCESS_DENIED = 'CLIENT_ACCESS_DENIED',
  
  // Plan Limits
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_INACTIVE = 'SUBSCRIPTION_INACTIVE',
  
  // Validation
  CLIENT_ID_REQUIRED = 'CLIENT_ID_REQUIRED',
  INVALID_ORGANIZATION = 'INVALID_ORGANIZATION',
  NO_ORGANIZATION = 'NO_ORGANIZATION',
  SAME_ORG_VIOLATION = 'SAME_ORG_VIOLATION',
  DUPLICATE_MEMBERSHIP = 'DUPLICATE_MEMBERSHIP',
  
  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}
```

### Severidade dos Erros

- **Low**: Erros menores que não impedem o uso básico
- **Medium**: Erros que limitam funcionalidades mas são recuperáveis  
- **High**: Erros que bloqueiam funcionalidades importantes
- **Critical**: Erros que impedem o uso do sistema

## Personalização

### Mensagens Customizadas

```tsx
const customError = AccessControlErrorHandler.handleError({
  response: {
    status: 403,
    data: {
      code: 'USER_TYPE_NOT_ALLOWED',
      message: 'Mensagem customizada do servidor'
    }
  }
})
```

### Ações Customizadas

```tsx
<AccessControlErrorDisplay
  error={error}
  onRetry={customRetryHandler}
  onUpgrade={customUpgradeHandler}
  onContact={customContactHandler}
/>
```

### Tooltips Customizados

```tsx
<RestrictionTooltip
  restrictionType="permission"
  customMessage="Esta funcionalidade requer aprovação especial"
  onRequestAccess={requestSpecialPermission}
>
  <Button disabled>Funcionalidade Especial</Button>
</RestrictionTooltip>
```

## Monitoramento e Logs

O sistema automaticamente registra erros para monitoramento:

```typescript
// Logs são enviados para /api/monitoring/access-control-errors
{
  error: AccessControlError,
  originalError: Error,
  context: {
    timestamp: string,
    userAgent: string,
    url: string,
    referrer: string
  }
}
```

## Testes

Para testar o sistema de erro, use o componente de demonstração:

```tsx
import ErrorHandlingDemo from '@/components/examples/error-handling-demo'

// Acesse /demo/error-handling para ver todos os componentes em ação
```

## Requisitos Atendidos

- ✅ **6.1**: Mensagens de erro específicas por tipo de restrição
- ✅ **9.4**: Feedback visual claro sobre limitações
- ✅ **9.5**: Notificações de mudanças de permissão

## Próximos Passos

1. **Integração com Analytics**: Rastrear padrões de erro para melhorar UX
2. **A/B Testing**: Testar diferentes mensagens de erro
3. **Internacionalização**: Suporte a múltiplos idiomas
4. **Acessibilidade**: Melhorar suporte a screen readers
5. **Performance**: Otimizar cache e lazy loading de componentes