# 🚨 GUIA URGENTE: Aplicar SQL no Supabase

## ❌ Problema Atual

As colunas NÃO existem no banco de dados:
- `google_ads_encryption_keys.algorithm` ❌
- `google_ads_encryption_keys.version` ❌
- `google_ads_encryption_keys.key_hash` ❌
- `google_ads_connections.is_active` ❌

## ✅ Solução em 3 Passos

### Passo 1: Abrir SQL Editor

Clique neste link:
```
https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql/new
```

Ou navegue manualmente:
1. Abra https://supabase.com/dashboard
2. Selecione o projeto `doiogabdzybqxnyhktbv`
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New Query**

### Passo 2: Copiar e Colar SQL

Copie EXATAMENTE este SQL (selecione tudo entre as linhas):

```sql
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS algorithm VARCHAR(50) DEFAULT 'aes-256-gcm';
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS key_hash TEXT;
ALTER TABLE google_ads_encryption_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE google_ads_campaigns ADD COLUMN IF NOT EXISTS budget_amount_micros BIGINT;
```

Cole no editor SQL do Supabase.

### Passo 3: Executar

1. Clique no botão **RUN** (ou pressione Ctrl+Enter)
2. Aguarde a mensagem de sucesso
3. Você deve ver algo como: "Success. No rows returned"

## 🔍 Verificar se Funcionou

Depois de executar, rode este comando no terminal:

```bash
node scripts/add-columns-via-api.js
```

Você deve ver:
```
✅ google_ads_encryption_keys.algorithm - existe
✅ google_ads_encryption_keys.version - existe
✅ google_ads_encryption_keys.key_hash - existe
✅ google_ads_connections.is_active - existe
```

## ❓ Troubleshooting

### "Não consigo acessar o SQL Editor"
- Verifique se está logado no Supabase
- Verifique se tem permissões de admin no projeto
- Tente fazer logout e login novamente

### "O SQL dá erro ao executar"
- Verifique se copiou TODO o SQL
- Verifique se não tem caracteres extras
- Tente executar uma linha por vez

### "Diz que executou mas as colunas não aparecem"
- Aguarde 30 segundos e tente novamente
- Limpe o cache do navegador (Ctrl+Shift+R)
- Tente em uma aba anônima

### "Ainda não funciona"
Me avise qual erro específico aparece no Supabase SQL Editor.

## 📝 Próximo Passo

Depois que as colunas forem adicionadas com sucesso, execute:

```bash
node scripts/test-google-health-check.js
```

Para verificar se o sistema está saudável.
