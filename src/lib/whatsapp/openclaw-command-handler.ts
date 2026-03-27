import { META_CONFIG } from '@/lib/meta/config';
import { createServiceClient } from '@/lib/supabase/server';

type RawPayload = Record<string, unknown>;

type GroupBindingRow = {
  group_id: string;
  client_id: string;
  is_active: boolean;
  can_read: boolean | null;
  can_manage_campaigns: boolean | null;
  allowed_sender_ids: string[] | null;
};

type CampaignRow = {
  id: string;
  name: string | null;
  status: string | null;
  daily_budget: string | null;
  updated_time: string | null;
  connection_id: string;
};

type InsightRow = {
  campaign_id: string;
  impressions: string | number | null;
  clicks: string | number | null;
  spend: string | number | null;
};

type BalanceRow = {
  ad_account_id: string | null;
  ad_account_name: string | null;
  currency: string | null;
  balance: string | number | null;
  daily_spend: string | number | null;
  spend_cap: string | number | null;
  status: string | null;
  last_checked_at: string | null;
};

type ClientBalanceSnapshot = {
  totalAccounts: number;
  totalBalance: number;
  totalDailySpend: number;
  criticalAccounts: number;
  warningAccounts: number;
  healthyAccounts: number;
  currency: string;
  lastCheckedAt: string | null;
  accounts: Array<{
    adAccountId: string;
    adAccountName: string | null;
    currency: string;
    balance: number;
    dailySpend: number;
    spendCap: number;
    status: string;
    lastCheckedAt: string | null;
  }>;
};

type IncomingMessage = {
  groupId: string;
  senderId: string;
  messageId: string | null;
  text: string;
};

type CommandType = 'help' | 'campaign_status' | 'campaign_insights' | 'campaign_pause' | 'campaign_resume' | 'unknown';

type ParsedCommand = {
  type: CommandType;
  campaignId?: string;
  normalized: string;
};

