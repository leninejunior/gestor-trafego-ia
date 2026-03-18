import { getPostgresPool } from '@/lib/postgres/client';

type UnknownRow = Record<string, unknown>;

interface TokenRow {
  access_token: string;
}

interface SyncLogInput {
  userId: string;
  syncType: string;
  status: string;
  results?: unknown;
  errorMessage?: string | null;
  durationMs?: number | null;
  recordsProcessed?: number | null;
}

interface MetaCampaignInput {
  id: string;
  name: string;
  status?: string | null;
  objective?: string | null;
  daily_budget?: string | number | null;
  lifetime_budget?: string | number | null;
  created_time?: string | null;
  updated_time?: string | null;
  start_time?: string | null;
  stop_time?: string | null;
}

interface SyncConnectionRow extends UnknownRow {
  id: string;
  account_id: string;
  account_name: string | null;
  is_active: boolean;
  last_sync: string | null;
  sync_status: string | null;
  client_name: string | null;
}

async function tryRows<T>(query: string, values: unknown[]): Promise<T[] | null> {
  try {
    const pool = getPostgresPool();
    const { rows } = await pool.query<T>(query, values);
    return rows;
  } catch {
    return null;
  }
}

export async function getActiveUserMetaToken(userId: string): Promise<string | null> {
  const rows = await tryRows<TokenRow>(
    `
      SELECT access_token
      FROM user_meta_tokens
      WHERE user_id = $1
        AND is_active = true
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  return rows[0].access_token;
}

export async function insertSyncLog(input: SyncLogInput): Promise<void> {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO sync_logs (
        user_id,
        sync_type,
        status,
        results,
        error_message,
        duration_ms,
        records_processed,
        created_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
    `,
    [
      input.userId,
      input.syncType,
      input.status,
      JSON.stringify(input.results ?? {}),
      input.errorMessage ?? null,
      input.durationMs ?? null,
      input.recordsProcessed ?? null,
      new Date().toISOString(),
    ]
  );
}

export async function listSyncLogsByUser(
  userId: string,
  limit: number,
  offset: number
): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT *
      FROM sync_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [userId, limit, offset]
  );

  return rows;
}

