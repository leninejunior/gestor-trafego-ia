# Correção: Hierarquia Meta Mostrando R$ 0,00

## 📊 Problema Identificado

Na página de campanhas Meta Ads:
- ✅ Campanhas mostram métricas corretas (gasto, impressões, cliques)
- ❌ Conjuntos de anúncios mostram R$ 0,00 em todas as métricas
- ❌ Anúncios mostram R$ 0,00 em todas as métricas

## 🔍 Diagnóstico Realizado

### 1. Verificação do Banco de Dados

```bash
node scripts/check-meta-hierarchy-data.js
```

**Resultado:**
- ✅ 5 campanhas no banco
- ✅ 2 conjuntos de anúncios no banco
- ✅ 10 anúncios no banco
- ❌ 0 insights de campanhas
- ❌ 0 insights de adsets
- ❌ 0 insights de ads

### 2. Análise do Código

**APIs verificadas:**
- `src/app/api/meta/campaigns/route.ts` - ✅ Busca insights da Meta API
- `src/app/api/meta/adsets/route.ts` - ✅ Busca insights da Meta API
- `src/app/api/meta/ads/route.ts` - ✅ Busca insights da Meta API

**Componentes verificados:**
- `src/components/meta/campaigns-list.tsx` - ✅ Exibe insights corretamente
- `src/components/meta/adsets-list.tsx` - ✅ Exibe insights corretamente
- `src/components/meta/ads-list.tsx` - ✅ Exibe insights corretamente

## 🎯 Causa Raiz

A Meta API não está retornando insights para adsets e ads. Possíveis causas:

1. **Período sem dados**: Os adsets/ads não têm dados no período selecionado
2. **Status pausado**: Todos os adsets/ads estão pausados (confirmado no banco)
3. **Insights não disponíveis**: A Meta pode não ter processado os insights ainda
4. **Permissões do token**: O token pode não ter permissão para ler insights de adsets/ads

## 🔧 Soluções Propostas

### Solução 1: Verificar Período de Dados (Mais Provável)

Os adsets e ads estão todos **PAUSADOS**. Quando pausados, a Meta pode não retornar insights para períodos recentes.

**Teste:**
1. Abrir a página de campanhas
2. Mudar o filtro de data para um período mais amplo (ex: últimos 90 dias)
3. Verificar se os dados aparecem

**Implementação:**
```typescript
// Já implementado em:
// - src/components/meta/campaigns-list.tsx (linha 42)
// - src/components/meta/adsets-list.tsx (linha 35)
// - src/components/meta/ads-list.tsx (linha 35)

// O filtro de data já está sendo passado para as APIs
const dateRange = getDefaultDateRange(); // Últimos 30 dias
```

### Solução 2: Buscar Insights Históricos do Banco

Criar uma função que busca insights históricos salvos no banco quando a Meta API não retorna dados.

**Implementação:**

```typescript
// src/lib/meta/insights-fallback.ts
export async function getHistoricalInsights(
  supabase: any,
  entityId: string,
  entityType: 'campaign' | 'adset' | 'ad'
) {
  const table = `meta_${entityType}_insights`;
  
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(`${entityType}_id`, entityId)
    .order('date_stop', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return data[0];
}
```

### Solução 3: Sincronizar Insights Periodicamente

Criar um job que sincroniza insights da Meta API para o banco regularmente.

**Implementação:**

```typescript
// src/app/api/meta/sync-insights/route.ts
export async function POST(request: NextRequest) {
  // 1. Buscar todas as conexões ativas
  // 2. Para cada conexão, buscar campanhas
  // 3. Para cada campanha, buscar insights
  // 4. Salvar insights no banco
  // 5. Repetir para adsets e ads
}
```

### Solução 4: Mostrar Mensagem Explicativa

Quando não houver insights, mostrar mensagem explicativa ao invés de R$ 0,00.

**Implementação:**

```typescript
// src/components/meta/adsets-list.tsx (linha 180)
<TableCell className="text-right font-medium">
  {insights ? (
    formatCurrency(insights.spend, false)
  ) : (
    <span className="text-muted-foreground text-xs">
      Sem dados no período
    </span>
  )}
</TableCell>
```

## 🚀 Plano de Ação Recomendado

### Curto Prazo (Imediato)

1. **Testar com período maior**
   ```bash
   # Abrir página de campanhas
   # Mudar filtro para "Últimos 90 dias"
   # Verificar se dados aparecem
   ```

2. **Verificar logs da API**
   ```bash
   # Abrir DevTools > Console
   # Expandir campanha
   # Verificar logs de [ADSETS API]
   # Procurar por erros da Meta API
   ```

3. **Testar com campanha ativa**
   ```bash
   # Ativar uma campanha no Meta Ads Manager
   # Aguardar alguns minutos
   # Verificar se insights aparecem
   ```

### Médio Prazo (Esta Semana)

1. **Implementar fallback para insights históricos**
   - Criar função `getHistoricalInsights`
   - Modificar APIs para usar fallback
   - Testar com dados históricos

2. **Melhorar mensagens de erro**
   - Substituir "R$ 0,00" por "Sem dados no período"
   - Adicionar tooltip explicativo
   - Mostrar última data com dados

### Longo Prazo (Próximas Sprints)

1. **Implementar sincronização automática**
   - Criar job de sincronização
   - Configurar cron job no Vercel
   - Salvar insights no banco regularmente

2. **Implementar cache de insights**
   - Cachear insights por 1 hora
   - Reduzir chamadas à Meta API
   - Melhorar performance

## 📝 Scripts de Diagnóstico

### Verificar Dados no Banco

```bash
node scripts/check-meta-hierarchy-data.js
```

### Testar APIs Diretamente

```bash
# Iniciar servidor
npm run dev

# Em outro terminal
node scripts/diagnose-meta-hierarchy.js
```

### Verificar Logs da Meta API

```bash
# Abrir DevTools > Console
# Filtrar por "[ADSETS API]" ou "[ADS API]"
# Verificar resposta da Meta API
```

## 🔍 Informações Adicionais

### Status Atual dos Dados

- **Campanhas**: 5 no banco, 1 ativa, 4 pausadas
- **Adsets**: 2 no banco, ambos pausados
- **Ads**: 10 no banco, todos pausados
- **Insights**: Nenhum salvo no banco

### Conexão Meta

- **Client ID**: a3ab33da-739f-45c9-943f-b0a76cab9731 (BM Coan)
- **Ad Account ID**: act_3656912201189816
- **Connection ID**: 8cad7806-7dfe-40b9-a28e-64151ae823fc
- **Status**: Ativa

### Período de Dados Padrão

- **Últimos 30 dias**: Configurado em `getDefaultDateRange()`
- **Formato**: YYYY-MM-DD
- **Timezone**: UTC

## ✅ Próximos Passos

1. **Testar com período maior** (Imediato)
2. **Verificar logs da API** (Imediato)
3. **Ativar uma campanha para teste** (Hoje)
4. **Implementar mensagens explicativas** (Esta semana)
5. **Implementar fallback histórico** (Esta semana)
6. **Implementar sincronização automática** (Próxima sprint)

---

**Data**: 2025-12-12
**Status**: Diagnóstico completo, aguardando testes
**Prioridade**: Alta
