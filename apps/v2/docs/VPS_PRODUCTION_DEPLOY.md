# Runbook - Deploy V2 em Producao na VPS

## Objetivo
Subir a V2 em modo `production` na VPS (sem `next dev`) para reduzir latencia e estabilizar desempenho.

## Pre-requisitos
- Docker e Docker Compose instalados na VPS.
- Nginx no host (recomendado) para TLS e roteamento de dominio.
- Porta local para app definida (`APP_HOST_PORT`, padrao `3100`).
- Porta HTTP de producao definida (`PROD_HTTP_PORT`, padrao `80`).
- Porta HTTPS de producao definida (`PROD_HTTPS_PORT`, padrao `443`).
- Arquivo `.env.production` com valores reais.
- DNS apontando para a VPS.
- Dominio inicial configurado: `edith.engrene.com`.
- `SSL_DOMAIN` e `SSL_EMAIL` configurados em `.env.production`.

## Passo a passo
1. Atualizar codigo no servidor:
   - `git pull`
2. Entrar na pasta da V2:
   - `cd apps/v2`
3. Criar arquivo de ambiente:
   - `cp .env.production.example .env.production`
4. Editar `.env.production` com valores reais (nao commitar).
5. Subir stack de producao:
   - `docker compose -f docker-compose.production.yml --env-file .env.production up --build -d app backup`
6. Validar servicos:
   - `docker compose -f docker-compose.production.yml --env-file .env.production ps`
7. Validar health:
   - `curl -fsS http://127.0.0.1:${APP_HOST_PORT:-3100}/api/health`
8. Ajustar Nginx do host para apontar dominio para `127.0.0.1:${APP_HOST_PORT:-3100}`.
9. Validar pelo dominio:
   - `curl -I https://edith.engrene.com/api/health`

## Opcional: proxy container na borda
Use somente quando `80/443` estiverem livres no host:
- `docker compose --profile container-proxy -f docker-compose.production.yml --env-file .env.production up --build -d`
- Emitir certificado SSL:
   - `sh ./scripts/ssl-issue.sh`

## Operacao
- Logs:
  - `docker compose -f docker-compose.production.yml --env-file .env.production logs -f app backup`
- Reiniciar app:
  - `docker compose -f docker-compose.production.yml --env-file .env.production up --build -d app`
- Parar stack:
  - `docker compose -f docker-compose.production.yml --env-file .env.production down`
- Renovar SSL manual:
  - `sh ./scripts/ssl-renew.sh`

## Renovacao automatica SSL (crontab no host)
Adicionar no servidor (executar `crontab -e`):

```cron
0 3 * * * cd /caminho/do/repositorio/apps/v2 && sh ./scripts/ssl-renew.sh >> /var/log/flying-fox-ssl-renew.log 2>&1
```

## Rollback rapido
1. Voltar para o commit anterior:
   - `git checkout <commit-anterior>`
2. Recriar stack:
   - `docker compose -f docker-compose.production.yml --env-file .env.production up --build -d`
3. Validar health novamente.

## Checklist de validacao
- [ ] `NODE_ENV=production` no container `app`
- [ ] `/api/health` respondendo `200`
- [ ] logs sem erro critico em `app` (e `proxy`, se perfil de proxy estiver ativo)
- [ ] backup gerando `.dump` e `.sha256` em `backups/postgres`
