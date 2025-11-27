# 🚨 APLICAR MIGRAÇÃO - Schema Reload Google Ads

## Problema Identificado

O erro nos logs indica que o Supabase não está reconhecendo a coluna `client_id` na tabela `google_ads_audit_log`:

```
[Audit Service] Error logging audit event: {
  code: 'PGRST204',
  message: "Could not find the 'client_id' column of 'google_ads_audit_log' in the schema cache"
}
```

## Causa

O cache do PostgREST (API do Supabase) está desatualizado e não reconhece a coluna `client_id`, mesmo que ela exista no banco de dados.

## Solução

### Passo 1: Aplicar Migração no Supabase SQL Editor

1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql

2. Copie e cole o conteúdo do arquivo:
   ```
   database/migrations/05-force-schema-reload.sql
   ```

3. Clique em **"Run"**

4. Verifique a saída:
   - Deve mostrar "Coluna client_id JÁ existe" ou "Coluna client_id criada com sucesso"
   - Deve listar todas as colunas da tabela
   - Deve listar as políticas RLS

### Passo 2: Verificar se Funcionou

Execute o health check:

```bash
node scripts/test-google-health-check.js
```

**Resultado esperado:**
- ✅ Não deve mais aparecer o erro `PGRST204`
- ✅ Os logs de auditoria devem ser salvos com sucesso

### Passo 3: Testar a API

Acesse no navegador:
```
http://localhost:3001/api/google/health
```

**Resultado esperado:**
- Status: `healthy` ou `unhealthy` (mas sem erros de schema)
- Não deve aparecer erros relacionados a `client_id`

## O Que Esta Migração Faz

1. **Verifica se a coluna existe** - Se não existir, cria
2. **Força reload do cache** - Envia notificação `NOTIFY pgrst, 'reload schema'`
3. **Mostra estrutura da tabela** - Para confirmar que tudo está correto
4. **Lista políticas RLS** - Para verificar segurança

## Outros Problemas Identificados

### Erro de Permissão Google Ads API

```
[GoogleAdsClient] API Error: {
  status: 403,
  message: 'The caller does not have permission',
  status: 'PERMISSION_DENIED'
}
```

**Possíveis causas:**

1. **Developer Token inválido ou não aprovado**
   - Verifique se `GOOGLE_DEVELOPER_TOKEN` está correto
   - Verifique se o token foi aprovado pelo Google

2. **Conta Google Ads sem permissões**
   - A conta `8938635478` pode não ter permissões adequadas
   - Verifique se o usuário OAuth tem acesso à conta

3. **Login Customer ID necessário**
   - Algumas contas precisam de `login-customer-id` no header
   - Pode ser necessário usar a conta MCC (gerenciadora)

### Como Resolver o Erro 403

1. **Verificar Developer Token:**
   ```bash
   # No .env, verifique:
   GOOGLE_DEVELOPER_TOKEN=xxx
   ```

2. **Verificar permissões da conta:**
   - Acesse: https://ads.google.com
   - Vá em Ferramentas > Acesso e segurança
   - Verifique se o usuário OAuth tem permissão de leitura

3. **Testar com Login Customer ID:**
   - Se a conta for gerenciada por uma MCC, adicione o ID da MCC
   - Modifique o código para incluir `login-customer-id` no header

## Checklist de Verificação

- [ ] Migração aplicada no Supabase SQL Editor
- [ ] Comando `NOTIFY pgrst, 'reload schema'` executado
- [ ] Health check não mostra mais erro `PGRST204`
- [ ] Logs de auditoria sendo salvos com sucesso
- [ ] Investigar erro 403 do Google Ads API (separadamente)

## Próximos Passos

1. ✅ Aplicar migração de schema reload
2. ⏳ Resolver erro 403 do Google Ads API
3. ⏳ Testar sincronização de campanhas
4. ⏳ Atualizar documentação

## Documentação Relacionada

- `database/migrations/05-force-schema-reload.sql` - Migração a ser aplicada
- `GOOGLE_ADS_SCHEMA_FIX.md` - Documentação completa do schema
- `docs/GOOGLE_ADS_TROUBLESHOOTING.md` - Guia de troubleshooting
- `.kiro/steering/google-ads-migrations.md` - Guia de migrações

---

**Data:** 2025-11-25  
**Status:** Aguardando aplicação da migração
