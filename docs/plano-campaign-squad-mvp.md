# Plano Campaign Squad V2 (Conversacional + RAG)

## Objetivo
Evoluir o Campaign Squad para um fluxo conversacional com menor friccao para o usuario:
- usuario descreve a ideia em texto livre
- squad faz briefing minimo dinamico
- agente planejador monta plano completo (campanhas, pecas, datas, orcamento)
- usuario aprova apenas o planejamento
- squad executa automaticamente, com QA interno e retrabalho por tarefa quando necessario
- publicacao automatica em Meta e Google apos QA aprovado

## Escopo funcional
- Conversa orientada por contexto, sem formulario rigido inicial
- Planejador autonomo para definir:
  - quantidade de campanhas
  - distribuicao de canais
  - quantidade de criativos por campanha
  - calendario de execucao
  - proposta de orcamento
- Gate unico de aprovacao manual: plano estrategico
- Execucao por agentes especializados apos aprovacao
- Agente de conferencia (QA) validando aderencia ao plano
- Politica de retrabalho automatico: maximo de 2 loops por tarefa
- Publicacao automatica apos QA final aprovado
- RAG fixo por cliente aplicado por padrao em todos os runs

## Escopo tecnico
- `apps/campaign-squad-service`:
  - nova maquina de estados conversacional
  - pipeline por tarefas (briefing -> planning -> execution -> qa -> publish)
  - endpoints de mensagens e aprovacao de plano
- BFF no app principal:
  - novas rotas para mensagens do run e aprovacao de plano
  - rotas para leitura/edicao de contexto fixo do cliente
- Persistencia:
  - contexto fixo por cliente (RAG) com campos estruturados + notas
  - historico de conversa e versao do contexto aplicada em cada run
  - trilha auditavel de QA e retrabalhos
- Jira:
  - backlog detalhado por historias CS-01..CS-14

## RAG fixo por cliente
Contexto persistente editavel no painel do cliente, usado automaticamente em todos os runs:
- company_overview
- products_services
- target_audience
- value_props
- brand_voice
- constraints
- offers
- notes

## Criterios de aceite
- usuario consegue iniciar run com ideia livre sem preencher plano completo
- sistema conduz briefing minimo e gera planejamento completo
- nenhuma publicacao ocorre sem aprovacao manual do plano
- apos aprovacao, execucao ocorre sem novos gates manuais intermediarios
- QA reprova e retorna apenas tarefas com desvio para os agentes responsaveis
- QA respeita limite de 2 retrabalhos por tarefa e sinaliza intervencao manual quando exceder
- RAG do cliente e aplicado por padrao no planejamento e execucao
- historico do run registra contexto aplicado, decisoes e eventos ponta a ponta