export async function listConnectionsForSyncByUser(userId: string): Promise<SyncConnectionRow[]> {
  const fromCreatedBy = await tryRows<SyncConnectionRow>(
    `
      SELECT
        cmc.id::text AS id,
        cmc.ad_account_id::text AS account_id,
        cmc.account_name,
        cmc.is_active,
        cmc.last_sync::text AS last_sync,
        cmc.sync_status,
        c.name AS client_name
      FROM client_meta_connections cmc
      LEFT JOIN clients c ON c.id = cmc.client_id
      WHERE cmc.created_by = $1
      ORDER BY cmc.updated_at DESC NULLS LAST, cmc.created_at DESC
    `,
    [userId]
  );

  if (fromCreatedBy !== null) {
    return fromCreatedBy;
  }

  const fromOrganizationMembershipsOrgId = await tryRows<SyncConnectionRow>(
    `
      SELECT
        cmc.id::text AS id,
        cmc.ad_account_id::text AS account_id,
        cmc.account_name,
        cmc.is_active,
        cmc.last_sync::text AS last_sync,
        cmc.sync_status,
        c.name AS client_name
      FROM client_meta_connections cmc
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE EXISTS (
        SELECT 1
        FROM organization_memberships om
        WHERE om.user_id = $1
          AND om.organization_id = c.org_id
      )
      ORDER BY cmc.updated_at DESC NULLS LAST, cmc.created_at DESC
    `,
    [userId]
  );

  if (fromOrganizationMembershipsOrgId !== null) {
    return fromOrganizationMembershipsOrgId;
  }

  const fromOrganizationMembershipsOrganizationId = await tryRows<SyncConnectionRow>(
    `
      SELECT
        cmc.id::text AS id,
        cmc.ad_account_id::text AS account_id,
        cmc.account_name,
        cmc.is_active,
        cmc.last_sync::text AS last_sync,
        cmc.sync_status,
        c.name AS client_name
      FROM client_meta_connections cmc
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE EXISTS (
        SELECT 1
        FROM organization_memberships om
        WHERE om.user_id = $1
          AND om.organization_id = c.organization_id
      )
      ORDER BY cmc.updated_at DESC NULLS LAST, cmc.created_at DESC
    `,
    [userId]
  );

  if (fromOrganizationMembershipsOrganizationId !== null) {
    return fromOrganizationMembershipsOrganizationId;
  }

  const fromMembershipsOrganizationId = await tryRows<SyncConnectionRow>(
    `
      SELECT
        cmc.id::text AS id,
        cmc.ad_account_id::text AS account_id,
        cmc.account_name,
        cmc.is_active,
        cmc.last_sync::text AS last_sync,
        cmc.sync_status,
        c.name AS client_name
      FROM client_meta_connections cmc
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE EXISTS (
        SELECT 1
        FROM memberships m
        WHERE m.user_id = $1
          AND m.organization_id = c.organization_id
      )
      ORDER BY cmc.updated_at DESC NULLS LAST, cmc.created_at DESC
    `,
    [userId]
  );

  if (fromMembershipsOrganizationId !== null) {
    return fromMembershipsOrganizationId;
  }

  const fromMembershipsOrgId = await tryRows<SyncConnectionRow>(
    `
      SELECT
        cmc.id::text AS id,
        cmc.ad_account_id::text AS account_id,
        cmc.account_name,
        cmc.is_active,
        cmc.last_sync::text AS last_sync,
        cmc.sync_status,
        c.name AS client_name
      FROM client_meta_connections cmc
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE EXISTS (
        SELECT 1
        FROM memberships m
        WHERE m.user_id = $1
          AND m.org_id = c.org_id
      )
      ORDER BY cmc.updated_at DESC NULLS LAST, cmc.created_at DESC
    `,
    [userId]
  );

  return fromMembershipsOrgId ?? [];
}

export async function upsertMetaCampaign(
  connectionId: string,
  campaign: MetaCampaignInput
): Promise<void> {
  const values = [
    connectionId,
    campaign.id,
    campaign.name,
    campaign.status ?? 'UNKNOWN',
    campaign.objective ?? null,
    campaign.daily_budget ?? null,
    campaign.lifetime_budget ?? null,
    campaign.created_time ?? null,
    campaign.updated_time ?? null,
    campaign.start_time ?? null,
    campaign.stop_time ?? null,
    new Date().toISOString(),
  ];

  const byExternalId = await tryRows<UnknownRow>(
    `
      INSERT INTO meta_campaigns (
        connection_id,
        external_id,
        name,
        status,
        objective,
        daily_budget,
        lifetime_budget,
        created_time,
        updated_time,
        start_time,
        stop_time,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (connection_id, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        objective = EXCLUDED.objective,
        daily_budget = EXCLUDED.daily_budget,
        lifetime_budget = EXCLUDED.lifetime_budget,
        created_time = EXCLUDED.created_time,
        updated_time = EXCLUDED.updated_time,
        start_time = EXCLUDED.start_time,
        stop_time = EXCLUDED.stop_time,
        updated_at = EXCLUDED.updated_at
      RETURNING id::text AS id
    `,
    values
  );

  if (byExternalId !== null) {
    return;
  }

  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO meta_campaigns (
        connection_id,
        campaign_id,
        name,
        status,
        objective,
        daily_budget,
        lifetime_budget,
        created_time,
        updated_time,
        start_time,
        stop_time,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (campaign_id, connection_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        objective = EXCLUDED.objective,
        daily_budget = EXCLUDED.daily_budget,
        lifetime_budget = EXCLUDED.lifetime_budget,
        created_time = EXCLUDED.created_time,
        updated_time = EXCLUDED.updated_time,
        start_time = EXCLUDED.start_time,
        stop_time = EXCLUDED.stop_time,
        updated_at = EXCLUDED.updated_at
    `,
    values
  );
}
