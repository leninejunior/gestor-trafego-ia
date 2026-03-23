import { createServiceClient } from '@/lib/supabase/server';

type ConnectionRow = {
  id: string;
  client_id: string;
  ad_account_id: string;
  access_token: string;
  account_name: string | null;
};

type CampaignApiRow = {
  id: string;
  name?: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  updated_time?: string;
  start_time?: string;
  stop_time?: string;
};

type InsightAction = {
  action_type?: string;
  value?: string;
};

type InsightApiRow = {
  campaign_id?: string;
  date_start?: string;
  date_stop?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: InsightAction[];
};

export type OpenClawMetaSyncOptions = {
  clientId?: string;
  daysLookback?: number;
  maxConnections?: number;
};

type ConnectionSyncSummary = {
  connectionId: string;
  clientId: string;
  accountId: string;
  accountName: string | null;
  campaignsFromMeta: number;
  campaignsUpserted: number;
  insightsFromMeta: number;
  insightsUpserted: number;
  errors: string[];
};

export type OpenClawMetaSyncResult = {
  ok: boolean;
  clientFilter: string | null;
  lookbackDays: number;
  processedConnections: number;
  totals: {
    campaignsFromMeta: number;
    campaignsUpserted: number;
    insightsFromMeta: number;
    insightsUpserted: number;
  };
  connections: ConnectionSyncSummary[];
  startedAt: string;
  finishedAt: string;
};

function normalizeAdAccountId(accountId: string): string {
  if (accountId.startsWith('act_')) {
    return accountId;
  }

  return `act_${accountId}`;
}

function toNumber(value: string | number | undefined | null, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDateWindow(daysLookback: number): { since: string; until: string } {
  const safeDays = Number.isFinite(daysLookback) && daysLookback > 0 ? Math.floor(daysLookback) : 7;
  const until = new Date();
  const since = new Date();
  since.setUTCDate(until.getUTCDate() - (safeDays - 1));

  return {
    since: toDateOnly(since),
    until: toDateOnly(until)
  };
}

async function fetchGraphJson<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  const payload = await response.json().catch(async () => {
    const text = await response.text();
    throw new Error(`Resposta nao JSON da Meta API: ${text.slice(0, 300)}`);
  });

  if (!response.ok) {
    const err = payload as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erro HTTP ${response.status} na Meta API`);
  }

  return payload as T;
}

async function fetchAllPages<T>(firstUrl: string, maxPages = 20): Promise<T[]> {
  const rows: T[] = [];
  let nextUrl: string | null = firstUrl;
  let page = 0;

  while (nextUrl && page < maxPages) {
    page += 1;
    const payload = await fetchGraphJson<{
      data?: T[];
      paging?: {
        next?: string;
      };
      error?: {
        message?: string;
      };
    }>(nextUrl);

    if (payload.error) {
      throw new Error(payload.error.message ?? 'Erro na Meta API');
    }

    if (Array.isArray(payload.data)) {
      rows.push(...payload.data);
    }

    nextUrl = payload.paging?.next ?? null;
  }

  return rows;
}

function extractConversions(actions: InsightAction[] | undefined): number {
  if (!Array.isArray(actions)) {
    return 0;
  }

  const targetActions = new Set([
    'offsite_conversion.fb_pixel_purchase',
    'omni_purchase',
    'purchase',
    'onsite_conversion.purchase'
  ]);

  return Math.round(
    actions.reduce((total, action) => {
      if (!action || !action.action_type || !targetActions.has(action.action_type)) {
        return total;
      }
      return total + toNumber(action.value, 0);
    }, 0)
  );
}

async function syncConnection(
  connection: ConnectionRow,
  dateWindow: { since: string; until: string }
): Promise<ConnectionSyncSummary> {
  const supabase = createServiceClient();
  const summary: ConnectionSyncSummary = {
    connectionId: connection.id,
    clientId: connection.client_id,
    accountId: connection.ad_account_id,
    accountName: connection.account_name,
    campaignsFromMeta: 0,
    campaignsUpserted: 0,
    insightsFromMeta: 0,
    insightsUpserted: 0,
    errors: []
  };

  const accountId = normalizeAdAccountId(connection.ad_account_id);
  const token = encodeURIComponent(connection.access_token);

  try {
    const campaignFields =
      'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,start_time,stop_time';
    const campaignsUrl = `https://graph.facebook.com/v22.0/${accountId}/campaigns?fields=${campaignFields}&limit=200&access_token=${token}`;
    const campaigns = await fetchAllPages<CampaignApiRow>(campaignsUrl, 30);

    summary.campaignsFromMeta = campaigns.length;

    for (const campaign of campaigns) {
      if (!campaign.id) {
        continue;
      }

      const { error } = await supabase.from('meta_campaigns').upsert(
        {
          connection_id: connection.id,
          external_id: String(campaign.id),
          name: campaign.name?.trim() || `Campanha ${campaign.id}`,
          status: campaign.status || 'UNKNOWN',
          objective: campaign.objective ?? null,
          daily_budget: campaign.daily_budget ? toNumber(campaign.daily_budget) / 100 : null,
          lifetime_budget: campaign.lifetime_budget ? toNumber(campaign.lifetime_budget) / 100 : null,
          created_time: campaign.created_time ?? null,
          updated_time: campaign.updated_time ?? null,
          start_time: campaign.start_time ?? null,
          stop_time: campaign.stop_time ?? null,
          updated_at: new Date().toISOString()
        } as never,
        {
          onConflict: 'connection_id,external_id',
          ignoreDuplicates: false
        }
      );

      if (error) {
        summary.errors.push(`campaign:${campaign.id}:${error.message}`);
        continue;
      }

      summary.campaignsUpserted += 1;
    }

    const { data: dbCampaigns, error: mapError } = await supabase
      .from('meta_campaigns')
      .select('id, external_id')
      .eq('connection_id', connection.id);

    if (mapError) {
      summary.errors.push(`map:${mapError.message}`);
      return summary;
    }

    const campaignIdMap = new Map(
      (Array.isArray(dbCampaigns) ? dbCampaigns : []).map((row: { id: string; external_id: string }) => [
        row.external_id,
        row.id
      ])
    );

    const insightFields = 'campaign_id,date_start,date_stop,impressions,clicks,spend,reach,frequency,cpm,cpc,ctr,actions';
    const timeRange = encodeURIComponent(JSON.stringify(dateWindow));
    const insightsUrl = `https://graph.facebook.com/v22.0/${accountId}/insights?level=campaign&fields=${insightFields}&time_range=${timeRange}&limit=500&access_token=${token}`;
    const insights = await fetchAllPages<InsightApiRow>(insightsUrl, 30);

    summary.insightsFromMeta = insights.length;

    for (const insight of insights) {
      const externalCampaignId = insight.campaign_id ? String(insight.campaign_id) : null;
      if (!externalCampaignId) {
        continue;
      }

      const internalCampaignId = campaignIdMap.get(externalCampaignId);
      if (!internalCampaignId) {
        continue;
      }

      const conversions = extractConversions(insight.actions);
      const clicks = Math.round(toNumber(insight.clicks, 0));
      const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const spend = toNumber(insight.spend, 0);
      const costPerConversion = conversions > 0 ? spend / conversions : 0;

      const { error } = await supabase.from('meta_campaign_insights').upsert(
        {
          campaign_id: internalCampaignId,
          date_start: insight.date_start ?? dateWindow.since,
          date_stop: insight.date_stop ?? dateWindow.until,
          impressions: Math.round(toNumber(insight.impressions, 0)),
          clicks,
          spend,
          reach: Math.round(toNumber(insight.reach, 0)),
          frequency: toNumber(insight.frequency, 0),
          cpm: toNumber(insight.cpm, 0),
          cpc: toNumber(insight.cpc, 0),
          ctr: toNumber(insight.ctr, 0),
          conversions,
          cost_per_conversion: costPerConversion,
          conversion_rate: conversionRate,
          updated_at: new Date().toISOString()
        } as never,
        {
          onConflict: 'campaign_id,date_start,date_stop',
          ignoreDuplicates: false
        }
      );

      if (error) {
        summary.errors.push(`insight:${externalCampaignId}:${error.message}`);
        continue;
      }

      summary.insightsUpserted += 1;
    }
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : 'Erro desconhecido na sincronizacao');
  }

  return summary;
}

