const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');

const OPENAI_API_BASE = (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  channel: z.enum(['meta', 'google']),
  name: z.string().min(2),
  objective: z.string().min(2),
  creativesPlanned: z.number().int().positive(),
  startDate: z.string().min(8)
});

const planSchema = z.object({
  generatedAt: z.string().optional(),
  summary: z.string().min(8),
  channels: z.array(z.enum(['meta', 'google'])).min(1),
  budget: z.object({
    amount: z.number().positive(),
    currency: z.string().min(3)
  }),
  schedule: z.object({
    startDate: z.string().min(8),
    cadence: z.string().min(3),
    durationDays: z.number().int().positive()
  }),
  campaigns: z.array(campaignSchema).min(1),
  qaPolicy: z.object({
    maxLoopsPerTask: z.number().int().min(1).max(2)
  }).optional(),
  contextUsed: z.any().optional()
});

function resolveTokenReference(tokenReference) {
  if (!tokenReference || typeof tokenReference !== 'string') return null;
  if (tokenReference.startsWith('env:')) {
    const key = tokenReference.slice(4).trim();
    return key ? process.env[key] || null : null;
  }
  return tokenReference.trim() || null;
}

function truncateText(raw, max = 1800) {
  if (!raw || typeof raw !== 'string') return '';
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}...`;
}

function toBriefContext(run) {
  const context = run?.contextSnapshot || null;
  const conversation = Array.isArray(run?.messages)
    ? run.messages.map((message) => ({
        role: message.role,
        phase: message.phase,
        content: truncateText(message.content, 1800)
      }))
    : [];

  const websiteSources = conversation
    .filter((message) => message.phase === 'context_ingestion')
    .slice(-3)
    .map((message) => ({
      role: message.role,
      content: truncateText(message.content, 2200)
    }));

  return {
    idea: run?.idea || null,
    objectiveHint: run?.objective || null,
    budgetHint: run?.budget || null,
    channelsHint: Array.isArray(run?.channels) ? run.channels : [],
    conversation,
    websiteSources,
    clientContext: context
      ? {
          company_overview: context.companyOverview || '',
          products_services: context.productsServices || '',
          target_audience: context.targetAudience || '',
          value_props: context.valueProps || '',
          brand_voice: context.brandVoice || '',
          constraints: context.constraints || '',
          offers: context.offers || '',
          notes: context.notes || ''
        }
      : null
  };
}

function normalizePlan(raw, run) {
  const parsed = planSchema.parse(raw);
  const generatedAt = parsed.generatedAt || new Date().toISOString();
  const channels = Array.from(new Set(parsed.channels));

  return {
    ...parsed,
    source: 'llm_openai',
    generatedAt,
    channels,
    campaigns: parsed.campaigns.map((campaign) => ({
      ...campaign,
      id: campaign.id || uuidv4()
    })),
    qaPolicy: parsed.qaPolicy || { maxLoopsPerTask: 2 },
    contextUsed: parsed.contextUsed ?? (run?.contextSnapshot || null)
  };
}

async function requestOpenAiPlan({ token, model, temperature, contextPayload }) {
  const systemPrompt = [
    'Voce e um planejador de campanha de trafego pago.',
    'Responda SOMENTE JSON valido.',
    'Monte um plano completo com campanhas, canais, cronograma, orcamento e QA policy.',
    'Use no maximo 2 loops de QA por tarefa.',
    'Quando houver websiteSources/context_ingestion, trate esses dados como fonte primaria para nicho, oferta, publico e linguagem.'
  ].join(' ');

  const userPrompt = JSON.stringify({
    task: 'Gerar plano estruturado de campanha',
    schema: {
      summary: 'string',
      channels: ['meta|google'],
      budget: { amount: 'number', currency: 'string' },
      schedule: { startDate: 'YYYY-MM-DD', cadence: 'weekly|monthly|custom', durationDays: 'number' },
      campaigns: [
        {
          id: 'uuid opcional',
          channel: 'meta|google',
          name: 'string',
          objective: 'string',
          creativesPlanned: 'number',
          startDate: 'YYYY-MM-DD'
        }
      ],
      qaPolicy: { maxLoopsPerTask: '1..2' },
      contextUsed: 'objeto opcional'
    },
    input: contextPayload
  });

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: Number.isFinite(temperature) ? temperature : 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  const payload = await response.json().catch(async () => ({
    error: { message: await response.text() }
  }));

  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI planning call failed (${response.status})`;
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI planning response is empty.');
  }

  return JSON.parse(content);
}

async function generateStructuredPlan({ run }) {
  const provider = String(run?.llmSnapshot?.provider || '').toLowerCase();
  if (provider !== 'openai') return null;

  const token = resolveTokenReference(run?.llmSnapshot?.tokenReference);
  if (!token) return null;

  const model = run?.llmSnapshot?.model || 'gpt-5.4-mini';
  const temperature = run?.llmSnapshot?.temperature ?? 0.3;
  const contextPayload = toBriefContext(run);

  const rawPlan = await requestOpenAiPlan({
    token,
    model,
    temperature,
    contextPayload
  });

  return normalizePlan(rawPlan, run);
}

module.exports = {
  generateStructuredPlan
};