export type WhatsAppWebhookResult = {
  ok: boolean;
  status: 'ignored' | 'rejected' | 'executed' | 'failed';
  action: CommandType;
  groupId: string | null;
  senderId: string | null;
  clientId: string | null;
  replyText: string;
  reason?: string;
  campaignId?: string;
  accountBalance?: ClientBalanceSnapshot;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toNumber(value: string | number | null): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function stripAgentMentionPrefix(normalized: string): string {
  return normalized
    .replace(/^@[a-z0-9_.-]+\s+/, '')
    .replace(/^edith[\s,:-]+/, '');
}

function parseCommand(inputText: string): ParsedCommand {
  const normalized = stripAgentMentionPrefix(normalizeText(inputText));

  if (!normalized) {
    return { type: 'unknown', normalized };
  }

  if (/^(\/)?(help|ajuda|comandos)\b/.test(normalized)) {
    return { type: 'help', normalized };
  }

  if (
    /^(\/)?(campanhas|status|rodando)\b/.test(normalized) ||
    normalized.includes('campanhas ativas') ||
    normalized.includes('o que esta rodando') ||
    normalized.includes('o que ta rodando')
  ) {
    return { type: 'campaign_status', normalized };
  }

  if (/^(\/)?(insights|resumo|performance|saldo|gasto|investimento)\b/.test(normalized)) {
    return { type: 'campaign_insights', normalized };
  }

  const pause = normalized.match(/^(?:\/)?(?:pausar|pause)\s+([a-z0-9_:\-.]+)$/i);
  if (pause) {
    return { type: 'campaign_pause', normalized, campaignId: pause[1] };
  }

  const resume = normalized.match(/^(?:\/)?(?:ligar|ativar|retomar|resume)\s+([a-z0-9_:\-.]+)$/i);
  if (resume) {
    return { type: 'campaign_resume', normalized, campaignId: resume[1] };
  }

  return { type: 'unknown', normalized };
}

function parseCommandFromIntent(payload: RawPayload): ParsedCommand | null {
  const data = asObject(payload.data);
  const intent = asString(payload.intent) ?? asString(data?.intent);

  if (!intent) {
    return null;
  }

  const normalizedIntent = normalizeText(intent);
  const parameters = asObject(payload.parameters) ?? asObject(data?.parameters);
  const campaignId =
    asString(parameters?.campaign_id) ??
    asString(parameters?.campaignId) ??
    asString(parameters?.id);

  if (['campanhas_ativas', 'status_campanhas', 'campaign_status'].includes(normalizedIntent)) {
    return { type: 'campaign_status', normalized: `intent:${normalizedIntent}` };
  }

  if (
    [
      'saldo_conta',
      'saldo',
      'gasto',
      'gasto_diario',
      'gasto_semanal',
      'performance',
      'performance_resumo',
      'campaign_insights'
    ].includes(normalizedIntent)
  ) {
    return { type: 'campaign_insights', normalized: `intent:${normalizedIntent}` };
  }

  if (['pausar_campanha', 'pause_campaign', 'campaign_pause'].includes(normalizedIntent)) {
    return { type: 'campaign_pause', normalized: `intent:${normalizedIntent}`, campaignId: campaignId ?? undefined };
  }

  if (
    [
      'ativar_campanha',
      'ligar_campanha',
      'retomar_campanha',
      'resume_campaign',
      'campaign_resume'
    ].includes(normalizedIntent)
  ) {
    return { type: 'campaign_resume', normalized: `intent:${normalizedIntent}`, campaignId: campaignId ?? undefined };
  }

  return null;
}

function parseCommandWithPayload(payload: RawPayload, inputText: string): ParsedCommand {
  return parseCommandFromIntent(payload) ?? parseCommand(inputText);
}

function buildHelpMessage(): string {
  return [
    'Comandos disponíveis:',
    '- /campanhas -> mostra campanhas em execução',
    '- /insights -> resumo dos últimos 7 dias',
    '- /pausar <campaign_id> -> pausa campanha',
    '- /ligar <campaign_id> -> ativa campanha',
    '- /ajuda -> mostra este menu'
  ].join('\n');
}

function extractTextFromPayload(payload: RawPayload): string | null {
  const direct = asString(payload.text);
  if (direct) {
    return direct;
  }

  const directMessage = asString(payload.message);
  if (directMessage) {
    return directMessage;
  }

  const message = payload.message;
  if (message && typeof message === 'object') {
    const msgObj = message as Record<string, unknown>;
    const conversation = asString(msgObj.conversation);
    if (conversation) {
      return conversation;
    }

    const extended = msgObj.extendedTextMessage;
    if (extended && typeof extended === 'object') {
      const txt = asString((extended as Record<string, unknown>).text);
      if (txt) {
        return txt;
      }
    }

    const imageMessage = msgObj.imageMessage;
    if (imageMessage && typeof imageMessage === 'object') {
      const caption = asString((imageMessage as Record<string, unknown>).caption);
      if (caption) {
        return caption;
      }
    }
  }

  const data = payload.data;
  if (data && typeof data === 'object') {
    const dataObj = data as Record<string, unknown>;
    const nestedMessage = dataObj.message;
    const nestedRaw = asString(nestedMessage);
    if (nestedRaw) {
      return nestedRaw;
    }

    if (nestedMessage && typeof nestedMessage === 'object') {
      const nestedObj = nestedMessage as Record<string, unknown>;
      const conversation = asString(nestedObj.conversation);
      if (conversation) {
        return conversation;
      }

      const extended = nestedObj.extendedTextMessage;
      if (extended && typeof extended === 'object') {
        const txt = asString((extended as Record<string, unknown>).text);
        if (txt) {
          return txt;
        }
      }

      const imageMessage = nestedObj.imageMessage;
      if (imageMessage && typeof imageMessage === 'object') {
        const caption = asString((imageMessage as Record<string, unknown>).caption);
        if (caption) {
          return caption;
        }
      }
    }
  }

  return null;
}

function extractIncomingMessage(payload: RawPayload): IncomingMessage | null {
  const data = asObject(payload.data);
  const key = asObject(data?.key);
  const sender = asObject(payload.sender);

  const fromMe = key?.fromMe === true;
  if (fromMe) {
    return null;
  }

  const groupId =
    asString(payload.groupId) ??
    asString(payload.group_id) ??
    asString(data?.groupId) ??
    asString(key?.remoteJid) ??
    asString(data?.remoteJid);

  const senderId =
    asString(payload.senderId) ??
    asString(payload.sender_id) ??
    asString(sender?.jid) ??
    asString(sender?.id) ??
    asString(data?.sender) ??
    asString(key?.participant) ??
    asString(key?.remoteJid) ??
    'unknown';

  const messageId =
    asString(payload.messageId) ??
    asString(payload.message_id) ??
    asString(data?.id) ??
    asString(key?.id) ??
    null;

  const text = extractTextFromPayload(payload) ?? asString(payload.intent) ?? asString(data?.intent);

  if (!groupId || !text) {
    return null;
  }

  return {
    groupId,
    senderId,
    messageId,
    text
  };
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  if (candidate.code === '42P01') {
    return true;
  }

  const msg = (candidate.message ?? '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist');
}

function formatCurrency(value: number, currency = 'BRL'): string {
  const normalizedCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'BRL';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: normalizedCurrency }).format(value);
}