export async function syncOpenClawMetaData(options: OpenClawMetaSyncOptions = {}): Promise<OpenClawMetaSyncResult> {
  const startedAt = new Date().toISOString();
  const lookbackDays = Number.isFinite(options.daysLookback) ? Math.max(1, Math.floor(options.daysLookback!)) : 7;
  const maxConnections = Number.isFinite(options.maxConnections) ? Math.max(1, Math.floor(options.maxConnections!)) : 50;
  const dateWindow = getDateWindow(lookbackDays);

  const supabase = createServiceClient();

  let query = supabase
    .from('client_meta_connections')
    .select('id, client_id, ad_account_id, access_token, account_name')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(maxConnections);

  if (options.clientId) {
    query = query.eq('client_id', options.clientId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Falha ao buscar conexoes Meta: ${error.message}`);
  }

  const connections = (Array.isArray(data) ? data : []) as ConnectionRow[];
  const summaries: ConnectionSyncSummary[] = [];

  for (const connection of connections) {
    summaries.push(await syncConnection(connection, dateWindow));
  }

  const totals = summaries.reduce(
    (acc, item) => {
      acc.campaignsFromMeta += item.campaignsFromMeta;
      acc.campaignsUpserted += item.campaignsUpserted;
      acc.insightsFromMeta += item.insightsFromMeta;
      acc.insightsUpserted += item.insightsUpserted;
      return acc;
    },
    {
      campaignsFromMeta: 0,
      campaignsUpserted: 0,
      insightsFromMeta: 0,
      insightsUpserted: 0
    }
  );

  return {
    ok: true,
    clientFilter: options.clientId ?? null,
    lookbackDays,
    processedConnections: summaries.length,
    totals,
    connections: summaries,
    startedAt,
    finishedAt: new Date().toISOString()
  };
}
