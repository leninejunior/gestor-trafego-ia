# 🔍 Google Ads - Problemas Identificados e Soluções

**Data:** 2025-11-25  
**Status:** Diagnóstico Completo

## 📊 Resumo Executivo

Identificamos **2 problemas principais** no sistema Google Ads:

1. ✅ **Problema de Schema** - Cache do Supabase desatualizado (SOLUÇÃO PRONTA)
2. ⚠️ **Erro 403 API** - Permissões do Google Ads (REQUER AÇÃO MANUAL)

---

## 🔴 Problema 1: Cache do Schema Desatualizado

### Sintoma
```
[Audit Service] Error logging audit event: {
  code: 'PGRST204',
  message: "Could not find the 'client_id' column of 'google_ads_audit_log' in the schema cache"
}
```

### Causa
O PostgREST (API do Supabase) não reconhece a coluna `client_id` porque o cache está desatualizado.

### Solução ✅ PRONTA

**Aplicar migração no Supabase SQL Editor:**

1. Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql

2. Copie e cole o conteúdo de:
   ```
   database/migrations/05-force-schema-reload.sql
   ```

3. Clique em **"Run"**

4. Verifique se aparece: "Coluna client_id JÁ existe"

**Arquivo criado:** `database/migrations/05-force-schema-reload.sql`  
**Guia detalhado:** `APLICAR_MIGRACAO_SCHEMA_RELOAD.md`

---

## 🔴 Problema 2: Erro 403 - Google Ads API

### Sintoma
```
[GoogleAdsClient] API Error: {
  status: 403,
  message: 'The caller does not have permission',
  status: 'PERMISSION_DENIED'
}
```

### Diagnóstico Realizado

✅ **Variáveis de ambiente:** Todas configuradas corretamente  
✅ **Developer Token:** Formato válido (22 caracteres)  
✅ **Customer ID:** Formato correto (10 dígitos)  
✅ **Conectividade OAuth:** Funcionando

### Possíveis Causas (em ordem de probabilidade)

#### 1. Developer Token não aprovado (MAIS PROVÁVEL)
- **Problema:** Token precisa ser aprovado pelo Google
- **Como verificar:** https://ads.google.com/aw/apicenter
- **Status esperado:** "Aprovado" (não "Pendente" ou "Rejeitado")

#### 2. Usuário OAuth sem permissões
- **Problema:** Email OAuth não tem acesso à conta
- **Como verificar:** https://ads.google.com → Ferramentas → Acesso e segurança
- **Permissão necessária:** "Padrão" ou "Admin"

#### 3. Login Customer ID necessário
- **Problema:** Conta gerenciada por MCC precisa do ID da gerenciadora
- **Solução:** Adicionar header `login-customer-id` nas requisições

#### 4. Conta suspensa ou desativada
- **Problema:** Conta Google Ads pode estar suspensa
- **Como verificar:** https://ads.google.com (verificar avisos)

### Ações Recomendadas (PRIORIDADE ALTA)

1. **Verificar Developer Token:**
   - Acesse: https://ads.google.com/aw/apicenter
   - Verifique status do token
   - Se pendente, solicite aprovação
   - Se rejeitado, crie novo token

2. **Verificar permissões do usuário:**
   - Acesse: https://ads.google.com
   - Vá em: Ferramentas → Acesso e segurança
   - Confirme que o email OAuth tem permissão adequada

3. **Testar com Login Customer ID:**
   - Identifique se a conta é gerenciada por MCC
   - Se sim, adicione o ID da MCC no header

**Script de diagnóstico criado:** `scripts/diagnose-google-403.js`

---

## 📋 Checklist de Resolução

### Problema 1: Schema Cache
- [ ] Aplicar migração `05-force-schema-reload.sql` no Supabase
- [ ] Executar `node scripts/test-google-health-check.js`
- [ ] Confirmar que erro `PGRST204` não aparece mais
- [ ] Verificar que logs de auditoria são salvos com sucesso

### Problema 2: Erro 403 API
- [ ] Verificar status do Developer Token no Google Ads API Center
- [ ] Verificar permissões do usuário OAuth na conta Google Ads
- [ ] Testar se conta é gerenciada por MCC
- [ ] Se necessário, adicionar `login-customer-id` no código
- [ ] Reconectar conta OAuth se necessário
- [ ] Executar `node scripts/test-google-health-check.js` novamente

---

## 🛠️ Scripts Criados

1. **`database/migrations/05-force-schema-reload.sql`**
   - Força reload do cache do Supabase
   - Verifica estrutura da tabela
   - Lista políticas RLS

2. **`scripts/diagnose-google-403.js`**
   - Diagnóstico completo do erro 403
   - Verifica variáveis de ambiente
   - Testa conectividade OAuth
   - Lista possíveis causas e soluções

3. **`APLICAR_MIGRACAO_SCHEMA_RELOAD.md`**
   - Guia passo a passo para aplicar migração
   - Instruções de verificação
   - Troubleshooting

---

## 📚 Documentação Relacionada

- `APLICAR_MIGRACAO_SCHEMA_RELOAD.md` - Guia de aplicação da migração
- `GOOGLE_ADS_SCHEMA_FIX.md` - Documentação completa do schema
- `docs/GOOGLE_ADS_TROUBLESHOOTING.md` - Guia de troubleshooting
- `.kiro/steering/google-ads-migrations.md` - Guia de migrações
- `.kiro/steering/database.md` - Estrutura do banco de dados

---

## 🎯 Próximos Passos

### Imediato (Hoje)
1. Aplicar migração de schema no Supabase
2. Verificar status do Developer Token
3. Verificar permissões do usuário OAuth

### Curto Prazo (Esta Semana)
1. Resolver erro 403 seguindo recomendações
2. Testar sincronização de campanhas
3. Atualizar documentação com resultados

### Médio Prazo (Próximas Semanas)
1. Implementar monitoramento de erros 403
2. Adicionar suporte para Login Customer ID
3. Criar testes automatizados para permissões

---

## 💡 Observações Importantes

1. **Schema vs API:** São problemas independentes
   - Schema: Problema interno do Supabase (fácil de resolver)
   - API 403: Problema de permissões no Google (requer ação manual)

2. **Developer Token:** É o mais provável culpado do erro 403
   - Tokens de teste têm limitações
   - Tokens não aprovados não funcionam em produção

3. **Logs de Auditoria:** Continuarão falhando até aplicar migração
   - Não afeta funcionalidade principal
   - Mas é importante para compliance e segurança

---

**Criado por:** Kiro AI  
**Última atualização:** 2025-11-25 14:10 BRT
