# Tradução de Objetivos e Status do Meta Ads

## Implementação Concluída

Criado sistema de tradução centralizado para objetivos e status de campanhas do Meta Ads.

## Arquivo Criado

### `src/lib/utils/meta-translations.ts`

Utilitário centralizado com:

**Objetivos traduzidos:**
- Objetivos legados (APP_INSTALLS, BRAND_AWARENESS, CONVERSIONS, etc.)
- Novos objetivos baseados em resultados (OUTCOME_ENGAGEMENT, OUTCOME_SALES, etc.)

**Status traduzidos:**
- ACTIVE → Ativa
- PAUSED → Pausada
- DELETED → Excluída
- ARCHIVED → Arquivada
- IN_PROCESS → Em Processamento
- WITH_ISSUES → Com Problemas

**Funções exportadas:**
- `translateMetaObjective(objective: string)` - Traduz objetivo
- `translateMetaStatus(status: string)` - Traduz status
- `getAllMetaObjectives()` - Retorna todos os objetivos disponíveis

## Componentes Atualizados

### 1. `src/components/meta/campaigns-list.tsx`
✅ Objetivos traduzidos na tabela de campanhas

### 2. `src/app/dashboard/clients/[clientId]/page.tsx`
✅ Objetivos traduzidos nos filtros
✅ Removido mapeamento duplicado (agora usa função centralizada)

### 3. `src/components/reports/campaign-selector.tsx`
✅ Objetivos e status traduzidos no seletor de campanhas
✅ Corrigido import do CalendarIcon
✅ Corrigido formato de data

### 4. `src/components/campaigns/campaign-search.tsx`
✅ Objetivos e status traduzidos na busca
✅ Busca funciona tanto em inglês quanto em português
✅ Status traduzidos nos badges

## Exemplos de Tradução

### Objetivos
```
OUTCOME_ENGAGEMENT → Engajamento
OUTCOME_SALES → Vendas
OUTCOME_TRAFFIC → Tráfego
LEAD_GENERATION → Geração de Leads
CONVERSIONS → Conversões
VIDEO_VIEWS → Visualizações de Vídeo
```

### Status
```
ACTIVE → Ativa
PAUSED → Pausada
ARCHIVED → Arquivada
```

## Benefícios

1. **Centralização**: Uma única fonte de verdade para traduções
2. **Manutenibilidade**: Fácil adicionar novos objetivos/status
3. **Consistência**: Mesma tradução em toda a aplicação
4. **Busca Inteligente**: Funciona em português e inglês
5. **Extensibilidade**: Fácil adicionar novos idiomas no futuro

## Uso

```typescript
import { translateMetaObjective, translateMetaStatus } from '@/lib/utils/meta-translations';

// Traduzir objetivo
const objetivoTraduzido = translateMetaObjective('OUTCOME_ENGAGEMENT');
// Resultado: "Engajamento"

// Traduzir status
const statusTraduzido = translateMetaStatus('ACTIVE');
// Resultado: "Ativa"

// Obter todos os objetivos
const todosObjetivos = getAllMetaObjectives();
// Resultado: [{ value: 'OUTCOME_ENGAGEMENT', label: 'Engajamento' }, ...]
```

## Testes

✅ Sem erros de TypeScript
✅ Todas as traduções aplicadas
✅ Busca funciona com termos em português
✅ Interface totalmente em português
