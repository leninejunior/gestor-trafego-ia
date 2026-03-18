# Multi-Platform Sync Engine

Sistema de sincronização multi-plataforma para dados históricos de campanhas de anúncios.

## Arquitetura

### Componentes Principais

1. **MultiPlatformSyncEngine** - Orquestrador principal
   - Gerencia adapters de diferentes plataformas
   - Executa sincronizações de clientes
   - Calcula próximos horários de sync baseado em limites de plano

2. **SyncQueue** - Sistema de filas com prioridade
   - Gerencia fila de jobs de sincronização
   - Implementa retry logic com exponential backoff
   - Controla concorrência (máx 3 syncs simultâneos)

3. **BaseSyncAdapter** - Classe abstrata base
   - Define interface comum para todos os adapters
   - Implementa lógica compartilhada (autenticação, rate limiting, etc)

4. **Platform Adapters** - Implementações específicas
   - GoogleAdsSyncAdapter - Sincronização com Google Ads
   - MetaAdsSyncAdapter - Sincronização com Meta Ads (a ser implementado)

## Fluxo de Sincronização

```
┌─────────────────────────────────────────────────────────────┐
│  Cron: sync-scheduler (a cada 5 minutos)                    │
│  - Verifica configurações de sync que estão pendentes       │
│  - Cria jobs de sincronização                               │
│  - Adiciona jobs à fila com prioridade                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Cron: sync-executor (a cada 1 minuto)                      │
│  - Processa jobs da fila                                    │
│  - Respeita limite de concorrência (3 simultâneos)          │
│  - Implementa retry com exponential backoff                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MultiPlatformSyncEngine.syncClient()                       │
│  1. Busca configuração de sync do cliente                   │
│  2. Seleciona adapter apropriado (Meta/Google)              │
│  3. Autentica com a plataforma                              │
│  4. Busca campanhas                                         │
│  5. Busca insights para cada campanha                       │
│  6. Armazena dados no cache histórico                       │
│  7. Atualiza próximo horário de sync                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Cron: data-cleanup (diariamente às 3h)                     │
│  - Remove dados expirados baseado em retenção do plano      │
│  - Processa todos os clientes                               │
│  - Registra estatísticas de limpeza                         │
└─────────────────────────────────────────────────────────────┘
```

## Configuração de Sync

Cada cliente pode ter múltiplas configurações de sync (uma por plataforma):

```typescript
interface SyncConfig {
  id: string;
  platform: 'meta' | 'google';
  client_id: string;
  account_id: string;
  
  // OAuth tokens
  access_token: string;
  refresh_token?: string;
  token_expires_at?: Date;
  
  // Scheduling
  last_sync_at?: Date;
  next_sync_at?: Date;
  sync_status: 'pending' | 'active' | 'paused' | 'error';
  last_error?: string;
}
```

## Sistema de Filas

### Priorização

Jobs são priorizados baseado em:
- **+100 pontos**: Nunca sincronizado antes
- **+10 pontos por dia**: Dias de atraso
- **+50 pontos**: Teve erro na última tentativa

### Retry Logic

- **Máximo de tentativas**: 3
- **Backoff inicial**: 1 segundo
- **Backoff máximo**: 5 minutos
- **Multiplicador**: 2x a cada tentativa

Exemplo de delays:
- 1ª tentativa: imediato
- 2ª tentativa: após 1 segundo
- 3ª tentativa: após 2 segundos
- 4ª tentativa: após 4 segundos

### Concorrência

- Máximo de 3 syncs simultâneos
- Evita sobrecarga de APIs externas
- Garante uso eficiente de recursos

## Cron Jobs

### 1. Sync Scheduler (`/api/cron/sync-scheduler`)

**Frequência**: A cada 5 minutos

**Função**: Verifica quais clientes precisam ser sincronizados e agenda jobs

**Endpoint**:
```bash
# Automático (Vercel Cron)
GET /api/cron/sync-scheduler

# Manual
POST /api/cron/sync-scheduler
{
  "force": true  # Força agendamento mesmo se não estiver na hora
}
```

