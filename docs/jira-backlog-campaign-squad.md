# Jira Backlog - Campaign Squad Conversacional + RAG

## Projeto alvo
- Projeto Jira: `GT`
- Tipo de issue: `Epic` e `Story`
- Prioridade padrao: `High`
- Labels recomendadas: `campaign-squad`, `conversation`, `rag`, `qa`

## Epic
**Campaign Squad Conversacional + RAG por Cliente (Planejamento Autonomo + QA)**

Descricao:
- Evoluir o squad para fluxo por conversa com briefing minimo.
- Planejador autonomo gera plano completo (campanhas, pecas, datas, orcamento).
- Aprovacao manual unica do plano.
- Execucao automatica por agentes com QA e retrabalho por tarefa.
- Publicacao automatica apos QA aprovado.
- Uso padrao de contexto fixo por cliente (RAG), editavel no painel.

## Stories detalhadas
1. **CS-01 - Maquina de estados conversacional do run** (8 SP)
- Implementar estados: briefing, planning, awaiting_plan_approval, executing, qa_review, publishing, completed, failed, needs_manual_intervention.
- Aceite: transicoes auditaveis no timeline e compatibilidade com runs legados.

2. **CS-02 - Endpoint de mensagens do run** (5 SP)
- Criar `POST /runs/:runId/messages` para continuar conversa por contexto.
- Aceite: sistema responde pergunta seguinte ou avanca para plano sem formulario rigido.

3. **CS-03 - Aprovacao unica de planejamento** (5 SP)
- Criar `POST /runs/:runId/plan-approval` com `approve` e `revise`.
- Aceite: apenas o plano exige aprovacao manual antes da execucao.

4. **CS-04 - Planejador autonomo com saida estruturada** (8 SP)
- Substituir planejamento mock por geracao estruturada via LLM.
- Aceite: plano sempre retorna schema valido com campanhas, pecas, cronograma e orcamento.

5. **CS-05 - Persistencia do RAG fixo por cliente** (8 SP)
- Criar estrutura de contexto com campos fixos e notas.
- Aceite: leitura/escrita isoladas por organizacao e trilha de atualizacao.

6. **CS-06 - APIs de contexto do cliente** (5 SP)
- Criar `GET/PUT /api/clients/:clientId/context`.
- Aceite: validacao de payload e bloqueio de acesso cross-org.

7. **CS-07 - Injetar RAG automaticamente no fluxo** (5 SP)
- Aplicar contexto fixo por padrao nos agentes de briefing, planejamento, criacao e QA.
- Aceite: run usa contexto automaticamente sem exigir toggle manual.

8. **CS-08 - Executor por tarefas planejadas** (8 SP)
- Quebrar execucao em tarefas por agente responsavel.
- Aceite: status por tarefa e rastreabilidade no run.

9. **CS-09 - Agente QA com retrabalho automatico** (8 SP)
- QA valida aderencia ao plano e reabre tarefa para agente responsavel em caso de desvio.
- Aceite: limite de 2 loops por tarefa; excedeu limite -> needs_manual_intervention.

10. **CS-10 - Publicacao automatica pos-QA** (5 SP)
- Publicar em Meta/Google somente apos QA final aprovado.
- Aceite: falha por canal registrada em timeline e DLQ.

11. **CS-11 - UI conversacional no lugar do formulario de runs** (8 SP)
- Substituir tela rigida por chat com etapas, plano para aprovacao e progresso.
- Aceite: operacao principal feita por conversa.

12. **CS-12 - UI de Contexto Fixo no detalhe do cliente** (5 SP)
- Adicionar secao editavel de contexto fixo no cliente.
- Aceite: salvar/editar contexto com feedback e timestamp de atualizacao.

13. **CS-13 - Compatibilidade do fluxo legado** (3 SP)
- Manter `POST /runs` legado e historico de runs.
- Aceite: chamadas antigas continuam funcionais.

14. **CS-14 - Testes E2E e smoke do novo fluxo** (8 SP)
- Cobrir caminho feliz e excecoes: sem RAG, com RAG, QA loop, limite de loop, falha de publicacao.
- Aceite: suite cobre os cenarios criticos do novo fluxo.

## Definicao de pronto
- Documentacao tecnica atualizada no repositorio.
- Epic e stories criadas no Jira com detalhes de escopo e aceite.
- Fluxo conversacional, RAG e QA mapeados no backlog fim a fim.

## Integracao automatica (App Principal)
- Endpoint: `POST /api/campaign-squad/jira/backlog`
- Requer autenticacao com perfil admin.
- Variaveis necessarias:
  - `JIRA_BASE_URL`
  - `JIRA_EMAIL`
  - `JIRA_API_TOKEN`
  - `JIRA_PROJECT_KEY`
- Campos opcionais:
  - `JIRA_STORY_POINTS_FIELD_ID`
  - `JIRA_EPIC_NAME_FIELD_ID`
  - `JIRA_EPIC_LINK_FIELD_ID`

