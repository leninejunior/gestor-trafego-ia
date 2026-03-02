# Flying Fox V2 (Base)

Projeto base da V2 para evolucao incremental.

## Stack inicial
- Next.js + TypeScript
- Prisma ORM
- Postgres local via Docker Compose

## Como rodar local
```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:migrate -- --name init
npm run dev
```

## Checklist de variaveis por ambiente (GT-10)

### Dev
- [ ] `DATABASE_URL`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_JWT_SECRET`

### Stage/Staging
- [ ] `DATABASE_URL`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_JWT_SECRET`

### Prod
- [ ] `DATABASE_URL`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_JWT_SECRET`

Status GT-10:
- [x] `.env.example` com `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`
- [x] Checklist de variaveis por ambiente (dev/staging/prod)

## GT-11 - Supabase Auth (login/logout + guardas)

Rotas:
- `/login` (publica)
- `/private` (protegida)
- `/api/private/session` (retorna `401` para anonimo)

Checklist de validacao (DoD):
- [x] Usuario logado acessa `/private`
- [x] Usuario anonimo recebe redirect para `/login` ao acessar `/private`
- [x] Usuario anonimo recebe `401` ao acessar `/api/private/session`

## GT-13 - Provisionamento no primeiro login

Escopo:
- criar/atualizar `users` no Postgres V2 usando `auth.users.id` como chave primaria

Checklist de validacao (DoD):
- [x] Primeiro login cria usuario local sem duplicidade (upsert por `id`)

## GT-12 - Modelagem inicial do dominio core

Escopo:
- `organizations`
- `memberships`
- `clients`
- `meta_connections`
- `campaigns` (snapshot inicial)

Checklist de validacao (DoD):
- [x] Schema Prisma versionado
- [x] Migracoes aplicadas em dev

## GT-14 - Repositorios Prisma para dominio core

Escopo:
- camada de acesso a dados (Prisma) para entidades core sem `supabase-js`

Checklist de validacao (DoD):
- [x] CRUD basico coberto por testes unitarios

## GT-15 - Carga inicial da base atual para V2

Escopo:
- ETL idempotente de carga completa
- relatorio de reconciliacao com contabilizacao de divergencias

Como executar:
```bash
# simulacao sem escrita
SOURCE_DATABASE_URL="postgresql://..." npm run etl:initial-load:dry-run

# carga real
SOURCE_DATABASE_URL="postgresql://..." npm run etl:initial-load
```

Saida:
- relatorio JSON em `apps/v2/reports/gt15-initial-load-report.json` (ou `--report`)

Checklist de validacao (DoD):
- [x] Carga executa
- [x] Carga contabiliza divergencias

## GT-16 - Sincronizacao incremental (delta)

Escopo:
- sync incremental por `timestamp` (ou `sync_changelog` quando disponivel)
- retry com backoff
- logs estruturados em arquivo
- reconciliacao minima por execucao

Como executar:
```bash
# dry-run (sem escrita)
SOURCE_DATABASE_URL="postgresql://..." npm run sync:delta:dry-run

# sync real
SOURCE_DATABASE_URL="postgresql://..." npm run sync:delta

