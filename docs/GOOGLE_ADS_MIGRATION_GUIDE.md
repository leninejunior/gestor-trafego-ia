# Google Ads Integration - Migration Guide

## Overview

Este guia fornece instruções detalhadas para migração e deployment da integração Google Ads, incluindo scripts de aplicação do schema, planos de rollback e checklists de deploy.

## Pré-requisitos

### Sistema
- Node.js 18+ instalado
- Acesso ao banco Supabase (admin)
- Variáveis de ambiente configuradas
- Backup do banco de dados atual

### Credenciais Google
- Google Cloud Console project configurado
- OAuth 2.0 credentials criados
- Google Ads Developer Token aprovado
- Redirect URIs configurados

## Processo de Migração

### Fase 1: Preparação

#### 1.1 Backup do Sistema Atual

```bash
# Backup completo do banco
pg_dump -h your-supabase-host \
        -U postgres \
        -d postgres \
        --clean \
        --if-exists \
        > backup/pre-google-ads-migration-$(date +%Y%m%d).sql

# Backup específico de tabelas críticas
pg_dump -h your-supabase-host \
        -U postgres \
        -d postgres \
        --table=clients \
        --table=organization_memberships \
        --table=meta_ads_connections \
        --data-only \
        > backup/critical-data-$(date +%Y%m%d).sql
```

#### 1.2 Validação do Ambiente

```bash
# Executar script de validação
node scripts/pre-migration-check.js

# Verificar variáveis de ambiente
node scripts/validate-google-env.js

# Testar conectividade com APIs
node scripts/test-google-apis.js
```

### Fase 2: Aplicação do Schema

#### 2.1 Schema Principal

Execute o script de aplicação do schema:

```bash
# Aplicar schema Google Ads
node scripts/apply-google-ads-schema.js

# Ou manualmente via Supabase SQL Editor
# Copie o conteúdo de database/google-ads-schema.sql
```

#### 2.2 Verificação do Schema

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'google_ads_%';

-- Verificar políticas RLS
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename LIKE 'google_ads_%';

-- Verificar índices
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename LIKE 'google_ads_%';
```

#### 2.3 Dados de Teste (Opcional)

```bash
# Aplicar dados de teste em ambiente de desenvolvimento
node scripts/seed-google-ads-test-data.js
```

### Fase 3: Deploy da Aplicação

#### 3.1 Deploy Staging

```bash
# Deploy para staging
vercel --target staging

# Verificar health check
curl https://staging.your-domain.com/api/google/monitoring/health

# Executar testes de integração
npm run test:integration:google
```

#### 3.2 Testes de Aceitação

```bash
# Testes automatizados
npm run test:e2e:google

# Testes manuais
# 1. Conectar conta Google Ads
# 2. Verificar sincronização
# 3. Testar dashboard
# 4. Verificar métricas unificadas
```

#### 3.3 Deploy Produção

```bash
# Deploy para produção
vercel --prod

# Verificar deployment
curl https://your-domain.com/api/google/monitoring/health

# Monitorar logs
vercel logs --follow
```

### Fase 4: Configuração Pós-Deploy

#### 4.1 Configurar Cron Jobs

```bash
# Verificar se cron jobs estão ativos
curl https://your-domain.com/api/cron/google-sync \
  -H "Authorization: Bearer CRON_SECRET"
```

#### 4.2 Configurar Monitoramento

```bash
# Configurar alertas
node scripts/setup-google-ads-alerts.js

