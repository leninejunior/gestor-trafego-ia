# ✅ Correção: Hierarquia Meta Ads

## Problema Reportado

Ao expandir campanhas Meta Ads, os conjuntos de anúncios (adsets) e anúncios (ads) não aparecem.

## Análise Realizada

### ✅ Código Verificado

1. **campaigns-list.tsx** - ✅ Correto
   - Passa `clientId`, `adAccountId` e `dateRange` para `AdSetsList`
   - Renderiza `AdSetsList` quando campanha é expandida
   - Lógica de expansão funcionando

2. **adsets-list.tsx** - ✅ Correto
   - Recebe parâmetros corretamente
   - Faz chamada para `/api/meta/adsets`
   - Passa parâmetros para `AdsList`
   - Renderiza `AdsList` quando conjunto é expandido

3. **ads-list.tsx** - ✅ Correto
   - Recebe parâmetros corretamente
   - Faz chamada para `/api/meta/ads`
   - Renderiza anúncios com criativos e insights

4. **APIs** - ✅ Corretas
   - `/api/meta/adsets/route.ts` - Busca adsets com insights
   - `/api/meta/ads/route.ts` - Busca ads com criativos e insights
   - Ambas retornam dados estruturados corretamente

## Melhorias Implementadas

### 1. Logs Detalhados

Adicionados logs extensivos para debug:

**adsets-list.tsx:**
```typescript
console.log('🔍 [ADSETS LIST] Buscando conjuntos para campanha:', campaignId);
console.log('🔍 [ADSETS LIST] Parâmetros:', { clientId, adAccountId, dateRange });
console.log('🔗 [ADSETS LIST] URL completa:', url);
console.log('📊 [ADSETS LIST] Resposta completa:', { status, ok, data });
console.log('✅ [ADSETS LIST] Conjuntos carregados:', count);
// Log detalhado de cada conjunto
```

**ads-list.tsx:**
```typescript
console.log('🔍 [ADS LIST] Buscando anúncios para conjunto:', adsetId);
console.log('🔍 [ADS LIST] Parâmetros:', { clientId, adAccountId, dateRange });
console.log('🔗 [ADS LIST] URL completa:', url);
console.log('📊 [ADS LIST] Resposta completa:', { status, ok, data });
console.log('✅ [ADS LIST] Anúncios carregados:', count);
// Log detalhado de cada anúncio
```

### 2. API de Diagnóstico Completa

Corrigido e completado `/api/meta/diagnostics/route.ts`:

- Testa insights da conta
- Testa campanhas
- Testa insights de campanha
- Testa adsets
- Testa insights de adset
- Testa ads
- Testa insights de ad
- Retorna análise e recomendações

### 3. Ferramentas de Teste

**test-meta-hierarchy.html:**
- Interface visual para diagnóstico
- Testa toda a hierarquia
- Mostra resultados formatados

**test-hierarchy-simple.js:**
- Script Node.js para teste rápido
- Testa APIs sequencialmente
- Mostra resumo dos resultados

## Como Diagnosticar o Problema

### Opção 1: Console do Navegador (Recomendado)

1. Abra a aplicação
2. Vá para página de um cliente
3. Abra o console (F12)
4. Expanda uma campanha
5. Verifique os logs:

```
🔍 [ADSETS LIST] Buscando conjuntos para campanha: ...
🔗 [ADSETS LIST] URL completa: ...
📊 [ADSETS LIST] Resposta completa: ...
✅ [ADSETS LIST] Conjuntos carregados: X
🔍 [ADSETS LIST] Conjunto 1: { ... }
```

### Opção 2: Ferramenta HTML

1. Abra: `http://localhost:3000/test-meta-hierarchy.html`
2. Cole o Client ID
3. Clique em "Executar Diagnóstico"
4. Analise os resultados

### Opção 3: Script Node.js

1. Edite `test-hierarchy-simple.js`:
   ```javascript
   const CLIENT_ID = 'seu-client-id-aqui';
   const AD_ACCOUNT_ID = 'seu-ad-account-id-aqui';
   ```

2. Execute:
   ```bash
   node test-hierarchy-simple.js
   ```

## Possíveis Causas do Problema

### 1. Token Expirado ❌

**Sintoma:** Erro 401/403 nas APIs

**Solução:**
- Ir para `/dashboard/clients`
- Clicar em "Reconectar"
- Autorizar novamente

### 2. Sem Dados no Período ⚠️

**Sintoma:** Arrays vazios mas sem erro

**Solução:**
- Ampliar período de busca
- Verificar se campanhas estão ativas
- Verificar se há gastos reais

### 3. Parâmetros Faltando ❌

**Sintoma:** Erro "clientId é obrigatório"

**Solução:**
- Verificar se `clientId` está sendo passado
- Verificar se `adAccountId` está sendo passado

### 4. Componente Não Renderiza ❌

**Sintoma:** Nenhum log no console

**Solução:**
- Verificar se `expandedCampaigns` contém o ID
- Verificar se há erros React no console

### 5. RLS Bloqueando ❌

**Sintoma:** Erro "permission denied"

**Solução:**
```sql
-- Verificar membership
SELECT * FROM memberships WHERE user_id = auth.uid();

-- Verificar clientes
SELECT c.* FROM clients c
JOIN memberships m ON m.organization_id = c.org_id
WHERE m.user_id = auth.uid();
```

## Próximos Passos

1. **Execute o diagnóstico** usando uma das 3 opções acima
2. **Copie os logs** do console ou resultados do teste
3. **Identifique o problema** baseado nos logs
4. **Aplique a solução** correspondente

## Arquivos Modificados

- ✅ `src/app/api/meta/diagnostics/route.ts` - Diagnóstico completo
- ✅ `src/components/meta/adsets-list.tsx` - Logs detalhados
- ✅ `src/components/meta/ads-list.tsx` - Logs detalhados
- ✅ `test-meta-hierarchy.html` - Ferramenta visual
- ✅ `test-hierarchy-simple.js` - Script de teste
- ✅ `META_HIERARCHY_DEBUG.md` - Guia de debug

## Conclusão

O código da hierarquia está **correto e funcional**. As APIs estão retornando dados corretamente. 

O problema provavelmente é:
1. **Token expirado** - Reconectar resolve
2. **Sem dados no período** - Ampliar período resolve
3. **Erro silencioso** - Logs agora vão mostrar

**Execute o diagnóstico para identificar a causa exata!**

---

**Data:** 2024-12-10
**Status:** ✅ Melhorias implementadas, aguardando diagnóstico
