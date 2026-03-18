# Sistema de Controle de Acesso - Guia Rápido

**Última Atualização:** 02/01/2026  
**Status:** ✅ PRODUÇÃO

## 🚀 Início Rápido

### 3 Tipos de Usuário

```
┌─────────────────┬──────────────────┬─────────────────┐
│  MASTER USER    │  REGULAR USER    │  CLIENT USER    │
├─────────────────┼──────────────────┼─────────────────┤
│ Acesso Total    │ Limitado Plano   │ Read-Only       │
│ Sem Limites     │ Precisa Plano    │ Sem Plano       │
│ Gerencia Tudo   │ Gerencia Org     │ Vê Próprio      │
└─────────────────┴──────────────────┴─────────────────┘
```

## 💻 Uso em APIs

### Proteger Rota com Middleware

```typescript
import { createAccessControl } from '@/lib/middleware/user-access-middleware'

// Apenas leitura de campanhas
export const GET = createAccessControl.readCampaigns()(
  async (request, context) => {
    const { user, userType, clientId } = context
    // Sua lógica aqui
  }
)

// Criar cliente (valida limite do plano)
export const POST = createAccessControl.createClient()(
  async (request, context) => {
    const { user, organizationId } = context
    // Sua lógica aqui
  }
)

// Apenas super admins
import { requireSuperAdmin } from '@/lib/middleware/user-access-middleware'

export const DELETE = requireSuperAdmin()(
  async (request, context) => {
    // Apenas masters podem acessar
  }
)
```

### Verificar Permissões Manualmente

```typescript
import { UserAccessControlService } from '@/lib/services/user-access-control'

const accessControl = new UserAccessControlService()

// Verificar tipo de usuário
const userType = await accessControl.getUserType(userId)

// Verificar se é master
const isMaster = await accessControl.isSuperAdmin(userId)

// Verificar permissão específica
const result = await accessControl.checkPermission(
  userId,
  'campaigns',  // resource
  'read',       // action
  clientId      // optional
)

if (!result.allowed) {
  return NextResponse.json(
    { error: result.reason },
    { status: 403 }
  )
}

// Verificar acesso a cliente
const hasAccess = await accessControl.hasClientAccess(userId, clientId)

// Obter clientes acessíveis
const clients = await accessControl.getUserAccessibleClients(userId)

// Validar limite de plano
const validation = await accessControl.validateActionAgainstLimits(
  orgId,
  'create_client'
)

if (!validation.valid) {
  return NextResponse.json(
    { 
      error: validation.reason,
      currentUsage: validation.currentUsage,
      limit: validation.limit
    },
    { status: 402 }
  )
}
```

## 🎨 Uso em Componentes React

### Hook useUserAccessControl

```typescript
import { useUserAccessControl } from '@/lib/services/user-access-control'

function MyComponent() {
  const {
    getUserType,
    isSuperAdmin,
    checkPermission,
    getUserAccessibleClients,
    validateActionAgainstLimits
  } = useUserAccessControl()

  const [userType, setUserType] = useState<UserType | null>(null)

  useEffect(() => {
    async function loadUserType() {
      const type = await getUserType(userId)
      setUserType(type)
    }
    loadUserType()
  }, [userId])

  // Renderização condicional
  if (userType === 'master') {
    return <AdminPanel />
  }

  if (userType === 'client') {
    return <ClientView />
  }

  return <RegularUserView />
}
```

### Componente UserTypeBadge

```typescript
import { UserTypeBadge } from '@/components/ui/user-access-indicator'

function UserList() {
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>
          <span>{user.name}</span>
          <UserTypeBadge userType={user.type} />
        </div>
      ))}
    </div>
  )
}
```

## 🗄️ Consultas SQL Diretas

### Verificar Tipo de Usuário

```sql
-- Obter tipo de usuário
SELECT get_user_type('USER_ID_AQUI');

-- Resultado: 'master', 'regular' ou 'client'
```

### Verificar Permissões

```sql
-- Verificar se usuário pode acessar recurso
SELECT check_user_permissions(
  'USER_ID_AQUI',
  'campaigns',  -- resource_type
  'read',       -- action
  'CLIENT_ID_AQUI'  -- client_id (opcional)
);

-- Resultado: true ou false
```

### Obter Limites

```sql
-- Obter limites do usuário
SELECT get_user_limits('USER_ID_AQUI');

-- Resultado (JSONB):
-- Master: {"unlimited": true, ...}
-- Client: {"read_only": true, "max_clients": 1, ...}
-- Regular: limites do plano
```

### Criar Usuário Master

