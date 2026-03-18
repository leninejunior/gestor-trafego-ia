# User Access Control Middleware

Este documento descreve como usar o sistema de middleware de controle de acesso hierárquico implementado conforme os requisitos do sistema.

## Visão Geral

O middleware implementa três níveis de usuários:
- **Super Admin**: Acesso total sem restrições
- **Organization Admin**: Gerencia usuários e clientes dentro da organização
- **Common User**: Acesso restrito aos clientes autorizados

## Importação

```typescript
import {
  withUserAccessControl,
  requireSuperAdmin,
  requireOrgAdmin,
  requireAnyAdmin,
  requireClientAccess,
  validatePlanLimit,
  createAccessControl
} from '@/lib/middleware'
```

## Uso Básico

### 1. Middleware Base - `withUserAccessControl`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withUserAccessControl } from '@/lib/middleware'

const handler = withUserAccessControl({
  resourceType: 'campaigns',
  action: 'read',
  requireClientId: true,
  allowedUserTypes: ['super_admin', 'org_admin', 'common_user']
})(async (request: NextRequest, context: AccessControlContext) => {
  // Seu código aqui
  // context contém: user, userType, clientId, organizationId, userLimits
  
  return NextResponse.json({ success: true })
})

export { handler as GET }
```

### 2. Helpers Específicos

#### Requer Super Admin
```typescript
const handler = requireSuperAdmin()(async (request, context) => {
  // Apenas super admins podem acessar
  return NextResponse.json({ message: 'Super admin area' })
})
```

#### Requer Admin de Organização
```typescript
const handler = requireOrgAdmin()(async (request, context) => {
  // Super admins e org admins podem acessar
  return NextResponse.json({ message: 'Admin area' })
})
```

#### Requer Acesso a Cliente
```typescript
const handler = requireClientAccess()(async (request, context) => {
  // Verifica se o usuário tem acesso ao cliente especificado
  const { clientId } = context
  return NextResponse.json({ clientId })
})
```

#### Validar Limite de Plano
```typescript
const handler = validatePlanLimit('create_user')(async (request, context) => {
  // Verifica se a organização pode criar mais usuários
  return NextResponse.json({ message: 'User creation allowed' })
})
```

## Helpers Avançados - `createAccessControl`

### Leitura de Campanhas
```typescript
const handler = createAccessControl.readCampaigns()(async (request, context) => {
  // Usuários podem ler campanhas dos clientes autorizados
  return NextResponse.json({ campaigns: [] })
})
```

### Criação de Usuários
```typescript
const handler = createAccessControl.createUser()(async (request, context) => {
  // Apenas admins podem criar usuários, com validação de limite
  return NextResponse.json({ message: 'User created' })
})
```

### Criação de Clientes
```typescript
const handler = createAccessControl.createClient()(async (request, context) => {
  // Apenas admins podem criar clientes, com validação de limite
  return NextResponse.json({ message: 'Client created' })
})
```

## Exemplos Práticos

### API de Campanhas
```typescript
// src/app/api/campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAccessControl } from '@/lib/middleware'

// GET - Listar campanhas (requer acesso ao cliente)
export const GET = createAccessControl.readCampaigns()(
  async (request: NextRequest, context) => {
    const { clientId, userType } = context
    
    // Buscar campanhas do cliente
    const campaigns = await getCampaignsByClient(clientId!)
    
    return NextResponse.json({ campaigns, userType })
  }
)

// POST - Criar campanha (apenas admins)
export const POST = createAccessControl.writeCampaigns()(
  async (request: NextRequest, context) => {
    const { clientId, userType, organizationId } = context
    const body = await request.json()
    
    // Criar campanha
    const campaign = await createCampaign(clientId!, body)
    
    return NextResponse.json({ campaign })
  }
)
```

### API de Usuários
```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireOrgAdmin, validatePlanLimit } from '@/lib/middleware'

// GET - Listar usuários (apenas admins)
export const GET = requireOrgAdmin()(
  async (request: NextRequest, context) => {
    const { organizationId, userType } = context
    
    const users = await getUsersByOrganization(organizationId!)
    
    return NextResponse.json({ users })
  }
)

