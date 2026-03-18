# APIs do Sistema de Controle de Acesso

## Visão Geral

Esta documentação descreve todas as APIs disponíveis no Sistema de Controle de Acesso Hierárquico, organizadas por funcionalidade e nível de permissão.

## Autenticação

Todas as APIs requerem autenticação via JWT token do Supabase:

```http
Authorization: Bearer <jwt_token>
```

## Tipos de Resposta

### Sucesso
```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada com sucesso"
}
```

### Erro
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Acesso negado",
    "details": {
      "userType": "common_user",
      "requiredPermission": "admin"
    }
  }
}
```

## APIs de Gerenciamento de Usuários

### Criar Usuário
**POST** `/api/admin/users`

Cria um novo usuário na organização (apenas org admin ou super admin).

**Permissões**: `org_admin`, `super_admin`

**Body**:
```json
{
  "email": "usuario@exemplo.com",
  "name": "Nome do Usuário",
  "role": "admin" | "member",
  "organizationId": "uuid" // Opcional para super admin
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome do Usuário",
    "userType": "common_user",
    "organizations": [
      {
        "id": "uuid",
        "name": "Organização",
        "role": "member"
      }
    ],
    "createdAt": "2024-12-22T10:00:00Z"
  }
}
```

**Códigos de Erro**:
- `400`: Dados inválidos
- `402`: Limite de usuários atingido
- `403`: Sem permissão
- `409`: Email já existe

### Atualizar Usuário
**PUT** `/api/admin/users/[userId]`

Atualiza informações de um usuário existente.

**Permissões**: `org_admin` (mesma org), `super_admin`

**Body**:
```json
{
  "name": "Novo Nome",
  "role": "admin" | "member",
  "isActive": true
}
```

### Excluir Usuário
**DELETE** `/api/admin/users/[userId]`

Remove um usuário e todos os seus acessos.

**Permissões**: `org_admin` (mesma org), `super_admin`

**Resposta**:
```json
{
  "success": true,
  "message": "Usuário excluído com sucesso",
  "data": {
    "deletedRecords": {
      "memberships": 1,
      "clientAccess": 3,
      "auditLogs": 15
    }
  }
}
```

### Listar Usuários
**GET** `/api/admin/users`

Lista usuários da organização com filtros opcionais.

**Permissões**: `org_admin`, `super_admin`

**Query Parameters**:
- `organizationId`: UUID da organização (obrigatório para org admin)
- `role`: `admin` | `member`
- `isActive`: `true` | `false`
- `page`: Número da página (default: 1)
- `limit`: Itens por página (default: 20)

**Resposta**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "usuario@exemplo.com",
        "name": "Nome",
        "userType": "common_user",
        "role": "member",
        "isActive": true,
        "lastLoginAt": "2024-12-22T09:30:00Z",
        "clientAccessCount": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

## APIs de Gerenciamento de Acesso a Clientes

### Conceder Acesso a Cliente
**POST** `/api/admin/user-client-access`

Concede acesso de um usuário a um cliente específico.

**Permissões**: `org_admin` (mesma org), `super_admin`

**Body**:
```json
{
  "userId": "uuid",
  "clientId": "uuid",
  "permissions": {
    "read": true,
    "write": false
  },
  "notes": "Acesso para campanha de Black Friday"
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "clientId": "uuid",
    "permissions": {
      "read": true,
      "write": false
    },
    "grantedBy": "uuid",
    "grantedAt": "2024-12-22T10:00:00Z"
  }
}
```

**Códigos de Erro**:
- `400`: Usuário e cliente não pertencem à mesma organização
- `403`: Sem permissão
- `409`: Acesso já existe

### Revogar Acesso
**DELETE** `/api/admin/user-client-access`

Remove o acesso de um usuário a um cliente.

**Body**:
```json
{
  "userId": "uuid",
  "clientId": "uuid"
}
```

### Listar Acessos do Usuário
**GET** `/api/admin/user-client-access/[userId]`

Lista todos os acessos de um usuário específico.

**Resposta**:
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "userName": "Nome do Usuário",
    "accesses": [
      {
        "clientId": "uuid",
        "clientName": "Cliente ABC",
        "permissions": {
          "read": true,
          "write": true
        },
        "grantedAt": "2024-12-20T14:30:00Z",
        "grantedBy": "uuid",
        "grantedByName": "Admin User"
      }
    ]
  }
}
```

