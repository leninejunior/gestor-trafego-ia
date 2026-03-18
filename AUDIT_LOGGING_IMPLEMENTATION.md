# Sistema de Auditoria - Implementação Completa

## Visão Geral

Sistema completo de auditoria para o controle de acesso de usuários, implementando os requisitos 7.5 do design document.

## Componentes Implementados

### 1. Database Schema (`database/migrations/11-user-access-audit-log.sql`)

**Tabela Principal: `user_access_audit_log`**

Campos principais:
- `event_type`: Tipo de evento (user_type_change, access_grant, access_revoke, access_denied, etc.)
- `event_category`: Categoria (user_management, access_control, authentication, authorization, security)
- `actor_user_id`: Quem executou a ação
- `target_user_id`: Quem foi afetado
- `organization_id`: Organização relacionada
- `client_id`: Cliente relacionado
- `old_values`: Estado anterior (JSON)
- `new_values`: Novo estado (JSON)
- `success`: Se a operação foi bem-sucedida
- `error_message`: Mensagem de erro (se aplicável)
- `metadata`: Metadados adicionais (JSON)

**Índices Criados:**
- Por actor, target, organização, cliente
- Por tipo de evento e categoria
- Por data de criação
- Por sucesso/falha
- Índices compostos para queries comuns

**RLS Policies:**
- Super admins veem todos os logs
- Org admins veem logs de sua organização
- Usuários veem seus próprios logs
- Service role tem acesso total

**Funções Auxiliares:**
- `log_user_access_event()`: Função para registrar eventos
- `get_audit_statistics()`: Obter estatísticas agregadas
- `cleanup_old_audit_logs()`: Limpeza de logs antigos

**View:**
- `user_access_audit_log_detailed`: View com joins para exibição

### 2. Serviço de Auditoria (`src/lib/services/user-access-audit.ts`)

**Classe: `UserAccessAuditService`**

Métodos principais:
- `logUserTypeChange()`: Log de mudanças de tipo de usuário
- `logAccessGrant()`: Log de concessão de acesso
- `logAccessRevoke()`: Log de revogação de acesso
- `logAccessDenied()`: Log de tentativas de acesso negado
- `logUserCreate()`: Log de criação de usuário
- `logUserUpdate()`: Log de atualização de usuário
- `logUserDelete()`: Log de exclusão de usuário
- `logPlanLimitExceeded()`: Log de limite de plano excedido
- `getAuditLogs()`: Buscar logs com filtros
- `getAuditStatistics()`: Obter estatísticas
- `cleanupOldLogs()`: Limpar logs antigos

**Enums:**
- `AuditEventType`: Tipos de eventos
- `AuditEventCategory`: Categorias de eventos
- `AuditResourceType`: Tipos de recursos

### 3. Integração com User Management Service

O serviço de gerenciamento de usuários foi atualizado para registrar automaticamente:

**Criação de Usuário:**
- Log de sucesso com dados do novo usuário
- Log de falha com motivo (permissão negada, limite excedido, etc.)

**Atualização de Usuário:**
- Log com valores antigos e novos
- Rastreamento de mudanças de role

**Exclusão de Usuário:**
- Log com dados do usuário deletado
- Registro de cascade cleanup

**Concessão de Acesso:**
- Log com permissões concedidas
- Validação de mesma organização

**Revogação de Acesso:**
- Log com permissões anteriores
- Soft delete para auditoria

**Tentativas de Acesso Negado:**
- Log de todas as tentativas bloqueadas
- Motivo da negação
- Contexto completo (IP, user agent, etc.)

### 4. APIs de Auditoria

**GET /api/super-admin/audit-logs**
- Buscar logs com filtros avançados
- Paginação
- Filtros: organizationId, actorUserId, targetUserId, eventType, eventCategory, success, startDate, endDate
- Apenas super admins

**GET /api/super-admin/audit-stats**
- Estatísticas agregadas
- Período configurável
- Por organização (opcional)
- Apenas super admins

### 5. Dashboard de Auditoria (`src/components/admin/audit-dashboard.tsx`)

**Componente React: `AuditDashboard`**

Funcionalidades:
- Visualização de logs em tempo real
- Filtros avançados (tipo, categoria, status, datas)
- Estatísticas visuais (cards com métricas)
- Análise por tipo de evento
- Análise por categoria
- Paginação
- Refresh manual
- Indicadores visuais de sucesso/falha
- Detalhes completos de cada evento

**Tabs:**
1. **Logs de Auditoria**: Lista completa com filtros
2. **Análises**: Estatísticas e gráficos

**Cards de Estatísticas:**
- Total de eventos
- Eventos bem-sucedidos
- Eventos falhados
- Usuários ativos

