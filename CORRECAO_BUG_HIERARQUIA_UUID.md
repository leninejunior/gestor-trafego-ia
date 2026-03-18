# Correção: Bug de UUID vs External ID na Hierarquia Meta Ads

**Data:** 2025-12-12  
**Status:** ✅ Corrigido e Testado

## 🐛 Problema Identificado

As APIs de adsets e ads estavam usando o parâmetro recebido (`campaignId` ou `adsetId`) diretamente nas queries, mas esses parâmetros podem ser tanto UUIDs internos quanto external_ids do Meta.

### Erro Observado

```
❌ [ADSETS LIST] Erro na resposta: "Campanha não encontrada ou sem permissão"
```

### Causa Raiz

Após buscar a campanha/adset e validar permissões, as APIs estavam usando o parâmetro original ao invés do UUID interno retornado pela busca:

**Antes (ERRADO):**
```typescript
// API Adsets - linha 67
const { data: campaign } = await supabase
  .from('meta_campaigns')
  .select('id, connection_id, external_id')
  .eq('external_id', campaignId)  // Busca por external_id
  .single();

// Mas depois usava campaignId (external_id) ao invés de campaign.id (UUID)
const { data: adsets } = await supabase
  .from('meta_adsets')
  .select('*')
  .eq('campaign_id', campaignId)  // ❌ ERRADO - external_id não é FK válido!
```

## ✅ Solução Implementada

Usar sempre o UUID interno retornado pela busca inicial:

**Depois (CORRETO):**
```typescript
// API Adsets - linha 67
const { data: campaign } = await supabase
  .from('meta_campaigns')
  .select('id, connection_id, external_id')
  .eq('external_id', campaignId)
  .single();

// Usar campaign.id (UUID interno)
const { data: adsets } = await supabase
  .from('meta_adsets')
  .select('*')
  .eq('campaign_id', campaign.id)  // ✅ CORRETO - UUID é FK válido!
```

## 📝 Arquivos Corrigidos

### 1. `src/app/api/meta/adsets/route.ts` (linha 67)

**Antes:**
```typescript
.eq('campaign_id', campaignId)
```

**Depois:**
```typescript
.eq('campaign_id', campaign.id)
```

### 2. `src/app/api/meta/ads/route.ts` (linha 73)

**Antes:**
```typescript
.eq('adset_id', adsetId)
```

**Depois:**
```typescript
.eq('adset_id', adset.id)
```

## 🧪 Validação

Script de teste criado: `scripts/test-hierarchy-fix.js`

### Resultados do Teste

```
✅ 2 adsets encontrados com campaign.id (UUID interno)
❌ 0 adsets encontrados com campaign.external_id (erro de sintaxe UUID)

✅ 13 ads encontrados com adset.id (UUID interno)
❌ 0 ads encontrados com adset.external_id (erro de sintaxe UUID)
```

### Erro ao Usar External ID

```
{
  code: '22P02',
  message: 'invalid input syntax for type uuid: "120238169988720058"'
}
```

Isso confirma que external_id não pode ser usado como foreign key.

## 📊 Impacto

### Antes da Correção
- ❌ Hierarquia não carregava adsets
- ❌ Hierarquia não carregava ads
- ❌ Erro "Campanha não encontrada ou sem permissão"

### Depois da Correção
- ✅ Adsets carregam corretamente
- ✅ Ads carregam corretamente
- ✅ Hierarquia completa funcional

## 🔍 Lições Aprendidas

1. **Foreign Keys são UUIDs internos**, não external_ids do Meta
2. **Sempre usar o resultado da busca inicial** ao fazer queries relacionadas
3. **Validar permissões primeiro**, depois usar o UUID retornado
4. **External IDs são apenas para referência**, não para relacionamentos

## 📚 Documentação Relacionada

- `META_HIERARCHY_PROBLEMA_RESOLVIDO.md` - Diagnóstico completo anterior
- `APLICAR_META_HIERARCHY_MIGRATION.md` - Migração das tabelas
- `database.md` - Estrutura do banco de dados

## ✅ Checklist de Verificação

- [x] Bug identificado e documentado
- [x] Correção implementada em ambas as APIs
- [x] Script de teste criado e executado
- [x] Validação com dados reais bem-sucedida
- [x] Documentação atualizada
- [x] CHANGELOG.md atualizado

---

**Próximos Passos:**
1. Testar no navegador com usuário real
2. Verificar se métricas aparecem corretamente
3. Validar filtros de data funcionando
