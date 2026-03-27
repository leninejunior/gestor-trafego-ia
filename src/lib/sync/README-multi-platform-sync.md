# Multi-Platform Sync Engine

Sistema de sincronizaÃ§Ã£o multi-plataforma para dados histÃ³ricos de campanhas de anÃºncios.

## Arquitetura

### Componentes Principais

1. **MultiPlatformSyncEngine** - Orquestrador principal
   - Gerencia adapters de diferentes plataformas
   - Executa sincronizaÃ§Ãµes de clientes
   - Calcula prÃ³ximos horÃ¡rios de sync baseado em limites de plano

2. **SyncQueue** - Sistema de filas com prioridade
   - Gerencia fila de jobs de sincronizaÃ§Ã£o
   - Implementa retry logic com exponential backoff
   - Controla concorrÃªncia (mÃ¡x 3 syncs simultÃ¢neos)

3. **BaseSyncAdapter** - Classe abstrata base
   - Define interface comum para todos os adapters
   - Implementa lÃ³gica compartilhada (autenticaÃ§Ã£o, rate limiting, etc)

4. **Platform Adapters** - ImplementaÃ§Ãµes especÃ­ficas
   - GoogleAdsSyncAdapter - SincronizaÃ§Ã£o com Google Ads
   - MetaAdsSyncAdapter - SincronizaÃ§Ã£o com Meta Ads (a ser implementado)

## Fluxo de SincronizaÃ§Ã£o

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Cron: sync-scheduler (a cada 5 minutos)                    â”‚
â”‚  - Verifica configuraÃ§Ãµes de sync que estÃ£o pendentes       â”‚
â”‚  - Cria jobs de sincronizaÃ§Ã£o                               â”‚
â”‚  - Adiciona jobs Ã  fila com prioridade                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Cron: sync-executor (a cada 1 minuto)                      â”‚
â”‚  - Processa jobs da fila                                    â”‚
â”‚  - Respeita limite de concorrÃªncia (3 simultÃ¢neos)          â”‚
â”‚  - Implementa retry com exponential backoff                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  MultiPlatformSyncEngine.syncClient()                       â”‚
â”‚  1. Busca configuraÃ§Ã£o de sync do cliente                   â”‚
â”‚  2. Seleciona adapter apropriado (Meta/Google)              â”‚
â”‚  3. Autentica com a plataforma                              â”‚
â”‚  4. Busca campanhas                                         â”‚
â”‚  5. Busca insights para cada campanha                       â”‚
â”‚  6. Armazena dados no cache histÃ³rico                       â”‚
â”‚  7. Atualiza prÃ³ximo horÃ¡rio de sync                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Cron: data-cleanup (diariamente Ã s 3h)                     â”‚
â”‚  - Remove dados expirados baseado em retenÃ§Ã£o do plano      â”‚
â”‚  - Processa todos os clientes                               â”‚
â”‚  - Registra estatÃ­sticas de limpeza                         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## ConfiguraÃ§Ã£o de Sync

Cada cliente pode ter mÃºltiplas configuraÃ§Ãµes de sync (uma por plataforma):

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

### PriorizaÃ§Ã£o

Jobs sÃ£o priorizados baseado em:
- **+100 pontos**: Nunca sincronizado antes
- **+10 pontos por dia**: Dias de atraso
- **+50 pontos**: Teve erro na Ãºltima tentativa

### Retry Logic

- **MÃ¡ximo de tentativas**: 3
- **Backoff inicial**: 1 segundo
- **Backoff mÃ¡ximo**: 5 minutos
- **Multiplicador**: 2x a cada tentativa

Exemplo de delays:
- 1Âª tentativa: imediato
- 2Âª tentativa: apÃ³s 1 segundo
- 3Âª tentativa: apÃ³s 2 segundos
- 4Âª tentativa: apÃ³s 4 segundos

### ConcorrÃªncia

- MÃ¡ximo de 3 syncs simultÃ¢neos
- Evita sobrecarga de APIs externas
- Garante uso eficiente de recursos

