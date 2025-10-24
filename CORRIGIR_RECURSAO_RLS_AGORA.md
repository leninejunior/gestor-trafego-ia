# CORRIGIR RECURSÃO RLS - EXECUTAR AGORA! 🚨

## Problema Identificado ✅

```
infinite recursion detected in policy for relation "admin_users"
```

A política RLS da tabela `admin_users` está tentando verificar a própria tabela, causando **loop infinito**!

## Solução - 1 Minuto ⚡

### Passo 1: Abra o Supabase Dashboard
1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral → **SQL Editor**
4. Clique em **"New Query"**

### Passo 2: Execute o SQL
Copie e cole TODO o conteúdo de:
```
database/fix-admin-users-rls-recursion.sql
```

Clique em **"Run"** ou pressione **Ctrl+Enter**

### Passo 3: Verifique o Resultado
Deve mostrar:
- ✅ Políticas antigas removidas
- ✅ Novas políticas criadas
- ✅ Seu usuário admin aparece no teste final

### Passo 4: Recarregue a Página
Volte para a página de admin de planos e recarregue (F5)

## O Que o SQL Faz

1. **Remove todas as políticas antigas** que causavam recursão
2. **Desabilita RLS temporariamente** para limpar o estado
3. **Reabilita RLS** com políticas simples
4. **Cria 2 políticas novas:**
   - `admin_users_view_own`: Usuários veem apenas seu próprio status (SEM recursão)
   - `admin_users_service_role`: Service role tem acesso total

## Por Que Estava Dando Erro?

**Antes (ERRADO):**
```sql
-- Esta política causava recursão infinita
CREATE POLICY "Only admins can modify" ON admin_users
USING (
    EXISTS (
        SELECT 1 FROM admin_users  -- ❌ Verifica a própria tabela!
        WHERE user_id = auth.uid() 
        AND is_admin = true
    )
);
```

**Depois (CORRETO):**
```sql
-- Esta política NÃO causa recursão
CREATE POLICY "admin_users_view_own" ON admin_users
FOR SELECT 
USING (user_id = auth.uid());  -- ✅ Apenas compara com auth.uid()
```

## Após Aplicar

1. ✅ Recarregue a página de admin de planos
2. ✅ A lista de planos deve carregar normalmente
3. ✅ Você poderá editar os planos

## Se Ainda Não Funcionar

Execute este SQL adicional para verificar:

```sql
-- Ver todas as políticas RLS problemáticas
SELECT 
    schemaname,
    tablename,
    policyname,
    qual
FROM pg_policies 
WHERE qual LIKE '%admin_users%'
AND tablename != 'admin_users';
```

Se encontrar outras tabelas com políticas que referenciam `admin_users`, me avise!

## Status

⏳ **AGUARDANDO EXECUÇÃO** - Execute o SQL agora no Supabase Dashboard!
