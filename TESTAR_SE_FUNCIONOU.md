# ✅ Testar Se a Correção Funcionou

## Passo 1: Verificar Políticas Atuais

Execute no Supabase SQL Editor:

```sql
-- Ver políticas da tabela admin_users
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'admin_users'
ORDER BY policyname;
```

**Resultado esperado:**
- `admin_users_view_own` (SELECT)
- `admin_users_service_role` (ALL)

## Passo 2: Testar Acesso aos Planos

Agora teste se consegue buscar os planos:

```sql
-- Testar se consegue ler subscription_plans
SELECT 
    id,
    name,
    price_monthly,
    price_yearly,
    is_active
FROM subscription_plans
LIMIT 5;
```

**Se funcionar:** ✅ Problema resolvido!  
**Se der erro:** ❌ Ainda há problema

## Passo 3: Recarregar a Página

1. Volte para `/admin/plans`
2. Pressione `F5` ou `Ctrl + R`
3. Aguarde carregar

## Resultado Esperado

✅ **SUCESSO:**
- Lista de planos aparece
- Sem erro 500
- Pode clicar em "Edit" nos planos

❌ **AINDA COM ERRO:**
- Erro 500 persiste
- Veja os logs do terminal
- Cole aqui para análise

## Se Ainda Não Funcionar

Execute este SQL adicional para limpar TODAS as políticas problemáticas:

```sql
-- Remover TODAS as políticas de admin_users
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'admin_users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON admin_users', r.policyname);
    END LOOP;
END $$;

-- Desabilitar e reabilitar RLS
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Criar apenas a política simples
CREATE POLICY "admin_users_view_own" 
ON admin_users FOR SELECT 
USING (user_id = auth.uid());
```

## Status

⏳ **AGUARDANDO TESTE** - Recarregue a página e me avise o resultado!