```sql
-- Adicionar usuário como master
INSERT INTO master_users (user_id, created_by, notes)
VALUES (
  'USER_ID_AQUI',
  'ADMIN_ID_AQUI',
  'Motivo da promoção'
);
```

### Criar Usuário Cliente

```sql
-- Adicionar usuário como cliente
INSERT INTO client_users (user_id, client_id, created_by, permissions)
VALUES (
  'USER_ID_AQUI',
  'CLIENT_ID_AQUI',
  'ADMIN_ID_AQUI',
  '{"read_campaigns": true, "read_reports": true, "read_insights": true}'::jsonb
);
```

## 🔍 Middlewares Disponíveis

### Controle de Acesso Geral

```typescript
import { createAccessControl } from '@/lib/middleware/user-access-middleware'

// Leitura de campanhas
createAccessControl.readCampaigns()

// Escrita de campanhas (apenas admins)
createAccessControl.writeCampaigns()

// Leitura de relatórios
createAccessControl.readReports()

// Criar usuário (valida limite)
createAccessControl.createUser()

// Criar cliente (valida limite)
createAccessControl.createClient()

// Criar conexão (valida limite)
createAccessControl.createConnection()

// Gerenciar usuários
createAccessControl.manageUsers()

// Gerenciar acesso a clientes
createAccessControl.manageClientAccess()
```

### Controle por Tipo de Usuário

```typescript
import { 
  requireSuperAdmin,
  requireOrgAdmin,
  requireAnyAdmin,
  requireClientAccess
} from '@/lib/middleware/user-access-middleware'

// Apenas super admins
requireSuperAdmin('Acesso restrito')

// Apenas admins de organização
requireOrgAdmin('Apenas admins')

// Qualquer tipo de admin
requireAnyAdmin('Requer admin')

// Requer acesso ao cliente
requireClientAccess('Sem acesso ao cliente')
```

### Middleware Customizado

```typescript
import { withUserAccessControl } from '@/lib/middleware/user-access-middleware'

export const GET = withUserAccessControl({
  resourceType: 'campaigns',
  action: 'read',
  requireClientId: true,
  allowedUserTypes: ['master', 'regular'],
  validatePlanLimit: 'create_campaign',
  errorMessage: 'Acesso negado'
})(async (request, context) => {
  // Sua lógica aqui
})
```

## 📊 Tipos TypeScript

### UserType

```typescript
enum UserType {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  COMMON_USER = 'common_user'
}
```

### ResourceType

```typescript
type ResourceType = 
  | 'users' 
  | 'clients' 
  | 'connections' 
  | 'campaigns' 
  | 'reports'
```

### Action

```typescript
type Action = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete'
```

### LimitedAction

```typescript
type LimitedAction = 
  | 'create_user' 
  | 'create_client' 
  | 'create_connection' 
  | 'create_campaign'
```

### PermissionResult

```typescript
interface PermissionResult {
  allowed: boolean
  reason?: string
  userType: UserType
  limits?: PlanLimits
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean
  reason?: string
  currentUsage?: number
  limit?: number
}
```

### PlanLimits

```typescript
interface PlanLimits {
  maxUsers: number | null
  maxClients: number | null
  maxConnections: number | null
  maxCampaigns: number | null
  currentUsage: {
    users: number
    clients: number
    connections: number
    campaigns: number
  }
}
```

## 🎯 Exemplos Práticos

### Exemplo 1: API de Campanhas

```typescript
// src/app/api/campaigns/route.ts
import { createAccessControl } from '@/lib/middleware/user-access-middleware'

export const GET = createAccessControl.readCampaigns()(
  async (request, context) => {
    const { user, userType, clientId } = context

    // Obter campanhas baseado no tipo de usuário
    let campaigns
    
    if (userType === 'master') {
      // Master vê todas
      campaigns = await getAllCampaigns()
    } else if (userType === 'client') {
      // Client vê apenas do próprio cliente
      campaigns = await getCampaignsByClient(clientId!)
    } else {
      // Regular vê da organização
      campaigns = await getCampaignsByOrg(context.organizationId!)
    }

    return NextResponse.json({ campaigns })
  }
)

export const POST = createAccessControl.writeCampaigns()(
  async (request, context) => {
    const { user, organizationId } = context
    const body = await request.json()

    // Validar limite de campanhas
    const validation = await context.validateActionAgainstLimits!(
      organizationId!,
      'create_campaign'
    )

    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: validation.reason,
          upgradeRequired: true
        },
        { status: 402 }
      )
    }

    // Criar campanha
    const campaign = await createCampaign(body)
    return NextResponse.json({ campaign })
  }
)
```

### Exemplo 2: Componente de Dashboard