### 6. Integração com Super Admin Dashboard

O dashboard de super admin foi atualizado para incluir a aba "Logs de Auditoria" com o componente `AuditDashboard` completo.

## Tipos de Eventos Registrados

### User Management
- `user_create`: Criação de usuário
- `user_update`: Atualização de usuário
- `user_delete`: Exclusão de usuário
- `user_type_change`: Mudança de tipo de usuário

### Access Control
- `access_grant`: Concessão de acesso a cliente
- `access_revoke`: Revogação de acesso a cliente
- `access_denied`: Tentativa de acesso negado

### Authorization
- `plan_limit_exceeded`: Limite de plano excedido
- `permission_check`: Verificação de permissão

### Authentication
- `login_attempt`: Tentativa de login (futuro)

## Contexto de Auditoria

Cada evento pode incluir:
- `ipAddress`: Endereço IP da requisição
- `userAgent`: User agent do navegador
- `requestId`: ID da requisição para correlação
- `sessionId`: ID da sessão do usuário

## Políticas de Retenção

- Logs são mantidos indefinidamente por padrão
- Função `cleanup_old_audit_logs()` permite limpeza baseada em dias de retenção
- Recomendado: 365 dias para compliance

## Segurança

### Row Level Security (RLS)
- Super admins: acesso total
- Org admins: apenas logs de sua organização
- Usuários comuns: apenas seus próprios logs
- Service role: acesso total para logging

### Dados Sensíveis
- Senhas nunca são registradas
- Tokens são omitidos dos logs
- PII é minimizado quando possível

## Performance

### Índices
- Índices em todas as colunas de filtro comum
- Índices compostos para queries frequentes
- Índice em created_at DESC para ordenação

### Caching
- Estatísticas podem ser cacheadas
- Logs recentes podem ser cacheados por curto período

## Uso

### Registrar Evento Manualmente

```typescript
import { UserAccessAuditService, AuditContext } from '@/lib/services/user-access-audit'

const auditService = new UserAccessAuditService()

// Contexto da requisição
const context: AuditContext = {
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent'),
  requestId: request.headers.get('x-request-id')
}

// Log de mudança de tipo
await auditService.logUserTypeChange(
  adminUserId,
  targetUserId,
  'common_user',
  'org_admin',
  organizationId,
  context
)

// Log de acesso negado
await auditService.logAccessDenied(
  userId,
  'clients',
  'create',
  'Usuários comuns não podem criar clientes',
  organizationId,
  clientId,
  context
)
```

### Buscar Logs

```typescript
const logs = await auditService.getAuditLogs({
  organizationId: 'org-123',
  eventType: AuditEventType.ACCESS_DENIED,
  startDate: new Date('2025-01-01'),
  endDate: new Date(),
  limit: 50,
  offset: 0
})
```

### Obter Estatísticas

```typescript
const stats = await auditService.getAuditStatistics(
  'org-123', // opcional
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
  new Date()
)
```

## Aplicação da Migração

1. Copiar o conteúdo de `database/migrations/11-user-access-audit-log.sql`
2. Abrir Supabase SQL Editor
3. Colar e executar o SQL
4. Verificar que a tabela foi criada: `SELECT * FROM user_access_audit_log LIMIT 1;`
5. Verificar RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'user_access_audit_log';`

## Próximos Passos

1. ✅ Implementar logging em todas as operações de usuário
2. ✅ Criar dashboard de visualização
3. ✅ Adicionar estatísticas agregadas
4. ⏳ Adicionar alertas para eventos suspeitos
5. ⏳ Implementar exportação de logs (CSV, JSON)
6. ⏳ Adicionar gráficos de tendências
7. ⏳ Implementar retenção automática de logs

## Compliance

Este sistema de auditoria atende aos seguintes requisitos:

- **Requirement 7.5**: Log de todas as mudanças de tipo de usuário ✅
- **Requirement 7.5**: Log de concessões e revogações de acesso ✅
- **Requirement 7.5**: Log de tentativas de acesso negado ✅
- **Requirement 7.5**: Dashboard de auditoria para super admins ✅

## Troubleshooting

### Logs não aparecem
- Verificar se a migração foi aplicada
- Verificar RLS policies
- Verificar se o usuário é super admin

### Performance lenta
- Verificar índices
- Considerar particionamento da tabela
- Implementar arquivamento de logs antigos

### Erro ao registrar log
- Verificar service role key
- Verificar se a função `log_user_access_event` existe
- Verificar constraints da tabela

## Documentação Relacionada

- Design Document: `.kiro/specs/user-access-control-system/design.md`
- Requirements: `.kiro/specs/user-access-control-system/requirements.md`
- Tasks: `.kiro/specs/user-access-control-system/tasks.md`
