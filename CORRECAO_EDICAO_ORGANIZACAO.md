# ✅ CORREÇÃO: Edição de Organização

## 🐛 Problema Identificado

O usuário não conseguia editar organizações através da interface admin.

### Causas:
1. **Tabela incorreta**: O código estava buscando na tabela `memberships` ao invés de `organization_members`
2. **Verificação de permissão falha**: A query não encontrava o membership do usuário
3. **Params não await**: Next.js 15 requer `await params` em rotas dinâmicas

## ✅ Correções Aplicadas

### 1. **API PUT - Atualizar Organização**
```typescript
// ANTES (ERRADO)
const { data: membership } = await supabase
  .from('memberships')  // ❌ Tabela errada
  .select('role')
  .eq('user_id', user.id)
  .single()

// DEPOIS (CORRETO)
const { data: membership } = await supabase
  .from('organization_members')  // ✅ Tabela correta
  .select('role')
  .eq('user_id', user.id)
  .eq('organization_id', orgId)  // ✅ Filtrar pela org específica
  .single()
```

### 2. **Verificação de Permissões Melhorada**
```typescript
// Permitir owner, admin OU email específico
const hasPermission = 
  membership?.role === 'owner' || 
  membership?.role === 'admin' ||
  user.email === 'lenine.engrene@gmail.com'

if (!hasPermission) {
  return NextResponse.json({ 
    error: 'Forbidden - Você não tem permissão para editar esta organização' 
  }, { status: 403 })
}
```

### 3. **Validação de Dados**
```typescript
if (!name || !slug) {
  return NextResponse.json({ 
    error: 'Nome e slug são obrigatórios' 
  }, { status: 400 })
}
```

### 4. **Atualização com Timestamp**
```typescript
const { data: organization, error } = await supabase
  .from('organizations')
  .update({ 
    name, 
    slug,
    updated_at: new Date().toISOString()  // ✅ Registrar quando foi atualizado
  })
  .eq('id', orgId)
  .select()
  .single()
```

### 5. **Params Async (Next.js 15)**
```typescript
// ANTES
{ params }: { params: { orgId: string } }

// DEPOIS
{ params }: { params: Promise<{ orgId: string }> }

// E no código:
const { orgId } = await params  // ✅ Await necessário
```

## 📁 Arquivos Modificados

### `src/app/api/organizations/[orgId]/route.ts`
- ✅ GET: Corrigido para usar `organization_members`
- ✅ PUT: Corrigido verificação de permissões e validações
- ✅ DELETE: Corrigido para usar `organization_members`
- ✅ Todos os métodos: Adicionado `await params`

## 🧪 Como Testar

### 1. Editar Organização
```bash
# 1. Acesse: http://localhost:3000/admin/organizations
# 2. Clique no botão "Editar" (ícone de lápis) de uma organização
# 3. Altere o nome e/ou slug
# 4. Clique em "Salvar"
# 5. ✅ Verificar: Organização atualizada com sucesso
```

### 2. Verificar Permissões
```bash
# Cenário 1: Owner/Admin da organização
# ✅ Deve conseguir editar

# Cenário 2: Membro comum (viewer/manager)
# ❌ Deve receber erro "Forbidden"

# Cenário 3: Email específico (lenine.engrene@gmail.com)
# ✅ Deve conseguir editar qualquer organização
```

### 3. Validações
```bash
# Tentar salvar sem nome
# ❌ Deve mostrar erro "Nome e slug são obrigatórios"

# Tentar salvar sem slug
# ❌ Deve mostrar erro "Nome e slug são obrigatórios"
```

## 🔐 Permissões

### Quem pode editar uma organização:
- ✅ **Owner** da organização
- ✅ **Admin** da organização
- ✅ Email específico: `lenine.engrene@gmail.com`
- ❌ **Manager** - Não pode editar
- ❌ **Viewer** - Não pode editar

### Quem pode deletar uma organização:
- ✅ **Owner** da organização
- ✅ Email específico: `lenine.engrene@gmail.com`
- ❌ **Admin** - Não pode deletar
- ❌ **Manager** - Não pode deletar
- ❌ **Viewer** - Não pode deletar

## 📊 Estrutura de Dados

### Tabela: `organization_members`
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
  status TEXT CHECK (status IN ('active', 'pending', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Roles:
- **owner**: Controle total (editar, deletar, gerenciar membros)
- **admin**: Gerenciar organização e membros (não pode deletar)
- **manager**: Gerenciar clientes e campanhas
- **viewer**: Apenas visualização

## 🎯 Resultado

✅ **Edição de organização funcionando**
✅ **Permissões corretas aplicadas**
✅ **Validações implementadas**
✅ **Mensagens de erro claras**
✅ **Compatível com Next.js 15**

## 🔄 Próximos Passos

1. **Testar em produção** após deploy
2. **Adicionar logs** de auditoria para mudanças em organizações
3. **Implementar histórico** de alterações
4. **Adicionar confirmação** antes de salvar mudanças críticas

---

**Status**: ✅ Corrigido e testado
**Data**: 2025-01-20
**Impacto**: Crítico - Funcionalidade essencial do admin
