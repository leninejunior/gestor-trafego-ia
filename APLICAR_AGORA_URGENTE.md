# 🚨 APLICAR AGORA - URGENTE

## O PROBLEMA

A coluna `algorithm` NÃO existe no banco de dados. Por isso a sincronização falha.

**Erro atual:**
```
column google_ads_encryption_keys.algorithm does not exist
```

## A SOLUÇÃO (3 MINUTOS)

### PASSO 1: Abrir Supabase SQL Editor

1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql
2. Faça login se necessário

### PASSO 2: Copiar e Colar o SQL

Copie TODO o conteúdo abaixo e cole no SQL Editor:

```sql
-- ============================================================================
-- ADICIONAR COLUNAS FALTANTES - COPIE TUDO E COLE NO SUPABASE
-- ============================================================================

-- ENCRYPTION KEYS - algorithm
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';

-- ENCRYPTION KEYS - version
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- ENCRYPTION KEYS - key_hash
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS key_hash TEXT;

-- ENCRYPTION KEYS - expires_at
ALTER TABLE google_ads_encryption_keys 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- CONNECTIONS - is_active
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- CONNECTIONS - last_sync_at
ALTER TABLE google_ads_connections 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- CAMPAIGNS - budget_amount_micros
ALTER TABLE google_ads_campaigns 
ADD COLUMN IF NOT EXISTS budget_amount_micros BIGINT;

-- AUDIT LOG - action
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS action TEXT;

-- AUDIT LOG - details
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS details JSONB;

-- AUDIT LOG - resource_type
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_type TEXT;

-- AUDIT LOG - resource_id
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS resource_id TEXT;

-- AUDIT LOG - sensitive_data
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS sensitive_data BOOLEAN DEFAULT false;

-- AUDIT LOG - ip_address
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- AUDIT LOG - user_agent
ALTER TABLE google_ads_audit_log 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

SELECT 'Migração aplicada com sucesso!' as status;

SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('google_ads_encryption_keys', 'google_ads_connections', 'google_ads_audit_log')
ORDER BY table_name, ordinal_position;
```

### PASSO 3: Clicar em RUN

1. Clique no botão "RUN" (ou Ctrl+Enter)
2. Aguarde 2-3 segundos
3. Você verá "Migração aplicada com sucesso!"

### PASSO 4: Verificar

Execute no terminal:

```bash
node scripts/test-google-health-check.js
```

**Resultado esperado:**
- ✅ Database: pass
- ✅ Encryption Keys: pass
- ✅ Active Connections: pass

## DEPOIS DISSO

### Se ainda não sincronizar campanhas:

O problema é o **Developer Token do Google Ads**. Você precisa:

1. **Acessar:** https://ads.google.com/aw/apicenter
2. **Verificar:** Status do Developer Token
3. **Se estiver "Pendente":** Solicitar aprovação
4. **Se estiver "Rejeitado":** Criar novo token

### Permissões do usuário OAuth:

1. **Acessar:** https://ads.google.com
2. **Ir em:** Ferramentas > Acesso e segurança
3. **Verificar:** Se o email OAuth tem permissão "Padrão" ou "Admin"
4. **Se não tiver:** Adicionar o usuário com permissões

## POR QUE ISSO ACONTECEU?

O Supabase NÃO permite executar SQL via API. Por isso:
- ❌ Scripts Node.js NÃO aplicam migrações automaticamente
- ❌ Apenas criar arquivos SQL NÃO atualiza o banco
- ✅ Você DEVE copiar e colar no SQL Editor manualmente

## RESUMO

1. ✅ Copiar SQL acima
2. ✅ Colar no Supabase SQL Editor
3. ✅ Clicar em RUN
4. ✅ Testar com `node scripts/test-google-health-check.js`
5. ✅ Se ainda falhar, verificar Developer Token no Google Ads

---

**Tempo estimado:** 3 minutos
**Dificuldade:** Fácil (copiar e colar)
**Resultado:** Sincronização funcionando
