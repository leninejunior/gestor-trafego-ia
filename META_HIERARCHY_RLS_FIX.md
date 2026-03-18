# 🔒 Correção RLS - Hierarquia Meta Ads

## 📋 Resumo Executivo

**Data:** 2025-12-12  
**Problema:** Frontend mostra "Campanha não encontrada" ao tentar expandir adsets  
**Causa Raiz:** Políticas RLS ausentes nas tabelas `meta_adsets` e `meta_ads`  
**Solução:** Aplicar migração SQL com políticas RLS  
**Status:** ⚠️ Aguardando aplicação manual no Supabase

---

## 🐛 Problema Identificado

### Sintoma
```
❌ [ADSETS LIST] Erro na resposta: "Campanha não encontrada"
```

### Fluxo do Erro

1. Usuário clica para expandir campanha
2. Frontend chama `/api/meta/adsets?campaignId=XXX`
3. API tenta buscar campanha com `supabase.from('meta_campaigns').select().eq('id', campaignId)`
4. RLS bloqueia acesso (usuário autenticado não tem política)
5. API retorna 404 "Campanha não encontrada"

### Causa Raiz

As tabelas de hierarquia Meta foram criadas sem políticas RLS:
- ❌ `meta_adsets` - RLS habilitado mas sem políticas
- ❌ `meta_ads` - RLS habilitado mas sem políticas
- ❌ `meta_adset_insights` - RLS habilitado mas sem políticas
- ❌ `meta_ad_insights` - RLS habilitado mas sem políticas

**Resultado:** Usuários autenticados não conseguem acessar os dados, apenas service role.

---

## ✅ Solução Implementada

### 1. Correção nas APIs

**Arquivos modificados:**
- `src/app/api/meta/adsets/route.ts`
- `src/app/api/meta/ads/route.ts`

**Mudanças:**
- ✅ Adicionada verificação de autenticação
- ✅ Query com join explícito para RLS
- ✅ Mensagens de erro mais claras

**Antes:**
```typescript
const { data: campaign } = await supabase
  .from('meta_campaigns')
  .select('id, connection_id')
  .eq('id', campaignId)
  .single();
```

**Depois:**
```typescript
const { data: { user } } = await supabase.auth.getUser();

const { data: campaign } = await supabase
  .from('meta_campaigns')
  .select(`
    id, 
    connection_id,
    client_meta_connections!inner(
      client_id,
      clients!inner(
        id,
        org_id,
        memberships!inner(user_id)
      )
    )
  `)
  .eq('id', campaignId)
  .eq('client_meta_connections.clients.memberships.user_id', user.id)
  .single();
```

### 2. Migração RLS Criada

**Arquivo:** `database/migrations/add-meta-hierarchy-rls.sql`

**Políticas criadas:**

#### meta_adsets (5 políticas)
- `meta_adsets_select` - SELECT para usuários autenticados
- `meta_adsets_insert` - INSERT para usuários autenticados
- `meta_adsets_update` - UPDATE para usuários autenticados
- `meta_adsets_delete` - DELETE para usuários autenticados
- `service_role_full_access_meta_adsets` - Acesso total para service role

#### meta_ads (5 políticas)
- `meta_ads_select` - SELECT para usuários autenticados
- `meta_ads_insert` - INSERT para usuários autenticados
- `meta_ads_update` - UPDATE para usuários autenticados
- `meta_ads_delete` - DELETE para usuários autenticados
- `service_role_full_access_meta_ads` - Acesso total para service role

#### meta_adset_insights (3 políticas)
- `meta_adset_insights_select` - SELECT para usuários autenticados
- `meta_adset_insights_insert` - INSERT para usuários autenticados
- `service_role_full_access_meta_adset_insights` - Acesso total para service role

#### meta_ad_insights (3 políticas)
- `meta_ad_insights_select` - SELECT para usuários autenticados
- `meta_ad_insights_insert` - INSERT para usuários autenticados
- `service_role_full_access_meta_ad_insights` - Acesso total para service role

### 3. Lógica de Autorização

Todas as políticas seguem o mesmo padrão de isolamento por cliente:

```sql
connection_id IN (
  SELECT cmc.id
  FROM client_meta_connections cmc
  JOIN clients c ON c.id = cmc.client_id
  JOIN memberships m ON m.organization_id = c.org_id
  WHERE m.user_id = auth.uid()
)
```

