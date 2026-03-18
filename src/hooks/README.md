# User Access Control Hooks

Este documento descreve os hooks customizados para controle de acesso hierárquico implementados conforme os requisitos do sistema.

## Visão Geral

O sistema de controle de acesso foi refatorado para usar hooks individuais e especializados ao invés de um hook monolítico. Isso oferece:

- **Melhor performance**: Cada hook carrega apenas os dados necessários
- **Cache inteligente**: Cache automático com TTL configurável e invalidação granular
- **Reutilização**: Hooks podem ser usados independentemente
- **Manutenibilidade**: Código mais limpo e fácil de manter

## Hooks Disponíveis

### 1. `useUserAccess()` - Hook Base

Hook principal que gerencia autenticação e fornece funções básicas de acesso.

```typescript
const {
  currentUser,           // Usuário autenticado atual
  loading,              // Estado de carregamento
  error,                // Erro se houver
  refresh,              // Função para recarregar dados
  checkPermission,      // Verificar permissão específica
  hasClientAccess,      // Verificar acesso a cliente
  getUserAccessibleClients // Obter lista de clientes acessíveis
} = useUserAccess()
```

**Quando usar**: Como base para outros hooks ou quando precisar de funções de acesso básicas.

### 2. `useUserType()` - Tipo de Usuário

Hook especializado para gerenciar o tipo de usuário (Super Admin, Org Admin, Common User).

```typescript
const {
  userType,             // UserType enum
  loading,              // Estado de carregamento
  error,                // Erro se houver
  refresh,              // Recarregar tipo de usuário
  isSuperAdmin,         // Boolean: é super admin?
  isOrgAdmin,           // Boolean: é admin de organização?
  isCommonUser          // Boolean: é usuário comum?
} = useUserType()
```

**Cache**: 5 minutos TTL  
**Quando usar**: Para mostrar indicadores de tipo de usuário, controlar visibilidade de funcionalidades.

**Exemplo**:
```typescript
function AdminButton() {
  const { isOrgAdmin, isSuperAdmin } = useUserType()
  
  if (!isOrgAdmin && !isSuperAdmin) {
    return null // Ocultar para usuários comuns
  }
  
  return <Button>Gerenciar Usuários</Button>
}
```

### 3. `useClientAccess()` - Acesso a Clientes

Hook para gerenciar acesso a clientes específicos.

```typescript
const {
  accessibleClients,    // Array de clientes acessíveis
  loading,              // Estado de carregamento
  error,                // Erro se houver
  refresh,              // Recarregar lista de clientes
  checkClientAccess,    // Verificar acesso a cliente específico
  hasAccessToClient     // Alias para checkClientAccess
} = useClientAccess()
```

**Cache**: 2 minutos TTL  
**Quando usar**: Para filtrar dados por cliente, mostrar seletores de cliente.

**Exemplo**:
```typescript
function ClientSelector() {
  const { accessibleClients, loading } = useClientAccess()
  
  if (loading) return <Skeleton />
  
  return (
    <Select>
      {accessibleClients.map(client => (
        <SelectItem key={client.id} value={client.id}>
          {client.name}
        </SelectItem>
      ))}
    </Select>
  )
}
```

### 4. `usePlanLimits()` - Limites do Plano

Hook para gerenciar limites de plano e permissões de criação.

```typescript
const {
  planLimits,           // Objeto com limites e uso atual
  organizationId,       // ID da organização do usuário
  hasActiveSubscription, // Boolean: assinatura ativa?
  loading,              // Estado de carregamento
  error,                // Erro se houver
  refresh,              // Recarregar limites
  canCreateUsers,       // Boolean: pode criar usuários?
  canCreateClients,     // Boolean: pode criar clientes?
  canCreateConnections, // Boolean: pode criar conexões?
  canCreateCampaigns    // Boolean: pode criar campanhas?
} = usePlanLimits()
```

**Cache**: 10 minutos TTL  
**Quando usar**: Para controlar criação de recursos, mostrar limites de plano.

**Exemplo**:
```typescript
function AddClientButton() {
  const { canCreateClients, planLimits } = usePlanLimits()
  
  if (!canCreateClients) {
    return (
      <PlanLimitMessage 
        feature="clients" 
        action="adicionar cliente"
      />
    )
  }
  
  return <Button>Adicionar Cliente</Button>
}
```

### 5. `useAccessControlCache()` - Gerenciamento de Cache

Hook para controlar o cache dos dados de acesso.

