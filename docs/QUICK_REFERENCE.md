# Referência Rápida - Sistema de Controle de Acesso

## 🚀 Comandos Essenciais

### Diagnóstico Rápido
```bash
# Verificar usuário específico
node scripts/diagnose-user-access.js usuario@exemplo.com

# Verificar Super Admin
node scripts/diagnose-super-admin.js admin@exemplo.com

# Status geral do sistema
node scripts/system-health-check.js

# Verificar cache
node scripts/cache-diagnostics.js
```

### Manutenção de Cache
```bash
# Limpar cache de usuário
node scripts/clear-user-access-cache.js USER_ID

# Limpar cache de organização
node scripts/clear-organization-cache.js ORG_ID

# Limpar todo o cache
node scripts/clear-all-cache.js
```

## 🔍 Queries SQL Úteis

### Verificar Tipo de Usuário
```sql
-- Verificar se é Super Admin
SELECT sa.is_active, u.email
FROM super_admins sa
JOIN auth.users u ON u.id = sa.user_id
WHERE u.email = 'usuario@exemplo.com';

-- Verificar membership
SELECT m.role, o.name as org_name
FROM memberships m
JOIN organizations o ON o.id = m.organization_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'usuario@exemplo.com';
```

### Verificar Acessos a Clientes
```sql
-- Listar acessos de um usuário
SELECT c.name, uca.permissions, uca.created_at
FROM user_client_access uca
JOIN clients c ON c.id = uca.client_id
JOIN auth.users u ON u.id = uca.user_id
WHERE u.email = 'usuario@exemplo.com'
AND uca.is_active = true;
```

### Verificar Limites de Plano
```sql
-- Status de uso da organização
SELECT 
  o.name,
  COUNT(DISTINCT m.user_id) as users,
  COUNT(DISTINCT c.id) as clients,
  s.max_users,
  s.max_clients
FROM organizations o
LEFT JOIN memberships m ON m.organization_id = o.id
LEFT JOIN clients c ON c.org_id = o.id
LEFT JOIN subscriptions s ON s.organization_id = o.id
WHERE o.id = 'ORG_ID'
GROUP BY o.id, o.name, s.max_users, s.max_clients;
```

## 🛠️ APIs Essenciais

### Verificar Permissões
```typescript
// GET /api/user/type
{
  "userType": "org_admin",
  "organizations": [{"id": "uuid", "role": "admin"}],
  "permissions": {
    "canManageUsers": true,
    "canCreateClients": true
  }
}
```

### Criar Usuário
```typescript
// POST /api/admin/users
{
  "email": "novo@usuario.com",
  "name": "Novo Usuário",
  "role": "member"
}
```

### Conceder Acesso a Cliente
```typescript
// POST /api/admin/user-client-access
{
  "userId": "uuid",
  "clientId": "uuid",
  "permissions": {"read": true, "write": false}
}
```

## 🎣 React Hooks

### useUserAccess
```typescript
import { useUserAccess } from '@/hooks/use-user-access'

function MyComponent() {
  const { userType, canManageUsers, canCreateClients } = useUserAccess()
  
  if (userType === 'super_admin') {
    return <SuperAdminDashboard />
  }
  
  return (
    <div>
      {canManageUsers && <UserManagementPanel />}
      {canCreateClients && <CreateClientButton />}
    </div>
  )
}
```

### useClientAccess
```typescript
import { useClientAccess } from '@/hooks/use-client-access'

function ClientDashboard({ clientId }: { clientId: string }) {
  const { hasAccess, permissions, loading } = useClientAccess(clientId)
  
  if (loading) return <Loading />
  if (!hasAccess) return <AccessDenied />
  
  return (
    <div>
      <ClientData clientId={clientId} />
      {permissions.write && <EditButton />}
    </div>
  )
}
```

## 🔒 Middleware

### Proteger Rotas de API
```typescript
import { requireOrgAdmin, requireClientAccess } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  // Verificar se é admin
  const adminCheck = await requireOrgAdmin(request)
  if (!adminCheck.success) {
    return NextResponse.json(adminCheck.error, { status: 403 })
  }

  // Verificar acesso ao cliente
  const clientId = request.nextUrl.searchParams.get('clientId')
  const accessCheck = await requireClientAccess(clientId)(request)
  if (!accessCheck.success) {
    return NextResponse.json(accessCheck.error, { status: 403 })
  }

  // Processar requisição...
}
```

## 🚨 Códigos de Erro Comuns

| Código | Significado | Ação |
|--------|-------------|------|
| `UNAUTHORIZED` | Token inválido | Fazer login |
| `FORBIDDEN` | Sem permissão | Verificar tipo de usuário |
| `PLAN_LIMIT_EXCEEDED` | Limite atingido | Upgrade do plano |
| `CLIENT_ACCESS_DENIED` | Sem acesso ao cliente | Solicitar acesso |
| `SAME_ORG_VIOLATION` | Orgs diferentes | Verificar IDs |

## 🔧 Troubleshooting Rápido

### Usuário não consegue acessar
1. Verificar se existe: `SELECT * FROM auth.users WHERE email = '...'`
2. Verificar membership: `SELECT * FROM memberships WHERE user_id = '...'`
3. Limpar cache: `node scripts/clear-user-access-cache.js USER_ID`

### Super Admin não funciona
1. Verificar registro: `SELECT * FROM super_admins WHERE user_id = '...'`
2. Verificar se ativo: `SELECT is_active FROM super_admins WHERE user_id = '...'`
3. Limpar cache: `node scripts/clear-user-type-cache.js USER_ID`

### Limite de plano atingido
1. Verificar uso: `node scripts/check-plan-limits.js ORG_ID`
2. Remover usuários inativos
3. Contatar suporte comercial para upgrade

### Cache desatualizado
1. Limpar cache específico: `node scripts/clear-user-access-cache.js USER_ID`
2. Limpar cache geral: `node scripts/clear-all-cache.js`
3. Verificar TTL: `node scripts/cache-diagnostics.js`

## 📱 Contatos Rápidos

- **Suporte Técnico**: tech-support@empresa.com
- **Emergência**: emergency@empresa.com / +55 11 9999-9999
- **Comercial**: vendas@empresa.com / (11) 1234-5678
- **Slack**: #user-access-support

## 📋 Checklist de Deploy

### Antes do Deploy
- [ ] Executar `node scripts/system-health-check.js`
- [ ] Verificar RLS policies: `node scripts/check-rls-policies.js`
- [ ] Testar Super Admin: `node scripts/test-super-admin-permissions.js`
- [ ] Backup de configurações: `node scripts/backup-super-admin-config.js`

### Após o Deploy
- [ ] Verificar logs de erro
- [ ] Testar login de diferentes tipos de usuário
- [ ] Verificar cache funcionando: `node scripts/cache-diagnostics.js`
- [ ] Monitorar métricas de performance

### Em Caso de Problema
- [ ] Executar diagnóstico: `node scripts/system-health-check.js`
- [ ] Verificar logs de auditoria
- [ ] Limpar cache se necessário
- [ ] Rollback se crítico

---

**💡 Dica**: Mantenha esta referência sempre à mão durante desenvolvimento e troubleshooting!