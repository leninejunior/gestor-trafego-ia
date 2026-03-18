# Visualização Hierárquica de Campanhas Meta Ads

## Visão Geral

Implementação de uma visualização hierárquica completa das campanhas Meta Ads, similar ao Gerenciador de Anúncios do Facebook, permitindo expandir campanhas para ver conjuntos de anúncios e depois expandir conjuntos para ver anúncios individuais.

## Estrutura Hierárquica

```
📊 Campanha
  ├── 📁 Conjunto de Anúncios 1
  │   ├── 📄 Anúncio 1
  │   ├── 📄 Anúncio 2
  │   └── 📄 Anúncio 3
  ├── 📁 Conjunto de Anúncios 2
  │   ├── 📄 Anúncio 4
  │   └── 📄 Anúncio 5
  └── 📁 Conjunto de Anúncios 3
      └── 📄 Anúncio 6
```

## Componentes Criados

### 1. AdsList Component (`src/components/meta/ads-list.tsx`)
- Lista anúncios de um conjunto específico
- Exibe informações do criativo (imagem, título, corpo)
- Permite pausar/ativar anúncios
- Link direto para o Gerenciador de Anúncios do Facebook

**Funcionalidades:**
- ✅ Visualização de anúncios por conjunto
- ✅ Badge de status (Ativo, Pausado, etc.)
- ✅ Controle de status (Play/Pause)
- ✅ Preview do criativo com imagem
- ✅ Link externo para o Facebook Ads Manager

### 2. AdSetsList Component (Atualizado)
- Agora suporta expansão de conjuntos de anúncios
- Exibe lista de anúncios quando expandido
- Mantém funcionalidades existentes de edição de orçamento

**Melhorias:**
- ✅ Botão de expansão/colapso por conjunto
- ✅ Carregamento automático de anúncios ao expandir
- ✅ Indentação visual para hierarquia
- ✅ Estado de expansão independente por conjunto

### 3. CampaignsList Component (Já existente)
- Mantém funcionalidade de expansão de campanhas
- Carrega conjuntos de anúncios ao expandir

## APIs Criadas

### 1. GET `/api/meta/ads`
Busca anúncios de um conjunto específico.

**Query Parameters:**
- `adsetId` (obrigatório): ID do conjunto de anúncios

**Resposta:**
```json
{
  "success": true,
  "ads": [
    {
      "id": "123456789",
      "name": "Anúncio de Teste",
      "status": "ACTIVE",
      "creative": {
        "id": "987654321",
        "title": "Título do Anúncio",
        "body": "Descrição do anúncio",
        "image_url": "https://..."
      },
      "created_time": "2024-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Funcionalidades:**
- ✅ Busca anúncios da Meta API
- ✅ Sincroniza com banco de dados local
- ✅ Inclui informações do criativo
- ✅ Validação de conexão ativa

### 2. PATCH `/api/meta/ads/[adId]/status`
Atualiza o status de um anúncio específico.

**Body:**
```json
{
  "status": "ACTIVE" | "PAUSED"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Anúncio ativado com sucesso"
}
```

**Funcionalidades:**
- ✅ Atualiza status na Meta API
- ✅ Sincroniza com banco de dados local
- ✅ Validação de status
- ✅ Tratamento de erros da Meta API

## Fluxo de Uso

1. **Visualizar Campanhas**
   - Usuário acessa a lista de campanhas
   - Vê todas as campanhas do cliente/conta

2. **Expandir Campanha**
   - Clica no ícone de seta ao lado do nome da campanha
   - Sistema carrega e exibe conjuntos de anúncios

3. **Expandir Conjunto de Anúncios**
   - Clica no ícone de seta ao lado do nome do conjunto
   - Sistema carrega e exibe anúncios do conjunto

4. **Gerenciar Anúncios**
   - Pausar/Ativar anúncios individualmente
   - Visualizar preview do criativo
   - Abrir no Facebook Ads Manager

## Estilo Visual

### Hierarquia Visual
- Campanhas: Nível principal
- Conjuntos: Indentação de 32px (ml-8) com borda esquerda
- Anúncios: Indentação adicional de 32px com borda esquerda

### Ícones de Expansão
- `ChevronRight`: Item colapsado
- `ChevronDown`: Item expandido

### Badges de Status
- **Ativo**: Badge verde (default)
- **Pausado**: Badge cinza (secondary)
- **Excluído**: Badge vermelho (destructive)
- **Arquivado**: Badge outline

## Integração com Meta API

### Campos Buscados

**Campanhas:**
```
id, name, status, objective, daily_budget, lifetime_budget, created_time
```

**Conjuntos de Anúncios:**
```
id, name, status, daily_budget, lifetime_budget, optimization_goal, billing_event, created_time
```

**Anúncios:**
```
id, name, status, creative{id,title,body,image_url,thumbnail_url}, created_time
```

## Sincronização com Banco de Dados

Todas as APIs sincronizam dados com as tabelas locais:
- `meta_campaigns`
- `meta_adsets`
- `meta_ads`

Isso permite:
- ✅ Cache local de dados
- ✅ Histórico de mudanças
- ✅ Queries mais rápidas
- ✅ Funcionamento offline parcial

## Tratamento de Erros

### Erros Comuns
1. **Conexão não encontrada**: Retorna erro 404
2. **Conexão inativa**: Retorna erro 400
3. **Erro da Meta API**: Retorna detalhes do erro
4. **Parâmetros inválidos**: Retorna erro 400

### Mensagens ao Usuário
- Toast de sucesso ao atualizar status
- Toast de erro com mensagem descritiva
- Loading states durante operações

## Próximos Passos Sugeridos

1. **Métricas em Tempo Real**
   - Adicionar impressões, cliques, gastos por nível
   - Gráficos de performance inline

2. **Edição em Massa**
   - Selecionar múltiplos itens
   - Pausar/ativar em lote
   - Editar orçamentos em massa

3. **Filtros e Busca**
   - Filtrar por status
   - Buscar por nome
   - Ordenar por métricas

4. **Criação de Anúncios**
   - Interface para criar novos anúncios
   - Upload de criativos
   - Preview antes de publicar

5. **Histórico de Mudanças**
   - Log de alterações de status
   - Histórico de orçamentos
   - Auditoria de ações

## Considerações de Performance

- Carregamento lazy: Dados só são buscados ao expandir
- Estado local: Evita re-fetches desnecessários
- Sincronização: Dados salvos localmente para cache
- Paginação: Considerar para contas com muitos anúncios

## Segurança

- ✅ Validação de clientId em todas as operações
- ✅ Verificação de conexão ativa
- ✅ Autenticação via Supabase
- ✅ RLS policies no banco de dados
- ✅ Tokens de acesso seguros
