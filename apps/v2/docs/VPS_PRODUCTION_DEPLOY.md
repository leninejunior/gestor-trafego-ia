# Runbook - Deploy V2 em Producao na VPS

## Objetivo
Subir a V2 em modo `production` na VPS (sem `next dev`) para reduzir latencia e estabilizar desempenho.

## Pre-requisitos
- Docker e Docker Compose instalados na VPS.
- Porta HTTP de producao definida (`PROD_HTTP_PORT`, padrao `80`).
- Arquivo `.env.production` com valores reais.
- DNS apontando para a VPS.
- Dominio inicial configurado: `edith.engrene.com`.

## Passo a passo
1. Atualizar codigo no servidor:
   - `git pull`
2. Entrar na pasta da V2:
   - `cd apps/v2`
3. Criar arquivo de ambiente:
   - `cp .env.production.example .env.production`
4. Editar `.env.production` com valores reais (nao commitar).
5. Subir stack de producao:
   - `docker compose -f docker-compose.production.yml --env-file .env.production up --build -d`
6. Validar servicos:
   - `docker compose -f docker-compose.production.yml --env-file .env.production ps`
7. Validar health:
   - `curl -fsS http://localhost:${PROD_HTTP_PORT:-80}/api/health`
8. Validar pelo dominio:
   - `curl -I http://edith.engrene.com/api/health`

## Operacao
- Logs:
  - `docker compose -f docker-compose.production.yml --env-file .env.production logs -f app proxy backup`
- Reiniciar app:
  - `docker compose -f docker-compose.production.yml --env-file .env.production up --build -d app`
- Parar stack:
  - `docker compose -f docker-compose.production.yml --env-file .env.production down`

## Rollback rapido
1. Voltar para o commit anterior:
   - `git checkout <commit-anterior>`
2. Recriar stack:
   - `docker compose -f docker-compose.production.yml --env-file .env.production up --build -d`
3. Validar health novamente.

## Checklist de validacao
- [ ] `NODE_ENV=production` no container `app`
- [ ] `/api/health` respondendo `200`
- [ ] logs sem erro critico em `app` e `proxy`
- [ ] backup gerando `.dump` e `.sha256` em `backups/postgres`
