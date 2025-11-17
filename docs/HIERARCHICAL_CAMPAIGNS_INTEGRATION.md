# Integração da Visualização Hierárquica de Campanhas

## Status Atual

✅ **IMPLEMENTADO E FUNCIONANDO**

A visualização hierárquica de campanhas Meta Ads está totalmente implementada com:
- Expansão de campanhas para mostrar conjuntos de anúncios
- Expansão de conjuntos para mostrar anúncios individuais
- Botões de ligar/pausar em todos os níveis
- Visualização aprimorada de criativos com imagens maiores

## Componentes

### 1. CampaignsList (`src/components/meta/campaigns-list.tsx`)
- Lista todas as campanhas
- Botão de expandir/colapsar (seta) ao lado do nome
- Botões "Pausar/Ativar" e "Orçamento"
- Ao expandir, mostra AdSetsList

### 2. AdSetsList (`src/components/meta/adsets-list.tsx`)
- Lista conjuntos de anúncios de uma campanha
- Botão de expandir/colapsar (seta) ao lado do nome
- Botões "Pausar/Ativar" e "Orçamento"
- Ao expandir, mostra AdsList

### 3. AdsList (`src/components/meta/ads-list.tsx`)
- Lista anúncios de um conjunto
- Exibe criativos com imagens 128x128px
- Mostra título, corpo do texto e call-to-action
- Botões "Pausar/Ativar" e link para Meta Ads Manager
- Suporte para vídeos com indicador visual

## Como Usar

### Na Interface

1. **Ver Campanhas**: Acesse a página de campanhas Meta
2. **Expandir Campanha**: Clique na seta (▶) ao lado do nome da campanha
3. **Ver Conjuntos**: Os conjuntos de anúncios aparecem indentados abaixo
4. **Expandir Conjunto**: Clique na seta (▶) ao lado do nome do conjunto
5. **Ver Anúncios**: Os anúncios aparecem em cards com preview visual

### Botões Disponíveis

**Nível de Campanha:**
- ▶/▼ - Expandir/Colapsar conjuntos
- ⏸ Pausar / ▶ Ativar - Alterar status
- 💲 Orçamento - Editar orçamento

**Nível de Conjunto:**
- ▶/▼ - Expandir/Colapsar anúncios
- ⏸ Pausar / ▶ Ativar - Alterar status
- 💲 Orçamento - Editar orçamento

**Nível de Anúncio:**
- ⏸ Pausar / ▶ Ativar - Alterar status
- 🔗 - Abrir no Gerenciador de Anúncios do Meta

## Estrutura Visual

```
📊 Campanha 1                    [Ativa] [Pausar] [Orçamento]
  ▼
  📁 Conjunto 1.1                [Ativo] [Pausar] [Orçamento]
    ▼
    📄 Anúncio 1.1.1
       [Imagem 128x128]
       Título do anúncio
       Texto do anúncio...
       [CTA: Saiba Mais]
       [Pausar] [🔗]
    
    📄 Anúncio 1.1.2
       [Vídeo 128x128]
       Título do anúncio
       Texto do anúncio...
       [Pausar] [🔗]
  
  📁 Conjunto 1.2                [Pausado] [Ativar] [Orçamento]
    ▶ (clique para expandir)

📊 Campanha 2                    [Pausada] [Ativar] [Orçamento]
  ▶ (clique para expandir)
```

## APIs Utilizadas

### GET /api/meta/campaigns
- Parâmetros: `clientId`, `adAccountId`
- Retorna: Lista de campanhas

### GET /api/meta/adsets
- Parâmetros: `campaignId`, `clientId`, `adAccountId`
- Retorna: Lista de conjuntos de anúncios

### GET /api/meta/ads
- Parâmetros: `adsetId`, `clientId`, `adAccountId`
- Retorna: Lista de anúncios com criativos

### PATCH /api/campaigns/[id]/status
- Body: `{ status: 'ACTIVE' | 'PAUSED' }`
- Altera status da campanha

### PATCH /api/adsets/[id]/status
- Body: `{ status: 'ACTIVE' | 'PAUSED' }`
- Altera status do conjunto

### PATCH /api/meta/ads/[id]/status
- Body: `{ status: 'ACTIVE' | 'PAUSED' }`
- Altera status do anúncio

## Melhorias nos Criativos

### Extração Inteligente de Dados
A API agora extrai informações de múltiplas fontes:

1. **Campos Diretos**: `title`, `body`, `image_url`
2. **object_story_spec.link_data**: `message`, `name`, `picture`
3. **object_story_spec.photo_data**: `message`, `url`
4. **object_story_spec.video_data**: `message`, `image_url`

### Suporte a Diferentes Tipos de Mídia
- ✅ Imagens estáticas
- ✅ Vídeos com thumbnail
- ✅ Vídeos sem thumbnail (ícone de play)
- ✅ Carrosséis (primeira imagem)
- ✅ Anúncios sem mídia (placeholder)

### Fallbacks Inteligentes
- Se não houver preview: Link para Meta Ads Manager
- Se houver apenas imagem: Indica "Apenas imagem (sem texto)"
- Se for vídeo sem texto: Indica "Vídeo sem texto"

## Logs de Debug

Todos os componentes incluem logs detalhados no console:

```javascript
// Campanhas
console.log('🚀 [CAMPAIGNS LIST] Iniciando busca...')
console.log('✅ [CAMPAIGNS LIST] Dados carregados')

// Conjuntos
console.log('🔍 [ADSETS LIST] Buscando conjuntos...')
console.log('✅ [ADSETS LIST] Conjuntos carregados:', count)

// Anúncios
console.log('🔍 [ADS LIST] Buscando anúncios...')
console.log('✅ [ADS LIST] Anúncios carregados:', count)
console.log('🔍 [ADS LIST] Primeiro anúncio:', details)

// API
console.log('📊 [ADS API] Resposta da Meta:', data)
console.log('🔍 [ADS API] Criativo completo:', creative)
console.log('📝 [ADS API] Criativo processado:', processed)
```

## Solução de Problemas

### Conjuntos não aparecem ao expandir
1. Verifique o console do navegador para erros
2. Confirme que `clientId` e `adAccountId` estão sendo passados
3. Verifique se a conexão Meta está ativa

### Anúncios sem preview
1. Alguns anúncios podem não ter dados de criativo disponíveis
2. Use o link "Ver no Gerenciador de Anúncios" para visualizar no Meta
3. Verifique os logs da API para ver quais campos estão disponíveis

### Botões não funcionam
1. Recarregue a página (Ctrl+R ou F5)
2. Limpe o cache do navegador
3. Verifique o console para erros de JavaScript

## Próximos Passos Possíveis

- [ ] Adicionar métricas (impressões, cliques, gastos) em cada nível
- [ ] Filtros por status (ativo, pausado, etc.)
- [ ] Busca por nome de campanha/conjunto/anúncio
- [ ] Ações em lote (pausar múltiplos itens)
- [ ] Exportação de dados
- [ ] Gráficos de performance inline

## Notas Técnicas

- Usa React.Fragment para evitar warnings de keys
- Estado de expansão mantido em Set para performance
- Componentes independentes e reutilizáveis
- Suporte a dados externos (do dashboard) ou busca interna
- Callbacks opcionais para refresh externo
