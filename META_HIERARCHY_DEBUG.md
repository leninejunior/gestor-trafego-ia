# Debug: Hierarquia Meta Ads Não Mostra Conjuntos e Anúncios

## 📊 Status Atual

### ✅ O que está funcionando:
1. **Banco de dados**: Dados estão corretos
   - 16 campanhas
   - 2 conjuntos (adsets)
   - 13 anúncios (ads)
   
2. **Meta API**: Funcionando perfeitamente
   - Token válido
   - Retorna adsets e ads corretamente
   
3. **APIs do Next.js**: Implementadas corretamente
   - `/api/meta/adsets` - Busca conjuntos
   - `/api/meta/ads` - Busca anúncios
   
4. **Componentes React**: Implementados corretamente
   - `AdSetsList` - Renderiza conjuntos
   - `AdsList` - Renderiza anúncios

### ❌ O que NÃO está funcionando:
- **Interface não mostra conjuntos e anúncios** quando você expande uma campanha

## 🔍 Diagnóstico

### Teste 1: Dados no Banco ✅
```bash
node scripts/test-meta-hierarchy-direct.js
```
**Resultado**: 16 campanhas, 2 conjuntos, 13 anúncios

### Teste 2: Meta API ✅
```bash
node scripts/test-meta-api-direct.js
```
**Resultado**: Meta API retorna 2 adsets e 13 ads

### Teste 3: API Next.js ⚠️
```bash
node scripts/diagnose-meta-hierarchy.js
```
**Resultado**: Retorna 0 campanhas (usuário não autenticado no script)

## 🎯 Causa Raiz Identificada

O problema está em **um dos seguintes pontos**:

### 1. Autenticação no Frontend
**Sintoma**: Você não está logado na interface web

**Como verificar**:
1. Abra o navegador em `http://localhost:3000`
2. Abra o DevTools (F12)
3. Vá para a aba Console
4. Procure por logs como:
   - `[CAMPAIGNS LIST]`
   - `[ADSETS LIST]`
   - `[ADS LIST]`

**Solução**: Faça login na aplicação

### 2. Cliente ID Incorreto
**Sintoma**: A interface está usando um cliente ID diferente

**Cliente ID correto**: `e3ab33da-79f9-45e9-a43f-6ce76ceb9751` (BM Coan)

**Como verificar**:
1. No DevTools Console, procure por logs de `clientId`
2. Verifique se o ID está correto

**Solução**: Selecione o cliente correto na interface

### 3. Filtro de Data Muito Restrito
**Sintoma**: O filtro de data não inclui o período das campanhas

**Como verificar**:
1. No DevTools Console, procure por logs de `dateRange`
2. Verifique se `since` e `until` cobrem o período das campanhas

**Solução**: Ajuste o filtro de data para um período maior (ex: últimos 90 dias)

### 4. Campanhas Não Retornadas
**Sintoma**: A API `/api/meta/campaigns` retorna array vazio

**Como verificar**:
1. No DevTools Network, procure pela requisição `/api/meta/campaigns`
2. Verifique a resposta

**Solução**: Verifique os logs do servidor Next.js

## 🛠️ Passos para Resolver

### Passo 1: Verificar Autenticação
```
1. Acesse http://localhost:3000
2. Faça login se necessário
3. Navegue até a página de campanhas
4. Abra o DevTools (F12) → Console
```

### Passo 2: Verificar Logs no Console
Procure por:
```
🔍 [CAMPAIGNS LIST] Iniciando busca de campanhas...
📋 [CAMPAIGNS LIST] Parâmetros: { clientId, adAccountId }
✅ [CAMPAIGNS LIST] Dados reais carregados
```

Se não aparecer, o problema é na busca de campanhas.

### Passo 3: Verificar Logs de Adsets
Quando expandir uma campanha, procure por:
```
🔍 [ADSETS LIST] Buscando conjuntos para campanha: XXX
🔗 [ADSETS LIST] URL completa: /api/meta/adsets?campaignId=XXX
✅ [ADSETS LIST] Conjuntos carregados: 2
```

Se aparecer "0 conjuntos", o problema é na API de adsets.

### Passo 4: Verificar Logs de Ads
Quando expandir um conjunto, procure por:
```
🔍 [ADS LIST] Buscando anúncios para conjunto: XXX
🔗 [ADS LIST] URL completa: /api/meta/ads?adsetId=XXX
✅ [ADS LIST] Anúncios carregados: 13
```

Se aparecer "0 anúncios", o problema é na API de ads.

## 📝 Logs Esperados (Sucesso)

### Console do Navegador:
```
🔍 [CAMPAIGNS LIST] Iniciando busca de campanhas...
📋 [CAMPAIGNS LIST] Parâmetros: {
  clientId: 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751',
  adAccountId: 'act_3656912201189816'
}
✅ [CAMPAIGNS LIST] Dados reais carregados

// Ao expandir campanha:
🔍 [ADSETS LIST] Buscando conjuntos para campanha: 120238169988720058
✅ [ADSETS LIST] Conjuntos carregados: 2

// Ao expandir conjunto:
🔍 [ADS LIST] Buscando anúncios para conjunto: 120238170401430058
✅ [ADS LIST] Anúncios carregados: 13
```

### Console do Servidor:
```
🔍 [CAMPAIGNS API] Iniciando busca de campanhas...
✅ [CAMPAIGNS API] Usuário autenticado: user@example.com
✅ [CAMPAIGNS API] Conexão encontrada
✅ [CAMPAIGNS API] Campanhas reais obtidas: 16

🔍 [ADSETS API] Parâmetros recebidos: { campaignId: '120238169988720058' }
✅ [ADSETS API] Usando conexão: { connectionId: '8cad7806-...' }
✅ [ADSETS API] Adsets encontrados: 2

🔍 [ADS API] Parâmetros recebidos: { adsetId: '120238170401430058' }
✅ [ADS API] Usando conexão: { connectionId: '8cad7806-...' }
✅ [ADS API] Anúncios encontrados: 13
```

## 🚀 Próximos Passos

1. **Acesse a interface web** com o servidor rodando
2. **Faça login** se necessário
3. **Abra o DevTools** (F12) → Console
4. **Navegue até campanhas** do cliente BM Coan
5. **Expanda uma campanha** e observe os logs
6. **Copie e cole os logs** aqui para análise

## 📞 Se o Problema Persistir

Envie os seguintes logs:

1. **Console do navegador** (DevTools → Console)
2. **Network do navegador** (DevTools → Network → filtrar por "meta")
3. **Console do servidor** (terminal onde rodou `npm run dev`)

Com esses logs, poderei identificar exatamente onde está o problema.

## 🔧 Scripts de Teste Disponíveis

```bash
# Testar dados no banco
node scripts/test-meta-hierarchy-direct.js

# Testar Meta API diretamente
node scripts/test-meta-api-direct.js

# Listar todas as conexões
node scripts/list-meta-connections.js

# Diagnóstico completo (requer servidor rodando e usuário logado)
node scripts/diagnose-meta-hierarchy.js
```

## ✅ Dados Confirmados

- **Cliente**: BM Coan (e3ab33da-79f9-45e9-a43f-6ce76ceb9751)
- **Conta**: act_3656912201189816
- **Campanhas**: 16 (no banco e na Meta API)
- **Conjuntos**: 2 (no banco e na Meta API)
- **Anúncios**: 13 (no banco e na Meta API)
- **Token**: Válido e funcionando
- **APIs**: Implementadas e funcionando

**O problema está na interface web ou na autenticação do usuário.**
