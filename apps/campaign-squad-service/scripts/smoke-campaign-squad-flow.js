/* eslint-disable no-console */
const BASE_URL = (process.env.CAMPAIGN_SQUAD_SMOKE_BASE_URL || 'http://localhost:4010').replace(/\/$/, '');
const INTERNAL_SECRET = (process.env.CAMPAIGN_SQUAD_INTERNAL_SECRET || '').trim();
const ORGANIZATION_ID = process.env.CAMPAIGN_SQUAD_SMOKE_ORG_ID || 'default';
const CLIENT_ID = process.env.CAMPAIGN_SQUAD_SMOKE_CLIENT_ID || 'smoke-client';
const WHATSAPP_PHONE = process.env.CAMPAIGN_SQUAD_SMOKE_WHATSAPP_PHONE || '65999999999';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(path, init = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {})
  };

  if (INTERNAL_SECRET) {
    headers['x-campaign-squad-secret'] = INTERNAL_SECRET;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${init.method || 'GET'} ${path} failed (${response.status}): ${payload.error || text}`);
  }

  return payload;
}

async function waitForRunStatus(runId, predicate, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = await api(`/runs/${runId}`);
    if (predicate(run)) return run;
    await delay(1200);
  }
  throw new Error(`Timeout waiting run ${runId} status transition.`);
}

async function main() {
  console.log('[smoke] checking /health ...');
  const health = await api('/health');
  console.log('[smoke] health:', health);

  console.log('[smoke] creating run ...');
  const createdRun = await api('/runs', {
    method: 'POST',
    body: JSON.stringify({
      organizationId: ORGANIZATION_ID,
      clientId: CLIENT_ID,
      campaignName: `Smoke Campaign ${new Date().toISOString()}`,
      objective: 'Leads',
      budget: {
        amount: 500,
        currency: 'BRL'
      },
      channels: ['meta'],
      allowAutoRefine: true
    })
  });

  console.log('[smoke] run created:', createdRun.id);

  const awaitingApproval = await waitForRunStatus(
    createdRun.id,
    (run) => run.status === 'awaiting_approval' && !!run.approvalId
  );
  console.log('[smoke] reached awaiting approval:', awaitingApproval.approvalId);

  console.log('[smoke] approving run ...');
  const approved = await api(`/approvals/${awaitingApproval.approvalId}`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'approve',
      feedback: 'Smoke test approval'
    })
  });
  console.log('[smoke] approval response status:', approved.status);

  const terminal = await waitForRunStatus(
    createdRun.id,
    (run) => ['completed', 'failed', 'rejected'].includes(run.status),
    60000
  );
  console.log('[smoke] terminal status:', terminal.status, 'stage:', terminal.stage);

  console.log('[smoke] sending whatsapp share ...');
  const whatsapp = await api(`/runs/${createdRun.id}/share/whatsapp`, {
    method: 'POST',
    body: JSON.stringify({
      phone: WHATSAPP_PHONE,
      customMessage: `Smoke test run ${createdRun.id}`
    })
  });
  console.log('[smoke] whatsapp sent:', whatsapp?.sentResult?.sent === true);

  console.log('[smoke] done');
}

main().catch((error) => {
  console.error('[smoke] failed:', error.message);
  process.exit(1);
});

