# Google Ads Environment Variables Documentation

## Overview

Esta documentação lista todas as variáveis de ambiente necessárias para a integração Google Ads, incluindo configuração, valores de exemplo e instruções de setup.

## Variáveis Obrigatórias

### Google Ads API Configuration

#### GOOGLE_CLIENT_ID
**Descrição:** ID do cliente OAuth 2.0 do Google Cloud Console  
**Tipo:** String  
**Obrigatório:** Sim  
**Exemplo:** `123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com`

**Como obter:**
1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Vá para "APIs & Services" > "Credentials"
3. Crie ou selecione um "OAuth 2.0 Client ID"
4. Copie o "Client ID"

#### GOOGLE_CLIENT_SECRET
**Descrição:** Secret do cliente OAuth 2.0  
**Tipo:** String  
**Obrigatório:** Sim  
**Exemplo:** `GOCSPX-abcdefghijklmnopqrstuvwxyz123456`

**Como obter:**
1. No mesmo OAuth 2.0 Client ID do Google Cloud Console
2. Copie o "Client Secret"

#### GOOGLE_DEVELOPER_TOKEN
**Descrição:** Token de desenvolvedor do Google Ads API  
**Tipo:** String  
**Obrigatório:** Sim  
**Exemplo:** `abcdefghijklmnopqrstuvwxyz123456`

