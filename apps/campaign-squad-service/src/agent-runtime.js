const AGENT_CATALOG = Object.freeze({
  strategist: Object.freeze({
    id: 'agent-strategist',
    role: 'strategist',
    label: 'Agente Estrategista',
    specialty: 'planejamento e estrategia de midia'
  }),
  copywriter: Object.freeze({
    id: 'agent-copywriter',
    role: 'copywriter',
    label: 'Agente Copywriter',
    specialty: 'mensagens, ofertas e criativos textuais'
  }),
  designer: Object.freeze({
    id: 'agent-designer',
    role: 'designer',
    label: 'Agente Designer',
    specialty: 'pecas visuais e roteiros de criativo'
  }),
  traffic_manager: Object.freeze({
    id: 'agent-traffic-manager',
    role: 'traffic_manager',
    label: 'Agente Gestor de Trafego',
    specialty: 'configuracao, budget e publicacao'
  }),
  qa_publisher: Object.freeze({
    id: 'agent-qa-publisher',
    role: 'qa_publisher',
    label: 'Agente QA/Publicador',
    specialty: 'controle de qualidade e gate final'
  })
});

function cloneAgent(baseAgent, run, assignedAt) {
  return {
    ...baseAgent,
    assignedAt,
    llm: {
      provider: run?.llmSnapshot?.provider || null,
      model: run?.llmSnapshot?.model || null
    }
  };
}

class AgentRuntime {
  constructor() {
    this.catalog = AGENT_CATALOG;
  }

  rosterForRun(run, assignedAt = new Date().toISOString()) {
    return Object.values(this.catalog).map((agent) => cloneAgent(agent, run, assignedAt));
  }

  resolveTaskRole(task) {
    if (!task || typeof task !== 'object') return 'strategist';
    if (task.type === 'creative') return 'designer';
    if (task.type === 'qa') return 'qa_publisher';
    if (task.type === 'publish') return 'traffic_manager';
    if (task.type === 'planning') return 'strategist';
    return 'strategist';
  }

  resolveAssetRole(asset) {
    if (!asset || typeof asset !== 'object') return 'designer';
    if (['copy', 'headline', 'primary-text', 'video-script'].includes(asset.type)) {
      return 'copywriter';
    }
    return 'designer';
  }

  annotatePlan(run, plan) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return plan;
    const assignedAt = new Date().toISOString();
    const roster = this.rosterForRun(run, assignedAt);
    const stageOwners = {
      strategy: cloneAgent(this.catalog.strategist, run, assignedAt),
      copy: cloneAgent(this.catalog.copywriter, run, assignedAt),
      creative: cloneAgent(this.catalog.designer, run, assignedAt),
      traffic: cloneAgent(this.catalog.traffic_manager, run, assignedAt),
      qa: cloneAgent(this.catalog.qa_publisher, run, assignedAt)
    };

    return {
      ...plan,
      agentRuntime: {
        version: '1.0',
        roster,
        stageOwners
      }
    };
  }

  annotateTasks(run, tasks) {
    const assignedAt = new Date().toISOString();
    return (Array.isArray(tasks) ? tasks : []).map((task) => {
      if (task?.agent && typeof task.agent === 'object') return task;
      const role = this.resolveTaskRole(task);
      const base = this.catalog[role] || this.catalog.strategist;
      return {
        ...task,
        agent: cloneAgent(base, run, assignedAt)
      };
    });
  }

  annotateAssets(run, assets) {
    const assignedAt = new Date().toISOString();
    return (Array.isArray(assets) ? assets : []).map((asset) => {
      if (asset?.agent && typeof asset.agent === 'object') return asset;
      const role = this.resolveAssetRole(asset);
      const base = this.catalog[role] || this.catalog.designer;
      return {
        ...asset,
        agent: cloneAgent(base, run, assignedAt)
      };
    });
  }
}

module.exports = {
  AgentRuntime
};
