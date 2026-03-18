# Troubleshooting - Sistema de Controle de Acesso

## Visão Geral

Este guia aborda os problemas mais comuns do Sistema de Controle de Acesso Hierárquico e suas soluções.

## Índice de Problemas

1. [Problemas de Autenticação](#problemas-de-autenticação)
2. [Problemas de Autorização](#problemas-de-autorização)
3. [Problemas de Criação de Usuários](#problemas-de-criação-de-usuários)
4. [Problemas de Acesso a Clientes](#problemas-de-acesso-a-clientes)
5. [Problemas de Limites de Plano](#problemas-de-limites-de-plano)
6. [Problemas de Super Admin](#problemas-de-super-admin)
7. [Problemas de Performance](#problemas-de-performance)
8. [Problemas de Cache](#problemas-de-cache)

## Problemas de Autenticação

### 🔴 Erro: "Token inválido ou expirado"

**Sintomas**:
- Usuário é redirecionado para login constantemente
- APIs retornam 401 Unauthorized
- Interface não carrega dados

**Possíveis Causas**:
1. Token JWT expirado
2. Configuração incorreta do Supabase
3. Problemas de sincronização de relógio

**Soluções**:

1. **Verificar configuração do Supabase**:
```typescript
// Verificar se as variáveis estão corretas
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

2. **Forçar novo login**:
```typescript
const supabase = await createClient()
await supabase.auth.signOut()
// Redirecionar para login
```

3. **Verificar validade do token**:
```bash
node scripts/verify-jwt-token.js
```

### 🔴 Erro: "Usuário não encontrado"

**Sintomas**:
- Login bem-sucedido mas dados não carregam
- Erro 404 em APIs de usuário

**Soluções**:

1. **Verificar se usuário existe no banco**:
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'usuario@exemplo.com';
```

2. **Verificar membership**:
```sql
SELECT m.*, o.name as org_name
FROM memberships m
JOIN organizations o ON o.id = m.organization_id
WHERE m.user_id = 'USER_ID';
```

## Problemas de Autorização

### 🔴 Erro: "Acesso negado" (403 Forbidden)

**Sintomas**:
- Usuário logado mas não consegue acessar recursos
- Mensagem "Você não tem permissão para esta ação"

**Diagnóstico**:

1. **Verificar tipo de usuário**:
```bash
node scripts/check-user-type.js usuario@exemplo.com
```

2. **Verificar membership**:
```sql
SELECT 
  u.email,
  m.organization_id,
  m.role,
  o.name as org_name
FROM auth.users u
LEFT JOIN memberships m ON m.user_id = u.id
LEFT JOIN organizations o ON o.id = m.organization_id
WHERE u.email = 'usuario@exemplo.com';
```

3. **Verificar se é Super Admin**:
```sql
SELECT sa.*, u.email
FROM super_admins sa
JOIN auth.users u ON u.id = sa.user_id
WHERE u.email = 'usuario@exemplo.com'
AND sa.is_active = true;
```

**Soluções**:

1. **Para usuários sem membership**:
```sql
-- Adicionar à organização
INSERT INTO memberships (user_id, organization_id, role)
VALUES ('USER_ID', 'ORG_ID', 'member');
```

2. **Para promover a admin**:
```sql
UPDATE memberships 
SET role = 'admin' 
WHERE user_id = 'USER_ID' AND organization_id = 'ORG_ID';
```

### 🔴 Erro: "Organização não encontrada"

**Sintomas**:
- Erro ao tentar acessar recursos da organização
- Dashboard vazio para admin

**Soluções**:

1. **Verificar se organização existe**:
```sql
SELECT * FROM organizations WHERE id = 'ORG_ID';
```

2. **Criar organização se necessário**:
```sql
INSERT INTO organizations (name, created_at)
VALUES ('Nome da Organização', NOW());
```

## Problemas de Criação de Usuários

### 🔴 Erro: "Limite de usuários atingido"

**Sintomas**:
- Erro 402 ao tentar criar usuário
- Mensagem sobre limite do plano

**Diagnóstico**:
```bash
node scripts/check-plan-limits.js ORG_ID
```

**Soluções**:

1. **Verificar uso atual**:
```sql
SELECT 
  o.name,
  COUNT(m.user_id) as current_users,
  s.max_users,
  sp.name as plan_name
FROM organizations o
LEFT JOIN memberships m ON m.organization_id = o.id
LEFT JOIN subscriptions s ON s.organization_id = o.id
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE o.id = 'ORG_ID'
GROUP BY o.id, o.name, s.max_users, sp.name;
```

2. **Remover usuários inativos**:
```sql
-- Listar usuários inativos
SELECT u.email, u.last_sign_in_at
FROM auth.users u
JOIN memberships m ON m.user_id = u.id
WHERE m.organization_id = 'ORG_ID'
AND u.last_sign_in_at < NOW() - INTERVAL '90 days';
```

3. **Upgrade do plano** (contatar suporte comercial)

### 🔴 Erro: "Email já existe"

**Sintomas**:
- Erro 409 ao criar usuário
- Mensagem sobre email duplicado

**Soluções**:

1. **Verificar se usuário já existe**:
```sql
SELECT u.email, m.organization_id, o.name
FROM auth.users u
LEFT JOIN memberships m ON m.user_id = u.id
LEFT JOIN organizations o ON o.id = m.organization_id
WHERE u.email = 'usuario@exemplo.com';
```

2. **Adicionar à organização se necessário**:
```sql
INSERT INTO memberships (user_id, organization_id, role)
SELECT u.id, 'ORG_ID', 'member'
FROM auth.users u
WHERE u.email = 'usuario@exemplo.com';
```

## Problemas de Acesso a Clientes

### 🔴 Usuário não vê clientes autorizados

**Sintomas**:
- Lista de clientes vazia para usuário comum
- Erro "Nenhum cliente encontrado"

**Diagnóstico**:

1. **Verificar acessos do usuário**:
```sql
SELECT 
  u.email,
  c.name as client_name,
  uca.permissions,
  uca.created_at
FROM user_client_access uca
JOIN auth.users u ON u.id = uca.user_id
JOIN clients c ON c.id = uca.client_id
WHERE u.email = 'usuario@exemplo.com'
AND uca.is_active = true;
```

2. **Verificar se cliente existe**:
```sql
SELECT c.*, o.name as org_name
FROM clients c
JOIN organizations o ON o.id = c.org_id
WHERE c.id = 'CLIENT_ID';
```

**Soluções**:

1. **Conceder acesso ao cliente**:
```sql
INSERT INTO user_client_access (
  user_id, 
  client_id, 
  organization_id, 
  granted_by,
  permissions
) VALUES (
  'USER_ID',
  'CLIENT_ID',
  'ORG_ID',
  'ADMIN_USER_ID',
  '{"read": true, "write": false}'::jsonb
);
```

2. **Verificar cache**:
```bash
# Limpar cache de acesso
node scripts/clear-user-access-cache.js USER_ID
```

### 🔴 Erro: "Usuário e cliente de organizações diferentes"

**Sintomas**:
- Erro 400 ao tentar conceder acesso
- Mensagem sobre violação de organização

**Diagnóstico**:
```sql
SELECT 
  u.email,
  um.organization_id as user_org,
  c.name as client_name,
  c.org_id as client_org
FROM auth.users u
JOIN memberships um ON um.user_id = u.id
CROSS JOIN clients c
WHERE u.id = 'USER_ID' AND c.id = 'CLIENT_ID';
```

**Solução**:
- Verificar se IDs estão corretos
- Apenas Super Admins podem conceder acesso cross-org

## Problemas de Limites de Plano

### 🔴 Erro: "Limite de clientes atingido"

**Sintomas**:
- Erro 402 ao criar cliente
- Botão de criação desabilitado

**Diagnóstico**:
```bash
node scripts/check-client-limits.js ORG_ID
```

**Soluções**:

1. **Verificar uso atual**:
```sql
SELECT 
  o.name,
  COUNT(c.id) as current_clients,
  s.max_clients,
  sp.name as plan_name
FROM organizations o
LEFT JOIN clients c ON c.org_id = o.id
LEFT JOIN subscriptions s ON s.organization_id = o.id
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE o.id = 'ORG_ID'
GROUP BY o.id, o.name, s.max_clients, sp.name;
```

2. **Remover clientes inativos**:
```sql
-- Listar clientes sem campanhas
SELECT c.name, c.created_at
FROM clients c
LEFT JOIN meta_campaigns mc ON mc.client_id = c.id
WHERE c.org_id = 'ORG_ID'
AND mc.id IS NULL;
```

### 🔴 Assinatura expirada

**Sintomas**:
- Todas as criações bloqueadas
- Mensagem sobre assinatura vencida

**Diagnóstico**:
```sql
SELECT 
  o.name,
  s.status,
  s.current_period_end,
  s.cancel_at_period_end
FROM organizations o
JOIN subscriptions s ON s.organization_id = o.id
WHERE o.id = 'ORG_ID';
```

**Soluções**:
1. Renovar assinatura
2. Contatar suporte comercial
3. Reativar plano suspenso

## Problemas de Super Admin

### 🔴 Super Admin não vê interface administrativa

**Sintomas**:
- Interface comum ao invés de Super Admin
- Não consegue acessar outras organizações

**Diagnóstico**:

1. **Verificar registro de Super Admin**:
```sql
SELECT sa.*, u.email
FROM super_admins sa
JOIN auth.users u ON u.id = sa.user_id
WHERE u.email = 'admin@exemplo.com';
```

2. **Verificar se está ativo**:
```sql
SELECT is_active FROM super_admins 
WHERE user_id = 'USER_ID';
```

**Soluções**:

1. **Criar registro se não existe**:
```sql
INSERT INTO super_admins (user_id, created_by, is_active)
VALUES ('USER_ID', 'CREATOR_ID', true);
```

2. **Ativar se desativado**:
```sql
UPDATE super_admins 
SET is_active = true 
WHERE user_id = 'USER_ID';
```

3. **Limpar cache**:
```bash
node scripts/clear-user-type-cache.js USER_ID
```

### 🔴 Super Admin não consegue acessar organização específica

**Diagnóstico**:
```bash
node scripts/diagnose-super-admin-access.js USER_ID ORG_ID
```

**Soluções**:
1. Verificar se organização existe e está ativa
2. Verificar RLS policies
3. Limpar cache de permissões

## Problemas de Performance

### 🔴 Verificação de permissões lenta

**Sintomas**:
- APIs demoram para responder
- Interface trava ao carregar

**Diagnóstico**:

1. **Verificar índices**:
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('memberships', 'user_client_access', 'super_admins');
```

2. **Analisar queries lentas**:
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%memberships%'
ORDER BY mean_exec_time DESC;
```

**Soluções**:

1. **Criar índices faltantes**:
```sql
CREATE INDEX CONCURRENTLY idx_memberships_user_org 
ON memberships(user_id, organization_id);

CREATE INDEX CONCURRENTLY idx_user_client_access_user 
ON user_client_access(user_id) WHERE is_active = true;
```

2. **Otimizar queries**:
```sql
-- Usar EXISTS ao invés de JOIN quando possível
SELECT * FROM clients c
WHERE EXISTS (
  SELECT 1 FROM memberships m 
  WHERE m.organization_id = c.org_id 
  AND m.user_id = 'USER_ID'
);
```

### 🔴 Cache não está funcionando

**Sintomas**:
- Mesmas queries executadas repetidamente
- Performance não melhora com uso

**Diagnóstico**:
```bash
node scripts/check-cache-status.js
```

**Soluções**:

1. **Verificar configuração do Redis**:
```typescript
// Verificar conexão
const redis = new Redis(process.env.REDIS_URL)
await redis.ping()
```

2. **Limpar cache corrompido**:
```bash
node scripts/clear-all-cache.js
```

3. **Reconfigurar TTL**:
```typescript
// Ajustar tempos de cache
const CACHE_TTL = {
  userType: 300,      // 5 minutos
  planLimits: 600,    // 10 minutos
  clientAccess: 120   // 2 minutos
}
```

## Problemas de Cache

### 🔴 Dados desatualizados após mudanças

**Sintomas**:
- Permissões não atualizam imediatamente
- Interface mostra dados antigos

**Soluções**:

1. **Invalidar cache específico**:
```bash
# Cache de tipo de usuário
node scripts/invalidate-user-type-cache.js USER_ID

# Cache de acesso a clientes
node scripts/invalidate-client-access-cache.js USER_ID

# Cache de limites de plano
node scripts/invalidate-plan-limits-cache.js ORG_ID
```

2. **Forçar atualização**:
```typescript
// No código da aplicação
await userAccessCache.invalidateUser(userId)
await userAccessCache.invalidateOrganization(orgId)
```

## Scripts de Diagnóstico

### Scripts Disponíveis

```bash
# Diagnóstico geral do sistema
node scripts/system-health-check.js

# Verificar usuário específico
node scripts/diagnose-user-access.js usuario@exemplo.com

# Verificar organização
node scripts/diagnose-organization.js ORG_ID

# Verificar Super Admin
node scripts/diagnose-super-admin.js admin@exemplo.com

# Verificar cache
node scripts/cache-diagnostics.js

# Verificar RLS policies
node scripts/check-rls-policies.js

# Verificar limites de plano
node scripts/check-all-plan-limits.js
```

### Exemplo de Uso

```bash
# Diagnóstico completo de usuário
node scripts/diagnose-user-access.js joao@empresa.com

# Saída esperada:
# ✅ Usuário existe no auth.users
# ✅ Tem membership ativa na organização ABC
# ✅ Role: admin
# ✅ Pode gerenciar usuários
# ❌ Não tem acesso ao cliente XYZ
# ⚠️  Cache desatualizado (última atualização: 10 min atrás)
```

## Logs e Monitoramento

### Verificar Logs de Auditoria

```sql
-- Últimas ações do usuário
SELECT 
  operation,
  success,
  error_message,
  created_at
FROM user_access_audit_log
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 20;
```

### Monitorar Tentativas de Acesso Negado

```sql
-- Acessos negados por usuário
SELECT 
  u.email,
  COUNT(*) as denied_attempts,
  MAX(ual.created_at) as last_attempt
FROM user_access_audit_log ual
JOIN auth.users u ON u.id = ual.user_id
WHERE ual.success = false
AND ual.created_at > NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email
ORDER BY denied_attempts DESC;
```

## Contato para Suporte

### Suporte Técnico
- **Email**: tech-support@empresa.com
- **Slack**: #user-access-support
- **Horário**: Segunda a Sexta, 9h às 18h

### Suporte de Emergência
- **Email**: emergency@empresa.com
- **Telefone**: +55 11 9999-9999
- **Disponível**: 24/7

### Informações para Incluir no Ticket

1. **Descrição do problema**
2. **Passos para reproduzir**
3. **Usuário/organização afetados**
4. **Mensagens de erro exatas**
5. **Logs relevantes**
6. **Resultado dos scripts de diagnóstico**

### Template de Ticket

```markdown
## Problema de Acesso de Usuário

**Severidade**: Alta/Média/Baixa
**Usuário Afetado**: usuario@exemplo.com
**Organização**: Nome da Organização
**Tipo de Usuário**: Super Admin/Org Admin/Common User

### Descrição
[Descreva o problema detalhadamente]

### Passos para Reproduzir
1. [Passo 1]
2. [Passo 2]
3. [Resultado esperado vs obtido]

### Logs/Erros
```
[Cole logs relevantes aqui]
```

### Diagnóstico Executado
```bash
node scripts/diagnose-user-access.js usuario@exemplo.com
# [Cole resultado aqui]
```

### Impacto
[Descreva o impacto no negócio/usuários]
```

---

**Última atualização**: Dezembro 2024  
**Versão**: 1.0.0