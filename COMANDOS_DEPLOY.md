# ðŸ› ï¸ Comandos Ãšteis para Deploy

## VerificaÃ§Ã£o PrÃ©-Deploy

```bash
# Verificar se sistema estÃ¡ pronto
node scripts\pre-deploy-check.js

# Verificar build local
npm run build

# Testar produÃ§Ã£o localmente
npm run start
```

## Deploy plataforma de deploy

### Primeira Vez

```bash
# Instalar plataforma de deploy CLI
npm install -g deploy

# Login
deploy login

# Deploy inicial (staging)
deploy

# Deploy produÃ§Ã£o
deploy --prod
```

### Deploys Subsequentes

```bash
# Deploy direto para produÃ§Ã£o
deploy --prod

# Ou usar script npm
npm run deploy
```

### Gerenciar VariÃ¡veis de Ambiente

```bash
# Adicionar variÃ¡vel
deploy env add NOME_VARIAVEL production

# Listar variÃ¡veis
deploy env ls

# Remover variÃ¡vel
deploy env rm NOME_VARIAVEL production

# Pull variÃ¡veis para local (nÃ£o recomendado para produÃ§Ã£o)
deploy env pull .env.local
```

## Logs e Monitoramento

```bash
# Ver logs em tempo real
deploy logs --follow

# Ver logs de uma funÃ§Ã£o especÃ­fica
deploy logs --follow /api/google/campaigns

# Ver Ãºltimos 100 logs
deploy logs -n 100

# Ver logs de build
deploy logs --build
```

## DomÃ­nio

```bash
# Adicionar domÃ­nio customizado
deploy domains add seudominio.com

# Listar domÃ­nios
deploy domains ls

# Remover domÃ­nio
deploy domains rm seudominio.com
```

## Projetos

```bash
# Listar projetos
deploy projects ls

# Ver informaÃ§Ãµes do projeto
deploy inspect

# Remover projeto
deploy remove nome-do-projeto
```

## Rollback

```bash
# Listar deployments
deploy ls

# Promover deployment anterior para produÃ§Ã£o
deploy promote [deployment-url]

# Ou via dashboard
# https://provedor-deploy.com/dashboard > Deployments > Promote to Production
```

## Supabase

### Aplicar Schemas

```bash
# NÃ£o hÃ¡ comando CLI - use Supabase Dashboard
# https://supabase.com/dashboard/project/SEU_PROJETO/sql

# Copie e cole manualmente:
# 1. database/complete-schema.sql
# 2. database/google-ads-schema.sql
```

### Verificar ConexÃ£o

```bash
# Testar conexÃ£o Supabase (local)
node scripts/check-supabase-keys.js
```

## Git

```bash
# Verificar status
git status

# Commit mudanÃ§as
git add .
git commit -m "Preparar para deploy em produÃ§Ã£o"

# Push para repositÃ³rio
git push origin main

# Tag de versÃ£o
git tag -a v0.1.1 -m "Release v0.1.1 - Deploy produÃ§Ã£o"
git push origin v0.1.1
```

## NPM Scripts DisponÃ­veis

```bash
# Desenvolvimento
npm run dev                    # Iniciar dev server
npm run build                  # Build para produÃ§Ã£o
npm run start                  # Iniciar produÃ§Ã£o local
npm run lint                   # Lint cÃ³digo

# Deploy
npm run pre-deploy             # VerificaÃ§Ã£o prÃ©-deploy
npm run deploy                 # Deploy plataforma de deploy produÃ§Ã£o

# Testes
npm run test                   # Testes unitÃ¡rios
npm run test:e2e               # Testes E2E
npm run test:coverage          # Coverage

# VerificaÃ§Ãµes
npm run check-env              # Verificar .env
npm run check-supabase         # Verificar Supabase
```

## Troubleshooting

### Build Falha

```bash
# Limpar cache e reinstalar
rm -rf .next node_modules
npm install
npm run build
```

### VariÃ¡veis de Ambiente NÃ£o Funcionam

```bash
# Verificar variÃ¡veis configuradas
deploy env ls

# Redeploy apÃ³s adicionar variÃ¡veis
deploy --prod --force
```

### Erro de PermissÃ£o

```bash
# Verificar login
deploy whoami

# Re-login se necessÃ¡rio
deploy logout
deploy login
```

### Logs NÃ£o Aparecem

```bash
# Especificar projeto
deploy logs --follow --scope=seu-time

# Ou via dashboard
# https://provedor-deploy.com/dashboard > Logs
```

## Comandos de EmergÃªncia

### Reverter Deploy Rapidamente

```bash
# 1. Listar deployments
deploy ls

# 2. Promover deployment anterior
deploy promote [url-deployment-anterior]
```

### Pausar AplicaÃ§Ã£o

```bash
# NÃ£o hÃ¡ comando direto - opÃ§Ãµes:
# 1. Remover domÃ­nio: deploy domains rm seudominio.com
# 2. Deletar projeto: deploy remove nome-projeto
# 3. Via dashboard: Settings > Delete Project
```

### Backup RÃ¡pido

```bash
# Backup cÃ³digo
git archive --format=zip --output=backup-$(date +%Y%m%d).zip HEAD

# Backup .env (local apenas)
cp .env .env.backup.$(date +%Y%m%d)
```

## Monitoramento ContÃ­nuo

```bash
# Terminal 1: Logs plataforma de deploy
deploy logs --follow

# Terminal 2: Monitorar status
watch -n 30 'curl -s https://seu-app.seu-dominio.com/api/health'

# Terminal 3: Monitorar Supabase
# Via dashboard: https://supabase.com/dashboard/project/SEU_PROJETO/logs
```

## Cron de Saldo (10 min)

```bash
# Teste manual do endpoint de cron de saldo
curl -X GET "https://seu-app.seu-dominio.com/api/cron/balance-sync" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

```bash
# Exemplo Linux crontab (a cada 10 minutos)
crontab -e
```

```cron
*/10 * * * * curl -fsS -X GET "https://seu-app.seu-dominio.com/api/cron/balance-sync" -H "Authorization: Bearer SEU_CRON_SECRET" >/dev/null 2>&1
```

## Aliases Ãšteis (Opcional)

Adicione ao seu `.bashrc` ou `.zshrc`:

```bash
# Deploy aliases
alias vdeploy='deploy --prod'
alias vlogs='deploy logs --follow'
alias venv='deploy env ls'
alias vls='deploy ls'

# Build aliases
alias nbuild='npm run build'
alias ndev='npm run dev'
alias ncheck='node scripts/pre-deploy-check.js'
```

## Checklist RÃ¡pido

Antes de cada deploy:

```bash
# 1. Verificar sistema
node scripts\pre-deploy-check.js

# 2. Commit mudanÃ§as
git add .
git commit -m "DescriÃ§Ã£o das mudanÃ§as"
git push

# 3. Deploy
deploy --prod

# 4. Verificar logs
deploy logs --follow

# 5. Testar aplicaÃ§Ã£o
curl https://seu-app.seu-dominio.com/api/health
```

---

**Dica:** Salve este arquivo como referÃªncia rÃ¡pida durante o deploy!

