# Debug: Anúncios "sem texto" no Meta Ads

## Problema

Alguns anúncios aparecem como "Criativo sem preview disponível" ou "sem texto" mesmo tendo conteúdo no Gerenciador de Anúncios do Facebook.

## Causa

A Meta API nem sempre retorna todos os campos solicitados. Alguns criativos armazenam informações em estruturas aninhadas (`object_story_spec`) que precisam ser extraídas manualmente.

## Solução Implementada

### 1. Campos Expandidos na API

Arquivo: `src/app/api/meta/ads/route.ts`

```typescript
fields: 'id,name,status,creative{
  id,
  name,
  title,
  body,
  image_url,
  thumbnail_url,
  image_hash,
  video_id,
  object_story_spec,
  effective_object_story_id,
  asset_feed_spec,
  call_to_action_type
},created_time,updated_time,effective_status'
```

### 2. Extração de object_story_spec

A API agora processa `object_story_spec` para extrair:

**Imagem:**
```typescript
if (!ad.creative.image_url && ad.creative.object_story_spec) {
  // Tenta: link_data.picture, photo_data.url, video_data.image_url
}
```

**Texto (Body):**
```typescript
if (!ad.creative.body && ad.creative.object_story_spec) {
  // Tenta: link_data.message, photo_data.message, video_data.message
}
```

**Título:**
```typescript
if (!ad.creative.title && ad.creative.object_story_spec) {
  // Tenta: link_data.name, link_data.caption, link_data.description
}
```

### 3. Logs Detalhados

A API agora registra:
- Campos disponíveis no criativo
- Tentativas de extração de dados
- Sucesso/falha de cada extração
- Dados finais processados

## Como Verificar

### 1. Abra o Console do Navegador (F12)

### 2. Expanda um conjunto de anúncios

Você verá logs como:

```
🔍 [ADS LIST] Buscando anúncios para conjunto: 123456789
🔗 [ADS LIST] URL: /api/meta/ads?adsetId=123456789&clientId=...
📊 [ADS LIST] Resposta: { status: 200, data: {...} }
✅ [ADS LIST] Anúncios carregados: 5
🔍 [ADS LIST] Primeiro anúncio: {
  id: "...",
  name: "...",
  creative: {...},
  hasTitle: true,
  hasBody: true,
  title: "Título do anúncio",
  bodyPreview: "Texto do anúncio..."
}
```

### 3. Verifique os logs da API

No console do servidor (terminal onde roda `pnpm dev`):

```
📊 [ADS API] Resposta da Meta: {
  total: 5,
  sample: {
    id: "...",
    hasCreative: true,
    creativeFields: ["id", "name", "title", "body", "image_url", "object_story_spec"],
    creativeDataSample: {
      id: "...",
      hasTitle: true,
      hasBody: true,
      hasImageUrl: true,
      hasObjectStorySpec: true
    }
  }
}

🔍 [ADS API] Criativo completo (primeiro anúncio): {
  "id": "...",
  "title": "Título",
  "body": "Texto...",
  "image_url": "https://...",
  "object_story_spec": {
    "link_data": {
      "message": "Texto do anúncio",
      "name": "Título",
      "picture": "https://..."
    }
  }
}

🔍 [ADS API] Analisando criativo ...: {
  hasObjectStorySpec: true,
  objectStorySpec: {...},
  directTitle: "Título",
  directBody: "Texto",
  directImageUrl: "https://..."
}

✅ Body extraído de link_data.message: Texto do anúncio...
✅ Título extraído de link_data.name: Título do anúncio

📝 [ADS API] Criativo processado para ...: {
  hasImage: true,
  hasTitle: true,
  hasBody: true,
  hasVideoId: false,
  title: "Título do anúncio",
  bodyPreview: "Texto do anúncio..."
}
```

## Casos Especiais

### Anúncio com object_story_spec mas sem campos diretos

**Antes:**
```json
{
  "creative": {
    "id": "123",
    "title": null,
    "body": null,
    "image_url": null
  }
}
```

**Depois do processamento:**
```json
{
  "creative": {
    "id": "123",
    "title": "Extraído de link_data.name",
    "body": "Extraído de link_data.message",
    "image_url": "Extraído de link_data.picture"
  }
}
```

### Anúncio de vídeo

```json
{
  "creative": {
    "id": "123",
    "video_id": "456",
    "thumbnail_url": "https://...",
    "body": "Extraído de video_data.message"
  }
}
```

### Anúncio realmente sem dados

Se após todas as tentativas não houver dados:

```
⚠️ Nenhum body encontrado em object_story_spec
⚠️ Nenhum título encontrado em object_story_spec
```

Neste caso, o anúncio mostrará:
- "Criativo sem preview disponível"
- ID do criativo
- Link para visualizar no Gerenciador de Anúncios

## Estrutura do object_story_spec

### link_data (Anúncios de link)
```json
{
  "link_data": {
    "message": "Texto principal",
    "name": "Título do link",
    "caption": "Legenda",
    "description": "Descrição",
    "picture": "URL da imagem",
    "link": "URL de destino"
  }
}
```

### photo_data (Anúncios de foto)
```json
{
  "photo_data": {
    "message": "Texto da foto",
    "url": "URL da imagem"
  }
}
```

### video_data (Anúncios de vídeo)
```json
{
  "video_data": {
    "message": "Texto do vídeo",
    "image_url": "URL do thumbnail",
    "video_id": "ID do vídeo"
  }
}
```

## Limitações Conhecidas

1. **Permissões da API**: Alguns campos podem não estar disponíveis dependendo das permissões do token de acesso

2. **Anúncios dinâmicos**: Anúncios de catálogo/dinâmicos podem não ter preview disponível via API

3. **Anúncios antigos**: Anúncios muito antigos podem ter estruturas diferentes

4. **Restrições de conteúdo**: Alguns criativos podem ter restrições que impedem o acesso via API

## Solução Alternativa

Para anúncios sem preview, sempre há um link direto para o Gerenciador de Anúncios:

```
Ver no Gerenciador de Anúncios →
```

Este link abre o anúncio específico no Meta Ads Manager onde você pode ver todos os detalhes.

## Melhorias Futuras

- [ ] Suporte para anúncios de carrossel (múltiplas imagens)
- [ ] Suporte para anúncios de coleção
- [ ] Cache de criativos processados
- [ ] Retry automático para criativos sem dados
- [ ] Busca direta do criativo via API separada
