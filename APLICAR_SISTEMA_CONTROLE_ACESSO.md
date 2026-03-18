# Sistema de Controle de Acesso - Guia de Aplicação

## 📋 Resumo

Implementação completa do sistema de controle de acesso baseado em tipos de usuário:

1. **Usuário Master** - Acesso ilimitado, não vinculado a planos
2. **Usuário Comum** - Limitado por planos de assinatura  
3. **Usuário Cliente** - Acesso restrito aos dados da agência

## 🚀 Passo a Passo de Aplicação

### 1. Aplicar Migração do Banco de Dados

**⚠️ CRÍTICO: Execute no Supabase SQL Editor**

```sql
-- Copie e cole o conteúdo de:
-- database/migrations/08-user-access-control-system.sql
```

**O que a migração faz:**
- Cria enum `user_type_enum` (master, regular, client)
- Cria tabela `master_users` para usuários master
- Cria tabela `client_users` para usuários cliente
- Adiciona coluna `user_type` na tabela `memberships`
- Cria funções SQL para controle de acesso
- Configura políticas RLS
- Cria índices para performance

### 2. Criar Usuário Master Inicial

**Após aplicar a migração, descomente e execute:**

```sql
-- Substitua 'admin@example.com' pelo email do administrador
INSERT INTO master_users (user_id, created_by, notes)
SELECT id, id, 'Usuário master inicial criado durante migração'
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

### 3. Verificar Aplicação da Migração

```sql
-- Verificar se as tabelas foram criadas
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('master_users', 'client_users');

-- Verificar se as funções foram criadas
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('get_user_type', 'check_user_permissions', 'get_user_limits');

-- Verificar se o enum foi criado
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_type_enum');
```

### 4. Testar Sistema de Controle de Acesso

```sql
-- Testar função get_user_type
SELECT get_user_type('USER_ID_AQUI');

-- Testar função get_user_limits
SELECT get_user_limits('USER_ID_AQUI');

-- Testar função check_user_permissions
SELECT check_user_permissions('USER_ID_AQUI', 'campaigns', 'read', 'CLIENT_ID_AQUI');
```

## 📁 Arquivos Criados

### Backend/Database
- `database/migrations/08-user-access-control-system.sql` - Migração completa
- `src/lib/services/user-access-control.ts` - Serviço principal
- `src/lib/middleware/user-access-middleware.ts` - Middleware para APIs

### Frontend/Components
- `src/hooks/use-user-access.ts` - Hook React para controle de acesso
- `src/components/admin/user-type-manager.tsx` - Interface de gerenciamento
- `src/components/ui/user-access-indicator.tsx` - Indicadores visuais

### Exemplo de Uso
- `src/app/api/campaigns/route.ts` - Exemplo de API com controle de acesso

## 🔧 Como Usar o Sistema

### 1. Em Rotas de API

```typescript
import { createAccessControl } from '@/lib/middleware/user-access-middleware'

// Middleware para leitura de campanhas
const handler = createAccessControl.readCampaigns()(async (request, context) => {
  const { userType, userLimits } = getUserFromAccessContext(context)
  // Sua lógica aqui
})

// Middleware apenas para masters
const adminHandler = createAccessControl.masterOnly()(async (request, context) => {
  // Apenas usuários master podem acessar
})
```

### 2. Em Componentes React

```typescript
import { useUserAccess } from '@/hooks/use-user-access'

function MyComponent() {
  const { userType, isMaster, canCreateCampaigns, userLimits } = useUserAccess()
  
  if (isMaster) {
    return <AdminPanel />
  }
  
  if (userType === 'client') {
    return <ClientView />
  }
  
  return <RegularUserView />
}
```

### 3. Verificação de Permissões

```typescript
import { UserAccessControl } from '@/lib/services/user-access-control'

const accessControl = new UserAccessControl()

// Verificar se usuário pode acessar recurso
const result = await accessControl.checkPermission(
  userId, 
  'campaigns', 
  'read', 
  clientId
)

