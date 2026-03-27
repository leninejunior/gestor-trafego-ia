const { v4: uuidv4 } = require('uuid');

class SquadStore {
  constructor() {
    this.runs = new Map();
    this.schedules = new Map();
    this.llmConfigs = new Map();
    this.approvals = new Map();
    this.clientContexts = new Map();
    this.supabase = null;

    try {
      const { getSupabaseClient } = require('./supabase');
      this.supabase = getSupabaseClient();
    } catch (_error) {
      this.supabase = null;
    }

    // Config default por organização para facilitar o bootstrap.
    const defaultConfigId = uuidv4();
    this.llmConfigs.set(defaultConfigId, {
      id: defaultConfigId,
      organizationId: 'default',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      tokenReference: 'env:OPENAI_API_KEY',
      agentRole: 'default',
      temperature: 0.3,
      maxTokens: 4000,
      fallbackModel: 'gpt-5.4-mini',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  db() {
    if (!this.supabase) return null;
    return this.supabase.schema('campaign_squad');
  }

  toLegacyCompatibleStatus(status) {
    if (['queued', 'running', 'awaiting_approval', 'publishing', 'completed', 'rejected', 'failed'].includes(status)) {
      return status;
    }
    if (status === 'awaiting_plan_approval') return 'awaiting_approval';
    if (status === 'needs_manual_intervention') return 'failed';
    return 'running';
  }

  createRun(input) {
    const now = new Date().toISOString();
    const id = uuidv4();
    const mode = input.mode === 'conversational' ? 'conversational' : 'legacy';
    const normalizedCampaignName = (input.campaignName || '').trim() || 'Run conversacional';
    const normalizedObjective = (input.objective || '').trim() || 'Leads';
    const isConversational = mode === 'conversational';
    const initialStatus = isConversational ? 'briefing' : 'queued';
    const initialStage = isConversational ? 'briefing' : 'queued';
    const run = {
      id,
      organizationId: input.organizationId,
      clientId: input.clientId,
      mode,
      idea: input.idea || input.initialMessage || null,
      campaignName: normalizedCampaignName,
      objective: normalizedObjective,
      budget: input.budget || null,
      channels: Array.isArray(input.channels) ? input.channels : ['meta'],
      publicationConfig: input.publicationConfig || null,
      readyCreatives: Array.isArray(input.readyCreatives) ? input.readyCreatives : [],
      status: initialStatus,
      stage: initialStage,
      allowAutoRefine: input.allowAutoRefine !== false,
      refinementCount: 0,
      qaLoopCount: 0,
      llmConfigId: input.llmConfigId || null,
      llmSnapshot: null,
      blueprint: null,
      planDraft: null,
      approvedPlan: null,
      contextSnapshot: null,
      executionTasks: [],
      messages: [],
      creativeBatch: null,
      approvalId: null,
      publishResult: null,
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          at: now,
          event: 'run.created',
          detail: isConversational
            ? 'Run conversacional criado em modo briefing.'
            : 'Run legado criado e enviado para fila.'
        }
      ]
    };

    this.runs.set(id, run);

    if (this.db()) {
      const baseInsert = {
        id,
        organization_id: input.organizationId,
        client_id: input.clientId,
        campaign_name: normalizedCampaignName,
        objective: normalizedObjective,
        status: this.toLegacyCompatibleStatus(initialStatus),
        stage: initialStage,
        allow_auto_refine: input.allowAutoRefine !== false,
        refinement_count: 0,
        timeline: run.timeline
      };

      const extendedInsert = {
        ...baseInsert,
        mode,
        idea_text: run.idea,
        plan_draft: run.planDraft,
        approved_plan: run.approvedPlan,
        qa_loop_count: 0,
        context_snapshot: run.contextSnapshot,
        execution_tasks: run.executionTasks
      };

      (async () => {
        const primary = await this.db()
          .from('campaign_runs')
          .insert(extendedInsert);
        if (!primary.error) return;
        await this.db()
          .from('campaign_runs')
          .insert(baseInsert);
      })().catch(() => undefined);
    }

    return run;
  }

  getRun(id) {
    return this.runs.get(id) || null;
  }

  updateRun(id, patch, timelineEvent) {
    const current = this.getRun(id);
    if (!current) return null;

    const now = new Date().toISOString();
    const merged = {
      ...current,
      ...patch,
      updatedAt: now,
      timeline: [...current.timeline]
    };

    if (timelineEvent) {
      merged.timeline.push({ at: now, ...timelineEvent });
    }

    this.runs.set(id, merged);

    if (this.db()) {
      const baseUpdate = {
        status: this.toLegacyCompatibleStatus(merged.status),
        stage: merged.stage,
        refinement_count: merged.refinementCount,
        llm_config_snapshot: merged.llmSnapshot,
        blueprint: merged.blueprint,
        creative_batch: merged.creativeBatch,
        publish_result: merged.publishResult,
        timeline: merged.timeline,
        updated_at: now
      };

      const extendedUpdate = {
        ...baseUpdate,
        qa_loop_count: merged.qaLoopCount,
        plan_draft: merged.planDraft,
        approved_plan: merged.approvedPlan,
        context_snapshot: merged.contextSnapshot,
        execution_tasks: merged.executionTasks
      };

      (async () => {
        const primary = await this.db()
          .from('campaign_runs')
          .update(extendedUpdate)
          .eq('id', id);
        if (!primary.error) return;
        await this.db()
          .from('campaign_runs')
          .update(baseUpdate)
          .eq('id', id);
      })().catch(() => undefined);
    }

    return merged;
  }

  mapDbRunToApiModel(item, approvalId = null) {
    const publishChannels = Array.isArray(item?.publish_result?.channels)
      ? item.publish_result.channels.map((channel) => channel?.channel).filter(Boolean)
      : [];
    const blueprintChannels = Array.isArray(item?.blueprint?.mediaPlan?.channels)
      ? item.blueprint.mediaPlan.channels.filter(Boolean)
      : [];
    const approvedPlanChannels = Array.isArray(item?.approved_plan?.channels)
      ? item.approved_plan.channels.filter(Boolean)
      : [];
    const channels = [...new Set([...publishChannels, ...blueprintChannels, ...approvedPlanChannels])];

    return {
      id: item.id,
      organizationId: item.organization_id,
      clientId: item.client_id,
      mode: item.mode || 'legacy',
      idea: item.idea_text || null,
      campaignName: item.campaign_name,
      objective: item.objective || 'Leads',
      budget: item?.blueprint?.mediaPlan?.budget || item?.approved_plan?.budget || null,
      channels,
      publicationConfig: null,
      readyCreatives: [],
      status: item.status,
      stage: item.stage,
      allowAutoRefine: item.allow_auto_refine !== false,
      refinementCount: item.refinement_count || 0,
      qaLoopCount: item.qa_loop_count || 0,
      llmConfigId: null,
      llmSnapshot: item.llm_config_snapshot || null,
      blueprint: item.blueprint || null,
      planDraft: item.plan_draft || null,
      approvedPlan: item.approved_plan || null,
      contextSnapshot: item.context_snapshot || null,
      executionTasks: Array.isArray(item.execution_tasks) ? item.execution_tasks : [],
      messages: [],
      creativeBatch: item.creative_batch || null,
      approvalId,
      publishResult: item.publish_result || null,
      timeline: Array.isArray(item.timeline) ? item.timeline : [],
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
  }

  async listRuns(filters = {}) {
    const limit = Number.isFinite(filters.limit) && filters.limit > 0
      ? Math.min(Math.floor(filters.limit), 200)
      : 50;

    const values = Array.from(this.runs.values());
    const filteredMemory = values
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.clientId || item.clientId === filters.clientId)
      .filter((item) => !filters.status || item.status === filters.status);

    if (!this.db()) {
      return filteredMemory
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, limit);
    }

    const applyRunFilters = (query) => {
      if (filters.organizationId) {
        query.eq('organization_id', filters.organizationId);
      }
      if (filters.clientId) {
        query.eq('client_id', filters.clientId);
      }
      if (filters.status) {
        query.eq('status', filters.status);
      }
      return query;
    };

    let queryResult = await applyRunFilters(
      this.db()
        .from('campaign_runs')
        .select('id, organization_id, client_id, campaign_name, objective, status, stage, allow_auto_refine, refinement_count, qa_loop_count, mode, idea_text, llm_config_snapshot, blueprint, plan_draft, approved_plan, context_snapshot, execution_tasks, creative_batch, publish_result, timeline, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(limit)
    );

    if (queryResult.error) {
      queryResult = await applyRunFilters(
        this.db()
          .from('campaign_runs')
          .select('id, organization_id, client_id, campaign_name, objective, status, stage, allow_auto_refine, refinement_count, llm_config_snapshot, blueprint, creative_batch, publish_result, timeline, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(limit)
      );
    }

    const { data, error } = queryResult;
    if (error || !Array.isArray(data)) {
      return filteredMemory
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, limit);
    }

    const runIds = data.map((item) => item.id);
    const approvalByRunId = {};

    if (runIds.length > 0) {
      const { data: approvals } = await this.db()
        .from('approval_requests')
        .select('id, run_id, status, created_at')
        .in('run_id', runIds)
        .order('created_at', { ascending: false });

      if (Array.isArray(approvals)) {
        approvals.forEach((approval) => {
          if (approvalByRunId[approval.run_id]) return;
          approvalByRunId[approval.run_id] = approval.status === 'pending' ? approval.id : null;
        });
      }
    }

    const dbRuns = data.map((item) => this.mapDbRunToApiModel(item, approvalByRunId[item.id] || null));

    const dedup = new Map();
    [...dbRuns, ...filteredMemory].forEach((item) => {
      const current = dedup.get(item.id);
      if (!current) {
        dedup.set(item.id, item);
        return;
      }
      const nextTime = new Date(item.updatedAt || 0).getTime();
      const currentTime = new Date(current.updatedAt || 0).getTime();
      if (nextTime >= currentTime) {
        dedup.set(item.id, item);
      }
    });

    return Array.from(dedup.values())
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);
  }

