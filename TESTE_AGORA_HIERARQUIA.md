# 🚀 Teste Agora: Hierarquia Meta Ads

## ✅ CORREÇÕES APLICADAS

**Status:** Sistema pronto para teste!

### 1. ✅ Políticas RLS Aplicadas
- `meta_adsets` - 5 políticas (SELECT, INSERT, UPDATE, DELETE, service_role)
- `meta_ads` - 5 políticas (SELECT, INSERT, UPDATE, DELETE, service_role)
- `meta_adset_insights` - 3 políticas (SELECT, INSERT, service_role)
- `meta_ad_insights` - 3 políticas (SELECT, INSERT, service_role)

### 2. ✅ Filtro de Data Corrigido
- **Problema:** Insights não apareciam porque filtro excluía dados que começavam 1 dia antes
- **Solução:** Corrigida lógica para buscar insights que se sobrepõem ao período
- **Arquivos:** `/api/meta/adsets/route.ts` e `/api/meta/ads/route.ts`

### 3. ✅ Logs Detalhados Adicionados
- Console do navegador mostra dados recebidos
- Terminal do servidor mostra insights encontrados

**Agora você pode testar a hierarquia no frontend!**

---

## ⚡ Teste Rápido (5 minutos)

### Passo 1: Servidor Rodando ✅
O servidor já está rodando em `http://localhost:3000`

### Passo 2: Acesse a Interface
1. Abra o navegador
2. Acesse: `http://localhost:3000`
3. **Faça login** se necessário

### Passo 3: Abra o DevTools
1. Pressione **F12** (ou Ctrl+Shift+I)
2. Vá para a aba **Console**
3. Deixe aberto para ver os logs

### Passo 4: Navegue até Campanhas
1. Vá para a página de **Campanhas Meta Ads**
2. Selecione o cliente **BM Coan**
3. Observe os logs no console

### Passo 5: Expanda uma Campanha
1. Clique no botão **▶** (seta) ao lado da campanha:
   **"[EN] [CBO] [MSG] [WPP] WORKSHOP P.I.P_2025"**
2. Observe os logs no console
3. **VERIFIQUE:** Devem aparecer 2 conjuntos de anúncios

### Passo 6: Verificar Métricas dos AdSets ⭐ NOVO
1. Após expandir a campanha, veja os conjuntos de anúncios
2. **VERIFIQUE as métricas:**
   - ✅ Gasto: R$ 54,64 e R$ 56,70
   - ✅ Impressões: 3.287 e 3.834
   - ✅ Cliques: 63 e 58
3. **Se aparecer "Sem dados":**
   - Verifique o período selecionado (deve ser "Últimos 30 dias")
   - Veja os logs no console e terminal
   - Copie e cole aqui para diagnóstico

### Passo 6: Expanda um Conjunto
1. Se aparecerem conjuntos, clique no botão **▶** ao lado de um conjunto
2. Observe os logs no console
3. Veja se aparecem anúncios

---

## 📊 O Que Você Deve Ver

### ✅ Se Estiver Funcionando:

**No Console do Navegador**:
```
🔍 [CAMPAIGNS LIST] Iniciando busca de campanhas...
✅ [CAMPAIGNS LIST] Dados reais carregados

// Ao expandir campanha:
🔍 [ADSETS LIST] Buscando conjuntos para campanha: 120238169988720058
✅ [ADSETS LIST] Conjuntos carregados: 2

// Ao expandir conjunto:
🔍 [ADS LIST] Buscando anúncios para conjunto: 120238170401430058
✅ [ADS LIST] Anúncios carregados: 13
```

**Na Interface**:
- Lista de campanhas aparece
- Ao expandir, aparecem 2 conjuntos
- Ao expandir conjunto, aparecem 13 anúncios

### ❌ Se NÃO Estiver Funcionando:

**Possível Log 1** (Não autenticado):
```
⚠️ [CAMPAIGNS LIST] Usuário não autenticado
```
**Solução**: Faça login

**Possível Log 2** (Sem campanhas):
```
📭 [CAMPAIGNS LIST] Nenhuma campanha encontrada
```
**Solução**: Verifique se selecionou o cliente BM Coan

