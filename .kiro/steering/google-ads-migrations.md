
# Google Ads - Migrações e Schema

## ⚠️ IMPORTANTE: Sempre Aplicar Migrações no Supabase

**REGRA CRÍTICA:** Sempre que houver mudanças no schema do Google Ads, você DEVE aplicar as migrações manualmente no Supabase SQL Editor.

### Por Que Isso é Necessário

O Supabase não permite executar SQL complexo via API. Portanto:
- ❌ Scripts Node.js NÃO conseguem aplicar migrações automaticamente
- ❌ Apenas criar arquivos SQL NÃO atualiza o banco de dados
- ✅ Você DEVE copiar e colar o SQL no Supabase SQL Editor manualmente

### Processo Obrigatório para Mudanças de Schema

Sempre que modificar o schema do Google Ads:

1. **Criar/Atualizar o arquivo SQL de migração**
   - Localização: `database/migrations/`
   - Usar `IF NOT EXISTS` para segurança

2. **Aplicar no Supabase SQL Editor**
   - URL: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql
   - Copiar conteúdo do arquivo SQL
   - Colar no editor
   - Clicar em "Run"

3. **Verificar se funcionou**
   ```bash
   node scripts/test-google-health-check.js
   ```

4. **Atualizar documentação**
   - Atualizar `CHANGELOG.md`
   - Atualizar documentação relevante
   - Criar summary da migração

### Arquivos de Schema Google Ads

#### Schema Base
- **Arquivo:** `database/google-ads-schema.sql`
- **Quando usar:** Primeira vez criando as tabelas
- **Contém:**
  - `google_ads_encryption_keys` - Chaves de criptografia
  - `google_ads_connections` - Conexões OAuth
  - `google_ads_campaigns` - Campanhas sincronizadas
  - `google_ads_metrics` - Métricas das campanhas
  - `google_ads_sync_logs` - Logs de sincronização
  - `google_ads_audit_log` - Auditoria de eventos
  - Políticas RLS para isolamento de clientes

#### Migrações
- **Diretório:** `database/migrations/`
- **Arquivos principais:**
  - `fix-google-ads-schema.sql` - Migração completa (com blocos DO)
  - `fix-google-ads-schema-simple.sql` - Versão simplificada (sem blocos DO)
  - `verify-google-ads-schema.sql` - Verificação pós-migração
  - `rollback-google-ads-schema.sql` - Reverter mudanças

### Estrutura das Tabelas Google Ads

#### google_ads_encryption_keys
```sql
- id (UUID, PK)
- key_data (TEXT) - Chave criptografada
- algorithm (VARCHAR(50)) - Algoritmo usado (ex: 'aes-256-gcm')
- version (INTEGER) - Versão da chave para rotação
- key_hash (TEXT) - Hash da chave
- is_active (BOOLEAN)
- created_at (TIMESTAMPTZ)
- expires_at (TIMESTAMPTZ)
```

#### google_ads_audit_log
```sql
- id (UUID, PK)
- client_id (UUID, FK -> clients) - Cliente associado
- connection_id (UUID, FK -> google_ads_connections)
- user_id (UUID, FK -> auth.users)
- operation (TEXT) - Tipo de operação
- action (TEXT) - Ação realizada (legado)
- metadata (JSONB) - Dados estruturados
- details (JSONB) - Detalhes (legado)
- resource_type (TEXT) - Tipo de recurso
- resource_id (TEXT) - ID do recurso
- success (BOOLEAN) - Se operação foi bem-sucedida
- error_message (TEXT) - Mensagem de erro
- sensitive_data (BOOLEAN) - Flag de dados sensíveis
- ip_address (TEXT)
- user_agent (TEXT)
- created_at (TIMESTAMPTZ)
```

