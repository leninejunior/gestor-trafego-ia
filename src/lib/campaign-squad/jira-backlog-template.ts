export type CampaignSquadJiraStory = {
  summary: string
  description: string
  storyPoints: number
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest'
}

export const CAMPAIGN_SQUAD_JIRA_EPIC_SUMMARY =
  'Campaign Squad Conversacional + RAG por Cliente (Planejamento Autonomo + QA)'

export const CAMPAIGN_SQUAD_JIRA_EPIC_DESCRIPTION = [
  'Iniciativa para evoluir o squad de campanhas para um fluxo conversacional orientado por contexto.',
  '',
  'Escopo principal:',
  '- Entrada por ideia em texto livre com briefing minimo dinamico',
  '- Planejador autonomo definindo campanhas, pecas, cronograma e orcamento',
  '- Aprovacao manual unica do planejamento',
  '- Execucao por squad de agentes com QA e retrabalho por tarefa',
  '- Publicacao automatica em Meta/Google apos QA aprovado',
  '- RAG fixo por cliente, editavel no painel, aplicado por padrao em todos os runs'
].join('\n')

export const CAMPAIGN_SQUAD_JIRA_STORIES: CampaignSquadJiraStory[] = [
  {
    summary: 'CS-01 - Maquina de estados conversacional do run',
    description: [
      'Escopo:',
      '- Implementar estados briefing/planning/awaiting_plan_approval/executing/qa_review/publishing/completed/failed/needs_manual_intervention.',
      '- Mapear transicoes validas e eventos no timeline do run.',
      'Aceite:',
      '- Cada mudanca de estado fica auditavel.',
      '- Runs legados continuam consultaveis sem regressao funcional.'
    ].join('\n'),
    storyPoints: 8,
    priority: 'High'
  },
  {
    summary: 'CS-02 - Endpoint de mensagens do run',
    description: [
      'Escopo:',
      '- Criar POST /runs/:runId/messages para conversa continua.',
      '- Suportar fluxo de perguntas de briefing e respostas do usuario.',
      'Aceite:',
      '- Conversa avanca para planejamento sem formulario rigido.',
      '- Contexto da conversa permanece consistente durante o run.'
    ].join('\n'),
    storyPoints: 5,
    priority: 'High'
  },
  {
    summary: 'CS-03 - Aprovacao unica de planejamento',
    description: [
      'Escopo:',
      '- Criar POST /runs/:runId/plan-approval com acoes approve e revise.',
      '- Remover gate manual intermediario de criativos no fluxo novo.',
      'Aceite:',
      '- Publicacao nao inicia sem aprovacao do plano.',
      '- Aprovado o plano, run segue para execucao automatica.'
    ].join('\n'),
    storyPoints: 5,
    priority: 'High'
  },
  {
    summary: 'CS-04 - Planejador autonomo com saida estruturada',
    description: [
      'Escopo:',
      '- Substituir planejamento mock por geracao via LLM com validacao de schema.',
      '- Plano deve incluir canais, campanhas, quantidades de pecas, cronograma e orcamento.',
      'Aceite:',
      '- Resposta do planejador sempre retorna estrutura valida para execucao.',
      '- Em falta de dados, sistema pergunta somente o minimo necessario.'
    ].join('\n'),
    storyPoints: 8,
    priority: 'High'
  },
  {
    summary: 'CS-05 - Persistencia do RAG fixo por cliente',
    description: [
      'Escopo:',
      '- Criar estrutura de contexto com campos estruturados e notas livres.',
      '- Registrar atualizacao com timestamp e usuario.',
      'Aceite:',
      '- Contexto e isolado por organizacao.',
      '- Contexto pode ser lido e atualizado de forma idempotente.'
    ].join('\n'),
    storyPoints: 8,
    priority: 'High'
  },
  {
    summary: 'CS-06 - APIs de contexto do cliente',
    description: [
      'Escopo:',
      '- Criar GET/PUT /api/clients/:clientId/context.',
      '- Validar payload e permissoes por organizacao.',
      'Aceite:',
      '- Usuario sem permissao nao acessa contexto de outro cliente.',
      '- Campos estruturados e notas sao persistidos corretamente.'
    ].join('\n'),
    storyPoints: 5,
    priority: 'High'
  },
  {
    summary: 'CS-07 - Injetar RAG automaticamente no fluxo',
    description: [
      'Escopo:',
      '- Incluir contexto fixo por padrao nos prompts de briefing/planning/creative/qa.',
      '- Registrar versao do contexto usada no run.',
      'Aceite:',
      '- Todo run novo usa contexto do cliente automaticamente.',
      '- Falta de contexto nao bloqueia run, apenas reduz enriquecimento.'
    ].join('\n'),
    storyPoints: 5,
    priority: 'High'
  },
  {
    summary: 'CS-08 - Executor por tarefas planejadas',
    description: [
      'Escopo:',
      '- Converter execucao em tarefas por agente responsavel.',
      '- Incluir status de tarefa, entregavel esperado e resultado.',
      'Aceite:',
      '- Progresso por tarefa visivel no run.',
      '- Falhas localizadas nao derrubam rastreabilidade global.'
    ].join('\n'),
    storyPoints: 8,
    priority: 'High'
  },
  {
    summary: 'CS-09 - Agente QA com retrabalho automatico',
    description: [
      'Escopo:',
      '- QA compara entrega vs plano aprovado e reprova somente tarefas com desvio.',
      '- Em reprova, retornar tarefa para agente dono.',
      'Aceite:',
      '- Maximo de 2 loops por tarefa.',
      '- Excedeu limite => run em needs_manual_intervention.'
    ].join('\n'),
    storyPoints: 8,
    priority: 'High'
  },
  {
    summary: 'CS-10 - Publicacao automatica pos-QA',
    description: [
      'Escopo:',
      '- Publicar Meta/Google somente apos QA final aprovado.',
      '- Registrar sucesso/falha por canal, com detalhe de erro.',
      'Aceite:',
      '- Falha de canal e enviada para DLQ.',
      '- Timeline registra tentativas e resultado final.'
    ].join('\n'),
    storyPoints: 5,
    priority: 'High'
  },
  {
    summary: 'CS-11 - UI conversacional no lugar do formulario de runs',
    description: [
      'Escopo:',
      '- Substituir tela rigida por chat com etapas e progresso.',
      '- Exibir card de planejamento para aprovacao unica.',
      'Aceite:',
      '- Usuario consegue operar o fluxo inteiro via conversa.',
      '- Interface mostra claramente em que fase o run esta.'
    ].join('\n'),
    storyPoints: 8,
    priority: 'High'
  },
  {
    summary: 'CS-12 - UI de Contexto Fixo no detalhe do cliente',
    description: [
      'Escopo:',
      '- Adicionar secao editavel de contexto fixo na pagina de cliente.',
      '- Permitir cadastro de empresa, produtos, publico, diferenciais e restricoes.',
      'Aceite:',
      '- Alteracoes persistem e ficam visiveis para novos runs.',
      '- Interface indica ultima atualizacao.'
    ].join('\n'),
    storyPoints: 5,
    priority: 'High'
  },
  {
    summary: 'CS-13 - Compatibilidade do fluxo legado',
    description: [
      'Escopo:',
      '- Manter suporte ao POST /runs legado e historico existente.',
      '- Garantir migracao gradual para o modo conversacional.',
      'Aceite:',
      '- Integracoes antigas continuam operacionais.',
      '- Historico nao perde dados por causa da mudanca de fluxo.'
    ].join('\n'),
    storyPoints: 3,
    priority: 'High'
  },
  {
    summary: 'CS-14 - Testes E2E e smoke do novo fluxo',
    description: [
      'Escopo:',
      '- Atualizar testes para fluxo conversacional, QA loop e publicacao.',
      '- Cobrir cenarios com/sem RAG e com limite de retrabalho.',
      'Aceite:',
      '- Suite valida caminho feliz e excecoes criticas.',
      '- Smoke do fluxo conversa->plano->aprovacao->execucao->qa->publicacao passa.'
    ].join('\n'),
    storyPoints: 8,
    priority: 'High'
  }
]
