# Sistema de Controle de Acesso - Checklist de Validação

**Data:** 02/01/2026  
**Versão:** 1.0.0

## 📋 Checklist Completo

Use este checklist para validar que o sistema de controle de acesso está funcionando corretamente.

## 🗄️ Banco de Dados

### Tabelas

- [ ] Tabela `master_users` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'master_users'
  );
  ```

- [ ] Tabela `client_users` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'client_users'
  );
  ```

- [ ] Coluna `user_type` existe em `memberships`
  ```sql
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'memberships' 
    AND column_name = 'user_type'
  );
  ```

### Enum

- [ ] Enum `user_type_enum` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_type 
    WHERE typname = 'user_type_enum'
  );
  ```

- [ ] Enum tem os 3 valores corretos
  ```sql
  SELECT enumlabel 
  FROM pg_enum 
  WHERE enumtypid = (
    SELECT oid FROM pg_type WHERE typname = 'user_type_enum'
  );
  -- Deve retornar: master, regular, client
  ```

### Funções SQL

- [ ] Função `get_user_type` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'get_user_type'
  );
  ```

- [ ] Função `check_user_permissions` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'check_user_permissions'
  );
  ```

- [ ] Função `get_user_limits` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'get_user_limits'
  );
  ```

### Políticas RLS

- [ ] RLS habilitado em `master_users`
  ```sql
  SELECT relrowsecurity 
  FROM pg_class 
  WHERE relname = 'master_users';
  -- Deve retornar: true
  ```

- [ ] RLS habilitado em `client_users`
  ```sql
  SELECT relrowsecurity 
  FROM pg_class 
  WHERE relname = 'client_users';
  -- Deve retornar: true
  ```

- [ ] Políticas criadas para `master_users`
  ```sql
  SELECT COUNT(*) 
  FROM pg_policies 
  WHERE tablename = 'master_users';
  -- Deve retornar: 2 ou mais
  ```

- [ ] Políticas criadas para `client_users`
  ```sql
  SELECT COUNT(*) 
  FROM pg_policies 
  WHERE tablename = 'client_users';
  -- Deve retornar: 3 ou mais
  ```

### Índices

- [ ] Índice `idx_master_users_user_id` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_indexes 
    WHERE indexname = 'idx_master_users_user_id'
  );
  ```

- [ ] Índice `idx_client_users_user_id` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_indexes 
    WHERE indexname = 'idx_client_users_user_id'
  );
  ```