# Verificar métricas
curl https://your-domain.com/api/google/monitoring/metrics
```

## Scripts de Migração

### Script Principal de Aplicação

**Arquivo**: `scripts/apply-google-ads-complete-migration.js`

```javascript
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Starting Google Ads migration...\n');
  
  try {
    // 1. Aplicar schema principal
    console.log('📋 Applying main schema...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../database/google-ads-schema.sql'), 
      'utf8'
    );
    
    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: schemaSQL
    });
    
    if (schemaError) {
      throw new Error(`Schema error: ${schemaError.message}`);
    }
    console.log('✅ Main schema applied');
    
    // 2. Aplicar políticas RLS
    console.log('🔒 Applying RLS policies...');
    const rlsSQL = fs.readFileSync(
      path.join(__dirname, '../database/google-ads-rls-policies.sql'), 
      'utf8'
    );
    
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: rlsSQL
    });
    
    if (rlsError) {
      throw new Error(`RLS error: ${rlsError.message}`);
    }
    console.log('✅ RLS policies applied');
    
    // 3. Aplicar índices de performance
    console.log('⚡ Creating performance indexes...');
    const indexSQL = fs.readFileSync(
      path.join(__dirname, '../database/google-ads-indexes.sql'), 
      'utf8'
    );
    
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: indexSQL
    });
    
    if (indexError) {
      throw new Error(`Index error: ${indexError.message}`);
    }
    console.log('✅ Performance indexes created');
    
    // 4. Aplicar funções auxiliares
    console.log('🔧 Creating helper functions...');
    const functionsSQL = fs.readFileSync(
      path.join(__dirname, '../database/google-ads-functions.sql'), 
      'utf8'
    );
    
    const { error: functionsError } = await supabase.rpc('exec_sql', {
      sql: functionsSQL
    });
    
    if (functionsError) {
      throw new Error(`Functions error: ${functionsError.message}`);
    }
    console.log('✅ Helper functions created');
    
    // 5. Verificar integridade
    console.log('🔍 Verifying migration...');
    await verifyMigration();
    
    console.log('\n🎉 Google Ads migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Deploy application code');
    console.log('2. Configure environment variables');
    console.log('3. Test OAuth flow');
    console.log('4. Run integration tests');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n🔄 Rolling back changes...');
    await rollbackMigration();
    process.exit(1);
  }
}

async function verifyMigration() {
  // Verificar tabelas
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .like('table_name', 'google_ads_%');
  
  if (tablesError) {
    throw new Error(`Verification error: ${tablesError.message}`);
  }
  
  const expectedTables = [
    'google_ads_connections',
    'google_ads_campaigns', 
    'google_ads_metrics',
    'google_ads_sync_logs'
  ];
  
  const createdTables = tables.map(t => t.table_name);
  const missingTables = expectedTables.filter(t => !createdTables.includes(t));
  
  if (missingTables.length > 0) {
    throw new Error(`Missing tables: ${missingTables.join(', ')}`);
  }
  
  console.log('✅ All tables created successfully');
  
  // Verificar RLS
  const { data: policies, error: policiesError } = await supabase
    .from('pg_policies')
    .select('tablename, policyname')
    .like('tablename', 'google_ads_%');
  
  if (policiesError) {
    throw new Error(`RLS verification error: ${policiesError.message}`);
  }
  
  if (policies.length === 0) {
    throw new Error('No RLS policies found');
  }
  
  console.log('✅ RLS policies verified');
}

async function rollbackMigration() {
  try {
    const rollbackSQL = `
      DROP TABLE IF EXISTS google_ads_sync_logs CASCADE;
      DROP TABLE IF EXISTS google_ads_metrics CASCADE;
      DROP TABLE IF EXISTS google_ads_campaigns CASCADE;
      DROP TABLE IF EXISTS google_ads_connections CASCADE;
      DROP TABLE IF EXISTS oauth_states CASCADE;
    `;
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: rollbackSQL
    });
    
    if (error) {
      console.error('❌ Rollback failed:', error.message);
    } else {
      console.log('✅ Rollback completed');
    }
  } catch (error) {
    console.error('❌ Rollback error:', error.message);
  }
}

// Executar migração
applyMigration();
```

### Script de Verificação Pré-Migração

**Arquivo**: `scripts/pre-migration-check.js`

```javascript
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

