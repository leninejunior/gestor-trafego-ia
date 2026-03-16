# Runbook - Backup e Restore Postgres (V2)

## Objetivo
Garantir backup diario automatizado do Postgres da V2 e procedimento seguro de restore em homologacao.

## Arquivos envolvidos
- `scripts/postgres-backup.sh`
- `scripts/postgres-restore.sh`
- `docker-compose.staging.yml` (servico `backup` em homologacao)
- `docker-compose.production.yml` (servico `backup` em producao)
- `.env.staging` (a partir de `.env.staging.example`)
- `.env.production` (a partir de `.env.production.example`)

## Variaveis de ambiente
- `DATABASE_URL`: conexao principal do banco da V2.
- `BACKUP_DATABASE_URL` (opcional): override para origem do backup.
- `BACKUP_RETENTION_DAYS` (padrao: `7`): quantidade de dias mantidos.
- `BACKUP_INTERVAL_SECONDS` (padrao: `86400`): intervalo do backup automatico (24h).

## Rotina de backup diario automatizado (staging)
1. Copie o exemplo de staging:
   - `cp .env.staging.example .env.staging`
2. Configure `.env.staging` com valores reais.
3. Suba os servicos:
   - `npm run deploy:staging:up`
4. O servico `backup` executa:
   - backup imediato na inicializacao
   - backups recorrentes a cada `BACKUP_INTERVAL_SECONDS`
5. Arquivos gerados:
   - `backups/postgres/*.dump`
   - `backups/postgres/*.dump.sha256`
   - `backups/postgres/latest_backup_path.txt`

## Rotina de backup diario automatizado (producao)
1. Copie o exemplo de producao:
   - `cp .env.production.example .env.production`
2. Configure `.env.production` com valores reais.
3. Suba os servicos:
   - `docker compose -f docker-compose.production.yml --env-file .env.production up --build -d app backup`
4. O servico `backup` executa:
   - backup imediato na inicializacao
   - backups recorrentes a cada `BACKUP_INTERVAL_SECONDS`
5. Validar health:
   - `curl -fsS http://127.0.0.1:${APP_HOST_PORT:-3100}/api/health`

## Backup sob demanda
- `npm run backup:postgres`

## Restore em homologacao (procedimento recomendado)
1. Selecione um dump:
   - `ls -1 backups/postgres/*.dump | tail -n 1`
2. Defina o destino de homologacao:
   - `export TARGET_DATABASE_URL='postgresql://.../flying_fox_v2_hml'`
3. Execute o restore:
   - `RESTORE_DROP_SCHEMA=true BACKUP_FILE='backups/postgres/<arquivo>.dump' npm run restore:postgres`
4. Verifique tabelas e dados apos restore:
   - `psql "$TARGET_DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"`

## Observacoes de seguranca
- Nunca commitar `.env.staging`.
- Nunca commitar `.env.production`.
- Nunca armazenar credenciais reais no repositório.
- Sempre validar o restore em homologacao antes de usar em producao.
