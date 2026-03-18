# User Client Access Migration Guide

## 🚨 CRITICAL: Database Schema Fix Required

The tests are failing because the database schema doesn't match the design document. You need to apply this migration manually.

## Problem

- **Expected Tables**: `super_admins`, `user_client_access` (from design document)
- **Actual Tables**: `master_users`, `client_users` (from wrong migration)
- **Result**: All property-based tests fail because they can't find the expected tables

## Solution

### Step 1: Apply Database Migration

1. **Open Supabase SQL Editor**:
   ```
   https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql
   ```

2. **Copy the migration SQL**:
   - Open file: `database/migrations/09-user-client-access-table-fixed.sql`
   - Copy ALL the contents

3. **Paste and Execute**:
   - Paste the SQL into the Supabase SQL Editor
   - Click "Run" to execute the migration

4. **Verify Success**:
   Should show:
   - ✅ `super_admins` na lista de tabelas existentes
   - ✅ `user_client_access` na lista de tabelas existentes
   - ✅ Índices criados
   - ✅ Políticas RLS ativas

### Step 2: Create Test Super Admin

Run this command to create a test super admin user:

```bash
node create-test-super-admin.js
```

### Step 3: Verify Migration

Check that these tables exist:

```sql
-- Check super_admins table
SELECT 'super_admins' as table_name, count(*) as rows FROM super_admins;

-- Check user_client_access table  
SELECT 'user_client_access' as table_name, count(*) as rows FROM user_client_access;

-- Check memberships role column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memberships' AND column_name = 'role';
```

## What This Migration Creates

### Tabela Criada
- **super_admins**: Usuários com acesso total ao sistema
- **user_client_access**: Controla acesso granular de usuários comuns aos clientes

### Colunas Principais

**super_admins**:
- `id` (UUID, PK)
- `user_id` (UUID, FK -> auth.users)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at`
- `notes` (TEXT)

**user_client_access**:
- `id` (UUID, PK)
- `user_id` (UUID, FK -> auth.users)
- `client_id` (UUID, FK -> clients)
- `organization_id` (UUID, FK -> organizations)
- `granted_by` (UUID, FK -> auth.users)
- `permissions` (JSONB)
- `is_active` (BOOLEAN)

### Índices para Performance
- `idx_super_admins_user_id`: Busca por usuário
- `idx_user_client_access_user_id`: Busca por usuário
- `idx_user_client_access_client_id`: Busca por cliente
- `idx_user_client_access_organization_id`: Busca por organização
- `idx_user_client_access_granted_by`: Auditoria de quem concedeu

## Próximos Passos

Após aplicar a migração:

1. ✅ Execute: `node create-test-super-admin.js`
2. ✅ Execute os testes: `npm test`
3. ✅ Verifique se todos os testes passam

## Troubleshooting

### Erro: "relation does not exist"
- **Causa**: Migração não foi aplicada
- **Solução**: Execute o SQL no Supabase SQL Editor

### Erro: "permission denied"
- **Causa**: RLS policies bloqueando acesso
- **Solução**: Verifique se as políticas service_role foram criadas

### Erro: "duplicate key value"
- **Causa**: Tentando criar tabela que já existe
- **Solução**: Normal, a migração usa `IF NOT EXISTS`

## Verificação Final

Após aplicar tudo, execute:

```bash
npm test -- --testPathPattern="user-access-control-constraints" --verbose
```

Deve mostrar:
- ✅ Todos os testes de Property 13 passando
- ✅ Sem erros de "relation does not exist"
- ✅ Sem erros de RLS policies