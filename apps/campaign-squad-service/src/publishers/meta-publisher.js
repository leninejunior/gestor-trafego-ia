const META_GRAPH_BASE = 'https://graph.facebook.com/v22.0';

function sanitizeAccountId(accountId) {
  if (!accountId) return null;
  const cleaned = String(accountId).trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('act_')) return cleaned;
  return `act_${cleaned.replace(/^act_/, '')}`;
}

function mapObjectiveToMeta(objective) {
  const normalized = String(objective || '').toLowerCase();
  if (normalized.includes('lead')) return 'OUTCOME_LEADS';
  if (normalized.includes('venda') || normalized.includes('sale') || normalized.includes('compra')) return 'OUTCOME_SALES';
  if (normalized.includes('traf') || normalized.includes('traffic')) return 'OUTCOME_TRAFFIC';
  return 'OUTCOME_TRAFFIC';
}

function buildTargeting() {
  return {
    geo_locations: {
      countries: ['BR']
    },
    age_min: 24,
    // Meta now requires max age >= 65 when advantage audience automation is enabled.
    age_max: 65,
    targeting_automation: {
      advantage_audience: 1
    }
  };
}

function getCopyContent(run) {
  const copyAsset = run?.creativeBatch?.assets?.find((asset) => asset.type === 'copy');
  if (copyAsset?.content) return copyAsset.content;
  return 'Conheça nossa oferta e acelere seus resultados com previsibilidade.';
}

function getHeadline(run) {
  const copyAsset = run?.creativeBatch?.assets?.find((asset) => asset.type === 'copy');
  if (copyAsset?.title) return copyAsset.title;
  return run?.campaignName || 'Campanha';
}