  async getRunById(id) {
    const inMemory = this.runs.get(id);
    if (inMemory) return inMemory;

    if (!this.db()) return null;

    let queryResult = await this.db()
      .from('campaign_runs')
      .select('id, organization_id, client_id, campaign_name, objective, status, stage, allow_auto_refine, refinement_count, qa_loop_count, mode, idea_text, llm_config_snapshot, blueprint, plan_draft, approved_plan, context_snapshot, execution_tasks, creative_batch, publish_result, timeline, created_at, updated_at')
      .eq('id', id)
      .single();

    if (queryResult.error) {
      queryResult = await this.db()
        .from('campaign_runs')
        .select('id, organization_id, client_id, campaign_name, objective, status, stage, allow_auto_refine, refinement_count, llm_config_snapshot, blueprint, creative_batch, publish_result, timeline, created_at, updated_at')
        .eq('id', id)
        .single();
    }

    const { data, error } = queryResult;

    if (error || !data) return null;

    let approvalId = null;
    const { data: approvals } = await this.db()
      .from('approval_requests')
      .select('id, run_id, batch_id, status, feedback, decided_at, created_at, updated_at')
      .eq('run_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (Array.isArray(approvals) && approvals.length > 0) {
      const latestApproval = approvals[0];
      if (latestApproval.status === 'pending') {
        approvalId = latestApproval.id;
      }

      this.approvals.set(latestApproval.id, {
        id: latestApproval.id,
        runId: latestApproval.run_id,
        creativeBatchId: latestApproval.batch_id,
        status: latestApproval.status,
        summary: null,
        feedback: latestApproval.feedback || null,
        createdAt: latestApproval.created_at,
        decidedAt: latestApproval.decided_at || null,
        updatedAt: latestApproval.updated_at || latestApproval.created_at
      });
    }

    const mapped = this.mapDbRunToApiModel(data, approvalId);
    mapped.messages = await this.listRunMessages(id);
    this.runs.set(id, mapped);
    return mapped;
  }

