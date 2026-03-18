# 🔍 Troubleshooting: Hierarquia Meta Ads

## 🆕 ATUALIZAÇÃO: 2025-12-12

### ✅ Status Confirmado:
- **Banco de dados**: 16 campanhas, 2 conjuntos, 13 anúncios ✅
- **Meta API**: Funcionando perfeitamente ✅
- **APIs Next.js**: Implementadas corretamente ✅
- **Componentes React**: Implementados corretamente ✅

### ❌ Problema:
**A interface não mostra conjuntos e anúncios quando você expande uma campanha**

### 🎯 Causas Possíveis:
1. **Usuário não está autenticado** na interface web
2. **Cliente ID incorreto** sendo usado
3. **Filtro de data muito restrito**
4. **API de campanhas retornando vazio**

---

## 🛠️ Como Resolver

### Passo 1: Verificar no Navegador
1. Acesse `http://localhost:3000`
2. Faça login se necessário
3. Abra DevTools (F12) → Console
4. Navegue até campanhas do cliente **BM Coan**
5. Expanda uma campanha
6. Observe os logs no console

### Passo 2: Logs Esperados
Se estiver funcionando, você verá:
```
🔍 [ADSETS LIST] Buscando conjuntos para campanha: XXX
✅ [ADSETS LIST] Conjuntos carregados: 2
```

Se não aparecer, copie os logs e analise.

### Passo 3: Scripts de Teste
```bash
# Confirmar dados no banco
node scripts/test-meta-hierarchy-direct.js

# Confirmar Meta API funcionando
node scripts/test-meta-api-direct.js

# Listar conexões disponíveis
node scripts/list-meta-connections.js
```

---

## 📊 Dados Confirmados

- **Cliente**: BM Coan
- **Cliente ID**: `e3ab33da-79f9-45e9-a43f-6ce76ceb9751`
- **Conta**: `act_3656912201189816`
- **Campanhas**: 16 ✅
- **Conjuntos**: 2 ✅
- **Anúncios**: 13 ✅
- **Token**: Válido ✅

---

## 🔍 Diagnóstico Detalhado

### Verificar Console do Navegador

Abra o console (F12) e procure por:

```
🔍 [CAMPAIGNS LIST] Iniciando busca de campanhas...
📋 [CAMPAIGNS LIST] Parâmetros: { clientId, adAccountId }
✅ [CAMPAIGNS LIST] Dados reais carregados

// Ao expandir campanha:
🔍 [ADSETS LIST] Buscando conjuntos para campanha: XXX
✅ [ADSETS LIST] Conjuntos carregados: 2

// Ao expandir conjunto:
🔍 [ADS LIST] Buscando anúncios para conjunto: XXX
✅ [ADS LIST] Anúncios carregados: 13
```

### Verificar Network do Navegador

1. Abra DevTools → Network
2. Filtre por "meta"
3. Expanda uma campanha
4. Verifique as requisições:
   - `/api/meta/adsets?campaignId=XXX`
   - `/api/meta/ads?adsetId=XXX`

### Verificar Console do Servidor

No terminal onde rodou `npm run dev`, procure por:

```
🔍 [ADSETS API] Parâmetros recebidos: { campaignId: 'XXX' }
✅ [ADSETS API] Usando conexão: { connectionId: 'XXX' }
✅ [ADSETS API] Adsets encontrados: 2
```

---

## 🚨 Problemas Comuns

### 1. "Nenhum conjunto de anúncios encontrado"

**Causa**: API não está retornando dados

**Solução**:
1. Verifique se está logado
2. Verifique o cliente ID correto
3. Verifique os logs do servidor

### 2. "Conexão Meta Ads não encontrada"

**Causa**: Cliente ID incorreto ou conexão inativa

**Solução**:
```bash
# Listar conexões disponíveis
node scripts/list-meta-connections.js

# Usar o cliente ID correto: e3ab33da-79f9-45e9-a43f-6ce76ceb9751
```

### 3. "Sem dados no período selecionado"

**Causa**: Filtro de data muito restrito

**Solução**:
1. Ajuste o filtro de data para um período maior (ex: últimos 90 dias)
2. Ou clique em "Mostrar Todos" para ver todos os conjuntos/anúncios

### 4. Componente não expande

**Causa**: Estado de expansão não está funcionando

**Solução**:
1. Verifique se o botão de expandir está visível
2. Verifique os logs no console ao clicar
3. Verifique se `expandedCampaigns` está sendo atualizado

---

## 📝 Checklist de Verificação

- [ ] Servidor Next.js está rodando (`npm run dev`)
- [ ] Usuário está autenticado na interface
- [ ] Cliente correto está selecionado (BM Coan)
- [ ] DevTools está aberto (F12)
- [ ] Console mostra logs de `[ADSETS LIST]` ao expandir
- [ ] Network mostra requisições para `/api/meta/adsets`
- [ ] Servidor mostra logs de `[ADSETS API]`

---

## 🆘 Se o Problema Persistir

Envie os seguintes logs:

1. **Console do navegador** (DevTools → Console)
2. **Network do navegador** (DevTools → Network → filtrar por "meta")
3. **Console do servidor** (terminal onde rodou `npm run dev`)

Com esses logs, será possível identificar exatamente onde está o problema.

---

## 📚 Documentação Relacionada

- `META_HIERARCHY_DEBUG.md` - Diagnóstico completo e detalhado
- `META_HIERARCHY_FIX_SUMMARY.md` - Resumo das correções aplicadas
- `APLICAR_META_HIERARCHY_MIGRATION.md` - Guia de migração do schema

---

## ✅ Testes Automatizados

```bash
# Teste 1: Dados no banco
node scripts/test-meta-hierarchy-direct.js
# Esperado: 16 campanhas, 2 conjuntos, 13 anúncios

# Teste 2: Meta API
node scripts/test-meta-api-direct.js
# Esperado: 2 adsets, 13 ads

# Teste 3: Listar conexões
node scripts/list-meta-connections.js
# Esperado: Conexão BM Coan ativa
```

---

**Última atualização**: 2025-12-12  
**Status**: Dados confirmados no banco e na Meta API ✅  
**Próximo passo**: Verificar interface web com usuário autenticado
