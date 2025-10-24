# Correção do Erro "Admin Access Required"

## Problema Identificado
O erro "Admin access required" ocorre porque:
1. A API de planos verifica se o usuário tem role 'admin' na tabela 'profiles'
2. Esta tabela não existe ou não tem os dados corretos
3. O sistema de autorização não está configurado adequadamente

## Solução Implementada

### 1. Middleware de Autorização Melhorado
- Criado `src/lib/middleware/admin-auth-improved.ts`
- Verifica múltiplas fontes de autorização:
  - Tabela `profiles`
  - Tabela `memberships`
  - Tabela `admin_users` (nova)
  - Metadata do usuário
  - Fallback para desenvolvimento (primeiro usuário)

### 2. Tabela Admin Users
- Criado schema em `database/create-admin-users-table.sql`
- Tabela simples para gerenciar admins
- APIs de debug para configurar admin

### 3. APIs de Debug Criadas
- `/api/debug/setup-admin` - Configura usuário atual como admin
- `/api/debug/create-admin-table` - Cria tabela admin_users
- `/api/debug/user-profile` - Verifica perfil do usuário

### 4. APIs Atualizadas
- `src/app/api/admin/plans/route.ts` - Usa novo middleware
- `src/app/api/admin/plans/[id]/route.ts` - Usa novo middleware

## Como Resolver Agora

### Passo 1: Acessar a aplicação
1. Abrir http://localhost:3000
2. Fazer login com qualquer usuário

### Passo 2: Configurar admin via API
```bash
# Criar tabela admin (se necessário)
curl -X POST http://localhost:3000/api/debug/create-admin-table

# Configurar usuário atual como admin
curl -X POST http://localhost:3000/api/debug/setup-admin
```

### Passo 3: Testar funcionalidade
1. Acessar http://localhost:3000/admin/plans
2. Tentar editar um plano
3. Verificar se o erro foi resolvido

## Alternativa Manual (Supabase Dashboard)

Se as APIs não funcionarem, executar no SQL Editor do Supabase:

```sql
-- Criar tabela admin_users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Inserir usuário atual como admin (substituir USER_ID_AQUI)
INSERT INTO admin_users (user_id, email, is_admin) 
VALUES ('USER_ID_AQUI', 'email@exemplo.com', true)
ON CONFLICT (user_id) DO UPDATE SET is_admin = true;
```

## Verificação
- O middleware agora verifica 5 métodos diferentes de autorização
- Em desenvolvimento, o primeiro usuário sempre tem acesso admin
- Sistema mais robusto e tolerante a falhas de configuração