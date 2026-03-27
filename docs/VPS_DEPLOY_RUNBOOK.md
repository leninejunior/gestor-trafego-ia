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