async function createMetaEntity(path, params) {
  const response = await fetch(`${META_GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params).toString()
  });

  const payload = await response.json().catch(async () => ({
    error: { message: await response.text() }
  }));

  if (!response.ok || payload?.error) {
    const metaError = payload?.error || {};
    const code = metaError.code ? `code=${metaError.code}` : '';
    const subcode = metaError.error_subcode ? `subcode=${metaError.error_subcode}` : '';
    const userTitle = metaError.error_user_title ? String(metaError.error_user_title) : '';
    const userMessage = metaError.error_user_msg ? String(metaError.error_user_msg) : '';
    const baseMessage = metaError.message || `Meta API error (${response.status})`;
    const suffix = [code, subcode].filter(Boolean).join(' ');
    const human = [userTitle, userMessage].filter(Boolean).join(': ');
    const message = [baseMessage, suffix, human].filter(Boolean).join(' | ');
    throw new Error(message);
  }

  return payload;
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const value = String(rawUrl).trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (['localhost', '127.0.0.1'].includes(parsed.hostname)) return null;
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function resolveDestinationUrl(run, appDashboardUrl) {
  const explicit = normalizeUrl(run?.publicationConfig?.meta?.destinationUrl);
  if (explicit) return explicit;

  const envDefault = normalizeUrl(process.env.META_DEFAULT_DESTINATION_URL);
  if (envDefault) return envDefault;

  const dashboard = normalizeUrl(appDashboardUrl);
  if (dashboard) return dashboard;

  return 'https://example.com';
}

async function resolveMetaPageId({ run, accessToken }) {
  const explicitPageId = String(run?.publicationConfig?.meta?.pageId || '').trim();
  if (explicitPageId) return explicitPageId;

  const envPageId = String(process.env.META_DEFAULT_PAGE_ID || '').trim();
  if (envPageId) return envPageId;

  const response = await fetch(
    `${META_GRAPH_BASE}/me/accounts?${new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,tasks',
      limit: '50'
    }).toString()}`
  );

  const payload = await response.json().catch(async () => ({
    error: { message: await response.text() }
  }));

  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || `Meta pages fetch failed (${response.status})`;
    throw new Error(`Meta page id not resolved: ${message}`);
  }

  const pages = Array.isArray(payload?.data) ? payload.data : [];
  if (pages.length === 0) {
    throw new Error('Meta page id not resolved: no pages available for this token.');
  }

  const withAdsTask = pages.find((page) => {
    const tasks = Array.isArray(page?.tasks) ? page.tasks.map((item) => String(item).toUpperCase()) : [];
    return tasks.includes('ADVERTISE') || tasks.includes('MANAGE');
  });

  return String(withAdsTask?.id || pages[0].id || '').trim() || null;
}

async function publishToMeta({ run, supabase, appDashboardUrl }) {
  if (!supabase) {
    throw new Error('Supabase not configured for Meta publisher.');
  }

  const { data: connections, error: connectionError } = await supabase
    .from('client_meta_connections')
    .select('id, ad_account_id, access_token, is_active')
    .eq('client_id', run.clientId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10);

  if (connectionError) {
    throw new Error(`Failed to fetch Meta connection: ${connectionError.message}`);
  }

  const connectionList = Array.isArray(connections) ? connections : [];
  const requestedAdAccountId = sanitizeAccountId(
    run?.publicationConfig?.meta?.adAccountId || run?.publicationConfig?.meta?.accountId
  );

  const connection = requestedAdAccountId
    ? connectionList.find((item) => sanitizeAccountId(item?.ad_account_id) === requestedAdAccountId) || null
    : (connectionList[0] || null);

  if (!connection?.access_token || !connection?.ad_account_id) {
    throw new Error('No active Meta connection with token/ad account for this client.');
  }

  const adAccountId = sanitizeAccountId(connection.ad_account_id);
  if (!adAccountId) {
    throw new Error('Invalid Meta ad account id.');
  }

  const amount = Number(run?.budget?.amount || 0);
  // Interpret run budget as monthly and derive a safer daily budget floor.
  const dailyBudgetCents = Math.max(500, Math.round((amount > 0 ? amount / 30 : 10) * 100));
  const objective = mapObjectiveToMeta(run.objective);
  const pageId = await resolveMetaPageId({ run, accessToken: connection.access_token });
  if (!pageId) {
    throw new Error('Meta page id required to create ad creative and leads promoted object.');
  }

  const campaign = await createMetaEntity(`/${adAccountId}/campaigns`, {
    access_token: connection.access_token,
    name: run.campaignName,
    objective,
    status: 'PAUSED',
    special_ad_categories: '[]',
    is_adset_budget_sharing_enabled: 'false'
  });

  const adsetPayload = {
    access_token: connection.access_token,
    name: `${run.campaignName} - AdSet`,
    campaign_id: campaign.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'LINK_CLICKS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: String(dailyBudgetCents),
    targeting: JSON.stringify(buildTargeting()),
    status: 'PAUSED'
  };
  if (objective === 'OUTCOME_LEADS') {
    adsetPayload.promoted_object = JSON.stringify({ page_id: pageId });
  }
  const adset = await createMetaEntity(`/${adAccountId}/adsets`, adsetPayload);

  const link = resolveDestinationUrl(run, appDashboardUrl);
  const creative = await createMetaEntity(`/${adAccountId}/adcreatives`, {
    access_token: connection.access_token,
    name: `${run.campaignName} - Creative`,
    object_story_spec: JSON.stringify({
      page_id: pageId,
      link_data: {
        link,
        message: getCopyContent(run),
        name: getHeadline(run)
      }
    })
  });

  const ad = await createMetaEntity(`/${adAccountId}/ads`, {
    access_token: connection.access_token,
    name: `${run.campaignName} - Ad`,
    adset_id: adset.id,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: 'PAUSED'
  });

  return {
    channel: 'meta',
    success: true,
    connectionId: connection.id,
    externalIds: {
      campaignId: campaign.id,
      adsetId: adset.id,
      creativeId: creative.id,
      adId: ad.id
    }
  };
}

module.exports = {
  publishToMeta
};
