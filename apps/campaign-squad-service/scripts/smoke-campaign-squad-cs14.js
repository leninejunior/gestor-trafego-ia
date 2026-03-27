/* eslint-disable no-console */
const path = require('node:path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const ROOT_ENV = path.resolve(__dirname, '../../../.env');
const APP_ENV = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: ROOT_ENV });
dotenv.config({ path: APP_ENV });

const BASE_URL = (process.env.CAMPAIGN_SQUAD_SMOKE_BASE_URL || 'http://localhost:4010').replace(/\/$/, '');
const DASHBOARD_API_URL = (process.env.CAMPAIGN_SQUAD_DASHBOARD_API_URL || 'http://localhost:3000/api/campaign-squad').replace(/\/$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ORGANIZATION_ID = process.env.CAMPAIGN_SQUAD_SMOKE_ORG_ID || '01bdaa04-1873-427f-8caa-b79bc7dd2fa2';
const NO_CONTEXT_CLIENT_ID = process.env.CAMPAIGN_SQUAD_SMOKE_NO_CONTEXT_CLIENT_ID || '0e66b723-033f-429b-ba9e-431a1d13c7fa';
const CONTEXT_CLIENT_ID = process.env.CAMPAIGN_SQUAD_SMOKE_CONTEXT_CLIENT_ID || 'e3ab33da-79f9-45e9-a43f-6ce76ceb9751';
const FAIL_CLIENT_ID = process.env.CAMPAIGN_SQUAD_SMOKE_PUBLISH_FAIL_CLIENT_ID || '50ede587-2de7-43b7-bc19-08f54d66c445';

const SCENARIO = parseScenario(process.argv.slice(2));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function parseScenario(argv) {
  const match = argv.find((arg) => arg.startsWith('--scenario='));
  return (match ? match.split('=')[1] : 'all').trim();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_error) {
      body = { raw: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

async function api(pathname, init = {}) {
  const { ok, status, body } = await httpJson(`${BASE_URL}${pathname}`, init);
  if (!ok) {
    const message = body?.error || body?.message || body?.raw || 'Unknown error';
    throw new Error(`${init.method || 'GET'} ${pathname} failed (${status}): ${message}`);
  }
  return body;
}

async function dashboardApi(pathname) {
  const { ok, status, body } = await httpJson(`${DASHBOARD_API_URL}${pathname}`);
  if (!ok) {
    const message = body?.error || body?.message || body?.raw || 'Unknown dashboard error';
    throw new Error(`Dashboard API ${pathname} failed (${status}): ${message}`);
  }
  return body;
}

function normalizeContextPayload(clientName) {
  return {
    companyOverview: `${clientName} atua em serviços B2B com foco em previsibilidade de leads.`,
    productsServices: 'Planejamento, criativos, tráfego pago e automação de campanhas.',
    targetAudience: 'Donos de negócios, gestores de marketing e times comerciais.',
    valueProps: 'Squad com briefing, planejamento, criativos, QA e publicação.',
    brandVoice: 'Direta, consultiva e orientada a resultado.',
    constraints: 'Evitar promessas irreais e usar linguagem objetiva.',
    offers: 'Diagnóstico inicial e operação recorrente de campanhas.',
    notes: 'Contexto usado pelo smoke CS-14.'
  };
}

async function upsertClientContext(clientId, clientName) {
  const context = normalizeContextPayload(clientName);
  const { error } = await supabase
    .schema('campaign_squad')
    .from('client_contexts')
    .upsert(
      {
        organization_id: ORGANIZATION_ID,
        client_id: clientId,
        company_overview: context.companyOverview,
        products_services: context.productsServices,
        target_audience: context.targetAudience,
        value_props: context.valueProps,
        brand_voice: context.brandVoice,
        constraints: context.constraints,
        offers: context.offers,
        notes: context.notes
      },
      { onConflict: 'organization_id,client_id' }
    );

  if (error) {
    throw new Error(`Failed to upsert client context: ${error.message}`);
  }

  return context;
}

async function deleteClientContext(clientId) {
  const { error } = await supabase
    .schema('campaign_squad')
    .from('client_contexts')
    .delete()
    .eq('organization_id', ORGANIZATION_ID)
    .eq('client_id', clientId);

  if (error) {
    throw new Error(`Failed to delete client context: ${error.message}`);
  }
}

async function getRunFromDb(runId) {
  const { data, error } = await supabase
    .schema('campaign_squad')
    .from('campaign_runs')
    .select('id, organization_id, client_id, status, stage, plan_draft, approved_plan, execution_tasks, publish_result, qa_loop_count, creative_batch, context_snapshot, created_at, updated_at')
    .eq('id', runId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read run ${runId} from DB: ${error.message}`);
  }

  return data;
}

async function insertFixtureRun({ clientId, label }) {
  const runId = uuidv4();
  const now = new Date().toISOString();
  const timeline = [
    { at: now, event: 'run.created', detail: `${label} criado como fixture para smoke.` },
    { at: now, event: 'qa.rework_requested', detail: 'QA reprovou e atingiu limite de loops.' },
    { at: now, event: 'qa.max_loops_reached', detail: 'needs_manual_intervention alcançado.' }
  ];

  const executionTasks = [
    {
      id: uuidv4(),
      type: 'creative',
      channel: 'meta',
      title: 'Fixture creative task',
      status: 'needs_manual_intervention',
      loopCount: 3,
      output: {
        assets: []
      },
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      type: 'qa',
      channel: 'meta',
      title: 'Fixture QA task',
      status: 'needs_manual_intervention',
      loopCount: 3,
      result: {
        reason: 'QA exceeded max loops'
      },
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      type: 'publish',
      channel: 'meta',
      title: 'Fixture publish task',
      status: 'pending',
      createdAt: now,
      updatedAt: now
    }
  ];

  const plan = {
    source: 'fixture',
    generatedAt: now,
    summary: 'Fixture para validar o estado needs_manual_intervention.',
    channels: ['meta'],
    budget: { amount: 2500, currency: 'BRL' },
    schedule: { startDate: now.slice(0, 10), cadence: 'weekly', durationDays: 30 },
    campaigns: [
      {
        id: uuidv4(),
        channel: 'meta',
        name: 'Fixture Meta Campaign',
        objective: 'Leads',
        creativesPlanned: 3,
        startDate: now.slice(0, 10)
      }
    ],
    qaPolicy: { maxLoopsPerTask: 2 },
    contextUsed: null
  };

  const payload = {
    id: runId,
    organization_id: ORGANIZATION_ID,
    client_id: clientId,
    mode: 'conversational',
    idea_text: 'Fixture para CS-14 QA limit',
    campaign_name: 'CS-14 QA Fixture',
    objective: 'Leads',
    status: 'needs_manual_intervention',
    stage: 'needs_manual_intervention',
    allow_auto_refine: true,
    refinement_count: 1,
    qa_loop_count: 3,
    llm_config_snapshot: {
      provider: 'openai',
      model: 'gpt-5.4-mini',
      tokenReference: 'env:OPENAI_API_KEY'
    },
    blueprint: null,
    plan_draft: plan,
    approved_plan: plan,
    context_snapshot: null,
    execution_tasks: executionTasks,
    creative_batch: {
      id: uuidv4(),
      taskId: executionTasks[0].id,
      channel: 'meta',
      taskTitle: 'Fixture creative task',
      iteration: 3,
      generatedAt: now,
      llm: {
        provider: 'openai',
        model: 'gpt-5.4-mini'
      },
      assets: []
    },
    publish_result: null,
    timeline,
    created_at: now,
    updated_at: now
  };

  const { error } = await supabase.schema('campaign_squad').from('campaign_runs').insert(payload);
  if (error) {
    throw new Error(`Failed to insert QA fixture run: ${error.message}`);
  }

  const { error: msgError } = await supabase.schema('campaign_squad').from('run_messages').insert([
    {
      id: uuidv4(),
      run_id: runId,
      role: 'assistant',
      phase: 'qa',
      content: 'Fixture de smoke para validar manual intervention.',
      created_at: now
    }
  ]);

  if (msgError) {
    throw new Error(`Failed to insert QA fixture message: ${msgError.message}`);
  }

  return runId;
}

async function createConversationalRun({ clientId, idea, channels = ['meta'] }) {
  const created = await api('/runs', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: ORGANIZATION_ID,
      clientId,
      mode: 'conversational',
      idea,
      channels
    })
  });

  return created.id;
}

async function waitForRunStatus(runId, predicate, timeoutMs = 60000, intervalMs = 300) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = await api(`/runs/${runId}`);
    if (predicate(run)) return run;
    await delay(intervalMs);
  }
  throw new Error(`Timeout waiting for run ${runId}.`);
}

async function sendRunMessage(runId, content) {
  return api(`/runs/${runId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });
}

async function approvePlan(runId) {
  return api(`/runs/${runId}/plan-approval`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' })
  });
}

async function ensureDashboardSeesRun(runId) {
  const response = await dashboardApi('/runs?limit=50');
  const found = Array.isArray(response?.data) && response.data.some((run) => run.id === runId);
  if (!found) {
    throw new Error(`Dashboard API did not return run ${runId}.`);
  }
  return true;
}

function summarizeRun(run) {
  const tasks = Array.isArray(run.executionTasks) ? run.executionTasks : [];
  const taskSummary = tasks.reduce((acc, task) => {
    const key = `${task.type}:${task.status}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    id: run.id,
    status: run.status,
    stage: run.stage,
    planSource: run.planDraft?.source || 'unknown',
    contextUsed: !!run.planDraft?.contextUsed,
    taskSummary,
    publishChannels: Array.isArray(run.publishResult?.channels) ? run.publishResult.channels.length : 0
  };
}

async function scenarioHappyPathNoContext() {
  console.log('[cs14] scenario: happy path without context');
  await deleteClientContext(NO_CONTEXT_CLIENT_ID);

  const runId = await createConversationalRun({
    clientId: NO_CONTEXT_CLIENT_ID,
    idea: 'Campanha para gerar leads qualificados para consultoria B2B.',
    channels: ['meta']
  });

  await sendRunMessage(runId, 'Quero priorizar WhatsApp e prova social, com orçamento mensal de 3500.');
  const planRun = await waitForRunStatus(runId, (run) => run.status === 'awaiting_plan_approval');
  if (planRun.planDraft?.contextUsed) {
    throw new Error('Expected no client context, but planDraft.contextUsed is present.');
  }

  await approvePlan(runId);
  const terminal = await waitForRunStatus(runId, (run) => ['completed', 'failed'].includes(run.status));
  if (terminal.status !== 'completed') {
    throw new Error(`Happy path without context ended with ${terminal.status}.`);
  }

  await ensureDashboardSeesRun(runId);
  return summarizeRun(terminal);
}

async function scenarioWithContext() {
  console.log('[cs14] scenario: with client context');
  const context = await upsertClientContext(CONTEXT_CLIENT_ID, 'Coan');
  const runId = await createConversationalRun({
    clientId: CONTEXT_CLIENT_ID,
    idea: 'Campanha com contexto do cliente para leads B2B.',
    channels: ['meta']
  });

  await sendRunMessage(runId, 'Usar foco em consultoria recorrente e captacao via Meta.');
  const planRun = await waitForRunStatus(runId, (run) => run.status === 'awaiting_plan_approval');
  if (!planRun.planDraft?.contextUsed) {
    throw new Error('Expected contextUsed in planDraft, but it is missing.');
  }

  await approvePlan(runId);
  const terminal = await waitForRunStatus(runId, (run) => ['completed', 'failed'].includes(run.status));
  if (terminal.status !== 'completed') {
    throw new Error(`Happy path with context ended with ${terminal.status}.`);
  }

  await ensureDashboardSeesRun(runId);
  return {
    ...summarizeRun(terminal),
    contextSeeded: !!context
  };
}

async function scenarioQaLoopLimitFixture() {
  console.log('[cs14] scenario: QA loop limit -> needs_manual_intervention');
  const fixtureRunId = await insertFixtureRun({
    clientId: CONTEXT_CLIENT_ID,
    label: 'QA limit fixture'
  });

  const fixtureFromApi = await waitForRunStatus(
    fixtureRunId,
    (run) => run.status === 'needs_manual_intervention',
    15000,
    200
  );

  if (fixtureFromApi.status !== 'needs_manual_intervention') {
    throw new Error('QA limit fixture did not resolve to needs_manual_intervention.');
  }

  await ensureDashboardSeesRun(fixtureRunId);
  return summarizeRun(fixtureFromApi);
}

async function scenarioPublishFailure() {
  console.log('[cs14] scenario: publish failure recorded');
  await deleteClientContext(FAIL_CLIENT_ID);

  const runId = await createConversationalRun({
    clientId: FAIL_CLIENT_ID,
    idea: 'Teste de falha de publicacao Meta sem conexao vinculada.',
    channels: ['meta']
  });

  await sendRunMessage(runId, 'Usar somente Meta e orçamento baixo.');
  await waitForRunStatus(runId, (run) => run.status === 'awaiting_plan_approval');
  await approvePlan(runId);

  const terminal = await waitForRunStatus(
    runId,
    (run) => ['completed', 'failed'].includes(run.status),
    60000,
    300
  );

  if (terminal.status !== 'failed') {
    throw new Error(`Expected publish failure, but run finished with ${terminal.status}.`);
  }

  const publishFailure = Array.isArray(terminal.publishResult?.channels)
    ? terminal.publishResult.channels.find((channel) => channel.success === false)
    : null;

  if (!publishFailure) {
    throw new Error('Publish failure run did not record a failed channel.');
  }

  await ensureDashboardSeesRun(runId);
  return {
    ...summarizeRun(terminal),
    failureReason: publishFailure.reason || null
  };
}

async function main() {
  console.log('[cs14] health check ...');
  const health = await api('/health');
  console.log('[cs14] health ok:', health.ok === true);

  const scenarios = [
    { name: 'happy_no_context', run: scenarioHappyPathNoContext },
    { name: 'with_context', run: scenarioWithContext },
    { name: 'qa_limit_fixture', run: scenarioQaLoopLimitFixture },
    { name: 'publish_failure', run: scenarioPublishFailure }
  ];

  const selected = SCENARIO === 'all'
    ? scenarios
    : scenarios.filter((scenario) => scenario.name === SCENARIO);

  if (selected.length === 0) {
    throw new Error(`Unknown scenario: ${SCENARIO}`);
  }

  const results = [];
  for (const scenario of selected) {
    const result = await scenario.run();
    results.push({
      scenario: scenario.name,
      ...result
    });
    console.log(`[cs14] ${scenario.name} ok -> ${result.status}`);
  }

  console.log(JSON.stringify({
    ok: true,
    scenario: SCENARIO,
    results
  }, null, 2));
}

main().catch((error) => {
  console.error('[cs14] failed:', error.message);
  process.exit(1);
});
