# Componentes de Analytics

## ClickableFilters

Componente de filtros clicáveis (chips/badges) que substitui dropdowns tradicionais.

### Características

- **Filtro Inteligente**: Mostra apenas opções com dados no período selecionado
- **Multi-seleção**: Permite selecionar múltiplas opções (campanhas, conjuntos, etc.)
- **Single-seleção**: Modo de seleção única para navegação hierárquica
- **Visual Interativo**: Badges clicáveis com hover e animações
- **Remoção Fácil**: Botão X para remover seleções rapidamente

### Uso

```tsx
import { ClickableFilters } from "@/components/analytics/clickable-filters";

// Multi-seleção (campanhas)
<ClickableFilters
  options={campaigns.map(c => ({
    id: c.id,
    name: c.name,
    hasData: c.hasData // true se teve impressões > 0
  }))}
  selectedIds={selectedCampaigns}
  onSelectionChange={setSelectedCampaigns}
  multiSelect={true}
  emptyMessage="Nenhuma campanha com dados neste período"
/>

// Single-seleção (campanha única)
<ClickableFilters
  options={campaigns.map(c => ({
    id: c.id,
    name: c.name,
    hasData: c.hasData
  }))}
  selectedIds={selectedCampaign ? [selectedCampaign] : []}
  onSelectionChange={(ids) => setSelectedCampaign(ids[0] || '')}
  multiSelect={false}
/>
```

### Props

- `options`: Array de opções com `id`, `name` e `hasData`
- `selectedIds`: Array de IDs selecionados
- `onSelectionChange`: Callback quando seleção muda
- `multiSelect`: Permite múltiplas seleções (default: true)
- `emptyMessage`: Mensagem quando não há opções com dados
- `className`: Classes CSS adicionais

### Lógica de Filtragem

O componente filtra automaticamente opções onde `hasData === false`, mostrando apenas:
- Campanhas que tiveram impressões > 0 no período
- Conjuntos de anúncios ativos no período
- Anúncios que rodaram no período

### Integração com Analytics

Na página de Analytics (`src/app/dashboard/analytics/page.tsx`):

1. **Nível Campanha**: Multi-seleção de campanhas com dados
2. **Nível Conjunto**: Single-seleção de campanha → Multi-seleção de conjuntos
3. **Nível Anúncio**: Single-seleção de campanha → Single-seleção de conjunto

### Benefícios

- ✅ UX mais intuitiva que dropdowns
- ✅ Visualização rápida de todas as opções disponíveis
- ✅ Evita confusão com opções sem dados
- ✅ Feedback visual imediato da seleção
- ✅ Fácil remoção de seleções