**Possível Log 3** (Sem conjuntos):
```
⚠️ [ADSETS LIST] 0 conjuntos encontrados
```
**Solução**: Verifique o filtro de data ou veja os logs detalhados

---

## 🔍 Logs Detalhados

### No Console do Navegador (F12):

Procure por:
- `[CAMPAIGNS LIST]` - Logs da lista de campanhas
- `[ADSETS LIST]` - Logs da lista de conjuntos
- `[ADS LIST]` - Logs da lista de anúncios

### No Console do Servidor (Terminal):

Procure por:
- `[CAMPAIGNS API]` - Logs da API de campanhas
- `[ADSETS API]` - Logs da API de conjuntos
- `[ADS API]` - Logs da API de anúncios

---

## 📋 Checklist Rápido

- [ ] Servidor rodando em `http://localhost:3000`
- [ ] Navegador aberto
- [ ] DevTools aberto (F12)
- [ ] Usuário logado
- [ ] Cliente BM Coan selecionado
- [ ] Console mostrando logs

---

## 🆘 Se Não Funcionar

### Copie e Cole Aqui:

1. **Logs do Console do Navegador**:
```
[Cole aqui os logs que aparecem no console]
```

2. **O que você vê na interface**:
```
[Descreva o que aparece: lista vazia, erro, etc.]
```

3. **Logs do Servidor** (se houver):
```
[Cole aqui os logs do terminal]
```

---

## 🎯 Dados Confirmados

Para referência, estes são os dados que **devem** aparecer:

### Cliente BM Coan:
- **Cliente ID**: `e3ab33da-79f9-45e9-a43f-6ce76ceb9731`
- **Conta**: `act_3656912201189816`

### Campanha de Teste:
- **Nome**: `[EN] [CBO] [MSG] [WPP] WORKSHOP P.I.P_2025 - 25/11/25`
- **ID**: `120238169988720058`
- **Conjuntos**: 2
- **Anúncios**: 13 (no primeiro conjunto)

### Conjuntos:
1. `CJ07b- [WPP] [BRASIL (10 ESTADOS )+ D. FEDERAL 80KM] [35+] [M/F] [ABERTO]`
   - ID: `120238170401430058`
   - Anúncios: 13

2. `CJ07b2- [WPP] [BRASIL (10 ESTADOS )+ D. FEDERAL 80KM] [35+] [M/F] [ABERTO]`
   - ID: `120238169988790058`
   - Anúncios: 0

---

## 🚀 Scripts de Teste (Opcional)

Se quiser confirmar que os dados estão no banco:

```bash
# Teste 1: Dados no banco
node scripts/test-meta-hierarchy-direct.js

# Teste 2: Meta API funcionando
node scripts/test-meta-api-direct.js

# Teste 3: Listar conexões
node scripts/list-meta-connections.js
```

Todos devem retornar sucesso ✅

---

## ✅ Resultado Esperado

Após seguir os passos acima, você deve:

1. ✅ Ver lista de campanhas
2. ✅ Expandir campanha e ver 2 conjuntos
3. ✅ Expandir conjunto e ver 13 anúncios
4. ✅ Ver criativos dos anúncios (imagens, textos)
5. ⚠️ Métricas podem estar zeradas (campanhas pausadas)

## ⚠️ Importante: Métricas Zeradas

Se você vê os anúncios mas as métricas mostram "Sem dados":

**Isso é NORMAL!** Significa que:
- As campanhas estão **pausadas** (não geram métricas novas)
- O **filtro de data** não inclui período com dados
- Os anúncios **existem**, apenas não têm métricas no período

**Solução**:
1. Ajuste o filtro de data para um período maior (ex: últimos 90 dias)
2. Ou clique em "Mostrar Todos" para ver todos os anúncios
3. Ou ative uma campanha para gerar métricas novas

---

**Tempo estimado**: 5 minutos  
**Dificuldade**: Fácil  
**Pré-requisito**: Servidor rodando e usuário logado

**Boa sorte! 🚀**