async function preMigrationCheck() {
  console.log('🔍 Running pre-migration checks...\n');
  
  let hasErrors = false;
  
  // 1. Verificar variáveis de ambiente
  console.log('📋 Checking environment variables...');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_DEVELOPER_TOKEN',
    'NEXT_PUBLIC_APP_URL'
  ];
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      console.log(`❌ Missing: ${varName}`);
      hasErrors = true;
    } else {
      console.log(`✅ Found: ${varName}`);
    }
  });
  
  // 2. Verificar conectividade Supabase
  console.log('\n🔗 Testing Supabase connection...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase
      .from('clients')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`❌ Supabase connection failed: ${error.message}`);
      hasErrors = true;
    } else {
      console.log('✅ Supabase connection successful');
    }
  } catch (error) {
    console.log(`❌ Supabase error: ${error.message}`);
    hasErrors = true;
  }
  
  // 3. Verificar se tabelas Google Ads já existem
  console.log('\n📊 Checking for existing Google Ads tables...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', 'google_ads_%');
    
    if (tables && tables.length > 0) {
      console.log('⚠️  Google Ads tables already exist:');
      tables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      console.log('   Migration will update existing tables');
    } else {
      console.log('✅ No existing Google Ads tables found');
    }
  } catch (error) {
    console.log(`❌ Table check error: ${error.message}`);
    hasErrors = true;
  }
  
  // 4. Verificar espaço em disco (estimativa)
  console.log('\n💾 Checking database size...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data } = await supabase.rpc('get_db_size');
    if (data) {
      console.log(`✅ Current database size: ${data}`);
    }
  } catch (error) {
    console.log('⚠️  Could not check database size');
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.log('❌ Pre-migration checks failed. Please fix errors before proceeding.');
    process.exit(1);
  } else {
    console.log('✅ All pre-migration checks passed!');
    console.log('\nYou can now proceed with the migration:');
    console.log('node scripts/apply-google-ads-complete-migration.js');
  }
}

preMigrationCheck();
```

## Plano de Rollback

### Rollback Automático

```javascript
// scripts/rollback-google-ads-migration.js
async function rollbackMigration() {
  console.log('🔄 Starting Google Ads migration rollback...\n');
  
  try {
    // 1. Remover tabelas Google Ads
    console.log('🗑️  Removing Google Ads tables...');
    const dropTablesSQL = `
      DROP TABLE IF EXISTS google_ads_sync_logs CASCADE;
      DROP TABLE IF EXISTS google_ads_metrics CASCADE;
      DROP TABLE IF EXISTS google_ads_campaigns CASCADE;
      DROP TABLE IF EXISTS google_ads_connections CASCADE;
      DROP TABLE IF EXISTS oauth_states CASCADE;
    `;
    
    await supabase.rpc('exec_sql', { sql: dropTablesSQL });
    console.log('✅ Tables removed');
    
    // 2. Remover funções
    console.log('🔧 Removing helper functions...');
    const dropFunctionsSQL = `
      DROP FUNCTION IF EXISTS cleanup_expired_oauth_states();
      DROP FUNCTION IF EXISTS get_google_sync_stats(UUID);
      DROP FUNCTION IF EXISTS cleanup_old_google_metrics();
    `;
    
    await supabase.rpc('exec_sql', { sql: dropFunctionsSQL });
    console.log('✅ Functions removed');
    
    // 3. Limpar cache (se aplicável)
    console.log('🧹 Clearing cache...');
    // Implementar limpeza de cache se necessário
    
    console.log('\n✅ Rollback completed successfully!');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  }
}
```

### Rollback Manual

```sql
-- SQL para rollback manual
BEGIN;

-- Remover tabelas na ordem correta (dependências)
DROP TABLE IF EXISTS google_ads_sync_logs CASCADE;
DROP TABLE IF EXISTS google_ads_metrics CASCADE;
DROP TABLE IF EXISTS google_ads_campaigns CASCADE;
DROP TABLE IF EXISTS google_ads_connections CASCADE;
DROP TABLE IF EXISTS oauth_states CASCADE;

-- Remover funções
DROP FUNCTION IF EXISTS cleanup_expired_oauth_states();
DROP FUNCTION IF EXISTS get_google_sync_stats(UUID);
DROP FUNCTION IF EXISTS cleanup_old_google_metrics();

-- Remover tipos customizados (se houver)
-- DROP TYPE IF EXISTS google_ads_status;

