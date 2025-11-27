# Google Ads: Campanhas Não Aparecem - Diagnóstico e Solução

## 🔍 Problema Identificado

Após conectar a conta Google Ads, as campanhas não aparecem na interface.

## 📊 Diagnóstico Realizado

### 1. Conexões Google Ads
✅ **Status:** Conexão ativa encontrada
- Cliente: Dr Hérnia Andradina (ID: `19ec44b5-a2c8-4410-bbb2-433f049f45ef`)
- Customer ID: `9456920735`
- Status: `active`
- Tokens: Presentes e válidos

### 2. Campanhas Sincronizadas
❌ **Status:** Nenhuma campanha no banco de dados
- Total de campanhas: **0**
- Última sincronização: Nunca executada para a conexão ativa

### 3. Problemas Encontrados e Corrigidos

#### A. API metrics-simple usava `.single()` com múltiplas conexões
**Problema:** Query falhava quando havia mais de uma conexão
```typescript
// ❌ ANTES - Falhava com múltiplas conexões
.single()

// ✅ DEPOIS - Funciona com múltiplas conexões
.maybeSingle()
```

#### B. API buscava por `is_active` ao invés de `status`
**Problema:** Schema usa `status` ('active', 'expired', 'revoked')
```typescript
// ❌ ANTES
.eq('is_active', true)

// ✅ DEPOIS
.eq('status', 'active')
```

#### C. API não filtrava apenas conexões ativas
**Problema:** Buscava todas as conexões, incluindo expiradas
```typescript
// ✅ AGORA - Filtra apenas conexões ativas
.eq('status', 'active')
```

## ✅ Correções Aplicadas

### 1. src/app/api/google/metrics-simple/route.ts
- Alterado `.single()` para `.maybeSingle()`
- Alterado `.eq('is_active', true)` para `.eq('status', 'active')`
- Adicionado verificação de conexões inativas
- Melhorada mensagem de erro quando conexão está expirada

### 2. src/app/api/google/campaigns/route.ts
- Adicionado verificação de conexão ativa antes de buscar campanhas
- Alterado `.eq('is_active', true)` para `.eq('status', 'active')`
- Filtro automático para usar apenas conexão ativa

## 🎯 Solução para o Usuário

### Passo 1: Sincronizar Campanhas

O usuário precisa **clicar no botão "Sincronizar Agora"** na interface:

1. Acesse: `/dashboard/google`
2. Selecione o cliente "Dr Hérnia Andradina"
3. No card "Sincronização", clique em **"Sincronizar Agora"**
4. Aguarde a sincronização completar (pode levar alguns minutos)

### Passo 2: Verificar Campanhas

Após a sincronização:
1. As campanhas aparecerão automaticamente na lista
2. Os KPIs serão atualizados com dados reais
3. Métricas estarão disponíveis para visualização

## 🔄 Sincronização Automática

- **Frequência:** A cada 6 horas (automático)
- **Manual:** Disponível a qualquer momento via botão
- **Limite:** Máximo 3 sincronizações manuais a cada 5 minutos

## 📝 Arquivos Modificados

1. `src/app/api/google/metrics-simple/route.ts` - Corrigido query de conexões
2. `src/app/api/google/campaigns/route.ts` - Adicionado filtro de conexão ativa
3. `scripts/diagnose-campaigns-issue.js` - Script de diagnóstico criado
4. `scripts/reactivate-google-connection.js` - Script para reativar conexões

## 🧪 Scripts de Teste Disponíveis

```bash
# Diagnosticar problema de campanhas
node scripts/diagnose-campaigns-issue.js

# Reativar conexão (se necessário)
node scripts/reactivate-google-connection.js
```

## ⚠️ Notas Importantes

1. **Primeira Sincronização:** Sempre necessária após conectar conta
2. **Conexões Múltiplas:** Sistema agora lida corretamente com múltiplas conexões
3. **Status da Conexão:** Apenas conexões com `status = 'active'` são usadas
4. **Tokens Expirados:** Sistema detecta e solicita reconexão automaticamente

## 🎓 Lições Aprendidas

1. **Schema vs Código:** Sempre verificar schema real antes de assumir nomes de colunas
2. **Query Methods:** `.single()` falha com múltiplos resultados, usar `.maybeSingle()`
3. **Sincronização Manual:** Primeira sync sempre deve ser manual após conexão
4. **Logs Detalhados:** Logs do frontend ajudaram a identificar o problema rapidamente

## 📅 Data da Correção

**26 de Novembro de 2025**

---

## 🚀 Próximos Passos Recomendados

1. ✅ Usuário deve clicar em "Sincronizar Agora"
2. ⏳ Aguardar sincronização completar
3. ✅ Verificar se campanhas aparecem
4. 📊 Validar métricas e KPIs
5. 🔄 Configurar sincronização automática (já está ativa)

---

**Status:** ✅ Correções aplicadas, aguardando sincronização manual do usuário
