const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { config } = require('dotenv');

config();

const appConfig = require('./config');
const { SquadStore } = require('./store');
const { QueueOrchestrator } = require('./queue');
const { WorkflowEngine } = require('./workflow');
const { uploadReadyCreative } = require('./storage/minio');

const runSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().min(1),
  mode: z.enum(['legacy', 'conversational']).optional(),
  idea: z.string().min(2).max(4000).optional(),
  initialMessage: z.string().min(2).max(4000).optional(),
  campaignName: z.string().min(2).optional(),
  objective: z.string().min(2).optional(),
  budget: z.object({
    amount: z.number().positive(),
    currency: z.string().min(3)
  }).optional(),
  channels: z.array(z.enum(['meta', 'google'])).min(1).optional(),
  allowAutoRefine: z.boolean().optional(),
  llmConfigId: z.string().optional(),
  publicationConfig: z.record(z.any()).optional(),
  readyCreatives: z.array(
    z.object({
      type: z.enum(['image', 'video', 'copy', 'video-script', 'headline', 'primary-text']),
      title: z.string().min(2),
      storageUrl: z.string().min(8).optional(),
      publicUrl: z.string().min(8).optional(),
      content: z.string().min(1).optional(),
      fileName: z.string().optional(),
      mimeType: z.string().optional()
    }).refine((creative) => creative.storageUrl || creative.content, {
      message: 'Each ready creative must include storageUrl or content.'
    })
  ).max(30).optional()
}).superRefine((payload, ctx) => {
  const conversationalRequested =
    payload.mode === 'conversational' ||
    (!!payload.idea && !payload.campaignName) ||
    (!!payload.initialMessage && !payload.campaignName);

  if (conversationalRequested) {
    if (!payload.idea && !payload.initialMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conversational run requires idea or initialMessage.'
      });
    }
    return;
  }

  if (!payload.campaignName || !payload.objective || !payload.budget || !payload.channels) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Legacy run requires campaignName, objective, budget and channels.'
    });
  }
});

const scheduleSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().min(1),
  cadence: z.enum(['monthly', 'weekly']),
  timezone: z.string().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  minute: z.number().int().min(0).max(59).optional(),
  nextRunAt: z.string().datetime().optional(),
  payloadTemplate: z.record(z.any()).default({}),
  isActive: z.boolean().optional()
});

const schedulePatchSchema = z.object({
  isActive: z.boolean().optional(),
  nextRunAt: z.string().datetime().nullable().optional()
}).refine((payload) => payload.isActive !== undefined || payload.nextRunAt !== undefined, {
  message: 'At least one schedule field must be provided.'
});

const approvalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  feedback: z.string().max(2000).optional()
});

const runMessageSchema = z.object({
  content: z.string().min(1).max(4000)
});

const planApprovalSchema = z.object({
  action: z.enum(['approve', 'revise']),
  feedback: z.string().max(2000).optional()
});

const finalApprovalSchema = z.object({
  action: z.enum(['approve', 'revise']),
  feedback: z.string().max(2000).optional()
});

const planDraftPatchSchema = z.object({
  planName: z.string().min(2).max(180).optional(),
  summary: z.string().min(3).max(4000).optional(),
  budget: z.object({
    amount: z.number().positive().optional(),
    currency: z.string().min(3).optional()
  }).optional(),
  channels: z.array(z.enum(['meta', 'google'])).min(1).optional(),
  campaigns: z.array(z.record(z.any())).optional()
}).refine((payload) => (
  payload.planName !== undefined ||
  payload.summary !== undefined ||
  payload.budget !== undefined ||
  payload.channels !== undefined ||
  payload.campaigns !== undefined
), {
  message: 'At least one plan draft field must be provided.'
});

const llmConfigSchema = z.object({
  organizationId: z.string().min(1),
  provider: z.string().min(2),
  model: z.string().min(2),
  tokenReference: z.string().min(3),
  agentRole: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  fallbackModel: z.string().optional()
});

const llmConfigTestSchema = z.object({
  provider: z.string().min(2),
  model: z.string().min(2),
  tokenReference: z.string().min(3)
});

const shareWhatsappSchema = z.object({
  phone: z.string().min(8),
  customMessage: z.string().max(2000).optional()
});

const uploadReadyCreativeSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().min(1).optional(),
  fileName: z.string().min(1).max(180).optional(),
  mimeType: z.string().min(1).max(120).optional(),
  dataUrl: z.string().min(16)
});

