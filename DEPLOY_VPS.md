# Deploy na VPS (edith.engrene.com)

Este projeto **nao deve depender de deploy automatico**.
Use o fluxo abaixo para publicar manualmente na VPS.

## 1) Pre-requisitos

- Acesso SSH a `edith.engrene.com` (chave SSH ou senha)
- Repositorio ja clonado na VPS
- Node.js e npm instalados na VPS
- Runtime configurado na VPS:
  - `pm2` (mais comum), ou
  - `systemd`, ou
  - `docker compose`

## 2) Comando rapido (Windows / PowerShell)

No seu ambiente local:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 `
  -SshHost "edith.engrene.com" `
  -User "root" `
  -AppDir "/var/www/flying-fox-bob" `
  -Branch "main" `
  -Runtime "pm2" `
  -ServiceName "edith-app"
```

Se voce usa `systemd`, troque:

```powershell
-Runtime "systemd" -ServiceName "edith-app.service"
```

Se voce usa `docker compose`, troque:

```powershell
-Runtime "docker"
```

## 3) O que o script faz

1. Conecta via SSH na VPS
2. Atualiza codigo (`git fetch`, `checkout`, `pull --ff-only`)
3. Instala dependencias (`npm ci`)
4. Gera build (`npm run build`)
5. Reinicia a aplicacao conforme runtime:
   - `pm2 restart ...` (ou start se nao existir)
   - `systemctl restart ...`
   - `docker compose up -d --build`

## 4) Validacao pos-deploy

No terminal local:

```powershell
curl.exe -I https://edith.engrene.com
```

Na VPS (opcional):

```bash
cd /var/www/flying-fox-bob
git rev-parse HEAD
```

Compare o hash com o ultimo commit enviado no GitHub.

## 5) Rollback rapido

Na VPS:

```bash
cd /var/www/flying-fox-bob
git log --oneline -n 5
git checkout <commit_anterior>
npm ci
npm run build
# reiniciar processo (pm2/systemd/docker)
```

## 6) Problemas comuns

- `Permission denied (publickey,password)`:
  - usuario sem acesso SSH
  - chave SSH nao configurada na VPS
- `pm2: command not found`:
  - instalar `pm2` na VPS ou usar runtime `systemd/docker`
- `npm run build` falhando:
  - validar `.env` e dependencias da VPS