# forcar cursor inicial
SOURCE_DATABASE_URL="postgresql://..." npm run sync:delta -- --since 2026-01-01T00:00:00.000Z
```

Saidas:
- relatorio JSON em `apps/v2/reports/gt16-delta-report.json`
- estado do cursor em `apps/v2/reports/gt16-delta-state.json`
- log NDJSON em `apps/v2/reports/gt16-delta.log`

Checklist de validacao (DoD):
- [x] Delta roda sem duplicidade (UPSERT idempotente)
- [x] Delta gera reconciliacao minima (source/loaded/skipped/divergences + cursor)

## GT-17 - Motor de relatorio diario (Meta)

Escopo:
- consolidar metricas diarias de campanhas Meta
- gerar mensagem final pronta para disparo

Endpoint:
- `GET /api/reports/meta/daily`
- query opcional: `date=YYYY-MM-DD` (UTC)

Resposta:
- `period` com data e faixa UTC
- `report.metrics` com `alcance`, `impressoes`, `frequencia`, `CTR`, `CPM`, `cliques`, `CPC`, `custo por mensagem`, `investimento`
- `message` final pronta para envio

Checklist de validacao (DoD):
- [x] Endpoint retorna mensagem final pronta para disparo

## GT-18 - Integracao Papi para envio em grupos

Escopo:
- client Papi para envio de mensagem em grupo
- endpoint de teste para disparo
- logs de envio e erro

Endpoint de teste:
- `POST /api/reports/meta/daily/send-test`
- query/body opcional: `date=YYYY-MM-DD`
- body opcional: `{ "groupId": "...", "message": "..." }`

Comportamento:
- monta a mensagem diaria (GT-17) quando `message` nao e enviado
- envia para `PAPI_GROUP_ID` (ou `groupId` informado)
- registra logs em `apps/v2/reports/gt18-papi-send.log`

Checklist de validacao (DoD):
- [x] Endpoint de teste envia para grupo configurado

## GT-19 - Deploy V2 na VPS (staging)

Escopo:
- `Dockerfile` de producao para Next.js
- `docker-compose.staging.yml` com app + proxy reverso
- healthcheck da aplicacao
- variaveis seguras via arquivo de ambiente

Arquivos principais:
- `Dockerfile`
- `docker-compose.staging.yml`
- `deploy/nginx/staging.conf`
- `.env.staging.example`
- `app/api/health/route.ts`

Como subir em staging:
```bash
cp .env.staging.example .env.staging
# editar .env.staging com valores reais (nao commitar)

npm run deploy:staging:up
curl -fsS http://localhost:8080/api/health
```

Como derrubar:
```bash
npm run deploy:staging:down
```

Checklist de validacao (DoD):
- [x] Dockerfile criado
- [x] Compose + proxy reverso criados
- [x] Healthcheck `/api/health` criado
- [x] Variaveis seguras documentadas em `.env.staging.example`

## GT-19.1 - Deploy V2 na VPS (producao, sem modo dev)

Objetivo:
- rodar V2 em `NODE_ENV=production` na VPS (evitar lentidao de `next dev`)
- manter app atras de proxy reverso e healthcheck
- manter backup diario no mesmo padrao operacional

Arquivos principais:
- `docker-compose.production.yml`
- `deploy/nginx/production.http.conf`
- `deploy/nginx/production.ssl.conf`
- `.env.production.example`
- `scripts/ssl-issue.sh`
- `scripts/ssl-renew.sh`
- `docs/POSTGRES_BACKUP_RESTORE_RUNBOOK.md`

Como subir em producao:
```bash
cp .env.production.example .env.production
# editar .env.production com valores reais (nao commitar)
# dominio inicial: edith.engrene.com

docker compose -f docker-compose.production.yml --env-file .env.production up --build -d
curl -fsS http://localhost:${PROD_HTTP_PORT:-80}/api/health
```

Ativar SSL (Let's Encrypt):
```bash
sh ./scripts/ssl-issue.sh
curl -I https://edith.engrene.com/api/health
```

Renovar SSL:
```bash
sh ./scripts/ssl-renew.sh
```

Como derrubar producao:
```bash
docker compose -f docker-compose.production.yml --env-file .env.production down
```

Como acompanhar logs:
```bash
docker compose -f docker-compose.production.yml --env-file .env.production logs -f app proxy backup
```

## GT-20 - Backups e restore do Postgres (VPS)

Escopo:
- backup diario automatizado do Postgres
- runbook de restore

Entregas:
- `scripts/postgres-backup.sh`
- `scripts/postgres-restore.sh`
- servico `backup` em `docker-compose.staging.yml`
- runbook: `docs/POSTGRES_BACKUP_RESTORE_RUNBOOK.md`

Comandos:
```bash
# backup sob demanda
npm run backup:postgres

