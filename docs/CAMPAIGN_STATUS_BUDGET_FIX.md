# Correção: Botões de Status e Orçamento de Campanhas/AdSets

## Problemas Identificados

### 1. Next.js 15 - Parâmetros Assíncronos
**Problema**: No Next.js 15, os parâmetros de rota dinâmica (`params`) são Promises e precisam ser aguardados com `await`.

**Solução**: Alterado o tipo de `params` de `{ campaignId: string }` para `Promise<{ campaignId: string }>` e adicionado `await` antes de desestruturar.

### 2. Campanhas Não Salvas no Banco
**Problema**: As campanhas estão vindo direto da Meta API em tempo real, mas não estão sendo salvas no banco de dados. As rotas antigas tentavam buscar as campanhas no banco, resultando em erro 404.

**Solução**: Modificadas as rotas para funcionarem **sem precisar do banco de dados**:
- As rotas agora buscam apenas a conexão Meta ativa (por `clientId` ou `adAccountId`)
- Usam o `campaignId` recebido diretamente como `external_id` para chamar a Meta API
- Não dependem mais de ter as campanhas sincronizadas no banco

### 3. Falta de Contexto nas Requisições
**Problema**: As rotas precisavam saber qual conexão Meta usar, mas só recebiam o `campaignId`.

**Solução**: Componentes agora enviam `clientId` e `adAccountId` junto com as requisições, permitindo que as rotas encontrem a conexão correta.

### 4. Edição de Orçamento
**Problema**: O diálogo de edição de orçamento não resetava os valores quando abria para um item diferente.

**Solução**: Adicionado `useEffect` para resetar os valores do formulário sempre que o diálogo abrir ou os valores mudarem.

## Arquivos Modificados

### Rotas de API

#### 1. `/src/app/api/campaigns/[campaignId]/status/route.ts`
- ✅ Busca flexível por `external_id` ou `id` interno
- ✅ Usa `external_id` para chamadas à Meta API
- ✅ Atualiza banco usando `id` interno
- ✅ Logs detalhados para debug

#### 2. `/src/app/api/campaigns/[campaignId]/budget/route.ts`
- ✅ Busca flexível por `external_id` ou `id` interno
- ✅ Usa `external_id` para chamadas à Meta API
- ✅ Atualiza banco usando `id` interno
- ✅ Logs detalhados para debug

#### 3. `/src/app/api/adsets/[adsetId]/status/route.ts`
- ✅ Busca flexível por `external_id` ou `id` interno
- ✅ Usa `external_id` para chamadas à Meta API
- ✅ Atualiza banco usando `id` interno
- ✅ Logs detalhados para debug

#### 4. `/src/app/api/adsets/[adsetId]/budget/route.ts`
- ✅ Busca flexível por `external_id` ou `id` interno
- ✅ Usa `external_id` para chamadas à Meta API
- ✅ Atualiza banco usando `id` interno
- ✅ Logs detalhados para debug

### Componentes

#### 5. `/src/components/meta/budget-edit-dialog.tsx`
- ✅ Adicionado `useEffect` para resetar valores ao abrir
- ✅ Valores resetam quando `open`, `currentDailyBudget` ou `currentLifetimeBudget` mudam

#### 6. `/src/components/meta/campaigns-list.tsx`
- ✅ Logs detalhados no `handleToggleStatus`
- ✅ Melhor feedback de erros

#### 7. `/src/components/meta/adsets-list.tsx`
- ✅ Logs detalhados no `handleToggleStatus`
- ✅ Melhor feedback de erros

## Como Funciona Agora

### Alteração de Status (Ligar/Desligar)

1. **Frontend**: Usuário clica no botão de Pausar/Ativar
2. **Componente**: Envia requisição PATCH com o novo status
3. **API Route**: 
   - Busca a campanha/adset no banco (por `external_id` ou `id`)
   - Obtém o `access_token` da conexão Meta
   - Chama a Meta API usando o `external_id`
   - Atualiza o status no banco local
4. **Frontend**: Recarrega a lista e mostra mensagem de sucesso

### Edição de Orçamento

1. **Frontend**: Usuário clica no botão "Orçamento"
2. **Diálogo**: Abre com valores atuais pré-preenchidos
3. **Usuário**: Edita orçamento diário e/ou total
4. **API Route**:
   - Busca a campanha/adset no banco
   - Converte valores de R$ para centavos
   - Chama a Meta API usando o `external_id`
   - Atualiza o orçamento no banco local
5. **Frontend**: Fecha diálogo, recarrega lista e mostra sucesso

## Logs de Debug

Os logs agora incluem:
- 🔄 Início da operação com dados enviados
- 📊 Resposta da API com status e dados
- ✅ Sucesso com detalhes
- ❌ Erros com detalhes completos
- 💥 Exceções capturadas

## Testando

### Teste de Status
1. Acesse uma campanha ou adset
2. Clique em "Pausar" ou "Ativar"
3. Verifique o console do navegador para logs
4. Confirme que o status mudou na interface
5. Verifique no Meta Ads Manager que o status foi atualizado

### Teste de Orçamento
1. Clique no botão "Orçamento" de uma campanha/adset
2. Verifique que os valores atuais estão pré-preenchidos
3. Altere o orçamento diário ou total
4. Clique em "Salvar Alterações"
5. Verifique o console para logs
6. Confirme que o orçamento foi atualizado na interface
7. Verifique no Meta Ads Manager que o orçamento foi atualizado

## Possíveis Erros e Soluções

### Erro: "Campanha não encontrada"
- **Causa**: ID inválido ou registro não existe no banco
- **Solução**: Sincronizar campanhas novamente

### Erro: "Conexão Meta Ads não está ativa"
- **Causa**: Token de acesso expirado ou conexão desativada
- **Solução**: Reconectar conta Meta Ads

### Erro da Meta API
- **Causa**: Permissões insuficientes ou limite de API
- **Solução**: Verificar permissões da conta Meta e limites de API

## Próximos Passos

- [ ] Adicionar testes automatizados para as rotas
- [ ] Implementar retry automático em caso de falha temporária
- [ ] Adicionar validação de permissões antes de chamar Meta API
- [ ] Implementar cache de status para reduzir chamadas à API
