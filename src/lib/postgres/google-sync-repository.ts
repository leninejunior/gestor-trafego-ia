import { getPostgresPool } from '@/lib/postgres/client';

interface IdRow {
  id: string;
}

interface OrgRow {
  org_id: string;
}

interface CountRow {
  count: string;
}

export interface GoogleConnectionRow {
  id: string;
  customer_id: string;
  status: string;
  last_sync_at: string | null;
}

export interface GoogleConnectionStatusRow extends GoogleConnectionRow {
  created_at: string;
  refresh_token?: string | null;
  access_token?: string | null;
  client_id?: string;
}

export interface GoogleActiveSyncRow {
  id: string;
  sync_type: string | null;
  started_at: string;
  connection_id: string;
  customer_id: string;
  client_id: string;
}

export interface GoogleSyncHistoryRow {
  id: string;
  sync_type: string | null;
  status: string | null;
  campaigns_synced: number | null;
  metrics_updated: number | null;
  error_message: string | null;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
  connection_id: string;
  customer_id: string;
  client_id: string;
}

export interface GoogleSyncLogRow {
  id: string;
  sync_type: string | null;
  status: string | null;
  campaigns_synced: number | null;
  metrics_updated: number | null;
  error_message: string | null;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
  connection_id: string;
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

export async function getClientOrganizationId(clientId: string): Promise<string | null> {
  const byOrgId = await tryRows<OrgRow>(
    'SELECT org_id::text AS org_id FROM clients WHERE id = $1 LIMIT 1',
    [clientId]
  );

  if (byOrgId && byOrgId.length > 0) {
    return byOrgId[0].org_id;
  }

  const byOrganizationId = await tryRows<OrgRow>(
    'SELECT organization_id::text AS org_id FROM clients WHERE id = $1 LIMIT 1',
    [clientId]
  );

  if (byOrganizationId && byOrganizationId.length > 0) {
    return byOrganizationId[0].org_id;
  }

  return null;
}

export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  const rows = await tryRows<IdRow>(
    `
      SELECT id::text AS id
      FROM super_admins
      WHERE user_id = $1
        AND is_active = true
      LIMIT 1
    `,
    [userId]
  );

  return Boolean(rows && rows.length > 0);
}

export async function hasOrgMembershipAccess(userId: string, orgId: string): Promise<boolean> {
  const queries: Array<Promise<IdRow[] | null>> = [
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM organization_memberships
        WHERE user_id = $1
          AND organization_id = $2
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND organization_id = $2
          AND status = 'active'
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND org_id = $2
          AND status = 'active'
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND organization_id = $2
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND org_id = $2
        LIMIT 1
      `,
      [userId, orgId]
    ),
  ];

  for (const rows of await Promise.all(queries)) {
    if (rows && rows.length > 0) {
      return true;
    }
  }

  return false;
}

export async function hasOrgAdminAccess(userId: string, orgId: string): Promise<boolean> {
  const queries: Array<Promise<IdRow[] | null>> = [
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM organization_memberships
        WHERE user_id = $1
          AND organization_id = $2
          AND role IN ('admin', 'owner')
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND organization_id = $2
          AND role = 'admin'
          AND status = 'active'
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND org_id = $2
          AND role = 'admin'
          AND status = 'active'
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND organization_id = $2
          AND role = 'admin'
        LIMIT 1
      `,
      [userId, orgId]
    ),
    tryRows<IdRow>(
      `
        SELECT id::text AS id
        FROM memberships
        WHERE user_id = $1
          AND org_id = $2
          AND role = 'admin'
        LIMIT 1
      `,
      [userId, orgId]
    ),
  ];

  for (const rows of await Promise.all(queries)) {
    if (rows && rows.length > 0) {
      return true;
    }
  }

  return false;
}

export async function listActiveGoogleConnectionsByClient(
  clientId: string,
  connectionId?: string
): Promise<GoogleConnectionRow[]> {
  const pool = getPostgresPool();
  const params: unknown[] = [clientId];

  const connectionFilter = connectionId
    ? 'AND id = $2'
    : '';

  if (connectionId) {
    params.push(connectionId);
  }

  const { rows } = await pool.query<GoogleConnectionRow>(
    `
      SELECT
        id::text AS id,
        customer_id::text AS customer_id,
        status::text AS status,
        last_sync_at::text AS last_sync_at
      FROM google_ads_connections
      WHERE client_id = $1
        AND status = 'active'
        ${connectionFilter}
      ORDER BY created_at DESC
    `,
    params
  );

  return rows;
}