- [ ] Índice `idx_client_users_client_id` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_indexes 
    WHERE indexname = 'idx_client_users_client_id'
  );
  ```

- [ ] Índice `idx_memberships_user_type` existe
  ```sql
  SELECT EXISTS (
    SELECT FROM pg_indexes 
    WHERE indexname = 'idx_memberships_user_type'
  );
  ```

## 🧪 Testes Funcionais

### Teste 1: Criar Usuário Master

- [ ] Criar usuário master
  ```sql
  INSERT INTO master_users (user_id, created_by, notes)
  VALUES (
    'USER_ID_TESTE',
    'ADMIN_ID',
    'Teste de criação de master user'
  );
  ```

- [ ] Verificar tipo de usuário
  ```sql
  SELECT get_user_type('USER_ID_TESTE');
  -- Deve retornar: 'master'
  ```

- [ ] Verificar limites
  ```sql
  SELECT get_user_limits('USER_ID_TESTE');
  -- Deve retornar: {"unlimited": true, ...}
  ```

- [ ] Verificar permissões
  ```sql
  SELECT check_user_permissions(
    'USER_ID_TESTE',
    'campaigns',
    'delete',
    'ANY_CLIENT_ID'
  );
  -- Deve retornar: true
  ```

### Teste 2: Criar Usuário Cliente

- [ ] Criar usuário cliente
  ```sql
  INSERT INTO client_users (user_id, client_id, created_by, permissions)
  VALUES (
    'USER_ID_CLIENTE_TESTE',
    'CLIENT_ID_TESTE',
    'ADMIN_ID',
    '{"read_campaigns": true, "read_reports": true}'::jsonb
  );
  ```

- [ ] Verificar tipo de usuário
  ```sql
  SELECT get_user_type('USER_ID_CLIENTE_TESTE');
  -- Deve retornar: 'client'
  ```

- [ ] Verificar limites
  ```sql
  SELECT get_user_limits('USER_ID_CLIENTE_TESTE');
  -- Deve retornar: {"read_only": true, "max_clients": 1, ...}
  ```

- [ ] Verificar permissão de leitura
  ```sql
  SELECT check_user_permissions(
    'USER_ID_CLIENTE_TESTE',
    'campaigns',
    'read',
    'CLIENT_ID_TESTE'
  );
  -- Deve retornar: true
  ```

- [ ] Verificar permissão de escrita (deve falhar)
  ```sql
  SELECT check_user_permissions(
    'USER_ID_CLIENTE_TESTE',
    'campaigns',
    'create',
    'CLIENT_ID_TESTE'
  );
  -- Deve retornar: false
  ```

### Teste 3: Usuário Regular

- [ ] Criar usuário regular (via membership)
  ```sql
  -- Usuário regular é criado automaticamente ao criar membership
  -- Verificar se user_type é 'regular' por padrão
  SELECT user_type 
  FROM memberships 
  WHERE user_id = 'USER_ID_REGULAR_TESTE';
  -- Deve retornar: 'regular'
  ```

- [ ] Verificar tipo de usuário
  ```sql
  SELECT get_user_type('USER_ID_REGULAR_TESTE');
  -- Deve retornar: 'regular'
  ```

- [ ] Verificar limites (com assinatura ativa)
  ```sql
  SELECT get_user_limits('USER_ID_REGULAR_TESTE');
  -- Deve retornar: limites do plano
  ```

- [ ] Verificar permissões (com assinatura ativa)
  ```sql
  SELECT check_user_permissions(
    'USER_ID_REGULAR_TESTE',
    'campaigns',
    'read',
    NULL
  );
  -- Deve retornar: true (se tem assinatura ativa)
  ```

## 💻 Backend

### Serviço Principal

- [ ] Arquivo `src/lib/services/user-access-control.ts` existe
- [ ] Classe `UserAccessControlService` está definida
- [ ] Método `getUserType` funciona
- [ ] Método `isSuperAdmin` funciona
- [ ] Método `isOrgAdmin` funciona
- [ ] Método `getOrganizationLimits` funciona
- [ ] Método `hasActiveSubscription` funciona
- [ ] Método `validateActionAgainstLimits` funciona
- [ ] Método `checkPermission` funciona
- [ ] Método `getUserAccessibleClients` funciona
- [ ] Método `hasClientAccess` funciona

### Middleware

- [ ] Arquivo `src/lib/middleware/user-access-middleware.ts` existe
- [ ] Função `withUserAccessControl` está definida
- [ ] Helper `requireSuperAdmin` funciona
- [ ] Helper `requireOrgAdmin` funciona
- [ ] Helper `requireAnyAdmin` funciona
- [ ] Helper `requireClientAccess` funciona
- [ ] Helper `validatePlanLimit` funciona
- [ ] Objeto `createAccessControl` está definido
- [ ] Middleware `readCampaigns` funciona
- [ ] Middleware `writeCampaigns` funciona
- [ ] Middleware `createUser` funciona
- [ ] Middleware `createClient` funciona
- [ ] Middleware `createConnection` funciona

### Teste de API

- [ ] Criar rota de teste com middleware
  ```typescript
  // src/app/api/test-access/route.ts
  import { createAccessControl } from '@/lib/middleware/user-access-middleware'

  export const GET = createAccessControl.readCampaigns()(
    async (request, context) => {
      return NextResponse.json({
        userType: context.userType,
        userId: context.user.id
      })
    }
  )
  ```

- [ ] Testar rota sem autenticação (deve retornar 401)
- [ ] Testar rota com usuário master (deve retornar 200)
- [ ] Testar rota com usuário regular (deve retornar 200 ou 403)
- [ ] Testar rota com usuário cliente (deve retornar 200 ou 403)

## 🎨 Frontend

### Hook React

- [ ] Arquivo `src/hooks/use-user-access.ts` existe
- [ ] Hook `useUserAccessControl` está definido
- [ ] Hook retorna todos os métodos necessários

### Componentes UI

- [ ] Arquivo `src/components/ui/user-access-indicator.tsx` existe
- [ ] Componente `UserTypeBadge` está definido
- [ ] Badge mostra cores diferentes por tipo
- [ ] Badge mostra ícones corretos

### Gerenciador de Tipos

- [ ] Arquivo `src/components/admin/user-type-manager.tsx` existe
- [ ] Componente `UserTypeManager` está definido
- [ ] Interface permite promover usuários
- [ ] Interface permite rebaixar usuários
- [ ] Interface permite gerenciar permissões

### Teste de Componente

- [ ] Criar página de teste
  ```typescript
  // src/app/test-access-ui/page.tsx
  import { useUserAccessControl } from '@/lib/services/user-access-control'
  import { UserTypeBadge } from '@/components/ui/user-access-indicator'

  export default function TestAccessUI() {
    const { getUserType } = useUserAccessControl()
    // Testar componentes
  }
  ```

- [ ] Testar renderização do badge
- [ ] Testar hook de acesso
- [ ] Testar renderização condicional por tipo

## 📚 Documentação

### Arquivos Criados

- [ ] `SISTEMA_CONTROLE_ACESSO_RESUMO_EXECUTIVO.md` existe
- [ ] `SISTEMA_CONTROLE_ACESSO_GUIA_RAPIDO.md` existe
- [ ] `SISTEMA_CONTROLE_ACESSO_FLUXO.md` existe
- [ ] `SISTEMA_CONTROLE_ACESSO_INDEX.md` existe
- [ ] `REVISAO_SISTEMA_CONTROLE_ACESSO_COMPLETA.md` existe
- [ ] `SISTEMA_CONTROLE_ACESSO_CHECKLIST.md` existe (este arquivo)

### Arquivos Atualizados

- [ ] `CHANGELOG.md` contém entrada sobre o sistema
- [ ] `README.md` contém seção sobre o sistema

### Arquivos Existentes

- [ ] `APLICAR_SISTEMA_CONTROLE_ACESSO.md` existe
- [ ] `SISTEMA_CONTROLE_ACESSO_STATUS.md` existe
- [ ] `SISTEMA_CONTROLE_ACESSO_INTEGRADO_FINAL.md` existe
- [ ] `TESTE_MCP_SISTEMA_CONTROLE_ACESSO_RESULTADO.md` existe

## 🔒 Segurança

### RLS Policies

- [ ] Usuário master pode ver todos os registros de `master_users`
- [ ] Usuário comum não pode ver registros de `master_users`
- [ ] Usuário cliente pode ver apenas seu próprio registro em `client_users`
- [ ] Usuário admin de org pode gerenciar `client_users` da sua org
- [ ] Usuário comum não pode ver `client_users` de outras orgs

### Validações

- [ ] Tipo de usuário é verificado em cada requisição de API
- [ ] Limites de plano são validados antes de criar recursos
- [ ] Assinatura ativa é verificada para usuários regulares
- [ ] Client ID é validado para usuários cliente
- [ ] Permissões são verificadas no backend, não apenas frontend

## 📈 Performance

### Cache

- [ ] Cache de tipo de usuário funciona (TTL: 5 min)
- [ ] Cache de limites de plano funciona (TTL: 10 min)
- [ ] Cache de acesso a cliente funciona (TTL: 2 min)
- [ ] Cache é invalidado quando necessário

### Índices

- [ ] Consultas de tipo de usuário são rápidas (<10ms)
- [ ] Consultas de permissões são rápidas (<15ms)
- [ ] Consultas de limites são rápidas (<20ms)

## 🧪 Testes Automatizados

### Scripts de Teste

- [ ] `test-user-access-system.js` existe
- [ ] `test-user-access-system-complete.js` existe
- [ ] Scripts executam sem erros
- [ ] Scripts validam todos os tipos de usuário

### Executar Testes

```bash
# Teste básico
node test-user-access-system.js

