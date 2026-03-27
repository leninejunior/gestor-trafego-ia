const { v4: uuidv4 } = require('uuid');
const { getSupabaseClient } = require('./supabase');
const { publishChannel } = require('./publishers');
const { generateStructuredPlan } = require('./planner');
const { AgentRuntime } = require('./agent-runtime');
const { uploadReadyCreative } = require('./storage/minio');

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'needs_manual_intervention']);

class WorkflowEngine {
  constructor({ store, queue }) {
    this.store = store;
    this.queue = queue;
    this.agentRuntime = new AgentRuntime();
  }

  extractUrlsFromText(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const matches = rawText.match(/https?:\/\/[^\s)]+/gi) || [];
    const dedup = new Set();
    matches.forEach((candidate) => {
      try {
        const parsed = new URL(candidate);
        if (!['http:', 'https:'].includes(parsed.protocol)) return;
        dedup.add(parsed.toString());
      } catch (_error) {
        // Ignore malformed URL.
      }
    });
    return Array.from(dedup);
  }

  isBlockedHostname(hostname) {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return true;

    if (host === 'localhost' || host.endsWith('.local')) return true;
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
    if (/^127\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;

    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172) {
      const secondOctet = Number(private172[1]);
      if (Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31) return true;
    }

    return false;
  }

  normalizeExtractedText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async fetchWebsiteContext(url) {
    const parsed = new URL(url);
    if (this.isBlockedHostname(parsed.hostname)) {
      throw new Error(`Hostname blocked for security: ${parsed.hostname}`);
    }

    const attemptUrls = [];
    const directUrl = parsed.toString();
    attemptUrls.push(directUrl);

    if (parsed.protocol === 'https:') {
      attemptUrls.push(`http://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`);
    }

    attemptUrls.push(`http://r.jina.ai/${directUrl}`);

    let lastError = null;

    for (const attemptUrl of attemptUrls) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(attemptUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': 'CampaignSquadBot/1.0 (+https://localhost)'
          }
        });

        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status} while reading ${attemptUrl}`);
          continue;
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        const raw = (await response.text()).slice(0, 250000);
        const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || raw.match(/^Title:\s*(.+)$/im);
        const descMatch =
          raw.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
          raw.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);

        const normalizedText = this.normalizeExtractedText(raw).slice(0, 6000);
        return {
          url: parsed.toString(),
          fetchedFrom: attemptUrl,
          contentType,
          title: titleMatch ? this.normalizeExtractedText(titleMatch[1]).slice(0, 200) : null,
          description: descMatch ? this.normalizeExtractedText(descMatch[1]).slice(0, 300) : null,
          text: normalizedText
        };
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error(`Failed to read ${parsed.toString()}`);
  }

  async ingestLinksIntoRun(runId, rawText, phase = 'briefing') {
    const urls = this.extractUrlsFromText(rawText).slice(0, 3);
    if (urls.length === 0) {
      return {
        detected: 0,
        loaded: 0,
        failed: 0
      };
    }

    let loaded = 0;
    let failed = 0;

    for (const url of urls) {
      try {
        const websiteContext = await this.fetchWebsiteContext(url);
        const messageContent = [
          `Website context loaded automatically from ${websiteContext.url}`,
          websiteContext.fetchedFrom ? `Fetched from: ${websiteContext.fetchedFrom}` : null,
          websiteContext.title ? `Title: ${websiteContext.title}` : null,
          websiteContext.description ? `Description: ${websiteContext.description}` : null,
          websiteContext.text ? `Extracted text: ${websiteContext.text}` : null
        ]
          .filter(Boolean)
          .join('\n');

        this.store.addRunMessage(runId, {
          role: 'system',
          phase: 'context_ingestion',
          content: messageContent
        });

        loaded += 1;
      } catch (error) {
        failed += 1;
        this.store.addRunMessage(runId, {
          role: 'assistant',
          phase,
          content: `Nao consegui ler ${url}. Motivo: ${error instanceof Error ? error.message : 'erro desconhecido'}.`
        });
      }
    }

    if (loaded > 0) {
      this.store.addRunMessage(runId, {
        role: 'assistant',
        phase,
        content: `Li ${loaded} link(s) automaticamente e vou usar esse contexto para montar o plano.`
      });
    }

    return {
      detected: urls.length,
      loaded,
      failed
    };
  }

  normalizePlanChannels(rawChannels) {
    const validChannels = ['meta', 'google'];
    const normalized = Array.isArray(rawChannels)
      ? rawChannels.filter((channel) => validChannels.includes(channel))
      : [];
    return normalized.length > 0 ? normalized : ['meta'];
  }

  resolvePlanName(plan, fallbackName = 'Planejamento sem nome') {
    if (plan && typeof plan.planName === 'string' && plan.planName.trim().length > 0) {
      return plan.planName.trim();
    }
    if (typeof fallbackName === 'string' && fallbackName.trim().length > 0) {
      return fallbackName.trim();
    }
    return 'Planejamento sem nome';
  }

  buildFallbackPlanFromConversation(run) {
    const userMessages = (run.messages || [])
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join(' ');
    const baseText = [run.idea || '', userMessages].join(' ').toLowerCase();

    const inferredChannels = [];
    if (baseText.includes('google')) inferredChannels.push('google');
    if (baseText.includes('meta') || baseText.includes('instagram') || baseText.includes('facebook')) {
      inferredChannels.push('meta');
    }

    const channels = this.normalizePlanChannels(inferredChannels.length > 0 ? inferredChannels : run.channels);
    const budget = run.budget || { amount: 1500, currency: 'BRL' };
    const objective = run.objective || 'Leads';
    const campaignName = run.campaignName || 'Campanha Conversacional';
    const today = new Date().toISOString().slice(0, 10);

    const campaigns = channels.map((channel) => ({
      id: uuidv4(),
      channel,
      name: `${campaignName} - ${channel.toUpperCase()}`,
      objective,
      creativesPlanned: channel === 'meta' ? 4 : 3,
      startDate: today
    }));

    return {
      source: 'fallback_rules',
      generatedAt: new Date().toISOString(),
      planName: campaignName,
      summary: `Plano gerado para ${campaigns.length} campanha(s) com foco em ${objective}.`,
      channels,
      budget,
      schedule: {
        startDate: today,
        cadence: 'weekly',
        durationDays: 30
      },
      campaigns,
      qaPolicy: {
        maxLoopsPerTask: 2
      },
      contextUsed: run.contextSnapshot
        ? {
            companyOverview: run.contextSnapshot.companyOverview || '',
            targetAudience: run.contextSnapshot.targetAudience || '',
            valueProps: run.contextSnapshot.valueProps || ''
          }
        : null
    };
  }

  async buildPlanFromConversation(run) {
    const fallbackPlan = this.buildFallbackPlanFromConversation(run);

    try {
      const structuredPlan = await generateStructuredPlan({ run });
      if (!structuredPlan) {
        return fallbackPlan;
      }

      const channels = this.normalizePlanChannels(structuredPlan.channels);
      const safeCampaigns = Array.isArray(structuredPlan.campaigns) && structuredPlan.campaigns.length > 0
        ? structuredPlan.campaigns.map((campaign) => ({
            ...campaign,
            id: campaign.id || uuidv4(),
            channel: channels.includes(campaign.channel) ? campaign.channel : channels[0]
          }))
        : fallbackPlan.campaigns;

      return {
        ...structuredPlan,
        planName:
          (typeof structuredPlan.planName === 'string' && structuredPlan.planName.trim()) ||
          run.campaignName ||
          fallbackPlan.planName,
        channels,
        budget: structuredPlan.budget || fallbackPlan.budget,
        campaigns: safeCampaigns,
        qaPolicy: {
          maxLoopsPerTask: 2
        },
        contextUsed: structuredPlan.contextUsed ?? fallbackPlan.contextUsed
      };
    } catch (_error) {
      return fallbackPlan;
    }
  }

  summarizePlan(plan) {
    const planName =
      (typeof plan?.planName === 'string' && plan.planName.trim()) ||
      'Planejamento sem nome';
    const channels = Array.isArray(plan.channels) ? plan.channels.join(', ') : 'meta';
    const campaignCount = Array.isArray(plan.campaigns) ? plan.campaigns.length : 0;
    const budgetAmount = plan?.budget?.amount ?? 'n/a';
    const budgetCurrency = plan?.budget?.currency ?? 'BRL';

    return [
      'Plano pronto para aprovacao.',
      `Nome: ${planName}`,
      `Campanhas: ${campaignCount}`,
      `Canais: ${channels}`,
      `Orcamento: ${budgetAmount} ${budgetCurrency}`,
      'Se estiver ok, aprove o plano para iniciar execucao automatica.'
    ].join(' ');
  }

  annotatePlanWithAgents(run, plan) {
    return this.agentRuntime.annotatePlan(run, plan);
  }

  annotateTasksWithAgents(run, tasks) {
    return this.agentRuntime.annotateTasks(run, tasks);
  }

  annotateAssetsWithAgents(run, assets) {
    return this.agentRuntime.annotateAssets(run, assets);
  }

  toSafeFileSegment(raw) {
    return String(raw || 'creative')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'creative';
  }

  buildImageSvgDataUrl({ title, subtitle }) {
    const escapedTitle = String(title || 'Criativo')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const escapedSubtitle = String(subtitle || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">',
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
      '<stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#22c55e"/>',
      '</linearGradient></defs>',
      '<rect width="1200" height="628" fill="url(#g)"/>',
      '<rect x="44" y="44" width="1112" height="540" rx="28" fill="rgba(255,255,255,0.12)"/>',
      `<text x="78" y="250" fill="white" font-size="56" font-family="Arial, sans-serif" font-weight="700">${escapedTitle}</text>`,
      `<text x="78" y="318" fill="white" font-size="28" font-family="Arial, sans-serif">${escapedSubtitle}</text>`,
      '<text x="78" y="560" fill="white" font-size="20" font-family="Arial, sans-serif">Campaign Squad - Preview</text>',
      '</svg>'
    ].join('');

    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  }

  async buildGeneratedImageAsset({ run, creativeTask, iteration, taskLabel }) {
    const fallbackKey = `${creativeTask.campaignId || creativeTask.channel || 'task'}-image-${iteration}.svg`;
    const fallbackStorageUrl = `s3://campaign-squad/${run.organizationId}/${run.id}/${fallbackKey}`;

    try {
      const fileName = `${this.toSafeFileSegment(taskLabel)}-${iteration}.svg`;
      const dataUrl = this.buildImageSvgDataUrl({
        title: taskLabel,
        subtitle: `Iteracao ${iteration}`
      });
      const uploaded = await uploadReadyCreative({
        organizationId: run.organizationId,
        clientId: run.clientId,
        fileName,
        mimeType: 'image/svg+xml',
        dataUrl
      });

      return {
        id: uuidv4(),
        type: 'image',
        title: `${taskLabel} - Hero ${iteration}`,
        storageUrl: uploaded.storageUrl,
        publicUrl: uploaded.publicUrl || null,
        campaignId: creativeTask.campaignId,
        channel: creativeTask.channel
      };
    } catch (_error) {
      return {
        id: uuidv4(),
        type: 'image',
        title: `${taskLabel} - Hero ${iteration}`,
        storageUrl: fallbackStorageUrl,
        publicUrl: null,
        campaignId: creativeTask.campaignId,
        channel: creativeTask.channel
      };
    }
  }

  buildExecutionTasksFromPlan(run, plan) {
    const now = new Date().toISOString();
    const campaigns = Array.isArray(plan?.campaigns) ? plan.campaigns : [];
    const channels = Array.isArray(plan?.channels) ? plan.channels : [];

    const creativeAndQaTasks = campaigns.flatMap((campaign) => ([
      {
        id: uuidv4(),
        type: 'creative',
        campaignId: campaign.id || null,
        campaignName: campaign.name || campaign.channel || 'campanha',
        channel: campaign.channel || null,
        title: `Criar ativos - ${campaign.name || campaign.channel || 'campanha'}`,
        status: 'pending',
        loopCount: 0,
        output: null,
        priorityAt: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: uuidv4(),
        type: 'qa',
        campaignId: campaign.id || null,
        campaignName: campaign.name || campaign.channel || 'campanha',
        channel: campaign.channel || null,
        title: `QA - ${campaign.name || campaign.channel || 'campanha'}`,
        status: 'pending',
        loopCount: 0,
        result: null,
        priorityAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]));

    const publishTasks = channels.map((channel) => ({
      id: uuidv4(),
      type: 'publish',
      campaignId: null,
      campaignName: null,
      channel,
      title: `Publicar no canal ${channel}`,
      status: 'pending',
      loopCount: 0,
      result: null,
      priorityAt: now,
      createdAt: now,
      updatedAt: now
    }));

    return this.annotateTasksWithAgents(run, [...creativeAndQaTasks, ...publishTasks]);
  }

  applyTaskPatch(tasks, predicate, patch) {
    const now = new Date().toISOString();
    return (Array.isArray(tasks) ? tasks : []).map((task) => {
      if (!predicate(task)) return task;
      return {
        ...task,
        ...patch,
        updatedAt: now
      };
    });
  }

  getTasksByType(tasks, type) {
    return (Array.isArray(tasks) ? tasks : []).filter((task) => task.type === type);
  }

  findNextTask(tasks, type) {
    const candidates = this.getTasksByType(tasks, type)
      .filter(
        (task) =>
          task.status !== 'completed' &&
          task.status !== 'failed' &&
          task.status !== 'needs_manual_intervention'
      )
      .map((task, index) => ({
        task,
        index,
        score: new Date(task.priorityAt || task.updatedAt || task.createdAt || 0).getTime()
      }));

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => right.score - left.score || left.index - right.index);
    return candidates[0].task;
  }

  findTaskByCampaign(tasks, type, campaignId, channel = null) {
    return (Array.isArray(tasks) ? tasks : []).find((task) => {
      if (task.type !== type) return false;
      if (campaignId && task.campaignId !== campaignId) return false;
      if (channel && task.channel !== channel) return false;
      return task.status !== 'failed' && task.status !== 'needs_manual_intervention';
    }) || null;
  }


  async createRun(input) {
    const run = this.store.createRun(input);

    const llmConfig = await this.store.resolveLlmConfig(run.organizationId, run.llmConfigId);
    if (!llmConfig) {
      this.store.updateRun(
        run.id,
        {
          status: 'failed',
          stage: 'validation_failed'
        },
        {
          event: 'run.validation_failed',
          detail: 'Nenhuma configuracao de LLM valida para a organizacao.'
        }
      );
      throw new Error('No valid LLM config found for organization.');
    }

    const clientContext = await this.store.getClientContext(run.organizationId, run.clientId);
    const basePatch = {
      llmSnapshot: {
        id: llmConfig.id,
        provider: llmConfig.provider,
        model: llmConfig.model,
        tokenReference: llmConfig.tokenReference,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        fallbackModel: llmConfig.fallbackModel
      },
      contextSnapshot: clientContext || null
    };

    if (run.mode === 'conversational') {
      const initialIdea = (run.idea || '').trim();

      this.store.updateRun(
        run.id,
        {
          ...basePatch,
          status: 'planning',
          stage: 'planning'
        },
        {
          event: 'run.conversation_started',
          detail: `Config LLM selecionada: ${llmConfig.provider}/${llmConfig.model}`
        }
      );

      if (initialIdea) {
        this.store.addRunMessage(run.id, {
          role: 'user',
          phase: 'briefing',
          content: initialIdea
        });
      }

      const introMessage = 'Pedido recebido. Vou montar o plano automaticamente com base no texto e nos links enviados.';
      this.store.addRunMessage(run.id, {
        role: 'assistant',
        phase: 'briefing',
        content: introMessage
      });

      if (initialIdea) {
        await this.ingestLinksIntoRun(run.id, initialIdea, 'briefing');
      }

      const runForPlan = this.store.getRun(run.id);
      const planDraftRaw = await this.buildPlanFromConversation(runForPlan || run);
      const planDraft = this.annotatePlanWithAgents(runForPlan || run, planDraftRaw);

      this.store.updateRun(
        run.id,
        {
          stage: 'awaiting_plan_approval',
          status: 'awaiting_plan_approval',
          planDraft,
          campaignName: this.resolvePlanName(planDraft, runForPlan?.campaignName || run.campaignName),
          objective: runForPlan?.objective || run.objective,
          budget: runForPlan?.budget || run.budget || planDraft.budget,
          channels: this.normalizePlanChannels(planDraft.channels)
        },
        {
          event: 'planning.generated',
          detail: `Plano (${planDraft?.source || 'fallback_rules'}) gerado e aguardando aprovacao do usuario.`
        }
      );

      this.store.addRunMessage(run.id, {
        role: 'assistant',
        phase: 'planning',
        content: this.summarizePlan(planDraft)
      });

      return this.store.getRun(run.id);
    }

    this.store.updateRun(
      run.id,
      {
        ...basePatch,
        status: 'queued',
        stage: 'planning'
      },
      {
        event: 'run.queued',
        detail: `Config LLM selecionada: ${llmConfig.provider}/${llmConfig.model}`
      }
    );

    await this.queue.enqueue('planning', { runId: run.id });
    return this.store.getRun(run.id);
  }

  async handleRunMessage(runId, payload) {
    const run = this.store.getRun(runId) || await this.store.getRunById(runId);
    if (!run) {
      throw new Error('Run not found.');
    }

    if (run.mode !== 'conversational') {
      throw new Error('Run is not in conversational mode.');
    }

    if (TERMINAL_STATUSES.has(run.status)) {
      throw new Error(`Run already finalized with status ${run.status}.`);
    }

    const content = (payload.content || '').trim();
    if (!content) {
      throw new Error('Message content is required.');
    }

    this.store.addRunMessage(runId, {
      role: 'user',
      phase: run.stage || 'briefing',
      content
    });

    await this.ingestLinksIntoRun(runId, content, run.stage || 'briefing');

    const updatedRun = this.store.getRun(runId);
    if (!updatedRun) {
      throw new Error('Run unavailable after message append.');
    }

    if (updatedRun.stage === 'awaiting_plan_approval') {
      const normalized = content.toLowerCase();
      const approveIntent =
        normalized.includes('aprovar') ||
        normalized.includes('aprovado') ||
        normalized.includes('pode seguir') ||
        normalized.includes('pode publicar') ||
        normalized.includes('pode subir') ||
        normalized.includes('approve');

      if (approveIntent) {
        return this.decidePlanApproval(runId, {
          action: 'approve',
          feedback: content
        });
      }

      this.store.updateRun(
        runId,
        {
          stage: 'planning',
          status: 'planning'
        },
        {
          event: 'planning.adjustment_requested',
          detail: 'Usuario enviou ajuste por mensagem; regenerando plano.'
        }
      );

      const revisedRun = this.store.getRun(runId);
      const revisedPlanRaw = await this.buildPlanFromConversation(revisedRun || updatedRun);
      const revisedPlan = this.annotatePlanWithAgents(revisedRun || updatedRun, revisedPlanRaw);
      this.store.updateRun(
        runId,
        {
          stage: 'awaiting_plan_approval',
          status: 'awaiting_plan_approval',
          planDraft: revisedPlan,
          campaignName: this.resolvePlanName(revisedPlan, revisedRun?.campaignName || updatedRun.campaignName),
          objective: revisedRun?.objective || updatedRun.objective,
          budget: revisedRun?.budget || updatedRun.budget || revisedPlan.budget,
          channels: this.normalizePlanChannels(revisedPlan.channels)
        },
        {
          event: 'planning.generated',
          detail: `Plano (${revisedPlan?.source || 'fallback_rules'}) atualizado apos ajuste via chat.`
        }
      );

      this.store.addRunMessage(runId, {
        role: 'assistant',
        phase: 'planning',
        content: this.summarizePlan(revisedPlan)
      });

      return this.store.getRun(runId);
    }

    if (updatedRun.stage === 'awaiting_final_approval') {
      const normalized = content.toLowerCase();
      const approveIntent =
        normalized.includes('aprovar') ||
        normalized.includes('aprovado') ||
        normalized.includes('pode publicar') ||
        normalized.includes('pode subir') ||
        normalized.includes('publicar') ||
        normalized.includes('approve');

      if (approveIntent) {
        return this.decideFinalApproval(runId, {
          action: 'approve',
          feedback: content
        });
      }

      const reviseIntent =
        normalized.includes('ajust') ||
        normalized.includes('refin') ||
        normalized.includes('revis') ||
        normalized.includes('refazer') ||
        normalized.includes('mudar') ||
        normalized.includes('trocar');

      if (reviseIntent) {
        return this.decideFinalApproval(runId, {
          action: 'revise',
          feedback: content
        });
      }

      this.store.addRunMessage(runId, {
        role: 'assistant',
        phase: 'qa_review',
        content: 'Para seguir, responda "aprovar publicacao" ou envie os ajustes desejados para refino final.'
      });

      return this.store.getRun(runId);
    }

    if (!['briefing', 'planning'].includes(updatedRun.stage)) {
      const genericReply = 'Mensagem registrada no contexto do run.';
      this.store.addRunMessage(runId, {
        role: 'assistant',
        phase: updatedRun.stage || 'general',
        content: genericReply
      });
      return this.store.getRun(runId);
    }

    this.store.updateRun(
      runId,
      {
        stage: 'planning',
        status: 'planning'
      },
      {
        event: 'briefing.updated',
        detail: 'Nova mensagem recebida para refinamento do planejamento.'
      }
    );

    const runForPlan = this.store.getRun(runId);
    const planDraftRaw = await this.buildPlanFromConversation(runForPlan || updatedRun);
    const planDraft = this.annotatePlanWithAgents(runForPlan || updatedRun, planDraftRaw);
    this.store.updateRun(
      runId,
      {
        stage: 'awaiting_plan_approval',
        status: 'awaiting_plan_approval',
        planDraft,
        campaignName: this.resolvePlanName(planDraft, runForPlan?.campaignName || updatedRun.campaignName),
        objective: runForPlan?.objective || updatedRun.objective,
        budget: runForPlan?.budget || updatedRun.budget || planDraft.budget,
        channels: this.normalizePlanChannels(planDraft.channels)
      },
      {
        event: 'planning.generated',
        detail: `Plano (${planDraft?.source || 'fallback_rules'}) gerado e aguardando aprovacao do usuario.`
      }
    );

    this.store.addRunMessage(runId, {
      role: 'assistant',
      phase: 'planning',
      content: this.summarizePlan(planDraft)
    });

    return this.store.getRun(runId);
  }

  async decidePlanApproval(runId, decision) {
    const run = this.store.getRun(runId) || await this.store.getRunById(runId);
    if (!run) {
      throw new Error('Run not found.');
    }

    if (run.mode !== 'conversational') {
      throw new Error('Run is not in conversational mode.');
    }

    if (!run.planDraft) {
      throw new Error('No plan draft available for approval.');
    }

    if (decision.action === 'revise') {
      const feedback = (decision.feedback || '').trim();
      if (feedback) {
        this.store.addRunMessage(runId, {
          role: 'user',
          phase: 'planning',
          content: `Pedido de revisao: ${feedback}`
        });
      }

      this.store.updateRun(
        runId,
        {
          stage: 'briefing',
          status: 'briefing'
        },
        {
          event: 'planning.revision_requested',
          detail: feedback || 'Usuario pediu revisao de planejamento.'
        }
      );

      this.store.addRunMessage(runId, {
        role: 'assistant',
        phase: 'briefing',
        content: 'Entendido. Ajuste solicitado recebido. Me envie detalhes adicionais para recalcular o plano.'
      });

      return this.store.getRun(runId);
    }

    const approvedPlan = this.annotatePlanWithAgents(run, run.planDraft);
    const executionTasks = this.buildExecutionTasksFromPlan(run, approvedPlan);
    this.store.updateRun(
      runId,
      {
        stage: 'executing',
        status: 'executing',
        approvedPlan,
        campaignName: this.resolvePlanName(approvedPlan, run.campaignName),
        channels: this.normalizePlanChannels(approvedPlan.channels),
        budget: approvedPlan.budget || run.budget || null,
        objective: run.objective || approvedPlan.objective || 'Leads',
        qaLoopCount: 0,
        executionTasks
      },
      {
        event: 'planning.approved',
        detail: 'Plano aprovado. Execucao automatica iniciada.'
      }
    );

    await this.queue.enqueue('creative', { runId });
    return this.store.getRun(runId);
  }

  async patchRunPlanDraft(runId, patch) {
    const run = this.store.getRun(runId) || await this.store.getRunById(runId);
    if (!run) {
      throw new Error('Run not found.');
    }

    if (run.mode !== 'conversational') {
      throw new Error('Manual plan editing is available only for conversational runs.');
    }

    const currentPlan = run.planDraft && typeof run.planDraft === 'object'
      ? run.planDraft
      : null;

    if (!currentPlan) {
      throw new Error('No plan draft available for editing.');
    }

    const nextPlan = {
      ...currentPlan
    };

    if (typeof patch.planName === 'string' && patch.planName.trim().length > 0) {
      nextPlan.planName = patch.planName.trim();
    }

    if (typeof patch.summary === 'string' && patch.summary.trim().length > 0) {
      nextPlan.summary = patch.summary.trim();
    }

    if (patch.budget && typeof patch.budget === 'object') {
      nextPlan.budget = {
        ...nextPlan.budget,
        ...patch.budget
      };
    }

    if (Array.isArray(patch.campaigns)) {
      nextPlan.campaigns = patch.campaigns;
    }

    if (Array.isArray(patch.channels)) {
      nextPlan.channels = this.normalizePlanChannels(patch.channels);
    }

    const annotatedPlan = this.annotatePlanWithAgents(run, nextPlan);
    const nextPlanName = typeof annotatedPlan.planName === 'string' && annotatedPlan.planName.trim().length > 0
      ? annotatedPlan.planName.trim()
      : run.campaignName;

    this.store.updateRun(
      runId,
      {
        planDraft: annotatedPlan,
        campaignName: nextPlanName,
        budget: annotatedPlan.budget || run.budget || null,
        channels: this.normalizePlanChannels(annotatedPlan.channels || run.channels),
        stage: 'awaiting_plan_approval',
        status: 'awaiting_plan_approval'
      },
      {
        event: 'planning.manual_patch',
        detail: 'Usuario aplicou ajustes manuais no planejamento.'
      }
    );

    this.store.addRunMessage(runId, {
      role: 'assistant',
      phase: 'planning',
      content: 'Ajustes manuais aplicados no plano. Revise a hierarquia e aprove quando estiver pronto.'
    });

    return this.store.getRun(runId);
  }

  computeNextScheduleRun(schedule, fromDate = new Date()) {
    const base = new Date(fromDate);
    if (schedule.cadence === 'weekly') {
      base.setDate(base.getDate() + 7);
      return base.toISOString();
    }

    base.setMonth(base.getMonth() + 1);
    if (schedule.dayOfMonth) {
      base.setDate(Math.min(schedule.dayOfMonth, 28));
    }
    return base.toISOString();
  }

  async triggerDueSchedules() {
    const dueSchedules = this.store.listDueSchedules(new Date());
    const createdRuns = [];

    for (const schedule of dueSchedules) {
      const template = schedule.payloadTemplate || {};
      const runInput = {
        organizationId: schedule.organizationId,
        clientId: schedule.clientId,
        campaignName: template.campaignName || `Plano recorrente ${schedule.id.slice(0, 8)}`,
        objective: template.objective || 'Leads',
        budget: template.budget || { amount: 1000, currency: 'BRL' },
        channels: template.channels || ['meta', 'google'],
        allowAutoRefine: template.allowAutoRefine !== false,
        llmConfigId: template.llmConfigId || null,
        publicationConfig: template.publicationConfig || null,
        readyCreatives: Array.isArray(template.readyCreatives) ? template.readyCreatives : [],
        mode: template.mode === 'conversational' ? 'conversational' : 'legacy',
        idea: template.idea || null
      };

      const run = await this.createRun(runInput);
      createdRuns.push(run);

      const scheduleMode = String(template.scheduleMode || '').trim().toLowerCase();
      if (scheduleMode === 'one_time' || scheduleMode === 'one-time' || scheduleMode === 'single') {
        await this.store.updateSchedule(schedule.id, {
          isActive: false,
          nextRunAt: null
        });
      } else {
        await this.store.updateSchedule(schedule.id, {
          nextRunAt: this.computeNextScheduleRun(schedule, new Date())
        });
      }
    }

    return createdRuns;
  }

  async handlePlanning(runId) {
    const run = this.store.getRun(runId);
    if (!run) return;

    if (run.mode === 'conversational') {
      if (!run.approvedPlan) {
        const planDraftRaw = await this.buildPlanFromConversation(run);
        const planDraft = this.annotatePlanWithAgents(run, planDraftRaw);
        this.store.updateRun(
          runId,
          {
            status: 'awaiting_plan_approval',
            stage: 'awaiting_plan_approval',
            planDraft,
            campaignName: this.resolvePlanName(planDraft, run.campaignName)
          },
          {
            event: 'planning.generated',
            detail: `Plano (${planDraft?.source || 'fallback_rules'}) gerado e aguardando aprovacao.`
          }
        );
        this.store.addRunMessage(runId, {
          role: 'assistant',
          phase: 'planning',
          content: this.summarizePlan(planDraft)
        });
        return;
      }

      this.store.updateRun(
        runId,
        {
          status: 'executing',
          stage: 'executing',
          blueprint: {
            strategyId: uuidv4(),
            objective: run.objective,
            mediaPlan: {
              channels: this.normalizePlanChannels(run.approvedPlan.channels || run.channels),
              budget: run.approvedPlan.budget || run.budget,
              cadence: run.approvedPlan?.schedule?.cadence || 'weekly'
            },
            approvedPlan: run.approvedPlan
          }
        },
        {
          event: 'planning.completed',
          detail: 'Execucao iniciada a partir do plano aprovado.'
        }
      );

      await this.queue.enqueue('creative', { runId });
      return;
    }

    this.store.updateRun(
      runId,
      {
        status: 'running',
        stage: 'planning',
        blueprint: {
          strategyId: uuidv4(),
          objective: run.objective,
          audience: {
            summary: 'Publico baseado em sinais de historico e intencao de compra.',
            geo: 'Brasil',
            ageRange: '24-55'
          },
          mediaPlan: {
            channels: run.channels,
            budget: run.budget,
            cadence: 'always-on + bursts semanais'
          }
        }
      },
      {
        event: 'planning.completed',
        detail: 'Planejamento concluido pelo squad.'
      }
    );

    await this.queue.enqueue('creative', { runId });
  }

  async handleCreative(runId, refineReason) {
    const run = this.store.getRun(runId);
    if (!run) return;

    const currentTasks = this.annotateTasksWithAgents(run, Array.isArray(run.executionTasks) ? run.executionTasks : []);
    const creativeTask = this.findNextTask(currentTasks, 'creative');

    if (!creativeTask) {
      const pendingQa = this.findNextTask(currentTasks, 'qa');
      if (pendingQa) {
        await this.queue.enqueue('qa', { runId });
      }
      return;
    }

    const now = new Date().toISOString();
    const iteration = (creativeTask.loopCount || 0) + 1;
    const creativeBatchId = uuidv4();
    const hasProvidedCreatives = Array.isArray(run.readyCreatives) && run.readyCreatives.length > 0;
    const useProvidedCreatives = hasProvidedCreatives && !refineReason && iteration === 1;
    const taskLabel = creativeTask.title || `${run.campaignName} - ${String(creativeTask.channel || 'creative').toUpperCase()}`;

    const assets = useProvidedCreatives
      ? run.readyCreatives.map((creative) => ({
          id: uuidv4(),
          type: creative.type,
          title: creative.title,
          content: creative.content || null,
          storageUrl: creative.storageUrl || null,
          publicUrl: creative.publicUrl || null,
          fileName: creative.fileName || null,
          mimeType: creative.mimeType || null,
          source: 'user-provided',
          campaignId: creativeTask.campaignId,
          channel: creativeTask.channel
        }))
      : [
          await this.buildGeneratedImageAsset({
            run,
            creativeTask,
            iteration,
            taskLabel
          }),
          {
            id: uuidv4(),
            type: 'video-script',
            title: `${taskLabel} - Roteiro video ${iteration}`,
            content: 'Abertura de dor -> prova social -> CTA direto para oferta.',
            campaignId: creativeTask.campaignId,
            channel: creativeTask.channel
          },
          {
            id: uuidv4(),
            type: 'copy',
            title: `${taskLabel} - Copy principal ${iteration}`,
            content: 'Descubra como escalar seus resultados com menos desperdicio e mais previsibilidade.',
            campaignId: creativeTask.campaignId,
            channel: creativeTask.channel
          }
        ];
    const assetsWithAgents = this.annotateAssetsWithAgents(run, assets);

    const creativeBatch = {
      id: creativeBatchId,
      taskId: creativeTask.id,
      campaignId: creativeTask.campaignId,
      channel: creativeTask.channel,
      taskTitle: taskLabel,
      iteration,
      generatedAt: now,
      llm: {
        provider: run.llmSnapshot?.provider,
        model: run.llmSnapshot?.model
      },
      assets: assetsWithAgents,
      refineReason: refineReason || null
    };

    const updatedTasks = currentTasks.map((task) => {
      if (task.id === creativeTask.id) {
        return {
          ...task,
          status: 'completed',
          output: creativeBatch,
          completedAt: now,
          priorityAt: now,
          updatedAt: now
        };
      }

      if (task.type === 'qa' && task.campaignId === creativeTask.campaignId) {
        return {
          ...task,
          status: 'pending',
          result: null,
          priorityAt: now,
          updatedAt: now
        };
      }

      return task;
    });

    const updatedTasksWithAgents = this.annotateTasksWithAgents(run, updatedTasks);
    const remainingCreative = updatedTasksWithAgents.some((task) => task.type === 'creative' && task.status !== 'completed' && task.status !== 'failed');
    const nextStage = remainingCreative ? 'executing' : 'qa_review';
    const nextStatus = remainingCreative ? 'executing' : 'qa_review';

    this.store.updateRun(
      runId,
      {
        stage: nextStage,
        status: nextStatus,
        creativeBatch,
        refinementCount: (run.refinementCount || 0) + 1,
        executionTasks: updatedTasksWithAgents
      },
      {
        event: 'creative.completed',
        detail: remainingCreative
          ? `Criativo da tarefa ${taskLabel} concluído. Próxima tarefa criativa em fila.`
          : `Criativo da tarefa ${taskLabel} concluído. Indo para QA.`
      }
    );

    if (remainingCreative) {
      await this.queue.enqueue('creative', { runId });
      return;
    }

    await this.queue.enqueue('qa', { runId });
  }


  async handleQa(runId) {
    const run = this.store.getRun(runId);
    if (!run || run.mode !== 'conversational') return;

    const currentTasks = this.annotateTasksWithAgents(run, Array.isArray(run.executionTasks) ? run.executionTasks : []);
    const qaTask = this.findNextTask(currentTasks, 'qa');

    if (!qaTask) {
      if (run.stage === 'awaiting_final_approval' || run.status === 'awaiting_approval') {
        return;
      }
      const pendingPublish = this.findNextTask(currentTasks, 'publish');
      if (pendingPublish) {
        await this.queue.enqueue('publish', { runId });
      }
      return;
    }

    const relatedCreativeTask =
      this.findTaskByCampaign(currentTasks, 'creative', qaTask.campaignId, qaTask.channel) ||
      this.findTaskByCampaign(currentTasks, 'creative', qaTask.campaignId, null) ||
      this.findTaskByCampaign(currentTasks, 'creative', null, qaTask.channel);

    const creativeOutput = relatedCreativeTask?.output || null;
    const hasAssets = Array.isArray(creativeOutput?.assets) && creativeOutput.assets.length > 0;
    const now = new Date().toISOString();
    const nextLoops = (qaTask.loopCount || 0) + 1;

    if (!hasAssets) {
      if (nextLoops > 2) {
        const failedTasks = currentTasks.map((task) => {
          if (task.id === qaTask.id || (relatedCreativeTask && task.id === relatedCreativeTask.id)) {
            return {
              ...task,
              status: 'needs_manual_intervention',
              result: {
                reason: 'QA exceeded max loops'
              },
              loopCount: nextLoops,
              priorityAt: now,
              updatedAt: now
            };
          }
          return task;
        });

        this.store.updateRun(
          runId,
          {
            status: 'needs_manual_intervention',
            stage: 'needs_manual_intervention',
            qaLoopCount: nextLoops,
            executionTasks: this.annotateTasksWithAgents(run, failedTasks)
          },
          {
            event: 'qa.max_loops_reached',
            detail: `QA excedeu limite de retrabalho na tarefa ${qaTask.title || qaTask.id}.`
          }
        );
        return;
      }

      const retryTasks = currentTasks.map((task) => {
        if (task.id === qaTask.id) {
          return {
            ...task,
            status: 'pending',
            result: null,
            loopCount: nextLoops,
            priorityAt: now,
            updatedAt: now
          };
        }

        if (relatedCreativeTask && task.id === relatedCreativeTask.id) {
          return {
            ...task,
            status: 'pending',
            output: task.output || null,
            loopCount: nextLoops,
            priorityAt: now,
            updatedAt: now
          };
        }

        return task;
      });

      this.store.updateRun(
        runId,
        {
          status: 'executing',
          stage: 'executing',
          qaLoopCount: Math.max(run.qaLoopCount || 0, nextLoops),
          creativeBatch: creativeOutput || run.creativeBatch,
          executionTasks: this.annotateTasksWithAgents(run, retryTasks)
        },
        {
          event: 'qa.rework_requested',
          detail: `QA reprovou a tarefa ${qaTask.title || qaTask.id} e solicitou nova iteracao.`
        }
      );

      await this.queue.enqueue('creative', {
        runId,
        refineReason: `QA interno solicitou ajuste da tarefa ${qaTask.title || qaTask.id}.`
      });
      return;
    }

    const approvedTasks = currentTasks.map((task) => {
      if (task.id === qaTask.id) {
        return {
          ...task,
          status: 'completed',
          result: {
            approvedAt: now,
            creativeTaskId: relatedCreativeTask?.id || null,
            assetCount: creativeOutput.assets.length
          },
          completedAt: now,
          priorityAt: now,
          updatedAt: now
        };
      }

      return task;
    });

    const approvedTasksWithAgents = this.annotateTasksWithAgents(run, approvedTasks);
    const remainingQa = approvedTasksWithAgents.some((task) => task.type === 'qa' && task.status !== 'completed' && task.status !== 'failed');

    if (!remainingQa) {
      this.store.updateRun(
        runId,
        {
          status: 'awaiting_approval',
          stage: 'awaiting_final_approval',
          creativeBatch: creativeOutput || run.creativeBatch,
          executionTasks: approvedTasksWithAgents
        },
        {
          event: 'qa.final_ready',
          detail: `QA aprovado para ${qaTask.title || qaTask.id}. Aguardando confirmacao final do usuario para publicar.`
        }
      );

      this.store.addRunMessage(runId, {
        role: 'assistant',
        phase: 'qa_review',
        content: 'QA final concluido. Revise planejamento, criativos e orcamento e confirme a publicacao final.'
      });
      return;
    }

    this.store.updateRun(
      runId,
      {
        status: 'qa_review',
        stage: 'qa_review',
        creativeBatch: creativeOutput || run.creativeBatch,
        executionTasks: approvedTasksWithAgents
      },
      {
        event: 'qa.approved',
        detail: `QA aprovado para ${qaTask.title || qaTask.id}. Proxima tarefa de QA em fila.`
      }
    );

    await this.queue.enqueue('qa', { runId });
  }


  async handlePublish(runId) {
    const run = this.store.getRun(runId);
    if (!run) return;

    const currentTasks = this.annotateTasksWithAgents(run, Array.isArray(run.executionTasks) ? run.executionTasks : []);
    const publishTasks = this.getTasksByType(currentTasks, 'publish').filter((task) =>
      run.channels.includes(task.channel) &&
      task.status !== 'completed' &&
      task.status !== 'needs_manual_intervention'
    );

    this.store.updateRun(
      runId,
      {
        stage: 'publishing',
        status: 'publishing',
        executionTasks: [...currentTasks]
      },
      {
        event: 'publishing.started',
        detail: 'Publicacao em canais iniciada.'
      }
    );

    const supabase = getSupabaseClient();
    const results = [];
    const failures = [];
    let workingRun = this.store.getRun(runId) || run;

    for (const task of publishTasks) {
      const channel = task.channel;
      const startedAt = new Date().toISOString();

      const tasksInProgress = this.applyTaskPatch(
          this.annotateTasksWithAgents(workingRun, Array.isArray(workingRun.executionTasks) ? workingRun.executionTasks : []),
        (candidate) => candidate.id === task.id,
        {
          status: 'in_progress',
          startedAt,
          updatedAt: startedAt,
          priorityAt: startedAt
        }
      );

      this.store.updateRun(runId, { executionTasks: tasksInProgress });
      workingRun = this.store.getRun(runId) || workingRun;

      try {
        const channelResult = await publishChannel({
          channel,
          run: workingRun,
          supabase,
          appDashboardUrl: process.env.APP_DASHBOARD_URL || 'http://localhost:3000/dashboard/campaign-squad'
        });
        results.push(channelResult);

        const completedAt = new Date().toISOString();
        const tasksCompleted = this.applyTaskPatch(
          this.annotateTasksWithAgents(
            this.store.getRun(runId) || workingRun,
            Array.isArray((this.store.getRun(runId) || workingRun).executionTasks)
              ? (this.store.getRun(runId) || workingRun).executionTasks
              : []
          ),
          (candidate) => candidate.id === task.id,
          {
            status: 'completed',
            result: {
              success: true,
              channel,
              externalIds: channelResult.externalIds || null
            },
            externalIds: channelResult.externalIds || null,
            completedAt,
            updatedAt: completedAt
          }
        );

        this.store.updateRun(runId, { executionTasks: tasksCompleted });
        workingRun = this.store.getRun(runId) || workingRun;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown publish error';
        failures.push({
          channel,
          success: false,
          reason: message
        });

        const failedAt = new Date().toISOString();
        const tasksFailed = this.applyTaskPatch(
          this.annotateTasksWithAgents(
            this.store.getRun(runId) || workingRun,
            Array.isArray((this.store.getRun(runId) || workingRun).executionTasks)
              ? (this.store.getRun(runId) || workingRun).executionTasks
              : []
          ),
          (candidate) => candidate.id === task.id,
          {
            status: 'failed',
            result: {
              success: false,
              channel,
              reason: message
            },
            error: message,
            completedAt: failedAt,
            updatedAt: failedAt
          }
        );

        this.store.updateRun(runId, { executionTasks: tasksFailed });
        workingRun = this.store.getRun(runId) || workingRun;

        if (this.queue?.enqueueDlq) {
          await this.queue.enqueueDlq({
            runId,
            jobName: `publish:${channel}`,
            payload: { runId, channel },
            reason: message
          });
        }
      }
    }

    const now = new Date().toISOString();
    const publishResult = {
      publishedAt: now,
      channels: [...results, ...failures]
    };

    if (failures.length > 0) {
      this.store.updateRun(
        runId,
        {
          stage: 'failed',
          status: 'failed',
          publishResult,
          executionTasks: this.annotateTasksWithAgents(
            this.store.getRun(runId) || workingRun,
            (this.store.getRun(runId) || workingRun).executionTasks
          )
        },
        {
          event: 'publishing.failed',
          detail: `Falha em ${failures.length} canal(is). Verificar DLQ.`
        }
      );
      return;
    }

    this.store.updateRun(
      runId,
      {
        stage: 'completed',
        status: 'completed',
        publishResult,
        executionTasks: this.annotateTasksWithAgents(
          this.store.getRun(runId) || workingRun,
          (this.store.getRun(runId) || workingRun).executionTasks
        )
      },
      {
        event: 'publishing.completed',
        detail: 'Campanha publicada com sucesso.'
      }
    );
  }

  async decideApproval(approvalId, decision) {
    const approval = this.store.getApproval(approvalId);
    if (!approval) {
      throw new Error('Approval not found.');
    }

    const run = this.store.getRun(approval.runId);
    if (!run) {
      throw new Error('Run not found for approval.');
    }

    if (run.mode === 'conversational') {
      throw new Error('Use /runs/:runId/plan-approval for conversational runs.');
    }

    if (approval.status !== 'pending') {
      throw new Error('Approval already decided.');
    }

    const decidedAt = new Date().toISOString();

    if (decision.action === 'approve') {
      this.store.updateApproval(approvalId, {
        status: 'approved',
        feedback: decision.feedback || null,
        decidedAt
      });

      this.store.updateRun(
        run.id,
        {
          stage: 'publishing',
          status: 'publishing'
        },
        {
          event: 'approval.approved',
          detail: 'Usuario aprovou pecas e configuracao de midia.'
        }
      );

      await this.queue.enqueue('publish', { runId: run.id });
      return this.store.getRun(run.id);
    }

    this.store.updateApproval(approvalId, {
      status: 'rejected',
      feedback: decision.feedback || null,
      decidedAt
    });

    if (run.allowAutoRefine && run.refinementCount < 1) {
      this.store.updateRun(
        run.id,
        {
          stage: 'refining',
          status: 'running',
          refinementCount: run.refinementCount + 1
        },
        {
          event: 'approval.rejected',
          detail: 'Rejeitado. Rodada automatica de refacao iniciada.'
        }
      );

      await this.queue.enqueue('creative', {
        runId: run.id,
        refineReason: decision.feedback || 'Feedback nao informado'
      });

      return this.store.getRun(run.id);
    }

    this.store.updateRun(
      run.id,
      {
        stage: 'needs_manual_restart',
        status: 'rejected'
      },
      {
        event: 'approval.rejected_final',
        detail: 'Rejeitado apos politica de refacao automatica.'
      }
    );

    return this.store.getRun(run.id);
  }

  async decideFinalApproval(runId, decision) {
    const run = this.store.getRun(runId) || await this.store.getRunById(runId);
    if (!run) {
      throw new Error('Run not found.');
    }

    if (run.mode !== 'conversational') {
      throw new Error('Final approval is available only for conversational runs.');
    }

    if (run.stage !== 'awaiting_final_approval') {
      throw new Error(`Run is not awaiting final approval (current stage: ${run.stage}).`);
    }

    const feedback = (decision.feedback || '').trim();

    if (decision.action === 'approve') {
      this.store.updateRun(
        runId,
        {
          stage: 'publishing',
          status: 'publishing'
        },
        {
          event: 'final_approval.approved',
          detail: feedback || 'Usuario aprovou publicacao final.'
        }
      );

      await this.queue.enqueue('publish', { runId });
      return this.store.getRun(runId);
    }

    const now = new Date().toISOString();
    const tasks = this.annotateTasksWithAgents(run, Array.isArray(run.executionTasks) ? run.executionTasks : []);
    const creativeCandidates = tasks
      .filter((task) => task.type === 'creative' && task.status === 'completed')
      .sort((left, right) => {
        const leftTs = new Date(left.updatedAt || left.completedAt || left.createdAt || 0).getTime();
        const rightTs = new Date(right.updatedAt || right.completedAt || right.createdAt || 0).getTime();
        return rightTs - leftTs;
      });

    const selectedCreativeTask = creativeCandidates[0] || null;
    const selectedQaTask = selectedCreativeTask
      ? tasks.find((task) => task.type === 'qa' && task.campaignId === selectedCreativeTask.campaignId) || null
      : null;

    const updatedTasks = tasks.map((task) => {
      if (selectedCreativeTask && task.id === selectedCreativeTask.id) {
        return {
          ...task,
          status: 'pending',
          loopCount: (task.loopCount || 0) + 1,
          priorityAt: now,
          updatedAt: now
        };
      }

      if (selectedQaTask && task.id === selectedQaTask.id) {
        return {
          ...task,
          status: 'pending',
          result: null,
          loopCount: (task.loopCount || 0) + 1,
          priorityAt: now,
          updatedAt: now
        };
      }

      return task;
    });

    this.store.updateRun(
      runId,
      {
        stage: 'executing',
        status: 'executing',
        executionTasks: this.annotateTasksWithAgents(run, updatedTasks)
      },
      {
        event: 'final_approval.revision_requested',
        detail: feedback || 'Usuario solicitou refinamento final antes de publicar.'
      }
    );

    this.store.addRunMessage(runId, {
      role: 'assistant',
      phase: 'qa_review',
      content: 'Refino final solicitado. Vou ajustar os criativos e retornar para sua confirmacao antes da publicacao.'
    });

    await this.queue.enqueue('creative', {
      runId,
      refineReason: feedback || 'Refino solicitado na aprovacao final.'
    });

    return this.store.getRun(runId);
  }
}

module.exports = {
  WorkflowEngine
};