export async function listGoogleConnectionsByClient(
  clientId: string,
  connectionId?: string
): Promise<GoogleConnectionStatusRow[]> {
  const pool = getPostgresPool();
  const params: unknown[] = [clientId];

  const connectionFilter = connectionId
    ? 'AND id = $2'
    : '';

  if (connectionId) {
    params.push(connectionId);
  }

  const { rows } = await pool.query<GoogleConnectionStatusRow>(
    `
      SELECT
        id::text AS id,
        customer_id::text AS customer_id,
        status::text AS status,
        last_sync_at::text AS last_sync_at,
        created_at::text AS created_at
      FROM google_ads_connections
      WHERE client_id = $1
      ${connectionFilter}
      ORDER BY created_at DESC
    `,
    params
  );

  return rows;
}

export async function getGoogleConnectionById(
  connectionId: string
): Promise<GoogleConnectionStatusRow | null> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<GoogleConnectionStatusRow>(
    `
      SELECT
        id::text AS id,
        client_id::text AS client_id,
        customer_id::text AS customer_id,
        status::text AS status,
        last_sync_at::text AS last_sync_at,
        created_at::text AS created_at,
        refresh_token,
        access_token
      FROM google_ads_connections
      WHERE id = $1
      LIMIT 1
    `,
    [connectionId]
  );

  return rows[0] ?? null;
}

export async function getGoogleConnectionByClientAndCustomer(
  clientId: string,
  customerId: string
): Promise<GoogleConnectionStatusRow | null> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<GoogleConnectionStatusRow>(
    `
      SELECT
        id::text AS id,
        client_id::text AS client_id,
        customer_id::text AS customer_id,
        status::text AS status,
        last_sync_at::text AS last_sync_at,
        created_at::text AS created_at,
        refresh_token,
        access_token
      FROM google_ads_connections
      WHERE client_id = $1
        AND customer_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [clientId, customerId]
  );

  return rows[0] ?? null;
}

export async function markGoogleConnectionRevoked(connectionId: string): Promise<boolean> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `
      UPDATE google_ads_connections
      SET
        status = 'revoked',
        updated_at = NOW()
      WHERE id = $1
    `,
    [connectionId]
  );

  return (rowCount ?? 0) > 0;
}

export async function deleteGoogleConnectionById(connectionId: string): Promise<boolean> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `
      DELETE FROM google_ads_connections
      WHERE id = $1
    `,
    [connectionId]
  );

  return (rowCount ?? 0) > 0;
}

export async function deleteGoogleConnectionRelatedData(connectionId: string): Promise<void> {
  const pool = getPostgresPool();

  await pool.query(
    `
      DELETE FROM google_ads_metrics m
      USING google_ads_campaigns c
      WHERE m.campaign_id = c.id
        AND c.connection_id = $1
    `,
    [connectionId]
  );

  await pool.query(
    `
      DELETE FROM google_ads_campaigns
      WHERE connection_id = $1
    `,
    [connectionId]
  );

  await pool.query(
    `
      DELETE FROM google_ads_sync_logs
      WHERE connection_id = $1
    `,
    [connectionId]
  );
}

export async function getGoogleConnectionDataCounts(connectionId: string): Promise<{
  campaignCount: number;
  metricsCount: number;
  syncLogsCount: number;
}> {
  const pool = getPostgresPool();

  const [campaigns, metrics, syncLogs] = await Promise.all([
    pool.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM google_ads_campaigns
        WHERE connection_id = $1
      `,
      [connectionId]
    ),
    pool.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM google_ads_metrics m
        INNER JOIN google_ads_campaigns c ON c.id = m.campaign_id
        WHERE c.connection_id = $1
      `,
      [connectionId]
    ),
    pool.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM google_ads_sync_logs
        WHERE connection_id = $1
      `,
      [connectionId]
    ),
  ]);

  return {
    campaignCount: Number(campaigns.rows[0]?.count || 0),
    metricsCount: Number(metrics.rows[0]?.count || 0),
    syncLogsCount: Number(syncLogs.rows[0]?.count || 0),
  };
}

export async function listRecentActiveSyncsByConnectionIds(
  connectionIds: string[],
  startedAfterIso: string
): Promise<GoogleActiveSyncRow[]> {
  if (connectionIds.length === 0) {
    return [];
  }

  const pool = getPostgresPool();
  const { rows } = await pool.query<GoogleActiveSyncRow>(
    `
      SELECT
        l.id::text AS id,
        l.sync_type::text AS sync_type,
        l.started_at::text AS started_at,
        l.connection_id::text AS connection_id,
        c.customer_id::text AS customer_id,
        c.client_id::text AS client_id
      FROM google_ads_sync_logs l
      INNER JOIN google_ads_connections c ON c.id = l.connection_id
      WHERE l.connection_id::text = ANY($1::text[])
        AND l.completed_at IS NULL
        AND l.started_at >= $2::timestamptz
      ORDER BY l.started_at DESC
    `,
    [connectionIds, startedAfterIso]
  );

  return rows;
}