function formatCurrencyBRL(value: number): string {
  return formatCurrency(value, 'BRL');
}

async function writeAuditLog(payload: {
  groupId: string | null;
  senderId: string | null;
  messageId: string | null;
  commandText: string | null;
  normalizedCommand: string | null;
  action: CommandType;
  clientId: string | null;
  campaignId?: string;
  allowed: boolean;
  status: WhatsAppWebhookResult['status'];
  responseMessage: string;
  errorMessage?: string;
  rawEvent: RawPayload;
}) {
  const supabase = createServiceClient();
  await supabase.from('whatsapp_command_audit_logs').insert({
    group_id: payload.groupId,
    sender_id: payload.senderId,
    message_id: payload.messageId,
    command_text: payload.commandText,
    normalized_command: payload.normalizedCommand,
    action: payload.action,
    client_id: payload.clientId,
    target_campaign_id: payload.campaignId ?? null,
    allowed: payload.allowed,
    status: payload.status,
    response_message: payload.responseMessage,
    error_message: payload.errorMessage ?? null,
    raw_event: payload.rawEvent
  } as never);
}


function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractClientIdentifierHintFromPayload(payload: RawPayload): string | null {
  const sources: unknown[] = [
    payload.client_id,
    payload.clientId,
    payload.customer_id,
    payload.customerId
  ];

  if (payload.client && typeof payload.client === 'object') {
    const client = payload.client as Record<string, unknown>;
    sources.push(client.id, client.client_id, client.clientId, client.customer_id, client.customerId);
  }

  if (payload.context && typeof payload.context === 'object') {
    const context = payload.context as Record<string, unknown>;
    sources.push(context.client_id, context.clientId, context.customer_id, context.customerId);
  }

  if (payload.metadata && typeof payload.metadata === 'object') {
    const metadata = payload.metadata as Record<string, unknown>;
    sources.push(metadata.client_id, metadata.clientId, metadata.customer_id, metadata.customerId);
  }

  if (payload.data && typeof payload.data === 'object') {
    const data = payload.data as Record<string, unknown>;
    sources.push(data.client_id, data.clientId, data.customer_id, data.customerId);

    if (data.client && typeof data.client === 'object') {
      const nestedClient = data.client as Record<string, unknown>;
      sources.push(
        nestedClient.id,
        nestedClient.client_id,
        nestedClient.clientId,
        nestedClient.customer_id,
        nestedClient.customerId
      );
    }

    if (data.context && typeof data.context === 'object') {
      const nestedContext = data.context as Record<string, unknown>;
      sources.push(
        nestedContext.client_id,
        nestedContext.clientId,
        nestedContext.customer_id,
        nestedContext.customerId
      );
    }
  }

  for (const candidate of sources) {
    const parsed = asString(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractClientIdHintFromPayload(payload: RawPayload): string | null {
  const identifier = extractClientIdentifierHintFromPayload(payload);
  return identifier && isUuid(identifier) ? identifier : null;
}

function extractMetaAccountIdHintFromPayload(payload: RawPayload): string | null {
  const sources: unknown[] = [payload.meta_account_id, payload.metaAccountId, payload.ad_account_id, payload.adAccountId];

  if (payload.client && typeof payload.client === 'object') {
    const client = payload.client as Record<string, unknown>;
    sources.push(client.meta_account_id, client.metaAccountId, client.ad_account_id, client.adAccountId);
  }

  if (payload.data && typeof payload.data === 'object') {
    const data = payload.data as Record<string, unknown>;
    sources.push(data.meta_account_id, data.metaAccountId, data.ad_account_id, data.adAccountId);

    if (data.client && typeof data.client === 'object') {
      const nestedClient = data.client as Record<string, unknown>;
      sources.push(
        nestedClient.meta_account_id,
        nestedClient.metaAccountId,
        nestedClient.ad_account_id,
        nestedClient.adAccountId
      );
    }
  }

  for (const candidate of sources) {
    const parsed = asString(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractGroupNameHintFromPayload(payload: RawPayload): string | null {
  const direct = asString(payload.group_name) ?? asString(payload.groupName);
  if (direct) {
    return direct;
  }

  if (payload.data && typeof payload.data === 'object') {
    const data = payload.data as Record<string, unknown>;
    const nested = asString(data.group_name) ?? asString(data.groupName) ?? asString(data.subject) ?? asString(data.pushName);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractGroupAliasHintFromPayload(payload: RawPayload): string | null {
  const direct = asString(payload.group_alias) ?? asString(payload.groupAlias);
  if (direct) {
    return direct;
  }

  if (payload.data && typeof payload.data === 'object') {
    const data = payload.data as Record<string, unknown>;
    const nested = asString(data.group_alias) ?? asString(data.groupAlias);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeClientLookupValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function clientExists(clientId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) && data.length > 0;
}

async function resolveClientIdByNameHint(nameHint: string): Promise<string | null> {
  const normalizedHint = normalizeClientLookupValue(nameHint);
  if (!normalizedHint) {
    return null;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : [];
  const matches = rows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const candidate = row as { id?: unknown; name?: unknown };
      const id = asString(candidate.id);
      const name = asString(candidate.name);
      if (!id || !name || !isUuid(id)) {
        return null;
      }

      return {
        id,
        normalizedName: normalizeClientLookupValue(name)
      };
    })
    .filter((row): row is { id: string; normalizedName: string } => row !== null)
    .filter((row) => row.normalizedName === normalizedHint);

  if (matches.length === 1) {
    return matches[0].id;
  }

  return null;
}

function buildMetaAccountCandidates(metaAccountId: string): string[] {
  const sanitized = metaAccountId.trim();
  if (!sanitized) {
    return [];
  }

  const candidates = new Set<string>([sanitized]);
  if (sanitized.startsWith('act_')) {
    candidates.add(sanitized.replace(/^act_/, ''));
  } else if (/^\d+$/.test(sanitized)) {
    candidates.add(`act_${sanitized}`);
  }

  return Array.from(candidates);
}

async function resolveClientIdByMetaAccountId(metaAccountId: string): Promise<string | null> {
  const accountCandidates = buildMetaAccountCandidates(metaAccountId);
  if (accountCandidates.length === 0) {
    return null;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('client_meta_connections')
    .select('client_id')
    .in('ad_account_id', accountCandidates)
    .eq('is_active', true)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) && data.length > 0 ? (data[0] as { client_id?: unknown }) : null;
  const clientId = asString(row?.client_id);
  return clientId && isUuid(clientId) ? clientId : null;
}

async function resolveClientIdHint(payload: RawPayload): Promise<string | null> {
  const directClientId = extractClientIdHintFromPayload(payload);
  if (directClientId) {
    return directClientId;
  }

  const directIdentifier = extractClientIdentifierHintFromPayload(payload);
  if (directIdentifier) {
    const clientIdByName = await resolveClientIdByNameHint(directIdentifier);
    if (clientIdByName) {
      return clientIdByName;
    }
  }

  const metaAccountId = extractMetaAccountIdHintFromPayload(payload);
  if (metaAccountId) {
    const clientIdByMetaAccount = await resolveClientIdByMetaAccountId(metaAccountId);
    if (clientIdByMetaAccount) {
      return clientIdByMetaAccount;
    }
  }

  const groupAlias = extractGroupAliasHintFromPayload(payload);
  if (groupAlias) {
    const clientIdByGroupAlias = await resolveClientIdByNameHint(groupAlias);
    if (clientIdByGroupAlias) {
      return clientIdByGroupAlias;
    }
  }

  const groupName = extractGroupNameHintFromPayload(payload);
  if (groupName) {
    const clientIdByGroupName = await resolveClientIdByNameHint(groupName);
    if (clientIdByGroupName) {
      return clientIdByGroupName;
    }
  }

  return null;
}

async function tryAutoBindGroup(groupId: string, payload: RawPayload): Promise<GroupBindingRow | null> {
  const clientId = await resolveClientIdHint(payload);
  if (!clientId) {
    return null;
  }

  const exists = await clientExists(clientId);
  if (!exists) {
    return null;
  }

  const groupName = extractGroupNameHintFromPayload(payload);
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('whatsapp_group_bindings')
    .upsert(
      {
        group_id: groupId,
        group_name: groupName ?? null,
        client_id: clientId,
        is_active: true,
        can_read: true,
        can_manage_campaigns: false,
        allowed_sender_ids: []
      } as never,
      { onConflict: 'group_id' }
    )
    .select('group_id, client_id, is_active, can_read, can_manage_campaigns, allowed_sender_ids')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as GroupBindingRow;
}

async function getActiveGroupBinding(groupId: string): Promise<{ data: GroupBindingRow | null; missingRelation: boolean }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('whatsapp_group_bindings')
    .select('group_id, client_id, is_active, can_read, can_manage_campaigns, allowed_sender_ids')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return { data: null, missingRelation: true };
    }
    throw new Error(error.message);
  }

  return {
    data: data as GroupBindingRow | null,
    missingRelation: false
  };
}

async function getClientConnections(clientId: string): Promise<Array<{ id: string; access_token: string | null }>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('client_meta_connections')
    .select('id, access_token')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row: unknown) => {
      if (!row || typeof row !== 'object') {
        return null;
      }
      const candidate = row as { id?: unknown; access_token?: unknown };
      if (typeof candidate.id !== 'string') {
        return null;
      }
      return {
        id: candidate.id,
        access_token: typeof candidate.access_token === 'string' ? candidate.access_token : null
      };
    })
    .filter((row): row is { id: string; access_token: string | null } => row !== null);
}

async function getClientCampaigns(clientId: string): Promise<CampaignRow[]> {
  const connections = await getClientConnections(clientId);
  const connectionIds = connections.map((c) => c.id);

  if (connectionIds.length === 0) {
    return [];
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('meta_campaigns')
    .select('id, name, status, daily_budget, updated_time, connection_id')
    .in('connection_id', connectionIds)
    .order('updated_time', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : []) as CampaignRow[];
}

async function getCampaignInsightsSummary(clientId: string): Promise<{
  campaignsCount: number;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}> {
  const campaigns = await getClientCampaigns(clientId);
  if (campaigns.length === 0) {
    return {
      campaignsCount: 0,
      impressions: 0,
      clicks: 0,
      spend: 0,
      ctr: 0
    };
  }

  const ids = campaigns.map((c) => c.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('meta_campaign_insights')
    .select('campaign_id, impressions, clicks, spend')
    .in('campaign_id', ids)
    .gte('date_start', sevenDaysAgo)
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (Array.isArray(data) ? data : []) as InsightRow[];

  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += toNumber(row.impressions);
      acc.clicks += toNumber(row.clicks);
      acc.spend += toNumber(row.spend);
      return acc;
    },
    { impressions: 0, clicks: 0, spend: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return {
    campaignsCount: campaigns.length,
    impressions: totals.impressions,
    clicks: totals.clicks,
    spend: totals.spend,
    ctr
  };
}

async function getClientBalanceSnapshot(clientId: string): Promise<ClientBalanceSnapshot> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ad_account_balances')
    .select('ad_account_id, ad_account_name, currency, balance, daily_spend, spend_cap, status, last_checked_at')
    .eq('client_id', clientId)
    .order('balance', { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (Array.isArray(data) ? data : []) as BalanceRow[];
  const accounts = rows
    .map((row) => {
      const adAccountId = asString(row.ad_account_id);
      if (!adAccountId) {
        return null;
      }

      const currency = asString(row.currency)?.toUpperCase() ?? 'BRL';
      return {
        adAccountId,
        adAccountName: asString(row.ad_account_name),
        currency,
        balance: Number(toNumber(row.balance).toFixed(2)),
        dailySpend: Number(toNumber(row.daily_spend).toFixed(2)),
        spendCap: Number(toNumber(row.spend_cap).toFixed(2)),
        status: asString(row.status)?.toLowerCase() ?? 'unknown',
        lastCheckedAt: asString(row.last_checked_at)
      };
    })
    .filter(
      (
        row
      ): row is {
        adAccountId: string;
        adAccountName: string | null;
        currency: string;
        balance: number;
        dailySpend: number;
        spendCap: number;
        status: string;
        lastCheckedAt: string | null;
      } => row !== null
    );

  const currency = accounts[0]?.currency ?? 'BRL';

  return {
    totalAccounts: accounts.length,
    totalBalance: Number(accounts.reduce((acc, row) => acc + row.balance, 0).toFixed(2)),
    totalDailySpend: Number(accounts.reduce((acc, row) => acc + row.dailySpend, 0).toFixed(2)),
    criticalAccounts: accounts.filter((row) => row.status === 'critical').length,
    warningAccounts: accounts.filter((row) => row.status === 'warning').length,
    healthyAccounts: accounts.filter((row) => row.status === 'healthy').length,
    currency,
    lastCheckedAt: accounts[0]?.lastCheckedAt ?? null,
    accounts
  };
}

function buildBalanceSummaryLines(balanceSnapshot: ClientBalanceSnapshot): string[] {
  if (balanceSnapshot.totalAccounts === 0) {
    return ['- saldo de conta: sem dados sincronizados'];
  }

  return [
    `- saldo total em conta: ${formatCurrency(balanceSnapshot.totalBalance, balanceSnapshot.currency)}`,
    `- gasto diário estimado: ${formatCurrency(balanceSnapshot.totalDailySpend, balanceSnapshot.currency)}`,
    `- contas monitoradas: ${balanceSnapshot.totalAccounts} (saudáveis: ${balanceSnapshot.healthyAccounts}, alerta: ${balanceSnapshot.warningAccounts}, críticas: ${balanceSnapshot.criticalAccounts})`
  ];
}

async function ensureCampaignBelongsToClient(clientId: string, campaignId: string): Promise<boolean> {
  const campaigns = await getClientCampaigns(clientId);
  return campaigns.some((campaign) => campaign.id === campaignId);
}

async function updateCampaignStatus(clientId: string, campaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
  const connections = await getClientConnections(clientId);
  const connection = connections.find((item) => typeof item.access_token === 'string' && item.access_token.length > 0);

  if (!connection?.access_token) {
    throw new Error('Nenhuma conexão Meta ativa com token disponível para este cliente.');
  }

  const response = await fetch(`${META_CONFIG.BASE_URL}/${META_CONFIG.API_VERSION}/${campaignId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status,
      access_token: connection.access_token
    })
  });

  const payload = await response.json().catch(async () => ({ error: { message: await response.text() } }));

  if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload)) {
    const data = payload as { error?: { message?: string } };
    throw new Error(data.error?.message ?? 'Falha ao atualizar status na Meta API.');
  }

  const supabase = createServiceClient();
  await supabase
    .from('meta_campaigns')
    .update({
      status,
      updated_time: new Date().toISOString()
    } as never)
    .eq('id', campaignId);
}

function buildStatusMessage(campaigns: CampaignRow[], balanceSnapshot: ClientBalanceSnapshot): string {
  if (campaigns.length === 0) {
    return ['Nenhuma campanha encontrada para este cliente.', '', ...buildBalanceSummaryLines(balanceSnapshot)].join('\n');
  }

  const active = campaigns.filter((campaign) => (campaign.status ?? '').toUpperCase() === 'ACTIVE');
  if (active.length === 0) {
    return ['Nenhuma campanha ativa no momento.', '', ...buildBalanceSummaryLines(balanceSnapshot)].join('\n');
  }

  const header = `Campanhas ativas: ${active.length}`;
  const lines = active.slice(0, 10).map((campaign) => {
    const budget = campaign.daily_budget ? ` | orçamento: ${formatCurrencyBRL(toNumber(campaign.daily_budget) / 100)}` : '';
    return `- ${campaign.name ?? 'Sem nome'} (id: ${campaign.id})${budget}`;
  });

  const suffix = active.length > 10 ? `\n... e mais ${active.length - 10} campanhas` : '';
  return [header, ...lines, '', ...buildBalanceSummaryLines(balanceSnapshot)].join('\n') + suffix;
}

function buildInsightsMessage(summary: {
  campaignsCount: number;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}, balanceSnapshot: ClientBalanceSnapshot): string {
  if (summary.campaignsCount === 0) {
    return ['Sem campanhas vinculadas para gerar insights.', '', ...buildBalanceSummaryLines(balanceSnapshot)].join('\n');
  }

  return [
    'Resumo últimos 7 dias:',
    `- campanhas monitoradas: ${summary.campaignsCount}`,
    `- impressões: ${Math.round(summary.impressions).toLocaleString('pt-BR')}`,
    `- cliques: ${Math.round(summary.clicks).toLocaleString('pt-BR')}`,
    `- investimento: ${formatCurrencyBRL(summary.spend)}`,
    `- CTR: ${summary.ctr.toFixed(2)}%`,
    '',
    ...buildBalanceSummaryLines(balanceSnapshot)
  ].join('\n');
}

export async function processWhatsAppWebhookEvent(payload: RawPayload): Promise<WhatsAppWebhookResult> {
  const incoming = extractIncomingMessage(payload);

  if (!incoming) {
    return {
      ok: true,
      status: 'ignored',
      action: 'unknown',
      groupId: null,
      senderId: null,
      clientId: null,
      replyText: 'Evento ignorado (sem mensagem de grupo).',
      reason: 'unsupported_event'
    };
  }

  const parsed = parseCommandWithPayload(payload, incoming.text);

  try {
    const bindingResult = await getActiveGroupBinding(incoming.groupId);
    if (bindingResult.missingRelation) {
      const message = 'Tabelas de WhatsApp não encontradas. Aplique a migration 08-create-whatsapp-openclaw-tables.sql.';
      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: null,
        allowed: false,
        status: 'failed',
        responseMessage: message,
        errorMessage: 'missing_relation',
        rawEvent: payload
      });
      return {
        ok: false,
        status: 'failed',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: null,
        replyText: message,
        reason: 'missing_relation'
      };
    }

    let binding = bindingResult.data;
    let autoBound = false;

    if (!binding) {
      const autoBoundBinding = await tryAutoBindGroup(incoming.groupId, payload);
      if (autoBoundBinding) {
        binding = autoBoundBinding;
        autoBound = true;
      }
    }

    if (!binding) {
      const message = 'Grupo não vinculado a nenhum cliente. Configure o OpenClaw para enviar client_id no payload do webhook.';
      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: null,
        allowed: false,
        status: 'rejected',
        responseMessage: message,
        errorMessage: 'group_not_bound',
        rawEvent: payload
      });
      return {
        ok: false,
        status: 'rejected',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: null,
        replyText: message,
        reason: 'group_not_bound'
      };
    }

    const withAutoBindNotice = (message: string): string => {
      if (!autoBound) {
        return message;
      }

      return [
        'Grupo vinculado automaticamente com sucesso.',
        '',
        message
      ].join('\n');
    };

    const allowedSenders = Array.isArray(binding.allowed_sender_ids) ? binding.allowed_sender_ids : [];
    const senderAllowed = allowedSenders.length === 0 || allowedSenders.includes(incoming.senderId);
    if (!senderAllowed) {
      const message = 'Usuário sem permissão para executar comandos neste grupo.';
      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: binding.client_id,
        allowed: false,
        status: 'rejected',
        responseMessage: message,
        errorMessage: 'sender_not_allowed',
        rawEvent: payload
      });
      return {
        ok: false,
        status: 'rejected',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: binding.client_id,
        replyText: message,
        reason: 'sender_not_allowed'
      };
    }

    const canRead = binding.can_read !== false;
    const canManageCampaigns = binding.can_manage_campaigns === true;

    if (parsed.type === 'unknown' || parsed.type === 'help') {
      const help = withAutoBindNotice(buildHelpMessage());
      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: binding.client_id,
        allowed: true,
        status: 'executed',
        responseMessage: help,
        rawEvent: payload
      });

      return {
        ok: true,
        status: 'executed',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: binding.client_id,
        replyText: help
      };
    }

    if ((parsed.type === 'campaign_status' || parsed.type === 'campaign_insights') && !canRead) {
      const message = 'Leitura de campanhas não permitida para este grupo.';
      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: binding.client_id,
        allowed: false,
        status: 'rejected',
        responseMessage: message,
        errorMessage: 'read_not_allowed',
        rawEvent: payload
      });
      return {
        ok: false,
        status: 'rejected',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: binding.client_id,
        replyText: message,
        reason: 'read_not_allowed'
      };
    }

    if ((parsed.type === 'campaign_pause' || parsed.type === 'campaign_resume') && !canManageCampaigns) {
      const message = 'Este grupo não possui permissão para pausar/ativar campanhas.';
      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: binding.client_id,
        allowed: false,
        status: 'rejected',
        responseMessage: message,
        errorMessage: 'manage_not_allowed',
        rawEvent: payload
      });
      return {
        ok: false,
        status: 'rejected',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: binding.client_id,
        replyText: message,
        reason: 'manage_not_allowed'
      };
    }

    if (parsed.type === 'campaign_status') {
      const [campaigns, balanceSnapshot] = await Promise.all([
        getClientCampaigns(binding.client_id),
        getClientBalanceSnapshot(binding.client_id)
      ]);
      const message = withAutoBindNotice(buildStatusMessage(campaigns, balanceSnapshot));

      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: binding.client_id,
        allowed: true,
        status: 'executed',
        responseMessage: message,
        rawEvent: payload
      });

      return {
        ok: true,
        status: 'executed',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: binding.client_id,
        replyText: message,
        accountBalance: balanceSnapshot
      };
    }

    if (parsed.type === 'campaign_insights') {
      const [summary, balanceSnapshot] = await Promise.all([
        getCampaignInsightsSummary(binding.client_id),
        getClientBalanceSnapshot(binding.client_id)
      ]);
      const message = withAutoBindNotice(buildInsightsMessage(summary, balanceSnapshot));

      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: binding.client_id,
        allowed: true,
        status: 'executed',
        responseMessage: message,
        rawEvent: payload
      });

      return {
        ok: true,
        status: 'executed',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: binding.client_id,
        replyText: message,
        accountBalance: balanceSnapshot
      };
    }

    if (parsed.type === 'campaign_pause' || parsed.type === 'campaign_resume') {
      if (!parsed.campaignId) {
        const message = 'Informe o campaign_id. Exemplo: /pausar 1234567890';
        await writeAuditLog({
          groupId: incoming.groupId,
          senderId: incoming.senderId,
          messageId: incoming.messageId,
          commandText: incoming.text,
          normalizedCommand: parsed.normalized,
          action: parsed.type,
          clientId: binding.client_id,
          allowed: false,
          status: 'rejected',
          responseMessage: message,
          errorMessage: 'campaign_id_missing',
          rawEvent: payload
        });
        return {
          ok: false,
          status: 'rejected',
          action: parsed.type,
          groupId: incoming.groupId,
          senderId: incoming.senderId,
          clientId: binding.client_id,
          replyText: message,
          reason: 'campaign_id_missing'
        };
      }

      const belongs = await ensureCampaignBelongsToClient(binding.client_id, parsed.campaignId);
      if (!belongs) {
        const message = `Campanha ${parsed.campaignId} não encontrada para este cliente.`;
        await writeAuditLog({
          groupId: incoming.groupId,
          senderId: incoming.senderId,
          messageId: incoming.messageId,
          commandText: incoming.text,
          normalizedCommand: parsed.normalized,
          action: parsed.type,
          clientId: binding.client_id,
          campaignId: parsed.campaignId,
          allowed: false,
          status: 'rejected',
          responseMessage: message,
          errorMessage: 'campaign_not_found_for_client',
          rawEvent: payload
        });
        return {
          ok: false,
          status: 'rejected',
          action: parsed.type,
          groupId: incoming.groupId,
          senderId: incoming.senderId,
          clientId: binding.client_id,
          campaignId: parsed.campaignId,
          replyText: message,
          reason: 'campaign_not_found_for_client'
        };
      }

      const targetStatus = parsed.type === 'campaign_pause' ? 'PAUSED' : 'ACTIVE';
      await updateCampaignStatus(binding.client_id, parsed.campaignId, targetStatus);

      const message = withAutoBindNotice(
        targetStatus === 'PAUSED'
          ? `Campanha ${parsed.campaignId} pausada com sucesso.`
          : `Campanha ${parsed.campaignId} ativada com sucesso.`
      );

      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: binding.client_id,
        campaignId: parsed.campaignId,
        allowed: true,
        status: 'executed',
        responseMessage: message,
        rawEvent: payload
      });

      return {
        ok: true,
        status: 'executed',
        action: parsed.type,
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        clientId: binding.client_id,
        campaignId: parsed.campaignId,
        replyText: message
      };
    }

    const fallback = withAutoBindNotice('Comando não reconhecido. Use /ajuda.');
    await writeAuditLog({
      groupId: incoming.groupId,
      senderId: incoming.senderId,
      messageId: incoming.messageId,
      commandText: incoming.text,
      normalizedCommand: parsed.normalized,
      action: parsed.type,
      clientId: binding.client_id,
      allowed: true,
      status: 'executed',
      responseMessage: fallback,
      rawEvent: payload
    });
    return {
      ok: true,
      status: 'executed',
      action: parsed.type,
      groupId: incoming.groupId,
      senderId: incoming.senderId,
      clientId: binding.client_id,
      replyText: fallback
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    try {
      await writeAuditLog({
        groupId: incoming.groupId,
        senderId: incoming.senderId,
        messageId: incoming.messageId,
        commandText: incoming.text,
        normalizedCommand: parsed.normalized,
        action: parsed.type,
        clientId: null,
        campaignId: parsed.campaignId,
        allowed: false,
        status: 'failed',
        responseMessage: 'Falha ao processar comando.',
        errorMessage,
        rawEvent: payload
      });
    } catch (auditError) {
      console.error('Falha ao gravar audit log do WhatsApp:', auditError);
    }

    return {
      ok: false,
      status: 'failed',
      action: parsed.type,
      groupId: incoming.groupId,
      senderId: incoming.senderId,
      clientId: null,
      campaignId: parsed.campaignId,
      replyText: `Falha ao processar comando: ${errorMessage}`,
      reason: 'internal_error'
    };
  }
}