**Como obter:**
1. Acesse [Google Ads](https://ads.google.com)
2. Vá para "Tools & Settings" > "Setup" > "API Center"
3. Solicite um Developer Token
4. Aguarde aprovação (pode levar alguns dias)

### Application Configuration

#### NEXT_PUBLIC_APP_URL
**Descrição:** URL base da aplicação para callbacks OAuth  
**Tipo:** String  
**Obrigatório:** Sim  
**Exemplo Produção:** `https://your-domain.com`  
**Exemplo Desenvolvimento:** `http://localhost:3000`

**Configuração:**
- Deve ser a URL exata onde a aplicação está rodando
- Não incluir trailing slash
- Deve estar configurada como Redirect URI no Google Cloud Console

## Variáveis Opcionais

### Cache Configuration

#### REDIS_URL
**Descrição:** URL de conexão com Redis para cache  
**Tipo:** String  
**Obrigatório:** Não  
**Padrão:** Cache em memória  
**Exemplo:** `redis://localhost:6379`

#### GOOGLE_ADS_CACHE_TTL
**Descrição:** Tempo de vida do cache em segundos  
**Tipo:** Number  
**Obrigatório:** Não  
**Padrão:** `900` (15 minutos)  
**Exemplo:** `1800`

### Rate Limiting

#### GOOGLE_ADS_RATE_LIMIT_PER_MINUTE
**Descrição:** Limite de requests por minuto para Google Ads API  
**Tipo:** Number  
**Obrigatório:** Não  
**Padrão:** `1000`  
**Exemplo:** `500`

#### GOOGLE_ADS_BATCH_SIZE
**Descrição:** Tamanho do batch para sincronização  
**Tipo:** Number  
**Obrigatório:** Não  
**Padrão:** `50`  
**Exemplo:** `100`

### Sync Configuration

#### GOOGLE_ADS_SYNC_INTERVAL_HOURS
**Descrição:** Intervalo entre sincronizações automáticas em horas  
**Tipo:** Number  
**Obrigatório:** Não  
**Padrão:** `6`  
**Exemplo:** `4`

#### GOOGLE_ADS_SYNC_TIMEOUT_MINUTES
**Descrição:** Timeout para operações de sync em minutos  
**Tipo:** Number  
**Obrigatório:** Não  
**Padrão:** `30`  
**Exemplo:** `45`

### Monitoring

#### GOOGLE_ADS_ENABLE_MONITORING
**Descrição:** Habilitar monitoramento avançado  
**Tipo:** Boolean  
**Obrigatório:** Não  
**Padrão:** `false`  
**Exemplo:** `true`

#### GOOGLE_ADS_LOG_LEVEL
**Descrição:** Nível de log para Google Ads  
**Tipo:** String  
**Obrigatório:** Não  
**Padrão:** `info`  
**Valores:** `error`, `warn`, `info`, `debug`

## Arquivo .env Completo

### Exemplo para Desenvolvimento

```bash
# Google Ads API Configuration (OBRIGATÓRIO)
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz123456
GOOGLE_DEVELOPER_TOKEN=abcdefghijklmnopqrstuvwxyz123456

# Application URL (OBRIGATÓRIO)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cache Configuration (OPCIONAL)
REDIS_URL=redis://localhost:6379
GOOGLE_ADS_CACHE_TTL=900

# Rate Limiting (OPCIONAL)
GOOGLE_ADS_RATE_LIMIT_PER_MINUTE=1000
GOOGLE_ADS_BATCH_SIZE=50

# Sync Configuration (OPCIONAL)
GOOGLE_ADS_SYNC_INTERVAL_HOURS=6
GOOGLE_ADS_SYNC_TIMEOUT_MINUTES=30

# Monitoring (OPCIONAL)
GOOGLE_ADS_ENABLE_MONITORING=true
GOOGLE_ADS_LOG_LEVEL=debug

# Supabase (já existente)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Meta Ads (já existente)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
```

### Exemplo para Produção

```bash
# Google Ads API Configuration
GOOGLE_CLIENT_ID=123456789012-prodclientid123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-prodclientsecret123456
GOOGLE_DEVELOPER_TOKEN=proddevtoken123456

# Application URL
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# Cache Configuration
REDIS_URL=redis://your-redis-instance:6379
GOOGLE_ADS_CACHE_TTL=1800

# Rate Limiting (mais conservador em produção)
GOOGLE_ADS_RATE_LIMIT_PER_MINUTE=500
GOOGLE_ADS_BATCH_SIZE=25

# Sync Configuration
GOOGLE_ADS_SYNC_INTERVAL_HOURS=4
GOOGLE_ADS_SYNC_TIMEOUT_MINUTES=45

# Monitoring
GOOGLE_ADS_ENABLE_MONITORING=true
GOOGLE_ADS_LOG_LEVEL=info
```

## Configuração por Ambiente

### Desenvolvimento Local

```bash
# .env.local
GOOGLE_CLIENT_ID=dev-client-id
GOOGLE_CLIENT_SECRET=dev-client-secret
GOOGLE_DEVELOPER_TOKEN=dev-token
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_ADS_LOG_LEVEL=debug
```

### Staging

```bash
# .env.staging
GOOGLE_CLIENT_ID=staging-client-id
GOOGLE_CLIENT_SECRET=staging-client-secret
GOOGLE_DEVELOPER_TOKEN=staging-token
NEXT_PUBLIC_APP_URL=https://staging.your-domain.com
GOOGLE_ADS_LOG_LEVEL=info
```

### Produção

```bash
# .env.production
GOOGLE_CLIENT_ID=prod-client-id
GOOGLE_CLIENT_SECRET=prod-client-secret
GOOGLE_DEVELOPER_TOKEN=prod-token
NEXT_PUBLIC_APP_URL=https://your-domain.com
GOOGLE_ADS_LOG_LEVEL=warn
GOOGLE_ADS_ENABLE_MONITORING=true
```

## Validação de Configuração

### Script de Verificação

Crie um script para validar as variáveis:

```javascript
// scripts/validate-google-env.js
const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET', 
  'GOOGLE_DEVELOPER_TOKEN',
  'NEXT_PUBLIC_APP_URL'
];

const optionalVars = [
  'REDIS_URL',
  'GOOGLE_ADS_CACHE_TTL',
  'GOOGLE_ADS_RATE_LIMIT_PER_MINUTE',
  'GOOGLE_ADS_BATCH_SIZE',
  'GOOGLE_ADS_SYNC_INTERVAL_HOURS',
  'GOOGLE_ADS_SYNC_TIMEOUT_MINUTES',
  'GOOGLE_ADS_ENABLE_MONITORING',
  'GOOGLE_ADS_LOG_LEVEL'
];

function validateEnvironment() {
  console.log('🔍 Validating Google Ads environment variables...\n');
  
  let hasErrors = false;
  
  // Check required variables
  console.log('📋 Required Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.log(`❌ ${varName}: MISSING`);
      hasErrors = true;
    } else {
      console.log(`✅ ${varName}: SET`);
    }
  });
  
  // Check optional variables
  console.log('\n📋 Optional Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚪ ${varName}: NOT SET (using default)`);
    }
  });
  
  // Validate URL format
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.match(/^https?:\/\/.+/)) {
    console.log(`❌ NEXT_PUBLIC_APP_URL: Invalid URL format`);
    hasErrors = true;
  }
  
  // Validate numeric values
  const numericVars = [
    'GOOGLE_ADS_CACHE_TTL',
    'GOOGLE_ADS_RATE_LIMIT_PER_MINUTE', 
    'GOOGLE_ADS_BATCH_SIZE',
    'GOOGLE_ADS_SYNC_INTERVAL_HOURS',
    'GOOGLE_ADS_SYNC_TIMEOUT_MINUTES'
  ];
  
  numericVars.forEach(varName => {
    const value = process.env[varName];
    if (value && isNaN(Number(value))) {
      console.log(`❌ ${varName}: Must be a number`);
      hasErrors = true;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.log('❌ Configuration has errors. Please fix before proceeding.');
    process.exit(1);
  } else {
    console.log('✅ All Google Ads environment variables are properly configured!');
  }
}

validateEnvironment();
```

### Executar Validação

```bash
# Validar configuração
node scripts/validate-google-env.js

# Ou adicionar ao package.json
npm run validate:google-env
```

## Configuração no Google Cloud Console

### 1. Criar Projeto

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione existente
3. Habilite as APIs necessárias:
   - Google Ads API
   - Google OAuth2 API

### 2. Configurar OAuth 2.0

1. Vá para "APIs & Services" > "Credentials"
2. Clique "Create Credentials" > "OAuth 2.0 Client ID"
3. Selecione "Web application"
4. Configure Authorized redirect URIs:
   ```
   http://localhost:3000/api/google/callback
   https://your-domain.com/api/google/callback
   ```

### 3. Obter Developer Token

1. Acesse sua conta Google Ads
2. Vá para "Tools & Settings" > "Setup" > "API Center"
3. Clique "Get started" no Developer Token
4. Preencha o formulário de solicitação
5. Aguarde aprovação (1-3 dias úteis)

## Segurança

### Proteção de Secrets

1. **Nunca commitar secrets no código**
2. **Usar diferentes tokens por ambiente**
3. **Rotacionar tokens periodicamente**
4. **Monitorar uso dos tokens**

### Exemplo de .env.example

```bash
# Google Ads API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_DEVELOPER_TOKEN=your_google_developer_token_here

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Cache Configuration
REDIS_URL=redis://localhost:6379
GOOGLE_ADS_CACHE_TTL=900

# Optional: Rate Limiting
GOOGLE_ADS_RATE_LIMIT_PER_MINUTE=1000
GOOGLE_ADS_BATCH_SIZE=50

# Optional: Sync Configuration
GOOGLE_ADS_SYNC_INTERVAL_HOURS=6
GOOGLE_ADS_SYNC_TIMEOUT_MINUTES=30

# Optional: Monitoring
GOOGLE_ADS_ENABLE_MONITORING=false
GOOGLE_ADS_LOG_LEVEL=info
```

## Troubleshooting

### Problemas Comuns

#### 1. "Invalid client_id"
- Verificar se GOOGLE_CLIENT_ID está correto
- Confirmar que o projeto está ativo no Google Cloud Console

#### 2. "Redirect URI mismatch"
- Verificar se NEXT_PUBLIC_APP_URL está correto
- Confirmar que a URI está configurada no Google Cloud Console

#### 3. "Invalid developer token"
- Verificar se o token foi aprovado pelo Google
- Confirmar que o token está associado ao projeto correto

#### 4. "Rate limit exceeded"
- Reduzir GOOGLE_ADS_RATE_LIMIT_PER_MINUTE
- Aumentar GOOGLE_ADS_SYNC_INTERVAL_HOURS

### Comandos de Debug

```bash
# Testar configuração OAuth
curl "https://oauth2.googleapis.com/tokeninfo?access_token=YOUR_ACCESS_TOKEN"

# Verificar Developer Token
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "developer-token: YOUR_DEVELOPER_TOKEN" \
     "https://googleads.googleapis.com/v14/customers:listAccessibleCustomers"

# Testar conectividade
node -e "console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET')"
```

## Migração e Updates

### Atualizando Tokens

```bash
# Backup das configurações atuais
cp .env .env.backup

# Atualizar tokens
# Editar .env com novos valores

# Validar nova configuração
node scripts/validate-google-env.js

# Reiniciar aplicação
npm run restart
```

### Rotação de Secrets

1. **Gerar novos tokens no Google Cloud Console**
2. **Atualizar variáveis de ambiente**
3. **Testar em staging primeiro**
4. **Deploy em produção**
5. **Revogar tokens antigos**

## Monitoramento

### Métricas Importantes

- Taxa de sucesso de autenticação
- Uso de rate limits
- Tempo de resposta da API
- Erros de token expirado

### Alertas Recomendados

```bash
# Exemplo de alerta para tokens expirando
if [ $(date -d "+7 days" +%s) -gt $TOKEN_EXPIRY ]; then
  echo "⚠️  Google Ads tokens expiring in 7 days"
fi
```