  createSchedule(input) {
    const id = uuidv4();
    const now = new Date().toISOString();

    const schedule = {
      id,
      organizationId: input.organizationId,
      clientId: input.clientId,
      cadence: input.cadence,
      timezone: input.timezone || 'America/Sao_Paulo',
      dayOfMonth: input.dayOfMonth || 1,
      hour: input.hour || 9,
      minute: input.minute || 0,
      payloadTemplate: input.payloadTemplate,
      isActive: input.isActive !== false,
      nextRunAt: input.nextRunAt || null,
      createdAt: now,
      updatedAt: now
    };

    this.schedules.set(id, schedule);

    if (this.db()) {
      this.db()
        .from('campaign_schedules')
        .insert({
          id,
          organization_id: input.organizationId,
          client_id: input.clientId,
          cadence: input.cadence,
          timezone: schedule.timezone,
          day_of_month: schedule.dayOfMonth,
          hour: schedule.hour,
          minute: schedule.minute,
          next_run_at: schedule.nextRunAt,
          payload_template: schedule.payloadTemplate,
          is_active: schedule.isActive
        })
        .then(() => undefined)
        .catch(() => undefined);
    }

    return schedule;
  }

  async listSchedules(organizationId) {
    const values = Array.from(this.schedules.values());
    const filteredMemory = organizationId
      ? values.filter((item) => item.organizationId === organizationId)
      : values;

    if (!this.db()) {
      return filteredMemory;
    }

    const query = this.db()
      .from('campaign_schedules')
      .select('id, organization_id, client_id, cadence, timezone, day_of_month, hour, minute, next_run_at, payload_template, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return filteredMemory;
    }

    const dbMapped = data.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      clientId: item.client_id,
      cadence: item.cadence,
      timezone: item.timezone,
      dayOfMonth: item.day_of_month,
      hour: item.hour,
      minute: item.minute,
      nextRunAt: item.next_run_at,
      payloadTemplate: item.payload_template || {},
      isActive: item.is_active !== false,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    const dedup = new Map();
    [...dbMapped, ...filteredMemory].forEach((item) => {
      dedup.set(item.id, item);
    });

    return Array.from(dedup.values()).sort((a, b) => {
      const left = new Date(b.createdAt || 0).getTime();
      const right = new Date(a.createdAt || 0).getTime();
      return left - right;
    });
  }