const RUN_STATUSES = new Set([
  'briefing',
  'planning',
  'awaiting_plan_approval',
  'executing',
  'qa_review',
  'needs_manual_intervention',
  'queued',
  'running',
  'awaiting_approval',
  'publishing',
  'completed',
  'rejected',
  'failed'
]);

function resolveTokenReference(tokenReference) {
  if (!tokenReference || typeof tokenReference !== 'string') {
    return null;
  }

  if (tokenReference.startsWith('env:')) {
    const envKey = tokenReference.slice(4).trim();
    if (!envKey) return null;
    return process.env[envKey] || null;
  }

  return tokenReference.trim() || null;
}

async function testLlmConfigConnection({ provider, model, tokenReference }) {
  const normalizedProvider = provider.trim().toLowerCase();
  const resolvedToken = resolveTokenReference(tokenReference);

  if (!resolvedToken) {
    return {
      ok: false,
      message: 'Token não encontrado. Se usar env:, confirme a variável no .env do container.'
    };
  }

  if (normalizedProvider !== 'openai') {
    return {
      ok: false,
      message: `Teste automático ainda não implementado para provider "${provider}".`
    };
  }

  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${resolvedToken}`
    }
  });

  if (response.ok) {
    return {
      ok: true,
      message: `Conexão validada com sucesso para ${provider}/${model}.`
    };
  }

  const payload = await response.json().catch(() => null);
  const apiError = payload?.error?.message || `OpenAI API respondeu com status ${response.status}.`;
  return {
    ok: false,
    message: apiError
  };
}

function ensureAuthorized(req, res, next) {
  if (!appConfig.internalSecret) {
    return next();
  }

  const provided = (req.headers['x-campaign-squad-secret'] || '').toString().trim();
  if (provided !== appConfig.internalSecret) {
    return res.status(401).json({ error: 'Unauthorized campaign squad request.' });
  }

  return next();
}

async function sendWhatsappNotification(phone, message) {
  if (!appConfig.evolutionApiUrl || !appConfig.evolutionApiKey || !appConfig.evolutionInstanceName) {
    return {
      sent: false,
      reason: 'Evolution API env vars not configured.'
    };
  }

  const cleanNumber = phone.replace(/\D/g, '');
  const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

  const response = await fetch(
    `${appConfig.evolutionApiUrl}/message/sendText/${appConfig.evolutionInstanceName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: appConfig.evolutionApiKey
      },
      body: JSON.stringify({
        number: fullNumber,
        text: message
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      sent: false,
      reason: `Evolution API failed (${response.status}): ${body}`
    };
  }

  return {
    sent: true,
    response: await response.json()
  };
}

