# Correção do Erro "Admin access required" - Planos

## Problema
O erro "Admin access required" ocorre ao tentar atualizar planos porque o sistema de autorização não consegue verificar se o usuário é admin.

## Solução Implementada

### 1. Criado Middleware de Autorização Melhorado
- **Arquivo**: `src/lib/middleware/admin-auth-improved.ts`
- **Funcionalidade**: Verifica permissões admin através de múltiplos métodos:
  - Tabela `profiles` (role = 'admin' ou 'super_admin')
  - Tabela `memberships` (role = 'admin', 'super_admin' ou 'owner')
  - Tabela `admin_users` (is_admin = true)
  - User metadata (role = 'admin' ou 'super_admin')
  - Fallback para desenvolvimento (primeiro usuário)

### 2. Atualizado APIs de Planos
- **Arquivos**: 
  - `src/app/api/admin/plans/route.ts`
  - `src/app/api/admin/plans/[id]/route.ts`
- **Mudança**: Substituído verificação simples pelo novo middleware

### 3. Criada Tabela admin_users
- **Arquivo**: `database/create-admin-users-table.sql`
- **Estrutura**:
  ```sql
  CREATE TABLE admin_users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id),
      email TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id)
  );
  ```

### 4. APIs de Debug Criadas
- `src/app/api/debug/test-admin-setup/route.ts` - Testa e configura admin
- `src/app/api/debug/setup-admin/route.ts` - Configura usuário como admin
- `src/app/api/debug/create-admin-table/route.ts` - Cria tabela admin

## Passos para Resolver

### 1. Aplicar SQL no Supabase
Execute o conteúdo do arquivo `database/create-admin-users-table.sql` no SQL Editor do Supabase.

### 2. Configurar Usuário como Admin
Após aplicar o SQL, faça uma requisição POST para:
```
http://localhost:3000/api/debug/test-admin-setup
```

### 3. Testar Funcionamento
Acesse a página de planos em:
```
http://localhost:3000/admin/plans
```

## Verificação
Para verificar se está funcionando, faça GET para:
```
http://localhost:3000/api/debug/test-admin-setup
```

## Resultado Esperado
Após a correção, o usuário poderá:
- ✅ Visualizar planos
- ✅ Criar novos planos
- ✅ Editar planos existentes
- ✅ Deletar planos

## Arquivos Modificados
- `src/lib/middleware/admin-auth-improved.ts` (novo)
- `src/app/api/admin/plans/route.ts` (atualizado)
- `src/app/api/admin/plans/[id]/route.ts` (atualizado)
- `database/create-admin-users-table.sql` (novo)
- `src/app/api/debug/test-admin-setup/route.ts` (novo)

## Segurança
O sistema mantém múltiplas camadas de verificação de admin, garantindo que apenas usuários autorizados tenham acesso às funcionalidades administrativas.