  async getSchedule(id) {
    const inMemory = this.schedules.get(id);
    if (inMemory) return inMemory;

    if (!this.db()) return null;

    const { data, error } = await this.db()
      .from('campaign_schedules')
      .select('id, organization_id, client_id, cadence, timezone, day_of_month, hour, minute, next_run_at, payload_template, is_active, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const mapped = {
      id: data.id,
      organizationId: data.organization_id,
      clientId: data.client_id,
      cadence: data.cadence,
      timezone: data.timezone,
      dayOfMonth: data.day_of_month,
      hour: data.hour,
      minute: data.minute,
      nextRunAt: data.next_run_at,
      payloadTemplate: data.payload_template || {},
      isActive: data.is_active !== false,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    this.schedules.set(id, mapped);
    return mapped;
  }

  listDueSchedules(nowDate = new Date()) {
    const nowMs = nowDate.getTime();
    return Array.from(this.schedules.values()).filter((schedule) => {
      if (!schedule.isActive) return false;
      if (!schedule.nextRunAt) return false;
      const nextMs = new Date(schedule.nextRunAt).getTime();
      if (Number.isNaN(nextMs)) return false;
      return nextMs <= nowMs;
    });
  }

  async updateSchedule(id, patch) {
    const current = await this.getSchedule(id);
    if (!current) return null;
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.schedules.set(id, updated);

    if (this.db()) {
      this.db()
        .from('campaign_schedules')
        .update({
          next_run_at: updated.nextRunAt,
          payload_template: updated.payloadTemplate,
          is_active: updated.isActive,
          updated_at: updated.updatedAt
        })
        .eq('id', id)
        .then(() => undefined)
        .catch(() => undefined);
    }

    return updated;
  }

  createApproval(runId, creativeBatchId, summary) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const approval = {
      id,
      runId,
      creativeBatchId,
      status: 'pending',
      summary,
      feedback: null,
      createdAt: now,
      decidedAt: null,
      updatedAt: now
    };

    this.approvals.set(id, approval);

    if (this.db()) {
      this.db()
        .from('creative_batches')
        .insert({
          id: creativeBatchId,
          run_id: runId,
          iteration: summary?.iteration || 1,
          summary: summary || {}
        })
        .then(() => undefined)
        .catch(() => undefined);

      this.db()
        .from('approval_requests')
        .insert({
          id,
          run_id: runId,
          batch_id: creativeBatchId,
          status: 'pending',
          feedback: null
        })
        .then(() => undefined)
        .catch(() => undefined);
    }

    return approval;
  }

