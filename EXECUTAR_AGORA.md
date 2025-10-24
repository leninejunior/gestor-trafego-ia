# 🚨 EXECUTAR AGORA - Correção Urgente

## Problema
Erro ao carregar planos: **"infinite recursion detected in policy for relation admin_users"**

## Solução (1 minuto)

### 1. Abra o Supabase Dashboard
https://supabase.com/dashboard → Seu Projeto → **SQL Editor**

### 2. Copie e Cole Este SQL

```sql
-- Drop all existing policies on admin_users
DROP POLICY IF EXISTS "admin_users_select_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_insert_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_update_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_delete_policy" ON admin_users;
DROP POLICY IF EXISTS "Users can view their own admin status" ON admin_users;
DROP POLICY IF EXISTS "Only admins can modify admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage admin users" ON admin_users;

-- Disable RLS temporarily
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "admin_users_view_own" 
ON admin_users FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "admin_users_service_role" 
ON admin_users FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');
```

### 3. Clique em "Run" (ou Ctrl+Enter)

### 4. Recarregue a Página
Volte para `/admin/plans` e pressione F5

## ✅ Pronto!

Agora você deve conseguir:
- Ver a lista de planos
- Editar planos com valores zero
- Ver mensagem de sucesso verde ao salvar

---

**Documentação completa:** `SOLUCAO_COMPLETA_PLANOS.md`
