# 🔒 Aplicar Políticas RLS - Hierarquia Meta

## ⚠️ PROBLEMA IDENTIFICADO

**Erro:** "Campanha não encontrada" ao tentar expandir adsets

**Causa:** As tabelas `meta_adsets` e `meta_ads` não têm políticas RLS configuradas, impedindo que usuários autenticados acessem os dados.

**Solução:** Aplicar políticas RLS que permitem acesso baseado em membership da organização.

---

## 📋 PASSO A PASSO

### 1. Abrir Supabase SQL Editor

Acesse: https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql

### 2. Verificar Políticas Atuais (Opcional)

Copie e execute o conteúdo de `database/check-meta-rls-policies.sql` para ver o estado atual.

### 3. Aplicar Migração RLS

Copie e execute o conteúdo de `database/migrations/add-meta-hierarchy-rls.sql`

**O que essa migração faz:**

✅ Habilita RLS nas tabelas:
- `meta_adsets`
- `meta_ads`
- `meta_adset_insights`
- `meta_ad_insights`

✅ Cria políticas para cada operação (SELECT, INSERT, UPDATE, DELETE)

✅ Garante isolamento por cliente via `connection_id` → `client_meta_connections` → `clients` → `memberships`

✅ Permite acesso total para `service_role` (scripts de sincronização)

### 4. Verificar Aplicação

Execute no SQL Editor:

```sql
SELECT 
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN ('meta_adsets', 'meta_ads', 'meta_adset_insights', 'meta_ad_insights')
ORDER BY tablename, policyname;
```

**Resultado esperado:** Deve mostrar 5 políticas para `meta_adsets` e `meta_ads`, e 3 políticas para as tabelas de insights.

### 5. Testar no Frontend

1. Acesse o dashboard
2. Vá para a página de campanhas Meta
3. Clique para expandir uma campanha
4. Deve mostrar os conjuntos de anúncios (adsets)
5. Clique para expandir um adset
6. Deve mostrar os anúncios (ads)

---

## 🔍 COMO FUNCIONA O RLS

### Fluxo de Autorização

```
Usuário autenticado (auth.uid())
    ↓
memberships (user_id = auth.uid())
    ↓
clients (org_id = memberships.organization_id)
    ↓
client_meta_connections (client_id = clients.id)
    ↓
meta_campaigns (connection_id = client_meta_connections.id)
    ↓
meta_adsets (connection_id = client_meta_connections.id)
    ↓
meta_ads (connection_id = client_meta_connections.id)
```

### Exemplo de Política SELECT

```sql
CREATE POLICY "meta_adsets_select"
  ON meta_adsets
  FOR SELECT
  TO authenticated
  USING (
    connection_id IN (
      SELECT cmc.id
      FROM client_meta_connections cmc
      JOIN clients c ON c.id = cmc.client_id
      JOIN memberships m ON m.organization_id = c.org_id
      WHERE m.user_id = auth.uid()
    )
  );
```

**Tradução:** "Usuários autenticados podem ver adsets apenas se o `connection_id` pertencer a uma conexão de um cliente cuja organização o usuário é membro."

---

## 🧪 TESTES

### Teste 1: Verificar Dados com Service Role

```bash
node scripts/check-meta-hierarchy-data.js
```

**Esperado:** Deve mostrar campanhas, adsets e ads.

### Teste 2: Testar API de AdSets

```bash
node scripts/test-adsets-api.js
```

**Esperado:** Deve buscar adsets com sucesso usando service role.

### Teste 3: Testar no Frontend

1. Login no dashboard
2. Navegar para campanhas Meta
3. Expandir campanha
4. Verificar se adsets aparecem
5. Expandir adset
6. Verificar se ads aparecem

---

## 🐛 TROUBLESHOOTING

### Erro: "permission denied for table meta_adsets"

**Causa:** RLS está habilitado mas políticas não foram criadas

**Solução:** Execute a migração `add-meta-hierarchy-rls.sql`

### Erro: "Campanha não encontrada"

**Causa:** Usuário não tem membership na organização do cliente

**Solução:** Verificar se o usuário está associado à organização:

```sql
SELECT 
  u.email,
  o.name as organization,
  c.name as client
FROM auth.users u
JOIN memberships m ON m.user_id = u.id
JOIN organizations o ON o.id = m.organization_id
JOIN clients c ON c.org_id = o.id
WHERE u.id = 'USER_ID_AQUI';
```

### Erro: "No rows returned"

**Causa:** Dados não foram sincronizados

**Solução:** Execute o script de sincronização:

```bash
node sync-meta-campaigns.js
```

---

## 📊 IMPACTO

### Antes da Migração

❌ Usuários não conseguem ver adsets/ads (RLS bloqueia)
❌ Frontend mostra "Campanha não encontrada"
❌ Hierarquia não funciona

### Depois da Migração

✅ Usuários veem apenas dados de seus clientes
✅ Frontend mostra hierarquia completa
✅ Isolamento de dados mantido
✅ Scripts de sincronização continuam funcionando

---

## 📝 CHECKLIST

- [ ] Abrir Supabase SQL Editor
- [ ] Executar `database/check-meta-rls-policies.sql` (opcional)
- [ ] Executar `database/migrations/add-meta-hierarchy-rls.sql`
- [ ] Verificar políticas criadas
- [ ] Testar `node scripts/check-meta-hierarchy-data.js`
- [ ] Testar `node scripts/test-adsets-api.js`
- [ ] Testar no frontend (expandir campanha → ver adsets → expandir adset → ver ads)
- [ ] Atualizar `CHANGELOG.md`

---

## 🎯 PRÓXIMOS PASSOS

Após aplicar esta migração:

1. ✅ Testar hierarquia completa no frontend
2. ✅ Verificar métricas de adsets e ads
3. ✅ Testar filtros de data
4. ✅ Documentar sucesso em `META_HIERARCHY_FIX_SUMMARY.md`

---

**Data:** 2025-12-12
**Autor:** Kiro AI
**Status:** Pronto para aplicar