  getApproval(id) {
    return this.approvals.get(id) || null;
  }

  updateApproval(id, patch) {
    const current = this.getApproval(id);
    if (!current) return null;

    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.approvals.set(id, updated);

    if (this.db()) {
      this.db()
        .from('approval_requests')
        .update({
          status: updated.status,
          feedback: updated.feedback,
          decided_at: updated.decidedAt,
          updated_at: updated.updatedAt
        })
        .eq('id', id)
        .then(() => undefined)
        .catch(() => undefined);
    }

    return updated;
  }

  async listLlmConfigs(organizationId) {
    const values = Array.from(this.llmConfigs.values());
    const filteredMemory = organizationId
      ? values.filter((item) => item.organizationId === organizationId)
      : values;

    if (!this.db()) {
      return filteredMemory;
    }

    const query = this.db()
      .from('squad_llm_configs')
      .select('id, organization_id, provider, model, token_reference, agent_role, temperature, max_tokens, fallback_model, created_at, updated_at')
      .eq('is_active', true);

    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return filteredMemory;
    }

    const dbMapped = data.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      provider: item.provider,
      model: item.model,
      tokenReference: item.token_reference,
      agentRole: item.agent_role || 'default',
      temperature: item.temperature ?? 0.3,
      maxTokens: item.max_tokens ?? 4000,
      fallbackModel: item.fallback_model || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    const dedup = new Map();
    [...dbMapped, ...filteredMemory].forEach((item) => {
      dedup.set(item.id, item);
    });
    return Array.from(dedup.values());
  }

  createLlmConfig(input) {
    const id = uuidv4();
    const now = new Date().toISOString();

    const config = {
      id,
      organizationId: input.organizationId,
      provider: input.provider,
      model: input.model,
      tokenReference: input.tokenReference,
      agentRole: input.agentRole || 'default',
      temperature: input.temperature ?? 0.3,
      maxTokens: input.maxTokens ?? 4000,
      fallbackModel: input.fallbackModel || null,
      createdAt: now,
      updatedAt: now
    };

    this.llmConfigs.set(id, config);

    if (this.db()) {
      this.db()
        .from('squad_llm_configs')
        .insert({
          id,
          organization_id: input.organizationId,
          agent_role: config.agentRole,
          provider: config.provider,
          model: config.model,
          token_reference: config.tokenReference,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          fallback_model: config.fallbackModel,
          is_active: true
        })
        .then(() => undefined)
        .catch(() => undefined);
    }

    return config;
  }

  recordDeadLetter(payload) {
    if (!this.db()) return;
    this.db()
      .from('dead_letter_jobs')
      .insert({
        run_id: payload.runId || null,
        job_name: payload.jobName,
        payload: payload.payload || {},
        reason: payload.reason,
        status: 'open'
      })
      .then(() => undefined)
      .catch(() => undefined);
  }

  recordWhatsappShare(payload) {
    if (!this.db()) return;
    this.db()
      .from('whatsapp_shares')
      .insert({
        run_id: payload.runId,
        phone_number: payload.phone,
        message_preview: payload.preview || null,
        sent: payload.sent === true,
        provider_response: payload.providerResponse || null,
        error_message: payload.errorMessage || null
      })
      .then(() => undefined)
      .catch(() => undefined);
  }

  async listRunMessages(runId) {
    const inMemory = this.getRun(runId);
    if (inMemory && Array.isArray(inMemory.messages) && inMemory.messages.length > 0) {
      return inMemory.messages;
    }

    if (!this.db()) return [];

    const { data, error } = await this.db()
      .from('run_messages')
      .select('id, run_id, role, phase, content, created_at')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });

    if (error || !Array.isArray(data)) return [];

    return data.map((item) => ({
      id: item.id,
      runId: item.run_id,
      role: item.role,
      phase: item.phase || 'general',
      content: item.content,
      createdAt: item.created_at
    }));
  }

  addRunMessage(runId, input) {
    const current = this.getRun(runId);
    if (!current) return null;

    const message = {
      id: uuidv4(),
      runId,
      role: input.role,
      phase: input.phase || 'general',
      content: input.content,
      createdAt: new Date().toISOString()
    };

    const updated = {
      ...current,
      messages: [...(Array.isArray(current.messages) ? current.messages : []), message],
      updatedAt: message.createdAt
    };

    this.runs.set(runId, updated);

    if (this.db()) {
      this.db()
        .from('run_messages')
        .insert({
          id: message.id,
          run_id: runId,
          role: message.role,
          phase: message.phase,
          content: message.content,
          created_at: message.createdAt
        })
        .then(() => undefined)
        .catch(() => undefined);
    }

    return message;
  }

  async getClientContext(organizationId, clientId) {
    if (!organizationId || !clientId) return null;
    const cacheKey = `${organizationId}:${clientId}`;
    const cached = this.clientContexts.get(cacheKey);
    if (cached) return cached;
    if (!this.db()) return null;

    const { data, error } = await this.db()
      .from('client_contexts')
      .select('id, organization_id, client_id, company_overview, products_services, target_audience, value_props, brand_voice, constraints, offers, notes, updated_at')
      .eq('organization_id', organizationId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error || !data) return null;

    const mapped = {
      id: data.id,
      organizationId: data.organization_id,
      clientId: data.client_id,
      companyOverview: data.company_overview || '',
      productsServices: data.products_services || '',
      targetAudience: data.target_audience || '',
      valueProps: data.value_props || '',
      brandVoice: data.brand_voice || '',
      constraints: data.constraints || '',
      offers: data.offers || '',
      notes: data.notes || '',
      updatedAt: data.updated_at || null
    };

    this.clientContexts.set(cacheKey, mapped);
    return mapped;
  }

  async resolveLlmConfig(organizationId, llmConfigId) {
    const allConfigs = await this.listLlmConfigs(organizationId);

    if (llmConfigId) {
      const selected = allConfigs.find((cfg) => cfg.id === llmConfigId);
      if (!selected) return null;
      if (selected.organizationId !== organizationId) return null;
      return selected;
    }

    const byOrg = allConfigs.filter((cfg) => cfg.organizationId === organizationId);
    if (byOrg.length > 0) {
      return byOrg[0];
    }

    const defaults = await this.listLlmConfigs('default');
    return defaults[0] || null;
  }
}

module.exports = {
  SquadStore
};

