# Campaign Squad Conversacional + RAG por Cliente

## Objetivo
Permitir que o usuario informe apenas a ideia da campanha em linguagem natural e o squad complete o restante do fluxo com autonomia, mantendo controle humano somente na aprovacao do plano estrategico.

## Fluxo funcional
1. Usuario inicia run com ideia livre.
2. Agente de briefing faz perguntas minimas para remover ambiguidades criticas.
3. Agente planejador gera plano completo:
   - campanhas por canal
   - quantidade de pecas por campanha
   - datas e cadencia
   - proposta de orcamento
4. Usuario aprova ou solicita revisao do plano.
5. Aprovado o plano, agentes de execucao produzem entregas por tarefa.
6. Agente QA confere aderencia ao plano aprovado.
7. Se houver desvio, tarefa volta para agente responsavel (maximo 2 loops por tarefa).
8. QA final aprovado -> publicacao automatica em Meta/Google.

## Regras de produto
- Gate manual unico: aprovacao do plano estrategico.
- Nao ha aprovacao manual de pecas no fluxo novo.
- Retrabalho automatico limitado a 2 loops por tarefa.
- Ao exceder limite: status `needs_manual_intervention`.
- Publicacao automatica apos QA final aprovado.

## RAG fixo por cliente
Contexto persistente e editavel por cliente, aplicado por padrao em todos os runs:
- `company_overview`
- `products_services`
- `target_audience`
- `value_props`
- `brand_voice`
- `constraints`
- `offers`
- `notes`

### Regras de uso do RAG
- O contexto fixo entra automaticamente nos prompts de briefing, planejamento, criacao e QA.
- O run registra a versao/estado do contexto utilizado.
- Se contexto nao existir, o fluxo continua sem bloqueio.

## Estados do run
- `briefing`
- `planning`
- `awaiting_plan_approval`
- `executing`
- `qa_review`
- `publishing`
- `completed`
- `failed`
- `needs_manual_intervention`

## APIs planejadas
- `POST /runs` (modo conversacional com payload minimo + compatibilidade legado)
- `POST /runs/:runId/messages`
- `POST /runs/:runId/plan-approval`
- `GET /runs/:runId`
- `GET /api/clients/:clientId/context`
- `PUT /api/clients/:clientId/context`

## Persistencia planejada
- Conversa por run (mensagens e eventos por etapa).
- Plano proposto e plano aprovado.
- Tarefas de execucao por agente com status.
- Laudos QA por tarefa e por iteracao.
- Contexto fixo por cliente e metadados de atualizacao.

## Observabilidade
- Timeline por run com eventos de conversa, decisao, QA e publicacao.
- Registro de falhas por canal e integracao com DLQ.
- Indicadores basicos:
  - tempo de briefing ate aprovacao
  - taxa de aprovacao de plano
  - media de loops QA por tarefa
  - taxa de sucesso de publicacao por canal

## Cenarios de teste
1. Ideia livre -> briefing minimo -> plano -> aprovacao -> execucao -> QA -> publicacao.
2. Run com RAG completo do cliente.
3. Run sem RAG cadastrado.
4. QA com 1 ou 2 retrabalhos e aprovacao final.
5. QA excedendo limite de loop e encerrando em `needs_manual_intervention`.
6. Falha em um canal de publicacao com registro em DLQ.

## Nao objetivos desta fase
- OCR e ingestao automatica de documentos longos.
- Multi-aprovadores no mesmo run.
- Planejamento multi-mes em lote com dependencia entre runs.