## APIs de Super Admin

### Listar Todas as Organizações
**GET** `/api/super-admin/organizations`

Lista todas as organizações do sistema.

**Permissões**: `super_admin`

**Resposta**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Organização ABC",
      "userCount": 12,
      "clientCount": 8,
      "planType": "professional",
      "subscriptionStatus": "active",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Alterar Tipo de Usuário
**PUT** `/api/super-admin/users/change-type`

Altera o tipo de um usuário (promover/rebaixar).

**Permissões**: `super_admin`

**Body**:
```json
{
  "userId": "uuid",
  "newType": "org_admin" | "common_user",
  "organizationId": "uuid", // Para org_admin
  "reason": "Promoção por bom desempenho"
}
```

### Conceder Acesso Cross-Org
**POST** `/api/super-admin/access`

Concede acesso de usuário a cliente de outra organização.

**Permissões**: `super_admin`

**Body**:
```json
{
  "userId": "uuid",
  "clientId": "uuid",
  "permissions": {
    "read": true,
    "write": false
  },
  "reason": "Suporte técnico temporário"
}
```

### Estatísticas do Sistema
**GET** `/api/super-admin/stats`

Retorna estatísticas gerais do sistema.

**Resposta**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "totalOrganizations": 45,
    "totalClients": 380,
    "activeConnections": 125,
    "usersByType": {
      "super_admin": 3,
      "org_admin": 67,
      "common_user": 1180
    },
    "planDistribution": {
      "basic": 15,
      "professional": 25,
      "enterprise": 5
    }
  }
}
```

### Logs de Auditoria
**GET** `/api/super-admin/audit-logs`

Lista logs de auditoria com filtros.

**Query Parameters**:
- `userId`: Filtrar por usuário
- `operation`: Tipo de operação
- `startDate`: Data inicial (ISO 8601)
- `endDate`: Data final (ISO 8601)
- `success`: `true` | `false`
- `page`: Número da página
- `limit`: Itens por página

**Resposta**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "uuid",
        "userName": "Admin User",
        "operation": "user_create",
        "resourceType": "user",
        "resourceId": "uuid",
        "success": true,
        "metadata": {
          "targetUserId": "uuid",
          "organizationId": "uuid",
          "role": "member"
        },
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2024-12-22T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1250,
      "totalPages": 25
    }
  }
}
```

## APIs de Verificação de Acesso

### Verificar Tipo de Usuário
**GET** `/api/user/type`

Retorna o tipo do usuário atual.

**Resposta**:
```json
{
  "success": true,
  "data": {
    "userType": "org_admin",
    "organizations": [
      {
        "id": "uuid",
        "name": "Minha Organização",
        "role": "admin"
      }
    ],
    "permissions": {
      "canManageUsers": true,
      "canCreateClients": true,
      "canAccessAllClients": false
    }
  }
}
```

### Verificar Acesso a Cliente
**GET** `/api/user/client-access/[clientId]`

Verifica se o usuário atual tem acesso a um cliente específico.

**Resposta**:
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "permissions": {
      "read": true,
      "write": false
    },
    "grantedAt": "2024-12-20T14:30:00Z"
  }
}
```

### Listar Clientes Acessíveis
**GET** `/api/user/accessible-clients`

Lista todos os clientes que o usuário atual pode acessar.

**Resposta**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Cliente ABC",
      "organizationId": "uuid",
      "permissions": {
        "read": true,
        "write": true
      },
      "connectionCount": 3,
      "campaignCount": 15
    }
  ]
}
```

