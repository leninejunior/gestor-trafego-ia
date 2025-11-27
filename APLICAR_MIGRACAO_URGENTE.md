# 🚨 APLICAR MIGRAÇÃO URGENTE - Google Ads Schema

## ❌ Problema Identificado

As campanhas do Google Ads não estão sincronizando porque **a migração de schema NÃO foi aplicada no banco de dados**.

Erro atual:
```
column google_ads_encryption_keys.algorithm does not exist
```

## ✅ Solução: Aplicar Migração Manualmente

### Passo 1: Abrir Supabase SQL Editor

1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql
2. Faça login se necessário

### Passo 2: Copiar SQL da Migração

Abra o arquivo: `database/migrations/fix-google-ads-schema.sql`

Ou copie diretamente daqui (CTRL+A para selecionar tudo):

```sql
-- Cole o conteúdo completo do arquivo fix-google-ads-schema.sql aqui
```

### Passo 3: Executar no SQL Editor

1. Cole o SQL completo no editor
2. Clique no botão **"Run"** (ou pressione CTRL+Enter)
3. Aguarde a execução (pode levar 5-10 segundos)
4. Verifique se apareceu mensagens de sucesso

### Passo 4: Verificar Resultado

Execute este comando no SQL Editor para verificar:

```sql
-- Verificar colunas da tabela google_ads_encryption_keys
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'google_ads_encryption_keys'
ORDER BY ordinal_position;

-- Verificar colunas da tabela google_ads_audit_log
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'google_ads_audit_log'
ORDER BY ordinal_position;
```

**Resultado esperado:**

`google_ads_encryption_keys` deve ter:
- ✅ algorithm
- ✅ version
- ✅ key_hash

`google_ads_audit_log` deve ter:
- ✅ client_id
- ✅ connection_id
- ✅ operation
- ✅ metadata

### Passo 5: Testar Novamente

Depois de aplicar a migração, execute:

```bash
node scripts/test-google-health-check.js
```

**Resultado esperado:**
- ✅ Database: pass
- ✅ Encryption Keys: pass (não mais "column does not exist")
- ✅ Active Connections: pass
- ⚠️  Token Validation: warning (normal, tokens precisam refresh)
- ⚠️  API Quota: warning (normal)

## 🎯 Depois da Migração

Com o schema corrigido, você poderá:

1. **Testar OAuth flow:**
   ```bash
   node scripts/test-oauth-flow-e2e.js
   ```

2. **Testar sincronização:**
   ```bash
   node scripts/test-campaign-sync.js
   ```

3. **Verificar no dashboard:**
   - Acesse: http://localhost:3000/dashboard/google
   - Clique em "Sincronizar" em uma conexão
   - Verifique se as campanhas aparecem

## 📋 Checklist Rápido

- [ ] Abrir Supabase SQL Editor
- [ ] Copiar conteúdo de `database/migrations/fix-google-ads-schema.sql`
- [ ] Colar no SQL Editor
- [ ] Clicar em "Run"
- [ ] Verificar mensagens de sucesso
- [ ] Executar query de verificação
- [ ] Confirmar que colunas existem
- [ ] Executar `node scripts/test-google-health-check.js`
- [ ] Verificar que "Encryption Keys: pass"
- [ ] Testar sincronização de campanhas

## ⚠️ Se Encontrar Erros

### Erro: "relation already exists"
**Normal!** Significa que a tabela já existe. Continue a execução.

### Erro: "column already exists"
**Normal!** Significa que a coluna já foi criada. Continue a execução.

### Erro: "permission denied"
**Solução:** Certifique-se de estar logado como owner do projeto no Supabase.

### Erro: "syntax error"
**Solução:** Certifique-se de copiar o SQL completo, incluindo todas as linhas.

## 🆘 Precisa de Ajuda?

Se após aplicar a migração as campanhas ainda não sincronizarem:

1. Execute: `node scripts/test-connection-diagnostics.js`
2. Verifique os logs no console do navegador
3. Verifique os logs do Supabase
4. Me avise qual erro específico está aparecendo

---

**IMPORTANTE:** A migração é segura e idempotente (pode ser executada múltiplas vezes sem problemas).
