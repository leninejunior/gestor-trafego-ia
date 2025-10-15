# 🚨 CORREÇÃO URGENTE: Permissões de Super Admin

## Problema Identificado
O usuário `admin@adsmanager.com` não tem permissões de super admin, causando erro 403 nas APIs.

## ✅ Solução Rápida

### 1. Execute o SQL no Supabase
1. Acesse: https://supabase.com/dashboard
2. Vá para **SQL Editor**
3. Copie e cole o conteúdo de `database/fix-super-admin-permissions.sql`
4. Clique em **Run**

### 2. Verifique se Funcionou
Após executar o SQL, você deve ver uma mensagem como:
```
VERIFICAÇÃO: Super Admin Criado
admin@adsmanager.com | super_admin | active
```

### 3. Teste o Sistema
1. Recarregue a página `/admin/users`
2. Clique no botão "Atualizar"
3. Agora deve listar os usuários sem erro 403

## 🔧 O que o Script Faz

### Aplica Schema Completo
- ✅ Adiciona colunas de suspensão em `user_profiles`
- ✅ Adiciona colunas de remoção em `memberships`
- ✅ Cria tabela `user_activities` para auditoria
- ✅ Corrige estrutura de colunas

### Cria Super Admin
- ✅ Busca usuário `admin@adsmanager.com`
- ✅ Cria role `super_admin` se não existir
- ✅ Cria organização se necessário
- ✅ Associa usuário como super admin ativo

### Configura Segurança
- ✅ Aplica políticas RLS corretas
- ✅ Permite acesso total para super admins
- ✅ Registra atividade inicial

## 🎯 Após Executar

### Funcionalidades Liberadas
- ✅ Listar todos os usuários
- ✅ Convidar novos usuários
- ✅ Suspender/reativar usuários
- ✅ Ver detalhes e histórico
- ✅ Gerenciar roles e organizações

### Teste Estas Ações
1. **Listar usuários**: `/admin/users` deve carregar
2. **Buscar usuários**: Digite no campo de busca
3. **Filtrar**: Clique nos botões de filtro
4. **Convidar**: Clique em "Convidar Usuário"
5. **Ver detalhes**: Clique em "Ver" em qualquer usuário

## 🚨 Se Ainda Não Funcionar

### Verificar Usuário
```sql
SELECT email, id FROM auth.users WHERE email = 'admin@adsmanager.com';
```

### Verificar Membership
```sql
SELECT 
    au.email,
    m.role,
    ur.name,
    m.status
FROM auth.users au
JOIN memberships m ON au.id = m.user_id
JOIN user_roles ur ON m.role_id = ur.id
WHERE au.email = 'admin@adsmanager.com';
```

### Forçar Recriação
Se necessário, execute novamente apenas a parte do super admin:
```sql
-- Deletar membership existente
DELETE FROM memberships WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'admin@adsmanager.com'
);

-- Reexecutar a parte DO $$ do script
```

## ✅ Status Esperado

Após a correção, você deve conseguir:
- ✅ Acessar `/admin/users` sem erro
- ✅ Ver lista de usuários
- ✅ Usar todas as funcionalidades de admin
- ✅ Convidar e gerenciar usuários

**Execute o script agora e teste o sistema!**