# Diagnóstico: Métricas dos AdSets Não Aparecem

## 🔍 Problema Identificado

No dashboard, quando você expande uma campanha Meta Ads, os conjuntos de anúncios (adsets) aparecem, mas as métricas mostram "Sem dados" mesmo tendo dados no banco.

## ✅ O Que Está Funcionando

1. **Banco de dados**: 2 adsets com insights reais
   - Adset 1: Gasto=R$ 54.64, Impressões=3287, Cliques=63
   - Adset 2: Gasto=R$ 56.70, Impressões=3834, Cliques=58

2. **API Backend**: Retorna dados corretamente quando autenticado
   - `/api/meta/adsets?campaignId=XXX` funciona
   - Insights são agregados corretamente

3. **Hierarquia**: Adsets aparecem quando expande campanha

## ❌ O Que Não Está Funcionando

As métricas aparecem como "Sem dados" no frontend, mesmo com dados no banco.

## 🔎 Possíveis Causas

### 1. Problema de Autenticação no Navegador
- A API requer autenticação
- Se o usuário não estiver autenticado, retorna 401
- **Verificar**: Console do navegador deve mostrar erro 401

### 2. Formato dos Dados
- API retorna `insights.spend` como string "54.64"
- Componente verifica `parseFloat(insights.spend || '0') > 0`
- Isso deveria funcionar, mas pode haver problema de parsing

### 3. Filtro de Data
- Se o `dateRange` não incluir as datas dos insights, não retorna dados
- Insights no banco: date_start e date_stop específicos
- **Verificar**: Qual período está selecionado no dashboard?

### 4. RLS Policies
- Políticas RLS podem estar bloqueando acesso aos insights
- **Status**: RLS foi aplicado recentemente
- **Verificar**: Logs da API devem mostrar se há erro de permissão

## 🧪 Como Diagnosticar

### Passo 1: Verificar Console do Navegador

Abra o Console (F12) e procure por:

```
🔍 [ADSETS LIST] Buscando conjuntos para campanha: XXX
📊 [ADSETS LIST] Resposta completa: { ... }
🔍 [ADSETS LIST] Conjunto 1: { ... }
```

**O que procurar:**
- Se aparecer erro 401: Problema de autenticação
- Se `hasInsights: false`: API não está retornando insights
- Se `hasInsights: true` mas `spend: undefined`: Problema no formato dos dados
- Se `spend: "54.64"`: Dados estão corretos, problema é no componente

### Passo 2: Verificar Período Selecionado

No dashboard, qual período está selecionado?
- "Últimos 7 dias"
- "Últimos 30 dias"
- "Últimos 90 dias"

Os insights no banco são de datas específicas. Se o período não incluir essas datas, não retorna dados.

### Passo 3: Testar API Diretamente

No Console do navegador, execute:

```javascript
fetch('/api/meta/adsets?campaignId=63e9c58f-474b-4a27-9634-3122f88ec20e')
  .then(r => r.json())
  .then(data => console.log('API Response:', data))
```

Isso mostra exatamente o que a API está retornando.

## 🔧 Soluções Possíveis

### Solução 1: Verificar Autenticação

Se erro 401, o usuário precisa fazer login novamente.

### Solução 2: Ajustar Período

Se os insights são de datas antigas, selecionar um período maior (ex: "Últimos 90 dias").

### Solução 3: Corrigir Formato dos Dados

Se `insights.spend` está undefined, verificar se a API está agregando corretamente:

```typescript
// Em src/app/api/meta/adsets/route.ts
console.log('Insights agregados:', aggregated);
```

### Solução 4: Verificar RLS

Se RLS está bloqueando, verificar políticas:

```sql
-- No Supabase SQL Editor
SELECT * FROM meta_adset_insights 
WHERE adset_id = 'c53c9140-0d48-4209-8c4d-47347c0cf35c';
```

Se retornar vazio, RLS está bloqueando. Aplicar fix:

```bash
node scripts/check-meta-rls.js
```

## 📋 Próximos Passos

1. **Abrir Console do navegador** e verificar logs
2. **Copiar e colar aqui** os logs que aparecem
3. **Verificar período selecionado** no dashboard
4. **Testar API diretamente** no console

Com essas informações, posso identificar exatamente onde está o problema e aplicar a correção.

## 🎯 Informações Necessárias

Por favor, me forneça:

1. **Logs do Console do navegador** quando expande a campanha
2. **Período selecionado** no dashboard (ex: "Últimos 30 dias")
3. **Resultado do teste da API** no console do navegador
4. **Screenshot** da tela mostrando "Sem dados"

Com essas informações, posso resolver o problema rapidamente!