### 2. Sync Executor (`/api/cron/sync-executor`)

**Frequência**: A cada 1 minuto

**Função**: Executa jobs pendentes da fila

**Endpoints**:
```bash
# Iniciar processamento
GET /api/cron/sync-executor

# Ações de gerenciamento
POST /api/cron/sync-executor
{
  "action": "status"        # Ver status da fila
  "action": "retry_failed"  # Retentar jobs falhados
  "action": "clear"         # Limpar fila
  "action": "stop"          # Parar processamento
}
```

### 3. Data Cleanup (`/api/cron/data-cleanup`)

**Frequência**: Diariamente às 3h

**Função**: Remove dados expirados baseado em retenção do plano

**Endpoints**:
```bash
# Automático (Vercel Cron)
GET /api/cron/data-cleanup

# Manual para cliente específico
POST /api/cron/data-cleanup
{
  "client_id": "uuid",
  "retention_days": 90  # Opcional, usa limite do plano se omitido
}
```

## Segurança

Todos os cron jobs requerem autenticação via header:

```bash
Authorization: Bearer <CRON_SECRET>
```

Configure a variável de ambiente:
```env
CRON_SECRET=seu-secret-aqui
```

## Monitoramento

### Estatísticas da Fila

```typescript
interface QueueStats {
  total_jobs: number;        // Total de jobs
  pending_jobs: number;      // Aguardando processamento
  running_jobs: number;      // Em execução
  failed_jobs: number;       // Falhados (após max retries)
  completed_jobs: number;    // Completados com sucesso
  average_duration_ms: number; // Duração média
}
```

### Logs de Sincronização

Cada sync é registrado na tabela `sync_logs`:

```sql
SELECT 
  sc.client_id,
  sc.platform,
  sl.status,
  sl.records_synced,
  sl.duration_ms,
  sl.started_at,
  sl.completed_at
FROM sync_logs sl
JOIN sync_configurations sc ON sc.id = sl.sync_config_id
ORDER BY sl.started_at DESC;
```

## Limites por Plano

O sistema respeita os limites configurados em `plan_limits`:

- **sync_interval_hours**: Intervalo entre sincronizações (1-168 horas)
- **data_retention_days**: Período de retenção de dados (30-3650 dias)

## Tratamento de Erros

### Erros de Autenticação

- Token expirado → Tenta refresh automático
- Refresh falha → Marca sync como 'error', notifica usuário

### Erros de API

- Rate limit → Aguarda e retenta com backoff
- Erro temporário → Retenta até 3 vezes
- Erro permanente → Marca como falhado, registra erro

### Erros de Rede

- Timeout → Retenta com backoff
- Conexão perdida → Retenta com backoff

## Exemplo de Uso

### Adicionar Configuração de Sync

```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();

await supabase.from('sync_configurations').insert({
  client_id: 'client-uuid',
  platform: 'google',
  account_id: '123-456-7890',
  access_token: 'token',
  refresh_token: 'refresh',
  token_expires_at: new Date(Date.now() + 3600000),
  sync_status: 'active',
  next_sync_at: new Date() // Sync imediatamente
});
```

### Sincronizar Cliente Manualmente

```typescript
import { multiPlatformSyncEngine } from '@/lib/sync/multi-platform-sync-engine';
import { AdPlatform } from '@/lib/types/sync';

const result = await multiPlatformSyncEngine.syncClient(
  'client-uuid',
  AdPlatform.GOOGLE
);

console.log(`Synced ${result.records_synced} records in ${result.duration_ms}ms`);
```

### Verificar Status da Fila

```bash
curl -X POST https://seu-app.vercel.app/api/cron/sync-executor \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'
```

## Próximos Passos

1. Implementar MetaAdsSyncAdapter
2. Adicionar métricas de observabilidade (Prometheus/Grafana)
3. Implementar notificações de falhas
4. Adicionar dashboard de monitoramento no admin panel
5. Implementar sync incremental (apenas dados novos)