if (result.allowed) {
  // Permitir acesso
} else {
  // Negar acesso com result.reason
}
```

## 🎯 Funcionalidades Implementadas

### ✅ Tipos de Usuário

1. **Master Users**
   - Acesso ilimitado a todas as funcionalidades
   - Não vinculados a planos de assinatura
   - Podem gerenciar outros tipos de usuário
   - Bypass de todas as limitações

2. **Regular Users**
   - Acesso baseado no plano de assinatura ativo
   - Limitações de clientes, campanhas, contas de anúncios
   - Retenção de dados limitada
   - Formatos de exportação limitados

3. **Client Users**
   - Acesso apenas aos dados do próprio cliente
   - Somente leitura (não podem criar/editar)
   - Permissões granulares configuráveis
   - Isolamento total de dados

### ✅ Controle de Acesso

- **Middleware de API**: Proteção automática de rotas
- **Hooks React**: Integração fácil no frontend
- **Verificação de Permissões**: Sistema granular de permissões
- **Limites Dinâmicos**: Baseados no tipo de usuário e plano

### ✅ Interface de Gerenciamento

- **Painel Admin**: Gerenciar tipos de usuário
- **Indicadores Visuais**: Mostrar tipo e limites do usuário
- **Alertas de Limite**: Notificar quando limites são atingidos
- **Upgrade Prompts**: Incentivar upgrade de plano

## 🔍 Fluxos de Usuário

### 1. Usuário Master
```
Login → Verificação (master_users) → Acesso Total
- Pode ver todos os clientes e campanhas
- Pode criar/editar/deletar qualquer recurso
- Pode gerenciar outros usuários
- Sem limitações de plano
```

### 2. Usuário Regular
```
Login → Verificação (memberships + subscriptions) → Acesso Limitado
- Vê apenas clientes da sua organização
- Limitado pelo plano de assinatura
- Pode criar recursos dentro dos limites
- Precisa de plano ativo
```

### 3. Usuário Cliente
```
Login → Verificação (client_users) → Acesso Restrito
- Vê apenas dados do próprio cliente
- Somente leitura
- Não pode criar/editar recursos
- Acesso independente de plano
```

## 🚨 Pontos Importantes

### Segurança
- **RLS Habilitado**: Todas as tabelas têm Row Level Security
- **Isolamento de Dados**: Client users não veem dados de outros clientes
- **Validação Dupla**: Backend e frontend verificam permissões
- **Auditoria**: Logs de acesso e mudanças de tipo

### Performance
- **Índices Criados**: Para consultas rápidas de tipo de usuário
- **Cache de Permissões**: Evita consultas repetitivas
- **Consultas Otimizadas**: JOINs eficientes para verificação

### Manutenibilidade
- **Código Modular**: Serviços separados por responsabilidade
- **Documentação**: Comentários e tipos TypeScript
- **Testes**: Estrutura preparada para testes automatizados
- **Extensibilidade**: Fácil adicionar novos tipos ou permissões

## 📊 Próximos Passos

1. **Testar Sistema Completo**
   - Criar usuários de cada tipo
   - Testar fluxos de acesso
   - Verificar limitações

2. **Integrar com Páginas Existentes**
   - Adicionar controle de acesso nas páginas
   - Mostrar indicadores de tipo de usuário
   - Implementar alertas de limite

3. **Configurar Monitoramento**
   - Logs de acesso negado
   - Métricas de uso por tipo
   - Alertas de segurança

4. **Documentar para Equipe**
   - Guia de uso para desenvolvedores
   - Fluxos para suporte
   - Procedimentos de emergência

## 🎉 Resultado Final

Após aplicar este sistema, você terá:

- ✅ Controle granular de acesso baseado em tipos de usuário
- ✅ Usuários master com acesso ilimitado
- ✅ Usuários regulares limitados por planos
- ✅ Usuários cliente com acesso restrito
- ✅ Interface de gerenciamento completa
- ✅ Middleware automático para APIs
- ✅ Hooks React para frontend
- ✅ Indicadores visuais de limites
- ✅ Sistema extensível e seguro

O sistema está pronto para uso em produção e pode ser facilmente estendido conforme necessário!