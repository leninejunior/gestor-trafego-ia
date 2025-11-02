# Google Ads Integration - Initial Setup Process

## Overview

Este documento fornece um processo passo-a-passo para configurar a integração Google Ads do zero, incluindo todos os scripts, verificações e validações necessárias.

## Pré-requisitos

### Sistema
- Node.js 18+ instalado
- npm ou pnpm configurado
- Acesso ao projeto Next.js
- Acesso admin ao Supabase
- Git configurado

### Contas e Credenciais
- Conta Google Cloud Console
- Conta Google Ads (com acesso de admin)
- Projeto Supabase configurado
- Domínio de produção (se aplicável)

## Processo de Setup

### Fase 1: Preparação do Ambiente

#### 1.1 Clonar e Configurar Projeto

```bash
# Clonar repositório (se necessário)
git clone <repository-url>
cd <project-directory>

# Instalar dependências
npm install
# ou
pnpm install

# Verificar estrutura do projeto
ls -la src/app/api/
ls -la src/lib/
ls -la database/
ls -la scripts/
```

#### 1.2 Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Configure as variáveis obrigatórias:
```bash
# Supabase (já existentes)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Ads API (NOVOS)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_DEVELOPER_TOKEN=your_google_developer_token

# Application URL (ATUALIZAR)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # desenvolvimento
# NEXT_PUBLIC_APP_URL=https://your-domain.com  # produção
```

### Fase 2: Configuração Google Cloud

#### 2.1 Criar Projeto Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione existente
3. Anote o Project ID

#### 2.2 Habilitar APIs

```bash
# Via gcloud CLI (opcional)
gcloud services enable googleads.googleapis.com
gcloud services enable oauth2.googleapis.com
```

Ou via Console:
1. Navegue para **APIs & Services** > **Library**
2. Busque e habilite "Google Ads API"

#### 2.3 Configurar OAuth 2.0

1. Vá para **APIs & Services** > **Credentials**
2. Clique **Create Credentials** > **OAuth client ID**
3. Configure OAuth consent screen:
   - User Type: External (teste) ou Internal (organização)
   - App name: "Ads Manager - Google Ads Integration"
   - User support email: seu email
   - Scopes: `https://www.googleapis.com/auth/adwords`
4. Criar OAuth client ID:
   - Application type: **Web application**
   - Name: "Ads Manager Google Ads"
   - Authorized redirect URIs:
     ```
     http://localhost:3000/api/google/callback
     https://your-domain.com/api/google/callback
     ```
5. Salvar **Client ID** e **Client Secret**

#### 2.4 Obter Developer Token

