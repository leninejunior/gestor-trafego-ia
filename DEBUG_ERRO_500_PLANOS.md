# Debug Erro 500 - API de Planos

## Problema Atual

A API `/api/admin/plans` está retornando erro 500 ao tentar listar os planos.

## Mudanças Aplicadas

### 1. Logs Detalhados Adicionados

**Arquivo:** `src/app/api/admin/plans/route.ts`
- ✅ Logs em cada etapa do processo
- ✅ Mostra resultado da autenticação
- ✅ Mostra dados retornados do banco
- ✅ Mostra transformação dos dados

**Arquivo:** `src/lib/middleware/admin-auth-improved.ts`
- ✅ Logs detalhados em cada verificação de admin
- ✅ Melhor tratamento de erros
- ✅ Proteção contra falha no método de desenvolvimento

### 2. Como Verificar o Erro

1. **Abra o Console do Terminal** onde o Next.js está rodando
2. **Recarregue a página** de admin de planos
3. **Procure pelos logs** que começam com:
   - 🔐 checkAdminAuth
   - 🔍 API /api/admin/plans
   - ❌ (erros)

### 3. Possíveis Causas do Erro 500

#### Causa 1: Problema de Autenticação
**Sintoma:** Logs mostram erro em `checkAdminAuth`
**Solução:** Verificar se você está logado e é admin

```sql
-- Execute no Supabase SQL Editor
SELECT * FROM admin_users WHERE user_id = auth.uid();
```

#### Causa 2: Problema com RLS
**Sintoma:** Logs mostram "Database error" ou erro de permissão
**Solução:** Aplicar o SQL de correção RLS

```bash
# Ver arquivo: CORRIGIR_RLS_PLANOS_AGORA.md
```

#### Causa 3: Tabela não existe
**Sintoma:** Logs mostram "table does not exist"
**Solução:** Criar a tabela subscription_plans

```sql
-- Execute no Supabase SQL Editor
-- Ver arquivo: database/subscription-plans-schema.sql
```

#### Causa 4: Colunas com nomes errados
**Sintoma:** Logs mostram erro ao transformar dados
**Solução:** Verificar schema da tabela

```sql
-- Execute no Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscription_plans';
```

## Próximos Passos

### Passo 1: Ver os Logs
1. Recarregue a página de admin de planos
2. Copie TODOS os logs do terminal
3. Cole aqui para análise

### Passo 2: Verificar Admin
Execute no Supabase SQL Editor:

```sql
-- Verificar se você é admin
SELECT 
    au.user_id,
    au.is_admin,
    au.is_active,
    u.email
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
WHERE au.user_id = auth.uid();
```

### Passo 3: Verificar Tabela
Execute no Supabase SQL Editor:

```sql
-- Verificar se a tabela existe e tem dados
SELECT 
    COUNT(*) as total_plans,
    COUNT(CASE WHEN is_active THEN 1 END) as active_plans
FROM subscription_plans;
```

### Passo 4: Testar RLS
Execute no Supabase SQL Editor:

```sql
-- Testar se você consegue ler os planos
SELECT * FROM subscription_plans LIMIT 5;
```

## Checklist de Verificação

- [ ] Logs do terminal copiados
- [ ] Verificado se sou admin (SQL acima)
- [ ] Verificado se tabela existe (SQL acima)
- [ ] Testado RLS (SQL acima)
- [ ] Aplicado correção RLS se necessário

## Logs Esperados (Sucesso)

```
🔐 checkAdminAuth: Starting admin authentication check
🔐 checkAdminAuth: Getting user from Supabase
🔐 checkAdminAuth: User found: 980d1d5f-6bca-4d3f-b756-0fc0999b7658
🔐 checkAdminAuth: User IS admin - access granted
🔍 API /api/admin/plans GET called
🔐 Checking admin auth...
🔐 Auth result: { success: true, hasUser: true }
✅ Creating Supabase client...
Admin access granted - User: 980d1d5f-6bca-4d3f-b756-0fc0999b7658
📊 Fetching plans from database...
📊 Query result: { hasData: true, dataLength: 3, error: undefined }
🔄 Transforming plans data...
📝 Transforming plan: Gratuito { price_monthly: 0, price_yearly: 0, max_clients: 5 }
📝 Transforming plan: Starter { price_monthly: 29, price_yearly: 290, max_clients: 10 }
📝 Transforming plan: Pro { price_monthly: 99, price_yearly: 990, max_clients: 50 }
✅ Returning 3 plans
```

## Status

✅ **PROBLEMA IDENTIFICADO!**

**Erro:** `infinite recursion detected in policy for relation "admin_users"`

**Causa:** A política RLS da tabela `admin_users` está verificando a própria tabela, causando loop infinito.

**Solução:** Execute o SQL em `database/fix-admin-users-rls-recursion.sql`

**Ver instruções completas em:** `CORRIGIR_RECURSAO_RLS_AGORA.md`
