# Runbook de Deploy na VPS

Este documento descreve o fluxo real de deploy da aplicação em produção.

## Ambiente atual

- Host: VPS Linux
- Caminho da aplicação: `/opt/flying-fox-bob`
- Orquestração: `docker compose`
- Serviço web: `web` (`container: gt-web-local`)
- Healthcheck: `http://127.0.0.1:3000/api/health`

## Pré-requisitos

- Acesso SSH ao servidor com permissão para `docker`.
- Projeto atualizado localmente com os arquivos que serão publicados.
- Docker Engine e Docker Compose ativos na VPS.

## Passo a passo de deploy

1. Acessar a VPS:

```bash
ssh root@SEU_IP
```

2. Entrar na pasta da aplicação:

```bash
cd /opt/flying-fox-bob
```

3. Atualizar arquivos do projeto (via `git pull`, `scp` ou pipeline de CI/CD).

4. Recriar somente o serviço web com build novo:

```bash
DOCKER_BUILDKIT=1 docker compose up --build -d web
```

5. Confirmar container em execução:

```bash
docker compose ps
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep gt-web-local
```

6. Validar saúde da aplicação:

```bash
curl -i http://127.0.0.1:3000/api/health
```

Resposta esperada: `HTTP/1.1 200 OK` com `{"status":"ok"...}`.

## Pós-deploy (checagens recomendadas)

- Abrir a aplicação pelo domínio e validar fluxo crítico.
- Conferir logs do web:

```bash
cd /opt/flying-fox-bob
docker compose logs --tail=200 web
```

- Validar se não há referências legadas indevidas no código:

```bash
cd /opt/flying-fox-bob
grep -R -I -i "vercel" . \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=.git \
  --exclude=package-lock.json \
  --exclude=pnpm-lock.yaml \
  --exclude=tsconfig.tsbuildinfo | wc -l
```

Resultado esperado: `0`.

## Rollback rápido

Se o web subir com erro após atualização:

1. Restaurar a versão anterior dos arquivos.
2. Rebuild do web:

```bash
cd /opt/flying-fox-bob
DOCKER_BUILDKIT=1 docker compose up --build -d web
```

3. Revalidar com `curl http://127.0.0.1:3000/api/health`.

## Registro de deploy - 2026-03-27

- Ambiente: producao VPS (`74.1.21.137`, usuario `root`, porta `22`)
- Diretorio: `/opt/flying-fox-bob`
- Branch aplicada: `main`
- Commits publicados:
  - `df9f7a3` - lote de mudancas locais
  - `5999a3e` - hotfix para build de producao (`eslint.ignoreDuringBuilds`)

### O que aconteceu

1. Foi identificado que a VPS nao estava com checkout Git ativo em `/opt/flying-fox-bob` (sem pasta `.git`).
2. `git pull` falhava por esse motivo.
3. O arquivo `docker-compose.yml` existente no servidor nao estava versionado no repositorio.

### Acoes executadas

1. Backup do `.env` para `/root/flying-fox-bob.env.<timestamp>`.
2. Inicializacao de Git no diretorio e sincronizacao com `origin/main`.
3. Recriacao de `docker-compose.yml` no servidor para manter os servicos `web` e `postgres`.
4. Rebuild do servico web com:

```bash
DOCKER_BUILDKIT=1 docker compose up --build -d web
```

### Validacao

- `docker compose ps`:
  - `gt-web-local` em execucao na porta `127.0.0.1:3000`
  - `gt-postgres-local` healthy na porta `127.0.0.1:5432`
- Healthcheck local:
  - `curl -i http://127.0.0.1:3000/api/health` -> `HTTP/1.1 200 OK`
- Healthcheck publico:
  - `https://edith.engrene.com/api/health` -> `{"status":"ok"...}`

### Observacao importante

- Atualmente, `docker-compose.yml` esta presente na VPS, mas nao esta versionado no Git.
- Recomendado versionar esse arquivo (ou um compose de producao equivalente) para evitar perda de configuracao em futuros deploys.
