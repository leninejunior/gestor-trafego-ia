# 🚨 GUIA RÁPIDO: Aplicar Schema do Google Ads

## Problema Resolvido

O erro `relation "clients" does not exist` acontece porque o schema do Google Ads depende de tabelas base que não existem no banco.

## Solução em 2 Passos

### Passo 1: Criar Tabelas Base

1. Abra o Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql
   ```

2. Copie TODO o conteúdo de:
   ```
   database/migrations/00-complete-base-schema.sql
   ```

3. Cole no SQL Editor e clique em **RUN**

4. Aguarde a mensagem de sucesso

### Passo 2: Criar Tabelas Google Ads

1. No mesmo SQL Editor, limpe o conteúdo anterior

2. Copie TODO o conteúdo de:
   ```
   database/migrations/01-google-ads-complete-schema.sql
   ```

3. Cole no SQL Editor e clique em **RUN**

4. Aguarde a mensagem de sucesso

### Passo 3: Adicionar Colunas Faltantes

1. No mesmo SQL Editor, limpe o conteúdo anterior

2. Copie TODO o conteúdo de:
   ```
   database/migrations/02-add-missing-columns.sql
   ```

3. Cole no SQL Editor e clique em **RUN**

4. Aguarde a mensagem de sucesso e veja a lista de colunas

### Passo 4: Verificar

Execute o health check:

```bash
node scripts/test-google-health-check.js
```

Você deve ver:
```
✅ Todas as tabelas Google Ads existem
✅ Todas as colunas necessárias existem
✅ Todas as políticas RLS estão ativas
```

## O Que Foi Criado

### Tabelas Base (Passo 1)
- ✅ `organizations` - Organizações
- ✅ `memberships` - Associação usuário-organização
- ✅ `clients` - Clientes das organizações

### Tabelas Google Ads (Passo 2)
- ✅ `google_ads_encryption_keys` - Chaves de criptografia
- ✅ `google_ads_connections` - Conexões OAuth
- ✅ `google_ads_campaigns` - Campanhas sincronizadas
- ✅ `google_ads_metrics` - Métricas das campanhas
- ✅ `google_ads_sync_logs` - Logs de sincronização
- ✅ `google_ads_audit_log` - Auditoria de eventos

### Segurança
- ✅ RLS habilitado em todas as tabelas
- ✅ Isolamento por cliente via `client_id`
- ✅ Service role tem acesso total
- ✅ Usuários veem apenas dados de seus clientes

## Troubleshooting

### Erro: "function update_updated_at_column already exists"
**Solução:** Ignore, é normal. A função já existe e será reutilizada.

### Erro: "policy already exists"
**Solução:** Ignore, é normal. Os scripts usam `DROP POLICY IF EXISTS` para segurança.

### Erro: "relation already exists"
**Solução:** Ignore, é normal. Os scripts usam `CREATE TABLE IF NOT EXISTS`.

### Health check falha após aplicar
**Causa:** Pode ter pulado o Passo 1  
**Solução:** Execute o Passo 1 primeiro, depois o Passo 2

## Próximos Passos

Após aplicar com sucesso:

1. ✅ Testar OAuth flow do Google Ads
2. ✅ Testar sincronização de campanhas
3. ✅ Verificar criptografia de tokens
4. ✅ Atualizar CHANGELOG.md

## Arquivos Importantes

- `00-complete-base-schema.sql` - Schema base (organizations, clients)
- `01-google-ads-complete-schema.sql` - Schema Google Ads completo
- `scripts/test-google-health-check.js` - Verificação pós-migração
- `GOOGLE_ADS_SCHEMA_FIX.md` - Documentação completa

## Suporte

Se ainda tiver problemas:

1. Verifique se está usando o projeto correto no Supabase
2. Verifique se tem permissões de admin no projeto
3. Verifique os logs do Supabase SQL Editor
4. Execute o health check para diagnóstico detalhado
