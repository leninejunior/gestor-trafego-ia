# Gerenciamento de Campanhas e Orçamentos - Meta Ads

## Funcionalidades Implementadas

### 1. Controle de Status de Campanhas
- **Ativar/Pausar Campanhas**: Botões para ligar e desligar campanhas diretamente da interface
- **Feedback Visual**: Indicadores de status com cores (Ativa, Pausada, Excluída, Arquivada)
- **Sincronização**: Alterações são aplicadas na Meta API e sincronizadas no banco de dados local

### 2. Edição de Orçamento de Campanhas
- **Orçamento Diário**: Alterar o valor gasto por dia na campanha
- **Orçamento Total (Lifetime)**: Definir orçamento total para toda a duração da campanha
- **Interface Intuitiva**: Modal de edição com validação de valores
- **Conversão Automática**: Sistema converte valores de R$ para centavos (formato da Meta API)

### 3. Gerenciamento de Conjuntos de Anúncios (AdSets)
- **Visualização Hierárquica**: Lista expansível de adsets dentro de cada campanha
- **Controle de Status**: Ativar/pausar conjuntos individualmente
- **Edição de Orçamento**: Alterar orçamento diário ou total de cada conjunto
- **Carregamento Sob Demanda**: AdSets são carregados apenas quando expandidos

## Estrutura de Arquivos

### APIs Criadas

```
src/app/api/
├── campaigns/[campaignId]/
│   ├── status/route.ts          # Atualizar status da campanha
│   └── budget/route.ts          # Atualizar orçamento da campanha
├── adsets/[adsetId]/
│   ├── status/route.ts          # Atualizar status do adset
│   └── budget/route.ts          # Atualizar orçamento do adset
└── meta/
    └── adsets/route.ts          # Listar adsets de uma campanha
```

### Componentes

```
src/components/meta/
├── campaigns-list.tsx           # Lista de campanhas (atualizado)
├── adsets-list.tsx             # Lista de conjuntos de anúncios (novo)
└── budget-edit-dialog.tsx      # Modal de edição de orçamento (novo)
```

## Como Usar

### 1. Visualizar Campanhas
- Acesse a página do cliente
- As campanhas Meta Ads serão listadas automaticamente
- Cada campanha mostra: nome, status, objetivo, orçamento diário e data de criação

### 2. Ativar/Pausar Campanha
1. Localize a campanha na lista
2. Clique no botão "Pausar" (se ativa) ou "Ativar" (se pausada)
3. Aguarde a confirmação
4. O status será atualizado automaticamente

### 3. Editar Orçamento da Campanha
1. Clique no botão "Orçamento" na linha da campanha
2. No modal, informe:
   - **Orçamento Diário**: Valor em R$ gasto por dia
   - **Orçamento Total**: Valor total para toda a campanha
3. Clique em "Salvar Alterações"
4. O orçamento será atualizado na Meta e no sistema

### 4. Gerenciar Conjuntos de Anúncios
1. Clique no ícone de seta (▶) ao lado do nome da campanha
2. A lista de conjuntos será expandida
3. Para cada conjunto você pode:
   - Ativar/Pausar o conjunto
   - Editar o orçamento (mesmo processo das campanhas)

## Detalhes Técnicos

### Integração com Meta API

**Endpoints Utilizados:**
- `POST https://graph.facebook.com/v18.0/{campaign_id}` - Atualizar campanha
- `POST https://graph.facebook.com/v18.0/{adset_id}` - Atualizar adset
- `GET https://graph.facebook.com/v18.0/{campaign_id}/adsets` - Listar adsets

**Parâmetros de Orçamento:**
- Valores são enviados em centavos (ex: R$ 50,00 = 5000)
- `daily_budget`: Orçamento diário
- `lifetime_budget`: Orçamento total

**Parâmetros de Status:**
- `ACTIVE`: Campanha/adset ativo
- `PAUSED`: Campanha/adset pausado

### Segurança e Validação

1. **Autenticação**: Todas as requisições verificam o token de acesso do cliente
2. **Validação de Propriedade**: Sistema verifica se o usuário tem acesso ao cliente
3. **Validação de Conexão**: Verifica se a conexão Meta está ativa
4. **Sincronização**: Alterações são salvas localmente após sucesso na Meta API

### Tratamento de Erros

- Erros da Meta API são capturados e exibidos ao usuário
- Mensagens de erro específicas para cada tipo de problema
- Rollback automático em caso de falha
- Logs detalhados para debugging

## Fluxo de Dados

```
Interface do Usuário
    ↓
Componente React (campaigns-list.tsx / adsets-list.tsx)
    ↓
API Route (/api/campaigns/[id]/budget ou /api/adsets/[id]/budget)
    ↓
Validação e Autenticação
    ↓
Meta Marketing API (Facebook)
    ↓
Sincronização com Supabase
    ↓
Resposta ao Usuário
```

## Próximas Melhorias Sugeridas

1. **Histórico de Alterações**: Registrar todas as mudanças de orçamento e status
2. **Agendamento**: Permitir agendar ativação/pausa de campanhas
3. **Alertas de Orçamento**: Notificar quando orçamento estiver próximo do limite
4. **Edição em Lote**: Alterar múltiplas campanhas/adsets simultaneamente
5. **Gráficos de Gastos**: Visualizar evolução do gasto ao longo do tempo
6. **Regras Automáticas**: Pausar automaticamente campanhas com baixo desempenho

## Observações Importantes

- **Permissões Meta**: O token de acesso precisa ter permissões de `ads_management`
- **Limites da API**: Respeite os rate limits da Meta API
- **Orçamento Mínimo**: Meta tem valores mínimos para orçamentos (varia por país)
- **Moeda**: Sistema usa BRL (Real Brasileiro) por padrão
- **Fuso Horário**: Considere o fuso horário da conta de anúncios

## Suporte

Em caso de problemas:
1. Verifique se a conexão Meta está ativa
2. Confirme as permissões do token de acesso
3. Consulte os logs do servidor para erros detalhados
4. Verifique se os valores de orçamento atendem aos mínimos da Meta
