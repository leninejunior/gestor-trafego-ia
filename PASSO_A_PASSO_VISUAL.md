# 🚨 PASSO A PASSO VISUAL - Corrigir Erro dos Planos

## ❌ Erro Atual
```
GET /api/admin/plans 500 (Internal Server Error)
infinite recursion detected in policy for relation "admin_users"
```

## ✅ Solução em 4 Cliques

### 1️⃣ Abra o Supabase
- Vá para: https://supabase.com/dashboard
- Faça login
- Clique no seu projeto

### 2️⃣ Abra o SQL Editor
- No menu lateral esquerdo
- Procure por "SQL Editor" (ícone de código)
- Clique nele

### 3️⃣ Cole o SQL
Copie TUDO abaixo e cole no editor:

```sql
DROP POLICY IF EXISTS "admin_users_select_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_insert_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_update_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_users_delete_policy" ON admin_users;
DROP POLICY IF EXISTS "Users can view their own admin status" ON admin_users;
DROP POLICY IF EXISTS "Only admins can modify admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage admin users" ON admin_users;

ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users_view_own" 
ON admin_users FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "admin_users_service_role" 
ON admin_users FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');
```

### 4️⃣ Execute
- Clique no botão verde "Run" (canto inferior direito)
- OU pressione `Ctrl + Enter`

### 5️⃣ Verifique
Deve aparecer:
- ✅ "Success. No rows returned"
- OU uma tabela com as políticas criadas

### 6️⃣ Volte para o Sistema
- Volte para a página `/admin/plans`
- Pressione `F5` para recarregar
- **PRONTO!** Deve funcionar agora

## 🎯 O Que Você Vai Ver Depois

**Antes (Erro):**
```
❌ Failed to fetch plans
```

**Depois (Sucesso):**
```
✅ Lista de planos carregada
✅ Pode editar planos
✅ Mensagem verde ao salvar
```

## ⚠️ Se Não Funcionar

1. **Verifique se executou o SQL**
   - Deve ter aparecido "Success" no Supabase

2. **Verifique se está logado**
   - Faça logout e login novamente

3. **Limpe o cache**
   - Pressione `Ctrl + Shift + R` no navegador

4. **Me avise**
   - Cole os logs do TERMINAL (não do navegador)
   - Os logs começam com 🔐 e 📊

## 📝 Onde Está o SQL?

Se preferir, o SQL completo está em:
- `database/fix-admin-users-rls-recursion.sql`
- `EXECUTAR_AGORA.md`

## ❓ Por Que Preciso Fazer Isso?

O banco de dados tem uma política de segurança (RLS) que está causando loop infinito. Esse SQL corrige a política para que não haja mais recursão.

---

**Status:** ⏳ Aguardando você executar o SQL no Supabase