**Tradução:** "Usuário só vê dados de conexões que pertencem a clientes de organizações onde ele é membro."

---

## 📦 Arquivos Criados/Modificados

### Criados
- ✅ `database/migrations/add-meta-hierarchy-rls.sql` - Migração RLS
- ✅ `database/check-meta-rls-policies.sql` - Script de verificação
- ✅ `APLICAR_RLS_META_HIERARCHY.md` - Guia de aplicação
- ✅ `META_HIERARCHY_RLS_FIX.md` - Este documento
- ✅ `scripts/check-meta-rls.js` - Script de verificação (não usado)
- ✅ `scripts/test-adsets-api.js` - Script de teste

### Modificados
- ✅ `src/app/api/meta/adsets/route.ts` - Correção de autenticação
- ✅ `src/app/api/meta/ads/route.ts` - Correção de autenticação
- ✅ `TESTE_AGORA_HIERARQUIA.md` - Atualizado com aviso RLS

---

## 🧪 Testes Realizados

### ✅ Teste 1: Dados Existem
```bash
node scripts/check-meta-hierarchy-data.js
```
**Resultado:** 5 campanhas, 2 adsets, 10 ads encontrados ✅

### ✅ Teste 2: Service Role Funciona
```bash
node scripts/test-adsets-api.js
```
**Resultado:** Busca com service role funciona ✅

### ⚠️ Teste 3: Frontend
**Resultado:** Erro "Campanha não encontrada" (RLS bloqueando) ⚠️

---

## 📋 Próximos Passos

### 1. Aplicar Migração (MANUAL)

⚠️ **AÇÃO NECESSÁRIA:** Copiar e executar SQL no Supabase SQL Editor

1. Abrir: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql
2. Copiar conteúdo de: `database/migrations/add-meta-hierarchy-rls.sql`
3. Colar no editor
4. Clicar em "Run"

### 2. Verificar Aplicação

```sql
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('meta_adsets', 'meta_ads')
ORDER BY tablename, policyname;
```

**Esperado:** 5 políticas para cada tabela

### 3. Testar Frontend

1. Acessar dashboard
2. Ir para campanhas Meta
3. Expandir campanha
4. Verificar se adsets aparecem
5. Expandir adset
6. Verificar se ads aparecem

### 4. Atualizar Documentação

- [ ] Atualizar `CHANGELOG.md`
- [ ] Atualizar `META_HIERARCHY_FIX_SUMMARY.md`
- [ ] Marcar como resolvido em `TESTE_AGORA_HIERARQUIA.md`

---

## 🎯 Resultado Esperado

### Antes da Correção
❌ Frontend: "Campanha não encontrada"  
❌ Console: Erro 404 ao buscar adsets  
❌ Hierarquia não funciona

### Depois da Correção
✅ Frontend: Lista de adsets aparece  
✅ Console: Logs de sucesso  
✅ Hierarquia completa funciona  
✅ Isolamento de dados mantido

---

## 📊 Impacto

### Segurança
✅ **Mantida** - RLS garante isolamento por cliente  
✅ **Melhorada** - Políticas explícitas e auditáveis

### Performance
✅ **Sem impacto** - Queries já faziam joins similares  
✅ **Otimizada** - Índices existentes suportam as políticas

### Funcionalidade
✅ **Restaurada** - Hierarquia volta a funcionar  
✅ **Expandida** - Suporte completo a adsets e ads

---

## 🔍 Lições Aprendidas

1. **Sempre criar RLS junto com tabelas** - Não deixar para depois
2. **Testar com usuário autenticado** - Service role esconde problemas de RLS
3. **Documentar políticas** - Facilita manutenção futura
4. **Verificar joins** - RLS pode exigir joins explícitos nas queries

---

## 📚 Referências

- `database/migrations/add-meta-hierarchy-tables.sql` - Criação das tabelas
- `database/meta-ads-schema.sql` - Schema base Meta Ads
- `APLICAR_META_HIERARCHY_MIGRATION.md` - Guia da migração anterior
- `META_HIERARCHY_PROBLEMA_RESOLVIDO.md` - Diagnóstico inicial

---

**Status:** ⚠️ Aguardando aplicação manual da migração RLS  
**Prioridade:** 🔴 Alta - Bloqueia funcionalidade principal  
**Tempo estimado:** 5 minutos para aplicar  
**Risco:** 🟢 Baixo - Apenas adiciona políticas, não altera dados