```typescript
// src/components/dashboard/campaign-list.tsx
import { useUserAccessControl } from '@/lib/services/user-access-control'
import { UserTypeBadge } from '@/components/ui/user-access-indicator'

export function CampaignList() {
  const { getUserType, getUserAccessibleClients } = useUserAccessControl()
  const [userType, setUserType] = useState<UserType | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    async function loadData() {
      const type = await getUserType(userId)
      setUserType(type)

      const accessibleClients = await getUserAccessibleClients(userId)
      setClients(accessibleClients)
    }
    loadData()
  }, [userId])

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1>Campanhas</h1>
        <UserTypeBadge userType={userType} />
      </div>

      {userType === 'master' && (
        <div className="text-sm text-muted-foreground">
          Você tem acesso a todas as campanhas
        </div>
      )}

      {userType === 'client' && (
        <div className="text-sm text-muted-foreground">
          Visualização apenas - sem permissão de edição
        </div>
      )}

      <div className="grid gap-4">
        {clients.map(client => (
          <ClientCampaigns key={client.id} client={client} />
        ))}
      </div>
    </div>
  )
}
```

### Exemplo 3: Verificação de Limite Antes de Criar

```typescript
// src/components/admin/create-client-dialog.tsx
import { useUserAccessControl } from '@/lib/services/user-access-control'

export function CreateClientDialog() {
  const { validateActionAgainstLimits } = useUserAccessControl()
  const [canCreate, setCanCreate] = useState(false)
  const [limitInfo, setLimitInfo] = useState<ValidationResult | null>(null)

  useEffect(() => {
    async function checkLimit() {
      const validation = await validateActionAgainstLimits(
        organizationId,
        'create_client'
      )
      setCanCreate(validation.valid)
      setLimitInfo(validation)
    }
    checkLimit()
  }, [organizationId])

  if (!canCreate) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Limite Atingido</AlertTitle>
        <AlertDescription>
          {limitInfo?.reason}
          <br />
          Uso atual: {limitInfo?.currentUsage} / {limitInfo?.limit}
          <br />
          <Button onClick={handleUpgrade}>
            Fazer Upgrade do Plano
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Dialog>
      {/* Formulário de criação */}
    </Dialog>
  )
}
```

## 🔒 Segurança

### Checklist de Segurança

- ✅ Sempre usar middleware em rotas de API
- ✅ Verificar tipo de usuário no backend, não apenas frontend
- ✅ Validar limites de plano antes de criar recursos
- ✅ Verificar acesso a cliente antes de retornar dados
- ✅ Usar RLS policies para isolamento de dados
- ✅ Nunca confiar apenas em verificações do frontend

### Boas Práticas

```typescript
// ❌ ERRADO - Apenas frontend
function MyComponent() {
  if (userType === 'master') {
    return <AdminPanel />
  }
}

// ✅ CORRETO - Backend + Frontend
export const GET = requireSuperAdmin()(
  async (request, context) => {
    // Backend verifica primeiro
    return NextResponse.json({ data })
  }
)

function MyComponent() {
  // Frontend também verifica para UX
  if (userType === 'master') {
    return <AdminPanel />
  }
}
```

## 📚 Documentação Completa

- 📄 `SISTEMA_CONTROLE_ACESSO_RESUMO_EXECUTIVO.md` - Resumo executivo
- 📄 `APLICAR_SISTEMA_CONTROLE_ACESSO.md` - Guia de aplicação
- 📄 `database/migrations/08-user-access-control-system.sql` - Schema SQL
- 📄 `src/lib/services/user-access-control.ts` - Serviço principal
- 📄 `src/lib/middleware/user-access-middleware.ts` - Middleware

## 🆘 Troubleshooting

### Erro: "Acesso negado"

```typescript
// Verificar tipo de usuário
const userType = await accessControl.getUserType(userId)
console.log('User type:', userType)

// Verificar permissão específica
const result = await accessControl.checkPermission(
  userId,
  'campaigns',
  'read',
  clientId
)
console.log('Permission result:', result)
```

### Erro: "Limite do plano atingido"

```typescript
// Verificar limites atuais
const limits = await accessControl.getOrganizationLimits(orgId)
console.log('Current limits:', limits)

// Verificar assinatura
const hasActive = await accessControl.hasActiveSubscription(orgId)
console.log('Has active subscription:', hasActive)
```

### Erro: "Client ID é obrigatório"

```typescript
// Sempre passar clientId quando necessário
export const GET = createAccessControl.readCampaigns(true)( // true = requireClientId
  async (request, context) => {
    const { clientId } = context // clientId estará disponível
  }
)
```

---

**Dúvidas?** Consulte a documentação completa ou entre em contato com a equipe de desenvolvimento.
