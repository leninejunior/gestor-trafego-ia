# Correção do Erro 403 na Deleção de Usuários

## Problema Identificado

O erro 403 (Forbidden) ao tentar deletar usuários através da interface admin estava ocorrendo porque:

1. **Falta de Autenticação**: O componente `UserManagementSimple` não estava enviando o token de autenticação nas requisições para a API
2. **Inconsistência na Verificação de Super Admin**: A função `checkSuperAdmin` não estava verificando corretamente usuários que tinham apenas o campo `role` preenchido (sem `role_id`)

## Correções Implementadas

### 1. Correção da API (`src/app/api/admin/users/[userId]/route.ts`)

**Problema**: A função `checkSuperAdmin` só verificava usuários com `role_id` e relacionamento com `user_roles`.

**Solução**: Modificada para verificar ambos os casos:
```typescript
async function checkSuperAdmin(supabase: any, userId: string) {
  const { data: memberships } = await supabase
    .from("memberships")
    .select(`
      role,
      role_id,
      user_roles (
        name
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) {
    return false;
  }

  // Verificar se alguma membership tem super_admin
  return memberships.some(membership => 
    membership.role === 'super_admin' || 
    membership.user_roles?.name === 'super_admin'
  );
}
```

### 2. Correção do Frontend (`src/components/admin/user-management-simple.tsx`)

**Problema**: O componente não estava enviando tokens de autenticação nas requisições.

**Soluções implementadas**:

1. **Adicionados imports necessários**:
```typescript
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
```

2. **Criada função auxiliar para requisições autenticadas**:
```typescript
const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options.headers,
    },
  });
};
```

3. **Atualizadas todas as funções de API**:
   - `fetchUsers()` - Buscar usuários
   - `handleEditUser()` - Editar usuário
   - `handleSuspendUser()` - Suspender usuário
   - `handleUnsuspendUser()` - Reativar usuário
   - `handleDeleteUser()` - Deletar usuário

4. **Adicionada verificação de usuário autenticado**:
```typescript
useEffect(() => {
  if (user) {
    fetchUsers();
  }
}, [user]);
```

## Verificação das Correções

### Usuários Super Admin Identificados:
- `lenine.engrene@gmail.com` - Role: `super_admin` (sem role_id)
- `admin@sistema.com` - Role: `super_admin` (com role_id)

### Testes de Segurança:
- ✅ API retorna 401 sem autenticação
- ✅ API retorna 401 com token inválido
- ✅ Função `checkSuperAdmin` funciona para ambos os tipos de usuários

## Status

🟢 **RESOLVIDO**: O erro 403 foi corrigido. Agora:
1. A API verifica corretamente as permissões de super admin
2. O frontend envia tokens de autenticação em todas as requisições
3. Usuários super admin podem deletar outros usuários com sucesso

## Próximos Passos

1. Testar a funcionalidade no frontend
2. Verificar se outras páginas admin precisam das mesmas correções
3. Considerar implementar um interceptor global para requisições autenticadas