COMMIT;
```

## Checklist de Deploy

### Pré-Deploy

- [ ] Backup do banco de dados realizado
- [ ] Variáveis de ambiente configuradas
- [ ] Google Cloud Console configurado
- [ ] OAuth credentials testados
- [ ] Pre-migration checks executados
- [ ] Testes locais passando

### Deploy

- [ ] Schema aplicado com sucesso
- [ ] RLS policies ativas
- [ ] Índices criados
- [ ] Funções auxiliares instaladas
- [ ] Verificação de integridade passou
- [ ] Deploy da aplicação realizado
- [ ] Health checks passando

### Pós-Deploy

- [ ] OAuth flow testado
- [ ] Sincronização manual testada
- [ ] Dashboard Google Ads funcionando
- [ ] Dashboard unificado funcionando
- [ ] Cron jobs configurados
- [ ] Monitoramento ativo
- [ ] Alertas configurados
- [ ] Documentação atualizada

### Testes de Aceitação

- [ ] Conectar conta Google Ads
- [ ] Sincronizar campanhas
- [ ] Visualizar métricas
- [ ] Testar filtros e busca
- [ ] Exportar dados
- [ ] Testar com múltiplos clientes
- [ ] Verificar isolamento de dados
- [ ] Testar dashboard unificado

## Monitoramento Pós-Migração

### Métricas Críticas

```sql
-- Query para monitorar saúde pós-migração
SELECT 
  'connections' as metric,
  COUNT(*) as value,
  'active Google Ads connections' as description
FROM google_ads_connections 
WHERE status = 'active'

UNION ALL

SELECT 
  'sync_success_rate' as metric,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as value,
  'sync success rate last 24h' as description
FROM google_ads_sync_logs 
WHERE started_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'campaigns_synced' as metric,
  COUNT(*) as value,
  'total campaigns synced' as description
FROM google_ads_campaigns

UNION ALL

SELECT 
  'latest_metrics' as metric,
  EXTRACT(EPOCH FROM (NOW() - MAX(date))) / 3600 as value,
  'hours since latest metrics' as description
FROM google_ads_metrics;
```

### Alertas Pós-Deploy

```bash
# Script de monitoramento pós-deploy
#!/bin/bash

echo "🔍 Post-deployment monitoring..."

# Verificar conexões ativas
ACTIVE_CONNECTIONS=$(psql -t -c "SELECT COUNT(*) FROM google_ads_connections WHERE status = 'active'")
echo "Active connections: $ACTIVE_CONNECTIONS"

# Verificar syncs recentes
RECENT_SYNCS=$(psql -t -c "SELECT COUNT(*) FROM google_ads_sync_logs WHERE started_at >= NOW() - INTERVAL '1 hour'")
echo "Recent syncs: $RECENT_SYNCS"

# Verificar erros
ERROR_COUNT=$(psql -t -c "SELECT COUNT(*) FROM google_ads_sync_logs WHERE status = 'failed' AND started_at >= NOW() - INTERVAL '1 hour'")
echo "Recent errors: $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "⚠️  Errors detected in last hour"
  # Enviar alerta
fi

echo "✅ Monitoring complete"
```

## Troubleshooting de Migração

### Problemas Comuns

#### 1. Erro de Permissões
```
Error: permission denied for table clients
```

**Solução**: Verificar se está usando SUPABASE_SERVICE_ROLE_KEY

#### 2. Tabelas Já Existem
```
Error: relation "google_ads_connections" already exists
```

**Solução**: Usar `IF NOT EXISTS` ou executar rollback primeiro

#### 3. RLS Policies Falham
```
Error: policy "..." for table "..." already exists
```

**Solução**: Verificar políticas existentes e usar `DROP POLICY IF EXISTS`

### Logs de Debug

```bash
# Habilitar logs detalhados durante migração
export DEBUG=migration:*
node scripts/apply-google-ads-complete-migration.js
```

### Recuperação de Falhas

```bash
# Em caso de falha parcial
node scripts/diagnose-migration-state.js
node scripts/fix-partial-migration.js
```

## Contato e Suporte

### Em Caso de Problemas

1. **Verificar logs**: Consultar logs de migração e aplicação
2. **Executar diagnósticos**: Usar scripts de verificação
3. **Consultar documentação**: Revisar guias técnicos
4. **Rollback se necessário**: Usar scripts de rollback
5. **Escalar para equipe**: Seguir procedimentos de escalação

### Recursos de Suporte

- **Documentação Técnica**: `docs/GOOGLE_ADS_TECHNICAL_DOCUMENTATION.md`
- **Troubleshooting**: `docs/GOOGLE_ADS_TROUBLESHOOTING.md`
- **Scripts**: Diretório `scripts/`
- **Logs**: Verificar logs de aplicação e banco

---

**Última Atualização**: Dezembro 2024  
**Versão**: 1.0  
**Mantenedores**: Equipe de Desenvolvimento