// POST - Criar usuário (admins + validação de limite)
export const POST = validatePlanLimit('create_user')(
  requireOrgAdmin()(
    async (request: NextRequest, context) => {
      const { organizationId } = context
      const userData = await request.json()
      
      const user = await createUser({ ...userData, organizationId })
      
      return NextResponse.json({ user })
    }
  )
)
```

### API Super Admin
```typescript
// src/app/api/super-admin/organizations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/middleware'

export const GET = requireSuperAdmin()(
  async (request: NextRequest, context) => {
    // Super admin pode ver todas as organizações
    const organizations = await getAllOrganizations()
    
    return NextResponse.json({ organizations })
  }
)
```

## Contexto do Middleware

O middleware adiciona informações ao contexto da requisição:

```typescript
interface AccessControlContext {
  user: any                    // Usuário autenticado
  userType: UserType          // Tipo do usuário
  userLimits?: any            // Limites do plano
  clientId?: string           // ID do cliente (se aplicável)
  organizationId?: string     // ID da organização
}
```

### Funções Utilitárias

```typescript
import {
  getUserFromAccessContext,
  isSuperAdminInContext,
  isOrgAdminInContext,
  isCommonUserInContext,
  getUserLimitsFromContext,
  getOrganizationFromContext
} from '@/lib/middleware'

const handler = requireOrgAdmin()(async (request, context) => {
  // Verificar tipo de usuário
  if (isSuperAdminInContext(context)) {
    // Lógica específica para super admin
  }
  
  // Obter limites do usuário
  const limits = getUserLimitsFromContext(context)
  
  // Obter organização
  const orgId = getOrganizationFromContext(context)
  
  return NextResponse.json({ limits, orgId })
})
```

## Tratamento de Erros

O middleware retorna erros padronizados:

### 401 - Não Autenticado
```json
{
  "error": "Autenticação necessária",
  "code": "UNAUTHORIZED"
}
```

### 403 - Acesso Negado
```json
{
  "error": "Acesso negado: tipo de usuário 'common_user' não permitido",
  "code": "USER_TYPE_NOT_ALLOWED",
  "userType": "common_user",
  "allowedTypes": ["super_admin", "org_admin"]
}
```

### 402 - Limite de Plano
```json
{
  "error": "Limite de usuários atingido",
  "code": "PLAN_LIMIT_EXCEEDED",
  "currentUsage": 5,
  "limit": 5,
  "upgradeRequired": true
}
```

### 400 - Client ID Obrigatório
```json
{
  "error": "Client ID é obrigatório para esta operação",
  "code": "CLIENT_ID_REQUIRED"
}
```

## Composição de Middlewares

Você pode compor múltiplos middlewares:

```typescript
const handler = requireOrgAdmin()(
  validatePlanLimit('create_client')(
    requireClientAccess()(
      async (request, context) => {
        // Múltiplas validações aplicadas
        return NextResponse.json({ success: true })
      }
    )
  )
)
```

## Middleware Customizado

Para casos específicos, use o middleware customizado:

```typescript
const customHandler = withUserAccessControl({
  resourceType: 'reports',
  action: 'read',
  requireClientId: true,
  allowedUserTypes: [UserType.SUPER_ADMIN, UserType.ORG_ADMIN],
  validatePlanLimit: 'create_campaign',
  errorMessage: 'Acesso negado para relatórios avançados'
})(async (request, context) => {
  // Lógica customizada
  return NextResponse.json({ data: 'custom' })
})
```

## Boas Práticas

1. **Sempre use o middleware apropriado** para cada endpoint
2. **Valide limites de plano** para operações de criação
3. **Extraia clientId** quando necessário para isolamento de dados
4. **Use helpers específicos** ao invés do middleware base quando possível
5. **Trate erros adequadamente** no frontend baseado nos códigos retornados
6. **Teste todos os cenários** de acesso (super admin, org admin, common user)

## Testes

Para testar o middleware:

```typescript
// Simular diferentes tipos de usuário
const mockSuperAdmin = { id: 'super-1', userType: 'super_admin' }
const mockOrgAdmin = { id: 'org-1', userType: 'org_admin' }
const mockCommonUser = { id: 'user-1', userType: 'common_user' }

// Testar acesso negado
expect(response.status).toBe(403)
expect(response.body.code).toBe('USER_TYPE_NOT_ALLOWED')

// Testar limite de plano
expect(response.status).toBe(402)
expect(response.body.code).toBe('PLAN_LIMIT_EXCEEDED')
```