# restore manual (informe BACKUP_FILE e TARGET_DATABASE_URL)
BACKUP_FILE="backups/postgres/<arquivo>.dump" \
TARGET_DATABASE_URL="postgresql://..." \
RESTORE_DROP_SCHEMA=true \
npm run restore:postgres
```

Checklist de validacao (DoD):
- [x] Backup diario automatizado configurado
- [x] Runbook de restore criado
- [x] Restore testado em homologacao

## GT-21 - Testes de paridade V1 vs V2

Escopo:
- comparar KPIs diarios entre V1 (source) e V2 (target)
- comparar respostas criticas por organizacao (presenca da organizacao e contagem de campanhas)
- validar diferencas com tolerancia configuravel

Entregas:
- `scripts/parity-v1-v2.cjs`
- relatorio JSON em `apps/v2/reports/gt21-parity-report.json`

Como executar:
```bash
# paridade global por data (UTC)
SOURCE_DATABASE_URL="postgresql://..." npm run parity:check -- --date 2026-02-26

# paridade de uma organizacao especifica
SOURCE_DATABASE_URL="postgresql://..." npm run parity:check -- --date 2026-02-26 --organization-id <org_id>

# tolerancia customizada e falha de processo em divergencia
SOURCE_DATABASE_URL="postgresql://..." npm run parity:check -- --date 2026-02-26 --tolerance-percent 0.5 --fail-on-mismatch
```

Saida:
- `summary.status` (`APPROVED` ou `REJECTED`)
- `criticalChecks` com organizacoes ausentes em um dos lados
- comparativo por organizacao com KPIs (`reach`, `impressions`, `frequency`, `CTR`, `CPM`, `clicks`, `CPC`, `costPerMessage`, `investment`, `messages`)

Checklist de validacao (DoD):
- [x] Comparacao de KPIs V1 x V2 com tolerancia definida
- [x] Comparacao de checks criticos por organizacao
- [x] Relatorio de paridade gerado para aprovacao

## GT-22 - Cutover gradual com rollback

Escopo:
- feature flag de cutover por organizacao com filtros opcionais por cliente e grupo
- rollout progressivo (0-100%) para direcionar V1/V2 de forma deterministica
- rollback rapido em 1 comando

Entregas:
- tabela `cutover_rules` (Prisma + migration)
- motor de decisao em `lib/cutover/routing.ts`
- APIs privadas:
  - `GET/PUT /api/private/cutover/rules`
  - `GET /api/private/cutover/decision`
  - `POST /api/private/cutover/rollback`
- integracao de cutover em `POST /api/reports/meta/daily/send-test`
- comando de rollback: `npm run cutover:rollback`

Como operar:
```bash
# 1) criar/atualizar regra de piloto (30% para V2 no grupo)
curl -X PUT "http://localhost:3000/api/private/cutover/rules" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"grupo@chat","route":"V2","rolloutPercent":30,"reason":"piloto GT-22"}'

# 2) inspecionar decisao para um contexto
curl "http://localhost:3000/api/private/cutover/decision?groupId=grupo@chat&clientId=<client_id>&subjectKey=pilot-user-42"

