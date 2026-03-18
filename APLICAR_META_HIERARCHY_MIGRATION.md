# 🚨 APLICAR MIGRAÇÃO: Tabelas de Hierarquia Meta Ads

## Problema Identificado

As tabelas `meta_adsets` e `meta_ads` **NÃO EXISTEM** no banco de dados!

Por isso a hierarquia de campanhas não mostra conjuntos de anúncios e anúncios.

## Solução

Aplicar a migração `database/migrations/add-meta-hierarchy-tables.sql` no Supabase SQL Editor.

## Passo a Passo

### 1. Abrir Supabase SQL Editor

```
https://supabase.com/dashboard/project/doiogabdzybqxnyhktbv/sql
```

### 2. Copiar SQL da Migração

Abra o arquivo: `database/migrations/add-meta-hierarchy-tables.sql`

### 3. Colar e Executar

1. Cole todo o conteúdo no SQL Editor
2. Clique em **"Run"**
3. Aguarde a execução (deve levar ~5 segundos)

### 4. Verificar Sucesso

Você deve ver no final:

```
tabela       | total_colunas
-------------|---------------
meta_adsets  | 17
meta_ads     | 11
```

## O Que a Migração Cria

### Tabelas Principais

1. **meta_adsets** - Conjuntos de anúncios
   - Relaciona com `meta_campaigns` via `campaign_id`
   - Armazena orçamento, otimização, targeting

2. **meta_ads** - Anúncios individuais
   - Relaciona com `meta_adsets` via `adset_id`
   - Armazena creative, status

3. **meta_adset_insights** - Métricas de adsets
   - Impressões, cliques, gastos por período

4. **meta_ad_insights** - Métricas de ads
   - Impressões, cliques, gastos por período

### Segurança

- ✅ RLS habilitado em todas as tabelas
- ✅ Isolamento por cliente via `connection_id`
- ✅ Service role tem acesso total

### Performance

- ✅ Índices em todas as foreign keys
- ✅ Índices em external_id para buscas rápidas
- ✅ Índices em date ranges para insights

## Após Aplicar

### 1. Sincronizar Dados

```bash
node sync-meta-campaigns.js
```

Isso vai:
- ✅ Buscar campanhas da API Meta
- ✅ Buscar adsets de cada campanha
- ✅ Buscar ads de cada adset
- ✅ Salvar tudo no banco

### 2. Testar Hierarquia

```bash
node test-meta-real.js
```

Deve mostrar:
```
✅ 16 campanhas encontradas
   ✅ 2 conjuntos encontrados
      ✅ 13 anúncios encontrados
```

### 3. Verificar na Interface

1. Acesse: http://localhost:3000/dashboard/clients/e3ab33da-79f9-45e9-a43f-6ce76ceb9751
2. Clique em uma campanha para expandir
3. Deve mostrar os conjuntos de anúncios
4. Clique em um conjunto para ver os anúncios

## Troubleshooting

### Erro: "relation already exists"

Significa que as tabelas já existem. Tudo bem! Pule para o passo de sincronização.

### Erro: "permission denied"

Use o service_role key no Supabase (já está configurado).

### Erro: "function update_updated_at_column does not exist"

Execute primeiro o schema base:
```sql
-- database/meta-ads-schema.sql
```

## Documentação Atualizada

Após aplicar, atualize:

- ✅ `database.md` - Adicionar estrutura das novas tabelas
- ✅ `CHANGELOG.md` - Registrar migração aplicada
- ✅ `docs/META_INTEGRATION.md` - Atualizar fluxo de sincronização

---

**Data:** 2025-12-10  
**Autor:** Kiro AI  
**Status:** ⚠️ AGUARDANDO APLICAÇÃO MANUAL
