# 🧪 Teste Agora: Métricas dos AdSets

## 📋 Problema

Adsets aparecem mas métricas mostram "Sem dados".

## ✅ Correção Aplicada

Adicionei logs detalhados na API `/api/meta/adsets` para diagnosticar o problema.

## 🔧 Como Testar

### Passo 1: Reiniciar o Servidor

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
npm run dev
```

### Passo 2: Abrir Console do Navegador

1. Abra o dashboard no navegador
2. Pressione **F12** para abrir DevTools
3. Vá na aba **Console**
4. Limpe o console (ícone 🚫 ou Ctrl+L)

### Passo 3: Expandir Campanha

1. Na lista de campanhas, clique para expandir a campanha:
   **"[EN] [CBO] [MSG] [WPP] WORKSHOP P.I.P_2025 - 25/11/25"**

2. Observe os logs no console

### Passo 4: Verificar Logs

Você deve ver logs como:

```
🔍 [ADSETS LIST] Buscando conjuntos para campanha: 63e9c58f-474b-4a27-9634-3122f88ec20e
🔍 [ADSETS LIST] Parâmetros: { clientId: "...", adAccountId: "...", dateRange: {...} }
🔗 [ADSETS LIST] URL completa: /api/meta/adsets?campaignId=...&since=...&until=...
📊 [ADSETS LIST] Resposta completa: { status: 200, ok: true, adsetsCount: 2, ... }
✅ [ADSETS LIST] Conjuntos carregados: 2
🔍 [ADSETS LIST] Conjunto 1: { id: "...", hasInsights: true/false, spend: "...", ... }
```

### Passo 5: Verificar Logs do Servidor

No terminal onde o servidor está rodando, você deve ver:

```
🔍 [API ADSETS] Parâmetros recebidos: { campaignId: "...", since: "...", until: "..." }
✅ [API ADSETS] Usuário autenticado: ...
✅ [API ADSETS] Campanha encontrada: ...
✅ [API ADSETS] 2 adsets encontrados
🔍 [API ADSETS] Filtrando insights do adset ... por período: { since: "...", until: "..." }
✅ [API ADSETS] Adset ...: 1 insights encontrados
   Exemplo: { date_start: "...", spend: "...", impressions: "..." }
📤 [API ADSETS] Retornando adset 1: { hasInsights: true, spend: "54.64", ... }
```

## 🎯 O Que Procurar

### Cenário 1: Insights Não Encontrados

Se ver:
```
✅ [API ADSETS] Adset ...: 0 insights encontrados
```

**Causa**: Filtro de data está excluindo os insights.

**Solução**: Verificar se `since` e `until` estão corretos.

### Cenário 2: Insights Encontrados mas Não Retornados

Se ver:
```
✅ [API ADSETS] Adset ...: 1 insights encontrados
📤 [API ADSETS] Retornando adset 1: { hasInsights: false, ... }
```

**Causa**: Problema na agregação dos insights.

**Solução**: Verificar lógica de agregação na API.

### Cenário 3: Insights Retornados mas Não Exibidos

Se ver:
```
📤 [API ADSETS] Retornando adset 1: { hasInsights: true, spend: "54.64", ... }
🔍 [ADSETS LIST] Conjunto 1: { hasInsights: true, spend: "54.64", ... }
```

Mas ainda mostra "Sem dados" na tela.

**Causa**: Problema no componente React ao renderizar os dados.

**Solução**: Verificar lógica de formatação no componente.

## 📸 Informações Necessárias

Por favor, me envie:

1. **Screenshot dos logs do Console** (F12)
2. **Screenshot dos logs do Terminal** (servidor)
3. **Screenshot da tela** mostrando "Sem dados"
4. **Período selecionado** no dashboard (ex: "Últimos 30 dias")

## 🚀 Próximos Passos

Baseado nos logs, vou:

1. Identificar exatamente onde o problema está
2. Aplicar a correção específica
3. Testar novamente

## 💡 Dica Rápida

Se quiser testar sem filtro de data, você pode:

1. Comentar temporariamente o filtro de data no componente
2. Ou selecionar "Todos os períodos" no dashboard (se disponível)

Isso ajuda a isolar se o problema é o filtro de data ou outra coisa.

---

**Aguardando seus logs para continuar o diagnóstico!** 🔍
