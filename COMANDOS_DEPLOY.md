# 🛠️ Comandos Úteis para Deploy

## Verificação Pré-Deploy

```bash
# Verificar se sistema está pronto
node scripts\pre-deploy-check.js

# Verificar build local
npm run build

# Testar produção localmente
npm run start
```

## Deploy Vercel

### Primeira Vez

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy inicial (staging)
vercel

# Deploy produção
vercel --prod
```

### Deploys Subsequentes

```bash
# Deploy direto para produção
vercel --prod

# Ou usar script npm
npm run deploy
```

### Gerenciar Variáveis de Ambiente

```bash
# Adicionar variável
vercel env add NOME_VARIAVEL production

# Listar variáveis
vercel env ls

# Remover variável
vercel env rm NOME_VARIAVEL production

# Pull variáveis para local (não recomendado para produção)
vercel env pull .env.local
```

## Logs e Monitoramento

```bash
# Ver logs em tempo real
vercel logs --follow

# Ver logs de uma função específica
vercel logs --follow /api/google/campaigns

# Ver últimos 100 logs
vercel logs -n 100

# Ver logs de build
vercel logs --build
```

## Domínio

```bash
# Adicionar domínio customizado
vercel domains add seudominio.com

# Listar domínios
vercel domains ls

# Remover domínio
vercel domains rm seudominio.com
```

## Projetos

```bash
# Listar projetos
vercel projects ls

# Ver informações do projeto
vercel inspect

# Remover projeto
vercel remove nome-do-projeto
```

## Rollback

```bash
# Listar deployments
vercel ls

# Promover deployment anterior para produção
vercel promote [deployment-url]

# Ou via dashboard
# https://vercel.com/dashboard > Deployments > Promote to Production
```

## Supabase

### Aplicar Schemas

```bash
# Não há comando CLI - use Supabase Dashboard
# https://supabase.com/dashboard/project/SEU_PROJETO/sql

# Copie e cole manualmente:
# 1. database/complete-schema.sql
# 2. database/google-ads-schema.sql
```

### Verificar Conexão

```bash
# Testar conexão Supabase (local)
node scripts/check-supabase-keys.js
```

## Git

```bash
# Verificar status
git status

# Commit mudanças
git add .
git commit -m "Preparar para deploy em produção"

# Push para repositório
git push origin main

# Tag de versão
git tag -a v0.1.1 -m "Release v0.1.1 - Deploy produção"
git push origin v0.1.1
```

## NPM Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev                    # Iniciar dev server
npm run build                  # Build para produção
npm run start                  # Iniciar produção local
npm run lint                   # Lint código

# Deploy
npm run pre-deploy             # Verificação pré-deploy
npm run deploy                 # Deploy Vercel produção

# Testes
npm run test                   # Testes unitários
npm run test:e2e               # Testes E2E
npm run test:coverage          # Coverage

# Verificações
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

### Variáveis de Ambiente Não Funcionam

```bash
# Verificar variáveis configuradas
vercel env ls

# Redeploy após adicionar variáveis
vercel --prod --force
```

### Erro de Permissão

```bash
# Verificar login
vercel whoami

# Re-login se necessário
vercel logout
vercel login
```

### Logs Não Aparecem

```bash
# Especificar projeto
vercel logs --follow --scope=seu-time

# Ou via dashboard
# https://vercel.com/dashboard > Logs
```

## Comandos de Emergência

### Reverter Deploy Rapidamente

```bash
# 1. Listar deployments
vercel ls

# 2. Promover deployment anterior
vercel promote [url-deployment-anterior]
```

### Pausar Aplicação

```bash
# Não há comando direto - opções:
# 1. Remover domínio: vercel domains rm seudominio.com
# 2. Deletar projeto: vercel remove nome-projeto
# 3. Via dashboard: Settings > Delete Project
```

### Backup Rápido

```bash
# Backup código
git archive --format=zip --output=backup-$(date +%Y%m%d).zip HEAD

# Backup .env (local apenas)
cp .env .env.backup.$(date +%Y%m%d)
```

## Monitoramento Contínuo

```bash
# Terminal 1: Logs Vercel
vercel logs --follow

# Terminal 2: Monitorar status
watch -n 30 'curl -s https://seu-app.vercel.app/api/health'

# Terminal 3: Monitorar Supabase
# Via dashboard: https://supabase.com/dashboard/project/SEU_PROJETO/logs
```

## Aliases Úteis (Opcional)

Adicione ao seu `.bashrc` ou `.zshrc`:

```bash
# Deploy aliases
alias vdeploy='vercel --prod'
alias vlogs='vercel logs --follow'
alias venv='vercel env ls'
alias vls='vercel ls'

# Build aliases
alias nbuild='npm run build'
alias ndev='npm run dev'
alias ncheck='node scripts/pre-deploy-check.js'
```

## Checklist Rápido

Antes de cada deploy:

```bash
# 1. Verificar sistema
node scripts\pre-deploy-check.js

# 2. Commit mudanças
git add .
git commit -m "Descrição das mudanças"
git push

# 3. Deploy
vercel --prod

# 4. Verificar logs
vercel logs --follow

# 5. Testar aplicação
curl https://seu-app.vercel.app/api/health
```

---

**Dica:** Salve este arquivo como referência rápida durante o deploy!