# Teste completo
node test-user-access-system-complete.js
```

- [ ] Teste básico passa
- [ ] Teste completo passa
- [ ] Todos os tipos de usuário são validados
- [ ] Todas as permissões são testadas

## ✅ Validação Final

### Checklist de Produção

- [ ] Todas as tabelas criadas
- [ ] Todas as funções SQL funcionando
- [ ] Todas as políticas RLS ativas
- [ ] Todos os índices criados
- [ ] Serviço backend funcionando
- [ ] Middleware funcionando
- [ ] Hook React funcionando
- [ ] Componentes UI funcionando
- [ ] Documentação completa
- [ ] Testes passando
- [ ] Performance adequada
- [ ] Segurança validada

### Aprovação

- [ ] Revisado por: _______________
- [ ] Data: _______________
- [ ] Aprovado para produção: [ ] Sim [ ] Não

## 📝 Notas

Use este espaço para anotar observações durante a validação:

```
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
```

## 🆘 Troubleshooting

Se algum item do checklist falhar, consulte:

1. [Guia Rápido - Troubleshooting](./SISTEMA_CONTROLE_ACESSO_GUIA_RAPIDO.md#-troubleshooting)
2. [Guia de Aplicação](./APLICAR_SISTEMA_CONTROLE_ACESSO.md)
3. [Resumo Executivo](./SISTEMA_CONTROLE_ACESSO_RESUMO_EXECUTIVO.md)

---

**Versão:** 1.0.0  
**Data:** 02/01/2026  
**Status:** ✅ PRONTO PARA USO