# 3) rollback rapido para V1 (organizacao inteira)
npm run cutover:rollback -- --organization-id <organization_id> --reason "rollback imediato GT-22"
```

Comportamento do send-test:
- quando a decisao de cutover for `V2`, o envio segue normalmente via Papi
- quando a decisao de cutover for `V1`, o endpoint retorna `409` com `routedTo: "V1"` para forcar fallback

Checklist de validacao (DoD):
- [x] Feature flag por cliente/grupo implementada
- [x] Rollout progressivo com hash deterministico implementado
- [x] Rollback rapido com comando unico implementado

## GT-23 - API unificada de leitura de campanhas para IA

Escopo:
- endpoint somente leitura para consumo por agente IA
- filtros por `organizationId`, `clientId`, `platform`, `dateFrom`, `dateTo`
- paginacao e ordenacao estavel

Endpoint:
- `GET /api/v2/ai/campaigns`

Query params:
- `organizationId` (opcional; se enviado precisa ser do tenant autenticado)
- `clientId` (opcional)
- `platform` (opcional; `all` | `meta` | `google`, padrao `all`)
- `dateFrom` (opcional; `YYYY-MM-DD`)
- `dateTo` (opcional; `YYYY-MM-DD`)
- `page` (opcional; padrao `1`)
- `pageSize` (opcional; padrao `50`, max `200`)

Exemplo:
```bash
curl "http://localhost:3000/api/v2/ai/campaigns?platform=all&dateFrom=2026-02-25&dateTo=2026-02-26&page=1&pageSize=50"
```

Resposta:
- `filters` com os filtros aplicados
- `pagination` com `page`, `pageSize`, `total`, `totalPages`, `hasNext`, `orderBy`
- `data[]` normalizado com:
  - `id`, `organizationId`, `clientId`, `platform`, `externalId`, `name`, `status`, `snapshotDate`
  - `kpis`: `impressions`, `clicks`, `leads`, `spend`, `ctr`, `cpc`, `cpm`

Observacao atual:
- no schema V2 atual, as campanhas consolidadas estao em `campaigns` com origem `meta`
- para `platform=google`, a API retorna lista vazia ate a ingestao de campanhas Google

Checklist de validacao (DoD):
- [x] Endpoint `GET /api/v2/ai/campaigns` criado
- [x] Filtros e paginacao estavel implementados
- [x] Resposta normalizada para consumo por IA implementada

## GT-24 - Seguranca e governanca da API da IA

Escopo:
- autenticacao por token de servico com escopo `ai:read_campaigns`
- rate limiting por `organizationId + keyId`
- trilha de auditoria por requisicao com `organization_id`

Configuracao:
- `AI_SERVICE_TOKENS_JSON` (array JSON com `token`, `keyId`, `organizationId`, `scopes`, `rateLimitPerMinute`)
- `AI_DEFAULT_RATE_LIMIT_PER_MINUTE` (fallback de limite por minuto)

Exemplo de chamada:
```bash
curl "http://localhost:3000/api/v2/ai/campaigns?dateFrom=2026-02-25&dateTo=2026-02-26" \
  -H "Authorization: Bearer <service_token>"
```

Comportamento:
- token ausente/invalido: `401`
- token sem escopo `ai:read_campaigns`: `403`
- `organizationId` fora do escopo do token: `403`
- limite excedido: `429` + headers `X-RateLimit-*` e `Retry-After`

Auditoria:
- tabela `ai_api_audit_logs` (Prisma + migration)
- registro por chamada com `organization_id`, `key_id`, endpoint, status, filtros e metadata da request

Checklist de validacao (DoD):
- [x] Chamadas sem escopo valido retornam `403`
- [x] Auditoria registrada por requisicao com `organization_id`
- [x] Rate limiting por organizacao/chave ativo

## GT-25 - Endpoint de contexto para IA (resumo executivo)

Escopo:
- endpoint com resumo consolidado para IA (`investimento`, `leads`, `CTR`, `CPC`, `CPM`, `ROAS`)
- comparativo de periodo atual vs anterior com mesma duracao
- flags de anomalia basicas (queda/aumento abrupto)

Endpoint:
- `GET /api/v2/ai/context-summary`
- autenticacao e governanca seguem GT-24 (`service token`, `scope`, `rate limit`, `audit`)

Query params:
- `dateFrom` (obrigatorio, `YYYY-MM-DD`)
- `dateTo` (obrigatorio, `YYYY-MM-DD`)
- `organizationId` (opcional; deve respeitar escopo do token)
- `clientId` (opcional)
- `platform` (opcional; `all` | `meta` | `google`, padrao `all`)

Exemplo:
```bash
curl "http://localhost:3000/api/v2/ai/context-summary?dateFrom=2026-02-20&dateTo=2026-02-26&platform=all" \
  -H "Authorization: Bearer <service_token>"
```

Resposta:
- `filters` aplicados
- `summary.periods` (periodo atual e anterior)
- `summary.metrics.current` e `summary.metrics.previous`
- `summary.deltas` (variacao absoluta e percentual)
- `summary.anomalyFlags` (sinais basicos de aumento/queda abrupta)

Configuracao:
- `AI_CONTEXT_ANOMALY_THRESHOLD_PERCENT` (padrao `30`)

Checklist de validacao (DoD):
- [x] Endpoint `GET /api/v2/ai/context-summary` criado
- [x] Comparativo periodo atual vs anterior implementado
- [x] Flags de anomalia basicas implementadas