## Cron Jobs

### 1. Sync Scheduler (`/api/cron/sync-scheduler`)

**FrequÃªncia**: A cada 5 minutos

**FunÃ§Ã£o**: Verifica quais clientes precisam ser sincronizados e agenda jobs

**Endpoint**:
```bash
# AutomÃ¡tico (plataforma de deploy Cron)
GET /api/cron/sync-scheduler

# Manual
POST /api/cron/sync-scheduler
{
  "force": true  # ForÃ§a agendamento mesmo se nÃ£o estiver na hora
}
```

### 2. Sync Executor (`/api/cron/sync-executor`)

**FrequÃªncia**: A cada 1 minuto

**FunÃ§Ã£o**: Executa jobs pendentes da fila

**Endpoints**:
```bash
# Iniciar processamento
GET /api/cron/sync-executor

# AÃ§Ãµes de gerenciamento
POST /api/cron/sync-executor
{
  "action": "status"        # Ver status da fila
  "action": "retry_failed"  # Retentar jobs falhados
  "action": "clear"         # Limpar fila
  "action": "stop"          # Parar processamento
}
```

### 3. Data Cleanup (`/api/cron/data-cleanup`)

**FrequÃªncia**: Diariamente Ã s 3h

**FunÃ§Ã£o**: Remove dados expirados baseado em retenÃ§Ã£o do plano

**Endpoints**:
```bash
# AutomÃ¡tico (plataforma de deploy Cron)
GET /api/cron/data-cleanup

# Manual para cliente especÃ­fico
POST /api/cron/data-cleanup
{
  "client_id": "uuid",
  "retention_days": 90  # Opcional, usa limite do plano se omitido
}
```

## SeguranÃ§a

Todos os cron jobs requerem autenticaÃ§Ã£o via header:

```bash
Authorization: Bearer <CRON_SECRET>
```

Configure a variÃ¡vel de ambiente:
```env
CRON_SECRET=seu-secret-aqui
```

## Monitoramento

### EstatÃ­sticas da Fila

```typescript
interface QueueStats {
  total_jobs: number;        // Total de jobs
  pending_jobs: number;      // Aguardando processamento
  running_jobs: number;      // Em execuÃ§Ã£o
  failed_jobs: number;       // Falhados (apÃ³s max retries)
  completed_jobs: number;    // Completados com sucesso
  average_duration_ms: number; // DuraÃ§Ã£o mÃ©dia
}
```

### Logs de SincronizaÃ§Ã£o

Cada sync Ã© registrado na tabela `sync_logs`:

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

- **sync_interval_hours**: Intervalo entre sincronizaÃ§Ãµes (1-168 horas)
- **data_retention_days**: PerÃ­odo de retenÃ§Ã£o de dados (30-3650 dias)

## Tratamento de Erros

### Erros de AutenticaÃ§Ã£o

- Token expirado â†’ Tenta refresh automÃ¡tico
- Refresh falha â†’ Marca sync como 'error', notifica usuÃ¡rio

### Erros de API

- Rate limit â†’ Aguarda e retenta com backoff
- Erro temporÃ¡rio â†’ Retenta atÃ© 3 vezes
- Erro permanente â†’ Marca como falhado, registra erro

### Erros de Rede

- Timeout â†’ Retenta com backoff
- ConexÃ£o perdida â†’ Retenta com backoff

## Exemplo de Uso

### Adicionar ConfiguraÃ§Ã£o de Sync

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
curl -X POST https://seu-app.seu-dominio.com/api/cron/sync-executor \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'
```

## PrÃ³ximos Passos

1. Implementar MetaAdsSyncAdapter
2. Adicionar mÃ©tricas de observabilidade (Prometheus/Grafana)
3. Implementar notificaÃ§Ãµes de falhas
4. Adicionar dashboard de monitoramento no admin panel
5. Implementar sync incremental (apenas dados novos)