export async function listSyncHistoryByClient(
  clientId: string,
  limit: number,
  connectionId?: string
): Promise<GoogleSyncHistoryRow[]> {
  const pool = getPostgresPool();
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 10;
  const params: unknown[] = [clientId, safeLimit];

  const connectionFilter = connectionId
    ? 'AND l.connection_id = $3'
    : '';

  if (connectionId) {
    params.push(connectionId);
  }

  const { rows } = await pool.query<GoogleSyncHistoryRow>(
    `
      SELECT
        l.id::text AS id,
        l.sync_type::text AS sync_type,
        l.status::text AS status,
        l.campaigns_synced,
        l.metrics_updated,
        l.error_message,
        l.error_code,
        l.started_at::text AS started_at,
        l.completed_at::text AS completed_at,
        l.connection_id::text AS connection_id,
        c.customer_id::text AS customer_id,
        c.client_id::text AS client_id
      FROM google_ads_sync_logs l
      INNER JOIN google_ads_connections c ON c.id = l.connection_id
      WHERE c.client_id = $1
        ${connectionFilter}
      ORDER BY l.started_at DESC
      LIMIT $2
    `,
    params
  );

  return rows;
}

export async function listClientActiveSyncs(
  clientId: string,
  startedAfterIso: string
): Promise<GoogleActiveSyncRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<GoogleActiveSyncRow>(
    `
      SELECT
        l.id::text AS id,
        l.sync_type::text AS sync_type,
        l.started_at::text AS started_at,
        l.connection_id::text AS connection_id,
        c.customer_id::text AS customer_id,
        c.client_id::text AS client_id
      FROM google_ads_sync_logs l
      INNER JOIN google_ads_connections c ON c.id = l.connection_id
      WHERE c.client_id = $1
        AND l.completed_at IS NULL
        AND l.started_at >= $2::timestamptz
      ORDER BY l.started_at DESC
    `,
    [clientId, startedAfterIso]
  );

  return rows;
}

export async function getLatestSyncLogByConnectionId(
  connectionId: string
): Promise<GoogleSyncLogRow | null> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<GoogleSyncLogRow>(
    `
      SELECT
        id::text AS id,
        sync_type::text AS sync_type,
        status::text AS status,
        campaigns_synced,
        metrics_updated,
        error_message,
        error_code,
        started_at::text AS started_at,
        completed_at::text AS completed_at,
        connection_id::text AS connection_id
      FROM google_ads_sync_logs
      WHERE connection_id = $1
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [connectionId]
  );

  return rows[0] ?? null;
}

export async function getActiveSyncByConnectionId(
  connectionId: string
): Promise<GoogleActiveSyncRow | null> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<GoogleActiveSyncRow>(
    `
      SELECT
        l.id::text AS id,
        l.sync_type::text AS sync_type,
        l.started_at::text AS started_at,
        l.connection_id::text AS connection_id,
        c.customer_id::text AS customer_id,
        c.client_id::text AS client_id
      FROM google_ads_sync_logs l
      INNER JOIN google_ads_connections c ON c.id = l.connection_id
      WHERE l.connection_id = $1
        AND l.completed_at IS NULL
      ORDER BY l.started_at DESC
      LIMIT 1
    `,
    [connectionId]
  );

  return rows[0] ?? null;
}

export async function countGoogleCampaignsByConnectionId(
  connectionId: string
): Promise<number> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM google_ads_campaigns
      WHERE connection_id = $1
    `,
    [connectionId]
  );

  return Number(rows[0]?.count || 0);
}

export async function updateGoogleSyncLogStatus(
  syncId: string,
  payload: {
    status?: 'success' | 'failed' | 'partial';
    completedAt?: string;
    errorMessage?: string | null;
  }
): Promise<boolean> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `
      UPDATE google_ads_sync_logs
      SET
        status = COALESCE($1::text, status),
        completed_at = COALESCE($2::timestamptz, completed_at),
        error_message = COALESCE($3::text, error_message)
      WHERE id = $4
    `,
    [payload.status ?? null, payload.completedAt ?? null, payload.errorMessage ?? null, syncId]
  );

  return (rowCount ?? 0) > 0;
}