## Middleware de Controle de Acesso

### Funções Disponíveis

```typescript
// Verificar tipo de usuário
requireSuperAdmin()
requireOrgAdmin()
requireAnyAdmin()

// Verificar acesso a recursos
requireClientAccess(clientId: string)
requireOrganizationMembership(orgId: string)

// Validar limites de plano
validatePlanLimit(action: 'create_user' | 'create_client' | 'create_connection')
```

### Exemplo de Uso

```typescript
import { requireOrgAdmin, requireClientAccess } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  // Verificar se é admin da organização
  const adminCheck = await requireOrgAdmin(request)
  if (!adminCheck.success) {
    return NextResponse.json(adminCheck.error, { status: 403 })
  }

  // Verificar acesso ao cliente específico
  const clientId = request.nextUrl.searchParams.get('clientId')
  const accessCheck = await requireClientAccess(clientId)(request)
  if (!accessCheck.success) {
    return NextResponse.json(accessCheck.error, { status: 403 })
  }

  // Processar requisição...
}
```

## Códigos de Erro

| Código | Descrição | Ação Sugerida |
|--------|-----------|---------------|
| `UNAUTHORIZED` | Token inválido ou expirado | Fazer login novamente |
| `FORBIDDEN` | Sem permissão para a operação | Verificar tipo de usuário |
| `PLAN_LIMIT_EXCEEDED` | Limite do plano atingido | Fazer upgrade do plano |
| `INVALID_ORGANIZATION` | Organização não existe | Verificar ID da organização |
| `CLIENT_ACCESS_DENIED` | Sem acesso ao cliente | Solicitar acesso ao admin |
| `USER_NOT_FOUND` | Usuário não encontrado | Verificar ID do usuário |
| `DUPLICATE_MEMBERSHIP` | Membership já existe | Usar membership existente |
| `SAME_ORG_VIOLATION` | Usuário e cliente de orgs diferentes | Verificar organização |

## Rate Limiting

### Limites por Endpoint

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `/api/admin/users` (POST) | 10 req | 1 minuto |
| `/api/admin/user-client-access` | 50 req | 1 minuto |
| `/api/super-admin/*` | 100 req | 1 minuto |
| Outros endpoints | 200 req | 1 minuto |

### Headers de Rate Limit

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640188800
```

## Exemplos de Integração

### JavaScript/TypeScript

```typescript
class UserAccessAPI {
  private baseURL = '/api'
  private token: string

  constructor(token: string) {
    this.token = token
  }

  async createUser(userData: CreateUserData) {
    const response = await fetch(`${this.baseURL}/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error.message)
    }

    return response.json()
  }

  async grantClientAccess(userId: string, clientId: string) {
    const response = await fetch(`${this.baseURL}/admin/user-client-access`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        clientId,
        permissions: { read: true, write: false }
      })
    })

    return response.json()
  }
}
```

### cURL

```bash
# Criar usuário
curl -X POST /api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo@usuario.com",
    "name": "Novo Usuário",
    "role": "member"
  }'

# Conceder acesso a cliente
curl -X POST /api/admin/user-client-access \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "clientId": "client-uuid",
    "permissions": {"read": true, "write": false}
  }'
```

## Webhooks (Futuro)

### Eventos Disponíveis

- `user.created`: Usuário criado
- `user.updated`: Usuário atualizado
- `user.deleted`: Usuário excluído
- `access.granted`: Acesso concedido
- `access.revoked`: Acesso revogado
- `plan.limit_reached`: Limite do plano atingido

### Formato do Payload

```json
{
  "event": "user.created",
  "timestamp": "2024-12-22T10:00:00Z",
  "data": {
    "userId": "uuid",
    "organizationId": "uuid",
    "triggeredBy": "uuid"
  }
}
```

---

**Versão da API**: v1.0.0  
**Última atualização**: Dezembro 2024