async function bootstrap() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(ensureAuthorized);

  const store = new SquadStore();
  let workflow = null;

  const queue = new QueueOrchestrator({
    redisUrl: appConfig.redisUrl,
    handlers: {
      handlePlanning: async (runId) => workflow.handlePlanning(runId),
      handleCreative: async (runId, refineReason) => workflow.handleCreative(runId, refineReason),
      handleQa: async (runId) => workflow.handleQa(runId),
      handlePublish: async (runId) => workflow.handlePublish(runId),
      onDlq: (payload) => store.recordDeadLetter(payload)
    }
  });

  workflow = new WorkflowEngine({ store, queue });

  await queue.init();

  app.get('/health', async (_req, res) => {
    res.json({
      ok: true,
      service: 'campaign-squad-service',
      queueMode: queue.useInMemory ? 'in-memory' : 'bullmq',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/runs', async (req, res) => {
    try {
      const payload = runSchema.parse(req.body);
      const run = await workflow.createRun(payload);
      res.status(201).json(run);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid run payload' });
    }
  });

  app.get('/runs', async (req, res) => {
    try {
      const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
      const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
      const status = typeof req.query.status === 'string' && RUN_STATUSES.has(req.query.status)
        ? req.query.status
        : undefined;
      const parsedLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 200)
        : 50;

      const runs = await store.listRuns({
        organizationId,
        clientId,
        status,
        limit
      });

      return res.json({ data: runs });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list runs'
      });
    }
  });

  app.get('/runs/:runId', async (req, res) => {
    const run = await store.getRunById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    return res.json(run);
  });

  app.post('/runs/:runId/messages', async (req, res) => {
    try {
      const payload = runMessageSchema.parse(req.body);
      const run = await workflow.handleRunMessage(req.params.runId, payload);
      return res.json(run);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid message payload' });
    }
  });

  app.post('/runs/:runId/plan-approval', async (req, res) => {
    try {
      const payload = planApprovalSchema.parse(req.body);
      const run = await workflow.decidePlanApproval(req.params.runId, payload);
      return res.json(run);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid plan approval payload' });
    }
  });

  app.post('/runs/:runId/final-approval', async (req, res) => {
    try {
      const payload = finalApprovalSchema.parse(req.body);
      const run = await workflow.decideFinalApproval(req.params.runId, payload);
      return res.json(run);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid final approval payload' });
    }
  });

  app.patch('/runs/:runId/plan-draft', async (req, res) => {
    try {
      const payload = planDraftPatchSchema.parse(req.body);
      const run = await workflow.patchRunPlanDraft(req.params.runId, payload);
      return res.json(run);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid plan draft patch payload'
      });
    }
  });

  app.post('/schedules', async (req, res) => {
    try {
      const payload = scheduleSchema.parse(req.body);
      const schedule = store.createSchedule(payload);
      res.status(201).json(schedule);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid schedule payload' });
    }
  });

  app.get('/schedules', async (req, res) => {
    try {
      const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
      const schedules = await store.listSchedules(organizationId);
      return res.json({ data: schedules });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list schedules'
      });
    }
  });

  app.patch('/schedules/:scheduleId', async (req, res) => {
    try {
      const patch = schedulePatchSchema.parse(req.body);
      const updated = await store.updateSchedule(req.params.scheduleId, patch);
      if (!updated) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      return res.json(updated);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid schedule patch payload'
      });
    }
  });

  app.post('/schedules/trigger-due', async (_req, res) => {
    try {
      const runs = await workflow.triggerDueSchedules();
      return res.json({
        triggered: runs.length,
        runs
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to trigger due schedules'
      });
    }
  });

  app.post('/approvals/:approvalId', async (req, res) => {
    try {
      const payload = approvalSchema.parse(req.body);
      const run = await workflow.decideApproval(req.params.approvalId, payload);
      res.json(run);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid approval payload' });
    }
  });

  app.get('/llm-configs', async (req, res) => {
    const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const configs = (await store.listLlmConfigs(organizationId)).map((cfg) => ({
      ...cfg,
      tokenReference: cfg.tokenReference.length > 6
        ? `${cfg.tokenReference.slice(0, 3)}***${cfg.tokenReference.slice(-2)}`
        : '***'
    }));

    res.json({ data: configs });
  });

  app.post('/llm-configs', async (req, res) => {
    try {
      const payload = llmConfigSchema.parse(req.body);
      const created = store.createLlmConfig(payload);
      res.status(201).json({
        ...created,
        tokenReference: created.tokenReference.length > 6
          ? `${created.tokenReference.slice(0, 3)}***${created.tokenReference.slice(-2)}`
          : '***'
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid LLM config payload' });
    }
  });

  app.post('/llm-configs/test', async (req, res) => {
    try {
      const payload = llmConfigTestSchema.parse(req.body);
      const result = await testLlmConfigConnection(payload);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: error instanceof Error ? error.message : 'Invalid LLM test payload'
      });
    }
  });

  app.post('/runs/:runId/share/whatsapp', async (req, res) => {
    const run = await store.getRunById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    try {
      const payload = shareWhatsappSchema.parse(req.body);
      const link = `${appConfig.appDashboardUrl}?runId=${run.id}`;
      const message = payload.customMessage || [
        '*Aprovação de Campanha*',
        `Campanha: ${run.campaignName}`,
        `Status: ${run.status}`,
        `Aprove/reprove no painel: ${link}`
      ].join('\n');

      const sentResult = await sendWhatsappNotification(payload.phone, message);

      store.recordWhatsappShare({
        runId: run.id,
        phone: payload.phone,
        preview: message,
        sent: sentResult.sent,
        providerResponse: sentResult.response || null,
        errorMessage: sentResult.sent ? null : sentResult.reason || 'WhatsApp send failed'
      });

      return res.json({
        runId: run.id,
        sentResult,
        preview: message,
        link
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid WhatsApp payload' });
    }
  });

  app.post('/uploads/ready-creative', async (req, res) => {
    try {
      const payload = uploadReadyCreativeSchema.parse(req.body);
      const uploaded = await uploadReadyCreative(payload);
      return res.status(201).json(uploaded);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid ready creative upload payload'
      });
    }
  });

  app.listen(appConfig.port, () => {
    console.log(`[campaign-squad] service running on port ${appConfig.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('[campaign-squad] bootstrap failed', error);
  process.exit(1);
});

