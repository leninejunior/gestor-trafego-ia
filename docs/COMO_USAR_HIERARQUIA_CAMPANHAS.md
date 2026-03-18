# Como Usar a Visualização Hierárquica de Campanhas

## 🎯 Passo a Passo

### 1. Acesse a Página do Cliente
- Vá para **Dashboard → Clientes**
- Clique em um cliente que tenha conexão Meta Ads ativa

### 2. Visualize as Campanhas
- Role até a seção "Campanhas Meta Ads"
- Você verá uma tabela com todas as campanhas

### 3. Expandir Campanha para Ver Conjuntos de Anúncios
**IMPORTANTE:** Procure pela **seta (►)** ao lado do nome da campanha

```
┌─────────────────────────────────────────────────┐
│ Nome                    │ Status │ Objetivo     │
├─────────────────────────────────────────────────┤
│ ► Campanha de Vendas   │ Ativa  │ CONVERSIONS  │  ← CLIQUE AQUI NA SETA
└─────────────────────────────────────────────────┘
```

**Após clicar na seta:**
```
┌─────────────────────────────────────────────────┐
│ Nome                    │ Status │ Objetivo     │
├─────────────────────────────────────────────────┤
│ ▼ Campanha de Vendas   │ Ativa  │ CONVERSIONS  │  ← Seta agora aponta para baixo
│   └─ Conjuntos de Anúncios (Campanha de Vendas)│
│      ┌──────────────────────────────────────────┤
│      │ ► Conjunto 1  │ Ativo │ R$ 50,00        │  ← CLIQUE AQUI para ver anúncios
│      │ ► Conjunto 2  │ Pausado │ R$ 30,00      │
│      └──────────────────────────────────────────┘
└─────────────────────────────────────────────────┘
```

### 4. Expandir Conjunto para Ver Anúncios
Clique na **seta (►)** ao lado do nome do conjunto de anúncios:

```
┌─────────────────────────────────────────────────┐
│ ▼ Conjunto 1           │ Ativo │ R$ 50,00      │
│   └─ Anúncios (Conjunto 1)                     │
│      ┌──────────────────────────────────────────┤
│      │ Anúncio A  │ Ativo │ [Preview]          │
│      │ Anúncio B  │ Pausado │ [Preview]        │
│      └──────────────────────────────────────────┘
└─────────────────────────────────────────────────┘
```

## 🔍 Onde Está a Seta?

A seta de expansão fica **DENTRO da célula do nome**, antes do texto:

```
┌──────────────────────────────┐
│ [►] Nome da Campanha         │  ← A seta é um botão pequeno aqui
└──────────────────────────────┘
```

## ✨ Funcionalidades Disponíveis

### Em Cada Nível:

**Campanhas:**
- ✅ Expandir/Colapsar conjuntos
- ✅ Pausar/Ativar campanha
- ✅ Editar orçamento

**Conjuntos de Anúncios:**
- ✅ Expandir/Colapsar anúncios
- ✅ Pausar/Ativar conjunto
- ✅ Editar orçamento

**Anúncios:**
- ✅ Pausar/Ativar anúncio
- ✅ Ver preview do criativo (imagem + texto)
- ✅ Abrir no Facebook Ads Manager (ícone de link externo)

## 🎨 Indicadores Visuais

### Setas de Expansão:
- **►** (ChevronRight) = Item colapsado, clique para expandir
- **▼** (ChevronDown) = Item expandido, clique para colapsar

### Indentação:
- Conjuntos de anúncios: Indentados com borda esquerda cinza
- Anúncios: Duplamente indentados com borda esquerda cinza

### Badges de Status:
- 🟢 **Ativa/Ativo** = Verde (default)
- ⚪ **Pausada/Pausado** = Cinza (secondary)
- 🔴 **Excluída/Excluído** = Vermelho (destructive)
- ⚫ **Arquivada/Arquivado** = Outline

## 🐛 Troubleshooting

### Não vejo a seta de expansão?
1. Verifique se há campanhas na lista
2. A seta é um botão pequeno (6x6) dentro da célula do nome
3. Passe o mouse sobre o nome da campanha - a seta deve ficar visível

### Cliquei mas nada aconteceu?
1. Verifique o console do navegador (F12)
2. Pode haver erro na API de conjuntos/anúncios
3. Verifique se a conexão Meta está ativa

### Não vejo conjuntos de anúncios?
1. Verifique se a campanha tem conjuntos criados no Facebook
2. Aguarde alguns segundos - pode estar carregando
3. Veja se aparece "Carregando conjuntos..." ou "Nenhum conjunto encontrado"

### Não vejo anúncios?
1. Verifique se o conjunto tem anúncios criados no Facebook
2. Aguarde o carregamento
3. Veja se aparece "Carregando anúncios..." ou "Nenhum anúncio encontrado"

## 📊 Exemplo Completo

```
Campanhas Meta Ads
┌────────────────────────────────────────────────────────────┐
│ ▼ Black Friday 2024        │ Ativa │ CONVERSIONS │ R$ 500 │
│   └─ Conjuntos de Anúncios (Black Friday 2024)            │
│      ┌─────────────────────────────────────────────────────┤
│      │ ▼ Público Quente    │ Ativo │ R$ 200 │ CONVERSIONS │
│      │   └─ Anúncios (Público Quente)                     │
│      │      ┌──────────────────────────────────────────────┤
│      │      │ Anúncio Carrossel │ Ativo │ [🖼️ Preview]    │
│      │      │ Anúncio Vídeo     │ Pausado │ [🎥 Preview]  │
│      │      └──────────────────────────────────────────────┘
│      │                                                      │
│      │ ► Público Frio      │ Pausado │ R$ 150 │ REACH     │
│      │                                                      │
│      │ ► Retargeting       │ Ativo │ R$ 150 │ CONVERSIONS │
│      └─────────────────────────────────────────────────────┘
│                                                             │
│ ► Natal 2024               │ Pausada │ BRAND_AWARENESS     │
│                                                             │
│ ► Evergreen                │ Ativa │ LEAD_GENERATION       │
└────────────────────────────────────────────────────────────┘
```

## 💡 Dicas

1. **Performance**: Os dados só são carregados quando você expande (lazy loading)
2. **Múltiplas Expansões**: Você pode ter várias campanhas e conjuntos expandidos ao mesmo tempo
3. **Estado Persistente**: O estado de expansão é mantido enquanto você estiver na página
4. **Atualização**: Use o botão "Atualizar" no topo para recarregar todas as campanhas
5. **Preview de Criativos**: Os anúncios mostram miniatura da imagem quando disponível

## 🔄 Fluxo de Dados

```
1. Usuário clica na seta da campanha
   ↓
2. Sistema busca conjuntos de anúncios da Meta API
   ↓
3. Conjuntos são exibidos indentados
   ↓
4. Usuário clica na seta do conjunto
   ↓
5. Sistema busca anúncios da Meta API
   ↓
6. Anúncios são exibidos com preview do criativo
```

## 📝 Notas Importantes

- ⚠️ Certifique-se de que a conexão Meta está ativa
- ⚠️ Dados são sincronizados com o banco local para cache
- ⚠️ Mudanças de status são aplicadas imediatamente na Meta API
- ⚠️ Use o botão "Atualizar" se os dados parecerem desatualizados