1. Acesse [Google Ads](https://ads.google.com/)
2. Vá para **Tools & Settings** > **Setup** > **API Center**
3. Solicite Developer Token
4. Aguarde aprovação (1-3 dias úteis)
5. Copie o token quando aprovado

### Fase 3: Verificação Pré-Migração

#### 3.1 Executar Verificações

```bash
# Verificar configuração completa
node scripts/pre-migration-check.js
```

Saída esperada:
```
🔍 Running Google Ads pre-migration checks...

📋 Checking environment variables...
✅ Found: NEXT_PUBLIC_SUPABASE_URL
✅ Found: SUPABASE_SERVICE_ROLE_KEY
✅ Found: GOOGLE_CLIENT_ID
✅ Found: GOOGLE_CLIENT_SECRET
✅ Found: GOOGLE_DEVELOPER_TOKEN
✅ Found: NEXT_PUBLIC_APP_URL

🔗 Testing Supabase connection...
✅ Supabase connection successful
✅ Admin permissions verified

📊 Checking current database state...
✅ No existing Google Ads tables found
✅ Essential tables found
✅ Required extensions found

📦 Checking dependencies...
✅ Node.js version v18.x.x is compatible
✅ Found dependency: @supabase/supabase-js
✅ Found dependency: next

💾 Checking system resources...
✅ Memory usage: 45.2%
✅ Disk access verified

🔑 Checking Google configuration...
✅ Google Client ID format looks correct
✅ Google Client Secret format looks correct
✅ Google Developer Token format looks correct
✅ OAuth callback URL will be: http://localhost:3000/api/google/callback

====================================================
✅ All pre-migration checks passed!

System is ready for Google Ads migration.

To proceed with migration:
node scripts/apply-google-ads-complete-migration.js
```

#### 3.2 Corrigir Problemas (se houver)

Se houver erros, corrija antes de prosseguir:

**Variáveis de ambiente faltando:**
```bash
# Editar .env
nano .env
# Adicionar variáveis faltantes
```

**Formato incorreto:**
```bash
# Verificar formato no Google Cloud Console
# Client ID deve terminar com .apps.googleusercontent.com
# Client Secret deve começar com GOCSPX-
```

**Conectividade Supabase:**
```bash
# Verificar URLs e chaves
# Testar conexão manual se necessário
```

### Fase 4: Aplicação da Migração

#### 4.1 Executar Migração Completa

```bash
# Aplicar schema completo
node scripts/apply-google-ads-complete-migration.js
```

Saída esperada:
```
🚀 Starting Google Ads complete migration...

🔍 Running pre-migration checks...
✅ Pre-migration checks passed

📋 Applying main schema...
✅ Main schema applied

🔒 Applying RLS policies...
✅ RLS policies applied

⚡ Creating performance indexes...
✅ Performance indexes created

🔧 Creating helper functions...
✅ Helper functions created

⚙️  Creating triggers...
✅ Triggers created

🔍 Verifying migration...
✅ All tables created successfully
✅ RLS policies verified
✅ 12 indexes created
✅ 5 functions created

🎉 Google Ads migration completed successfully!

Next steps:
1. Deploy application code
2. Configure environment variables
3. Test OAuth flow
4. Run integration tests
5. Configure monitoring and alerts
```

#### 4.2 Verificar Migração

```bash
# Verificar tabelas criadas
psql -h your-supabase-host -U postgres -d postgres -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'google_ads_%'
ORDER BY table_name;
"
```

Resultado esperado:
```
     table_name      
--------------------
 google_ads_campaigns
 google_ads_connections
 google_ads_metrics
 google_ads_sync_logs
```

### Fase 5: Configuração Inicial

#### 5.1 Executar Setup Inicial

```bash
# Configurar ambiente inicial
node scripts/setup-google-ads-initial-config.js
```

Saída esperada:
```
🚀 Setting up Google Ads initial configuration...

🔍 Validating environment...
✅ Environment validation passed

📋 Verifying database schema...
✅ Database schema verified
✅ RLS policies verified

📊 Setting up monitoring...
✅ Monitoring functions created

🎭 Creating sample data for development...
✅ Sample data created successfully
   - 1 connection for client abc-123
   - 2 sample campaigns
   - 14 sample metrics (7 days × 2 campaigns)
   - 1 sync log entry

🔌 Testing API endpoints...
✅ Health check API working
   - connections: no_connections
   - recent_syncs: healthy
   - recent_metrics: healthy
✅ Database queries working

📄 Generating configuration report...
✅ Configuration report generated: google-ads-config-report.json

🎉 Google Ads initial configuration completed!

Next steps:
1. Test OAuth flow in browser
2. Connect a real Google Ads account
3. Verify sync functionality
4. Configure production monitoring
```

#### 5.2 Revisar Relatório de Configuração

```bash
# Visualizar relatório
cat google-ads-config-report.json
```

### Fase 6: Teste Local

#### 6.1 Iniciar Aplicação

```bash
# Iniciar servidor de desenvolvimento
npm run dev
# ou
pnpm dev
```

#### 6.2 Testar Funcionalidades

1. **Acesso ao Dashboard:**
   - Abrir http://localhost:3000
   - Fazer login
   - Navegar para dashboard

2. **Menu Google Ads:**
   - Verificar se item "Google Ads" aparece no menu
   - Clicar e acessar dashboard Google Ads

3. **Botão de Conexão:**
   - Verificar se botão "Conectar Google Ads" aparece
   - Clicar no botão (não conectar ainda)

4. **Health Check:**
   - Acessar http://localhost:3000/api/google/monitoring/health
   - Verificar resposta JSON

#### 6.3 Testar OAuth Flow (Opcional)

⚠️ **Cuidado**: Só teste se tiver conta Google Ads real

1. Clicar em "Conectar Google Ads"
2. Ser redirecionado para Google
3. Autorizar aplicação
4. Ser redirecionado de volta
5. Verificar se conexão foi salva

### Fase 7: Deploy (Produção)

#### 7.1 Configurar Variáveis de Produção

No Vercel Dashboard:
1. Ir para Project Settings > Environment Variables
2. Adicionar variáveis:
   ```
   GOOGLE_CLIENT_ID=prod_client_id
   GOOGLE_CLIENT_SECRET=prod_client_secret
   GOOGLE_DEVELOPER_TOKEN=prod_developer_token
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

#### 7.2 Atualizar OAuth Redirect URIs

No Google Cloud Console:
1. Adicionar URI de produção:
   ```
   https://your-domain.com/api/google/callback
   ```

#### 7.3 Aplicar Schema em Produção

```bash
# Configurar para produção
export NEXT_PUBLIC_SUPABASE_URL=prod_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=prod_service_role_key

# Executar migração
node scripts/apply-google-ads-complete-migration.js
```

#### 7.4 Deploy da Aplicação

```bash
# Deploy via Vercel
vercel --prod

# Ou via Git (se configurado)
git push origin main
```

#### 7.5 Verificar Deploy

```bash
# Testar health check
curl https://your-domain.com/api/google/monitoring/health

# Verificar OAuth callback
curl -I https://your-domain.com/api/google/callback
```

### Fase 8: Validação Final

#### 8.1 Testes de Produção

1. **OAuth Flow Completo:**
   - Conectar conta Google Ads real
   - Verificar redirecionamento
   - Confirmar dados salvos

2. **Sincronização:**
   - Aguardar sync automático
   - Ou forçar sync manual
   - Verificar campanhas importadas

3. **Dashboard:**
   - Verificar métricas exibidas
   - Testar filtros
   - Verificar dashboard unificado

#### 8.2 Monitoramento

```bash
# Verificar logs
vercel logs --follow

# Verificar métricas
curl https://your-domain.com/api/google/monitoring/metrics
```

## Troubleshooting

### Problemas Comuns

#### 1. "Invalid client_id"
```bash
# Verificar formato
echo $GOOGLE_CLIENT_ID
# Deve terminar com .apps.googleusercontent.com
```

#### 2. "Redirect URI mismatch"
```bash
# Verificar URL configurada
echo $NEXT_PUBLIC_APP_URL
# Deve coincidir com Google Cloud Console
```

#### 3. "Developer token invalid"
```bash
# Verificar status no Google Ads
# Pode estar pendente de aprovação
```

#### 4. Tabelas não criadas
```bash
# Re-executar migração
node scripts/rollback-google-ads-migration.js
node scripts/apply-google-ads-complete-migration.js
```

### Logs de Debug

```bash
# Habilitar debug
export DEBUG=google:*
npm run dev

# Verificar logs específicos
tail -f .next/server.log | grep google
```

### Rollback de Emergência

```bash
# Rollback completo
node scripts/rollback-google-ads-migration.js

# Rollback de emergência (mais agressivo)
node scripts/rollback-google-ads-migration.js --emergency
```

## Checklist Final

### Desenvolvimento
- [ ] Pré-requisitos instalados
- [ ] Variáveis de ambiente configuradas
- [ ] Google Cloud Console configurado
- [ ] Pré-migração passou
- [ ] Migração aplicada com sucesso
- [ ] Configuração inicial completa
- [ ] Testes locais passando
- [ ] OAuth flow funcionando

### Produção
- [ ] Variáveis de produção configuradas
- [ ] OAuth URIs de produção configurados
- [ ] Schema aplicado em produção
- [ ] Deploy realizado
- [ ] Health checks passando
- [ ] Testes de produção completos
- [ ] Monitoramento ativo

### Pós-Deploy
- [ ] Documentação atualizada
- [ ] Equipe treinada
- [ ] Usuários notificados
- [ ] Métricas sendo coletadas
- [ ] Alertas configurados

## Recursos de Suporte

### Documentação
- `docs/GOOGLE_ADS_TECHNICAL_DOCUMENTATION.md` - Documentação técnica completa
- `docs/GOOGLE_ADS_TROUBLESHOOTING.md` - Guia de troubleshooting
- `docs/GOOGLE_ADS_MIGRATION_GUIDE.md` - Guia de migração detalhado

### Scripts
- `scripts/pre-migration-check.js` - Verificações pré-migração
- `scripts/apply-google-ads-complete-migration.js` - Migração completa
- `scripts/setup-google-ads-initial-config.js` - Configuração inicial
- `scripts/rollback-google-ads-migration.js` - Rollback completo

### APIs de Teste
- `GET /api/google/monitoring/health` - Health check
- `GET /api/google/monitoring/metrics` - Métricas do sistema
- `POST /api/google/auth` - Iniciar OAuth (teste)

---

**Última Atualização**: Dezembro 2024  
**Versão**: 1.0  
**Mantenedores**: Equipe de Desenvolvimento