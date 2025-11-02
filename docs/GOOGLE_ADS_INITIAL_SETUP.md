# Configuração Inicial - Google Ads Integration

## Visão Geral

Este documento fornece instruções passo a passo para configurar a integração Google Ads do zero, incluindo configuração de ambiente, aplicação do schema e primeiros testes.

## Pré-requisitos

### Contas e Acessos Necessários

- [ ] **Conta Google Cloud** com permissões de administrador
- [ ] **Conta Google Ads** ativa com campanhas
- [ ] **Projeto Supabase** configurado
- [ ] **Acesso ao repositório** do código
- [ ] **Permissões de deploy** na plataforma (Vercel/Netlify)

### Ferramentas Necessárias

- [ ] **Node.js** 18+ instalado
- [ ] **npm** ou **pnpm** instalado
- [ ] **Git** configurado
- [ ] **Editor de código** (VS Code recomendado)
- [ ] **Navegador moderno** para testes

## Etapa 1: Configuração Google Cloud Console

### 1.1 Criar/Configurar Projeto

1. **Acesse o Google Cloud Console**
   - Vá para [console.cloud.google.com](https://console.cloud.google.com)
   - Faça login com sua conta Google

2. **Criar Novo Projeto** (se necessário)
   - Clique em "Selecionar projeto" no topo
   - Clique em "Novo Projeto"
   - Nome: `[SeuSistema] - Google Ads Integration`
   - Clique em "Criar"

3. **Habilitar APIs Necessárias**
   - Vá para "APIs & Services" > "Library"
   - Procure e habilite:
     - [ ] **Google Ads API**
     - [ ] **Google OAuth2 API**
     - [ ] **Google Identity API**

### 1.2 Configurar OAuth 2.0

1. **Criar Credenciais OAuth**
   - Vá para "APIs & Services" > "Credentials"
   - Clique em "Create Credentials" > "OAuth 2.0 Client ID"
   - Tipo de aplicação: "Web application"
   - Nome: `Google Ads Integration - [Ambiente]`

2. **Configurar Redirect URIs**
   ```
   Desenvolvimento:
   http://localhost:3000/api/google/callback
   
   Produção:
   https://your-domain.com/api/google/callback
   
   Staging (se aplicável):
   https://staging.your-domain.com/api/google/callback
   ```

3. **Salvar Credenciais**
   - [ ] Copiar **Client ID**
   - [ ] Copiar **Client Secret**
   - [ ] Baixar arquivo JSON (backup)

### 1.3 Obter Developer Token

1. **Acessar Google Ads**
   - Vá para [ads.google.com](https://ads.google.com)
   - Faça login com a conta que tem acesso às campanhas

2. **Solicitar Developer Token**
   - Vá para "Tools & Settings" > "Setup" > "API Center"
   - Clique em "Get started" no Developer Token
   - Preencha o formulário:
     - **Company/Organization**: Nome da sua empresa
     - **Website**: URL do seu sistema
     - **Use case**: "Campaign management and reporting"
     - **Description**: Descreva como usará a API

3. **Aguardar Aprovação**
   - O processo pode levar 1-3 dias úteis
   - Você receberá email quando aprovado
   - Token aparecerá na seção "API Center"

## Etapa 2: Configuração do Ambiente

### 2.1 Clonar e Configurar Repositório

```bash
# Clonar repositório
git clone [url-do-repositorio]
cd [nome-do-projeto]

# Instalar dependências
npm install
# ou
pnpm install
```

### 2.2 Configurar Variáveis de Ambiente

1. **Copiar arquivo de exemplo**
   ```bash
   cp .env.example .env
   ```

2. **Configurar variáveis obrigatórias**
   ```bash
   # Google Ads Configuration
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   GOOGLE_DEVELOPER_TOKEN=your_google_developer_token_here
   
   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # Supabase Configuration (já existente)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Configurar variáveis opcionais** (recomendado)
   ```bash
   # Cache Configuration
   REDIS_URL=redis://localhost:6379
   GOOGLE_ADS_CACHE_TTL=900
   
   # Rate Limiting
   GOOGLE_ADS_RATE_LIMIT_PER_MINUTE=1000
   GOOGLE_ADS_BATCH_SIZE=50
   
   # Sync Configuration
   GOOGLE_ADS_SYNC_INTERVAL_HOURS=6
   GOOGLE_ADS_SYNC_TIMEOUT_MINUTES=30
   
   # Monitoring
   GOOGLE_ADS_ENABLE_MONITORING=true
   GOOGLE_ADS_LOG_LEVEL=info
   ```

### 2.3 Validar Configuração

```bash
# Validar variáveis de ambiente
node scripts/validate-google-env.js

# Verificar conexão com Supabase
node scripts/check-supabase-connection.js

# Testar configuração Google (básico)
node scripts/test-google-config.js
```

## Etapa 3: Configuração do Banco de Dados

### 3.1 Backup do Estado Atual

```bash
# Criar backup do banco atual
node scripts/backup-database.js

# Ou via Supabase CLI
supabase db dump > backup-$(date +%Y%m%d).sql
```

### 3.2 Aplicar Schema Google Ads

```bash
# Aplicar schema completo
node scripts/apply-google-ads-complete-schema.js
```

**Saída esperada:**
```
🚀 Iniciando aplicação do schema Google Ads...

🔧 Verificando configuração...
📍 Supabase URL: https://your-project.supabase.co
🔑 Service Key: Configurada

🔍 Verificando tabelas existentes...
📋 Nenhuma tabela Google Ads encontrada

📋 Executando scripts de schema...

🔄 Criando função auxiliar exec_sql...
✅ Criando função auxiliar exec_sql - Concluído

🔄 Aplicando schema principal do Google Ads...
✅ Aplicando schema principal do Google Ads - Concluído

🔄 Aplicando schema de OAuth states...
✅ Aplicando schema de OAuth states - Concluído

🔄 Aplicando otimizações de query...
✅ Aplicando otimizações de query - Concluído

🔄 Aplicando schema de monitoramento...
✅ Aplicando schema de monitoramento - Concluído

🔄 Aplicando schema de criptografia...
✅ Aplicando schema de criptografia - Concluído

🔄 Aplicando schema de auditoria...
✅ Aplicando schema de auditoria - Concluído

📊 Resumo: 6/6 schemas aplicados com sucesso

🔍 Verificando instalação...
✅ Tabela google_ads_connections criada com sucesso
✅ Tabela google_ads_campaigns criada com sucesso
✅ Tabela google_ads_metrics criada com sucesso
✅ Tabela google_ads_sync_logs criada com sucesso
✅ Tabela oauth_states criada com sucesso
🔍 Verificando políticas RLS...
✅ 15 políticas RLS encontradas

🎉 Schema Google Ads aplicado com sucesso!
```

### 3.3 Verificar Instalação

```bash
# Verificar schema aplicado
node scripts/check-google-ads-schema.js

# Testar RLS policies
node scripts/test-rls-policies.js
```

## Etapa 4: Configuração da Aplicação

### 4.1 Instalar Dependências Adicionais

Se necessário, instalar dependências específicas:

```bash
# Redis (para cache)
npm install redis

# Cron jobs (se usando node-cron)
npm install node-cron

# Monitoramento (se usando)
npm install @sentry/nextjs
```

### 4.2 Configurar Cron Jobs

1. **Vercel Cron** (recomendado para Vercel)
   - Arquivo `vercel.json` já configurado
   - Cron jobs automáticos para sincronização

2. **Node Cron** (para outros ambientes)
   ```javascript
   // Adicionar ao seu servidor
   const cron = require('node-cron');
   
   // Sincronização a cada 6 horas
   cron.schedule('0 */6 * * *', () => {
     console.log('Executando sincronização Google Ads...');
     // Chamar endpoint de sincronização
   });
   ```

### 4.3 Configurar Monitoramento (Opcional)

```bash
# Configurar Sentry (exemplo)
npx @sentry/wizard -i nextjs

# Configurar variáveis de monitoramento
echo "SENTRY_DSN=your_sentry_dsn" >> .env
echo "GOOGLE_ADS_ENABLE_MONITORING=true" >> .env
```

## Etapa 5: Testes Iniciais

### 5.1 Testes de Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Em outro terminal, executar testes
npm run test:google-ads

# Testar endpoints básicos
curl http://localhost:3000/api/google/health
```

### 5.2 Teste de Conexão Manual

1. **Acessar aplicação**
   - Abra `http://localhost:3000`
   - Faça login no sistema

2. **Testar fluxo OAuth**
   - Vá para "Google Ads" no menu
   - Clique em "Conectar Google Ads"
   - Complete o fluxo de autorização
   - Verifique se contas aparecem para seleção

3. **Testar sincronização**
   - Selecione uma conta para conectar
   - Aguarde sincronização inicial
   - Verifique se campanhas aparecem no dashboard

### 5.3 Validação de Dados

```bash
# Verificar dados sincronizados
node scripts/validate-sync-data.js

# Verificar métricas
node scripts/check-metrics-accuracy.js
```

## Etapa 6: Deploy Inicial

### 6.1 Preparar para Deploy

```bash
# Build da aplicação
npm run build

# Testar build localmente
npm run start

# Executar testes finais
npm run test:all
```

### 6.2 Deploy em Staging

1. **Configurar ambiente de staging**
   - Criar projeto separado no Vercel/Netlify
   - Configurar variáveis de ambiente de staging
   - Atualizar redirect URIs no Google Cloud Console

2. **Executar deploy**
   ```bash
   # Via Vercel CLI
   vercel --prod --env staging
   
   # Ou via Git (se configurado)
   git push origin staging
   ```

3. **Testar em staging**
   - Executar todos os testes E2E
   - Validar fluxo completo de usuário
   - Verificar performance

### 6.3 Deploy em Produção

1. **Configurar ambiente de produção**
   - Configurar variáveis de ambiente de produção
   - Atualizar redirect URIs para domínio final
   - Configurar monitoramento

2. **Executar deploy**
   ```bash
   # Via Vercel CLI
   vercel --prod
   
   # Ou via Git
   git push origin main
   ```

3. **Verificação pós-deploy**
   - Executar checklist de deploy
   - Monitorar logs por 24 horas
   - Validar com usuários beta

## Etapa 7: Configuração de Produção

### 7.1 Configurar Alertas

```bash
# Configurar alertas de erro
node scripts/setup-error-alerts.js

# Configurar alertas de performance
node scripts/setup-performance-alerts.js
```

### 7.2 Configurar Backup Automático

```bash
# Configurar backup diário
node scripts/setup-daily-backup.js

# Testar processo de backup
node scripts/test-backup-restore.js
```

### 7.3 Documentar Configuração

1. **Criar documentação interna**
   - Credenciais e acessos
   - Procedimentos de manutenção
   - Contatos de emergência

2. **Treinar equipe**
   - Demonstrar funcionalidades
   - Explicar troubleshooting básico
   - Definir responsabilidades

## Troubleshooting da Configuração

### Problemas Comuns

#### 1. "Invalid client_id" durante OAuth
**Causa**: Client ID incorreto ou não configurado
**Solução**:
```bash
# Verificar variável de ambiente
echo $GOOGLE_CLIENT_ID

# Revalidar no Google Cloud Console
# Verificar se projeto está ativo
```

#### 2. "Developer token not approved"
**Causa**: Token ainda não foi aprovado pelo Google
**Solução**:
- Aguardar aprovação (1-3 dias)
- Verificar email de notificação
- Usar token de teste temporariamente

#### 3. Schema não aplica corretamente
**Causa**: Permissões insuficientes ou conflitos
**Solução**:
```bash
# Verificar permissões Supabase
node scripts/check-supabase-permissions.js

# Limpar e reaplicar schema
node scripts/rollback-google-ads-schema.js
node scripts/apply-google-ads-complete-schema.js
```

#### 4. Sincronização falha
**Causa**: Rate limits ou configuração incorreta
**Solução**:
```bash
# Verificar logs de sincronização
node scripts/check-sync-logs.js

# Testar conexão com API
node scripts/test-google-ads-api.js
```

### Logs Importantes

```bash
# Logs de aplicação
tail -f logs/application.log

# Logs de sincronização
tail -f logs/google-sync.log

# Logs de erro
tail -f logs/error.log
```

## Checklist de Configuração Completa

### Configuração Google Cloud
- [ ] Projeto criado e configurado
- [ ] APIs habilitadas
- [ ] OAuth 2.0 configurado
- [ ] Redirect URIs corretos
- [ ] Developer Token obtido e aprovado

### Configuração Ambiente
- [ ] Repositório clonado
- [ ] Dependências instaladas
- [ ] Variáveis de ambiente configuradas
- [ ] Configuração validada

### Configuração Banco de Dados
- [ ] Backup criado
- [ ] Schema aplicado com sucesso
- [ ] RLS policies funcionando
- [ ] Dados de teste criados

### Configuração Aplicação
- [ ] Build executa sem erros
- [ ] Testes passam
- [ ] Cron jobs configurados
- [ ] Monitoramento configurado

### Deploy e Produção
- [ ] Deploy em staging realizado
- [ ] Testes E2E passam
- [ ] Deploy em produção realizado
- [ ] Monitoramento ativo
- [ ] Backup automático configurado

### Documentação e Treinamento
- [ ] Documentação interna criada
- [ ] Equipe treinada
- [ ] Procedimentos documentados
- [ ] Contatos de emergência definidos

## Próximos Passos

Após completar a configuração inicial:

1. **Monitorar por 48 horas**
   - Verificar logs regularmente
   - Monitorar performance
   - Coletar feedback inicial

2. **Otimizar configuração**
   - Ajustar rate limits se necessário
   - Otimizar cache settings
   - Refinar alertas

3. **Treinar usuários**
   - Criar materiais de treinamento
   - Realizar sessões de demonstração
   - Coletar feedback de usuários

4. **Planejar melhorias**
   - Identificar oportunidades de otimização
   - Planejar funcionalidades adicionais
   - Definir roadmap de evolução

---

**Configuração concluída com sucesso!** 🎉

Para suporte adicional, consulte:
- [Documentação Técnica](GOOGLE_ADS_API_DOCUMENTATION.md)
- [Guia de Troubleshooting](GOOGLE_ADS_TROUBLESHOOTING.md)
- [FAQ](GOOGLE_ADS_FAQ.md)