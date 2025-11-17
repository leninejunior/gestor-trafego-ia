# Melhorias na Exibição de Criativos de Anúncios

## Resumo das Alterações

Melhorias implementadas para exibir melhor os criativos dos anúncios do Meta Ads, incluindo suporte aprimorado para diferentes tipos de mídia e fallbacks inteligentes.

## Alterações Realizadas

### 1. API de Anúncios (`src/app/api/meta/ads/route.ts`)

#### Campos Expandidos
- Adicionados mais campos na requisição à Meta API:
  - `creative.name` - Nome do criativo
  - `creative.image_hash` - Hash da imagem
  - `creative.video_id` - ID do vídeo (se for anúncio de vídeo)
  - `creative.asset_feed_spec` - Especificações de feed de assets
  - `creative.call_to_action_type` - Tipo de call-to-action
  - `effective_status` - Status efetivo do anúncio

#### Extração Inteligente de Dados
Implementado processamento pós-busca para extrair informações de `object_story_spec` quando os campos diretos não estão disponíveis:

```typescript
// Extração de imagem
if (!ad.creative.image_url && ad.creative.object_story_spec) {
  // Tenta link_data.picture, photo_data.url, video_data.image_url
}

// Extração de texto
if (!ad.creative.body && ad.creative.object_story_spec) {
  // Tenta link_data.message, photo_data.message, video_data.message
}

// Extração de título
if (!ad.creative.title && ad.creative.object_story_spec) {
  // Tenta link_data.name, link_data.caption
}
```

#### Logs Aprimorados
- Logs detalhados para debug de criativos processados
- Informações sobre disponibilidade de imagem, título, corpo e vídeo

### 2. Componente AdsList (`src/components/meta/ads-list.tsx`)

#### Interface Expandida
```typescript
interface MetaAd {
  id: string;
  name: string;
  status: string;
  creative?: {
    id: string;
    name?: string;           // NOVO
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;  // NOVO
    video_id?: string;       // NOVO
    call_to_action_type?: string; // NOVO
  };
  created_time: string;
  effective_status?: string; // NOVO
}
```

#### Melhorias Visuais

**Preview de Mídia:**
- Imagens aumentadas de 80x80 para 96x96 pixels (w-24 h-24)
- Suporte para thumbnail_url como fallback
- Indicador visual de vídeo (ícone de play sobreposto)
- Preview dedicado para vídeos sem thumbnail
- Gradiente visual para anúncios de vídeo

**Exibição de Conteúdo:**
- Nome do criativo exibido quando disponível
- Título em destaque (font-medium)
- Corpo do texto com line-clamp-3
- Badge visual para call-to-action
- Link direto para o Gerenciador de Anúncios quando não há preview

**Estados de Fallback:**
- "Criativo sem preview disponível" com ID e link para Meta
- "Vídeo sem texto" para vídeos sem descrição
- "Apenas imagem (sem texto)" para imagens sem texto
- "Criativo não disponível" com link para Meta

## Casos de Uso Cobertos

### ✅ Anúncio com Imagem e Texto Completo
- Exibe imagem 96x96px
- Mostra título e corpo
- Exibe call-to-action se disponível

### ✅ Anúncio de Vídeo
- Mostra thumbnail com ícone de play
- Se não houver thumbnail, exibe ícone de vídeo estilizado
- Indica "Vídeo sem texto" se não houver descrição

### ✅ Anúncio Apenas com Imagem
- Exibe imagem
- Indica "Apenas imagem (sem texto)"

### ✅ Anúncio Sem Preview
- Mostra placeholder com ID do criativo
- Link direto para visualizar no Gerenciador de Anúncios do Meta

## Como Testar

1. Acesse a página de campanhas Meta
2. Expanda uma campanha para ver os conjuntos de anúncios
3. Expanda um conjunto de anúncios para ver os anúncios
4. Verifique:
   - Imagens são exibidas corretamente
   - Vídeos têm indicador visual
   - Textos são exibidos quando disponíveis
   - Links para Meta funcionam para anúncios sem preview

## Próximos Passos Possíveis

- [ ] Adicionar preview de carrossel (múltiplas imagens)
- [ ] Suporte para anúncios de coleção
- [ ] Preview de anúncios dinâmicos
- [ ] Cache de thumbnails de vídeo
- [ ] Lightbox para visualização ampliada de imagens

## Notas Técnicas

- A Meta API nem sempre retorna todos os campos solicitados
- Alguns criativos podem ter restrições de acesso
- O `object_story_spec` é a fonte mais confiável para dados de criativo
- Vídeos podem não ter thumbnail disponível imediatamente após criação