#### google_ads_connections
```sql
- id (UUID, PK)
- client_id (UUID, FK -> clients) - Isolamento por cliente
- customer_id (TEXT) - ID da conta Google Ads
- account_name (TEXT) - Nome da conta
- refresh_token (TEXT) - Token OAuth criptografado
- access_token (TEXT) - Token de acesso criptografado
- token_expires_at (TIMESTAMPTZ)
- is_active (BOOLEAN)
- last_sync_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

#### google_ads_campaigns
```sql
- id (UUID, PK)
- client_id (UUID, FK -> clients) - Isolamento por cliente
- connection_id (UUID, FK -> google_ads_connections)
- campaign_id (TEXT) - ID da campanha no Google Ads
- name (TEXT)
- status (TEXT) - ENABLED, PAUSED, REMOVED
- budget (NUMERIC)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Políticas RLS (Row Level Security)

**TODAS as tabelas Google Ads DEVEM ter RLS habilitado com isolamento por cliente:**

```sql
-- Padrão para SELECT
CREATE POLICY "google_[table]_client_select"
  ON google_ads_[table]
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id 
      FROM clients c
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role tem acesso total
CREATE POLICY "service_role_full_access_[table]"
  ON google_ads_[table]
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Checklist de Verificação Pós-Migração

Após aplicar qualquer migração, SEMPRE verificar:

1. **Colunas existem:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'google_ads_encryption_keys'
ORDER BY ordinal_position;
```

2. **Índices criados:**
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename LIKE 'google_ads%';
```

3. **Políticas RLS ativas:**
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'google_ads%';
```

4. **Health check passa:**
```bash
node scripts/test-google-health-check.js
```

### Erros Comuns e Soluções

#### "relation does not exist"
**Causa:** Tabelas não foram criadas  
**Solução:** Executar `database/google-ads-schema.sql` primeiro

#### "column does not exist"
**Causa:** Migração não foi aplicada  
**Solução:** Executar `database/migrations/fix-google-ads-schema-simple.sql`

#### "syntax error at or near DO"
**Causa:** Blocos `DO $` não suportados no Supabase SQL Editor  
**Solução:** Usar versão `-simple.sql` sem blocos procedurais

#### "permission denied"
**Causa:** RLS bloqueando acesso  
**Solução:** Verificar políticas RLS e membership do usuário

### Variáveis de Ambiente Necessárias

```env
# Google Ads API
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_DEVELOPER_TOKEN=xxx
GOOGLE_TOKEN_ENCRYPTION_KEY=xxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Scripts de Teste Disponíveis

```bash
# Health check completo
node scripts/test-google-health-check.js

# Diagnóstico de conexão
node scripts/test-connection-diagnostics.js

# Teste OAuth flow
node scripts/test-oauth-flow-e2e.js

# Teste sincronização
node scripts/test-campaign-sync.js

# Teste criptografia
node scripts/test-google-encryption.js
```

### Documentação Relacionada

- `GOOGLE_ADS_SCHEMA_FIX.md` - Documentação completa das correções
- `docs/GOOGLE_ADS_TROUBLESHOOTING.md` - Guia de troubleshooting
- `database/migrations/README.md` - Guia de migrações
- `APLICAR_MIGRACAO_URGENTE.md` - Guia rápido de aplicação

### Lembrete Final

🚨 **NUNCA assuma que criar um arquivo SQL é suficiente!**

Sempre:
1. Criar o arquivo SQL
2. Aplicar manualmente no Supabase SQL Editor
3. Verificar com health check
4. Documentar a mudança

Sem o passo 2, o banco de dados NÃO será atualizado e as campanhas NÃO vão sincronizar!

---

## 📝 Última Atualização: 2025-11-25

### Migração Criada: 05-force-schema-reload.sql

**Objetivo:** Forçar reload do cache do PostgREST para reconhecer coluna `client_id`

**Problema Resolvido:** Erro `PGRST204` ao tentar inserir logs de auditoria

**Arquivos Criados:**
- `database/migrations/05-force-schema-reload.sql` - Migração SQL
- `APLICAR_MIGRACAO_SCHEMA_RELOAD.md` - Guia de aplicação
- `scripts/diagnose-google-403.js` - Diagnóstico de erro 403
- `GOOGLE_ADS_PROBLEMAS_IDENTIFICADOS.md` - Resumo executivo

**Próxima Ação:** Aplicar migração no Supabase SQL Editor