```typescript
const {
  invalidateAll,        // Limpar todo o cache
  invalidateUser,       // Limpar cache do usuário atual
  invalidateUserType,   // Limpar cache de tipo de usuário
  invalidateClientAccess, // Limpar cache de acesso a clientes
  invalidatePlanLimits  // Limpar cache de limites (orgId opcional)
} = useAccessControlCache()
```

**Quando usar**: Após mudanças de permissão, criação de recursos, mudanças de plano.

**Exemplo**:
```typescript
function UserManagementPanel() {
  const { invalidateUser } = useAccessControlCache()
  
  const handleUserCreated = () => {
    // Invalidar cache após criar usuário
    invalidateUser()
    toast.success('Usuário criado com sucesso!')
  }
  
  return <CreateUserDialog onSuccess={handleUserCreated} />
}
```

## Hooks de Conveniência

Para compatibilidade e conveniência, também estão disponíveis:

```typescript
// Verificações rápidas de tipo de usuário
const isSuperAdmin = useIsSuperAdmin()
const isOrgAdmin = useIsOrgAdmin()
const isCommonUser = useIsCommonUser()
```

## Migração do Hook Antigo

Se você estava usando `useUserAccessNew()`, pode migrar gradualmente:

### Antes:
```typescript
const {
  userType,
  planLimits,
  canCreateClients,
  hasClientAccess,
  getUserAccessibleClients
} = useUserAccessNew()
```

### Depois:
```typescript
const { userType } = useUserType()
const { planLimits, canCreateClients } = usePlanLimits()
const { hasClientAccess, getUserAccessibleClients } = useClientAccess()
```

## Cache e Performance

### Configuração de TTL

- **User Type**: 5 minutos (muda raramente)
- **Plan Limits**: 10 minutos (muda ocasionalmente)
- **Client Access**: 2 minutos (pode mudar frequentemente)

### Invalidação Automática

O cache é automaticamente invalidado quando:
- Usuário faz login/logout
- Mudanças de autenticação são detectadas

### Invalidação Manual

Use `useAccessControlCache()` para invalidar cache após:
- Criar/editar usuários
- Conceder/revogar acesso a clientes
- Mudanças de plano
- Operações administrativas

## Padrões de Uso

### 1. Controle de Visibilidade

```typescript
function AdminOnlyFeature() {
  const { isOrgAdmin, isSuperAdmin } = useUserType()
  
  if (!isOrgAdmin && !isSuperAdmin) {
    return null
  }
  
  return <AdminPanel />
}
```

### 2. Validação de Limites

```typescript
function CreateResourceButton({ resourceType }) {
  const { canCreateClients, canCreateUsers } = usePlanLimits()
  
  const canCreate = resourceType === 'client' ? canCreateClients : canCreateUsers
  
  return (
    <Button disabled={!canCreate}>
      {canCreate ? 'Criar' : 'Limite Atingido'}
    </Button>
  )
}
```

### 3. Filtro por Cliente

```typescript
function CampaignList() {
  const { accessibleClients } = useClientAccess()
  const [selectedClient, setSelectedClient] = useState(null)
  
  const filteredCampaigns = campaigns.filter(campaign =>
    accessibleClients.some(client => client.id === campaign.clientId)
  )
  
  return <CampaignTable campaigns={filteredCampaigns} />
}
```

### 4. Invalidação Após Mudanças

```typescript
function UserManagement() {
  const { invalidateUser, invalidatePlanLimits } = useAccessControlCache()
  
  const handleUserCreated = () => {
    invalidateUser() // Recarregar dados do usuário
    invalidatePlanLimits() // Recarregar limites (uso aumentou)
  }
  
  return <CreateUserForm onSuccess={handleUserCreated} />
}
```

## Tratamento de Erros

Todos os hooks fornecem tratamento de erro consistente:

```typescript
function MyComponent() {
  const { userType, loading, error } = useUserType()
  
  if (loading) return <Skeleton />
  if (error) return <ErrorMessage error={error} />
  
  return <div>User type: {userType}</div>
}
```

## Compatibilidade

O hook antigo `useUserAccessNew()` ainda está disponível para compatibilidade, mas é recomendado migrar para os novos hooks individuais para melhor performance e manutenibilidade.

## Requisitos Atendidos

- ✅ **1.1**: Hook para obter tipo de usuário (`useUserType`)
- ✅ **5.1**: Hook para verificar acesso a clientes (`useClientAccess`)
- ✅ **4.5**: Hook para mostrar limites e uso (`usePlanLimits`)
- ✅ **Cache**: Cache automático com TTL configurável
- ✅ **Invalidação**: Invalidação automática e manual do cache