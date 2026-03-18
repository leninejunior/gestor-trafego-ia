import { getPostgresPool } from '@/lib/postgres/client';

type UnknownRow = Record<string, unknown>;

interface OrgRow {
  org_id: string;
}

interface IdRow {
  id: string;
}

interface CountRow {
  count: string;
}

export interface UpsertConnectionInput {
  client_id: string;
  ad_account_id: string;
  access_token: string;
  account_name: string;
  currency?: string | null;
  is_active?: boolean;
}

interface ConnectionContextRow extends UnknownRow {
  id: string;
  client_id: string;
  org_id: string;
}

interface ConnectionIdRow {
  id: string;
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

export async function getClientOrgId(clientId: string): Promise<string | null> {
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

export async function clientExists(clientId: string): Promise<boolean> {
  const rows = await tryRows<IdRow>(
    'SELECT id::text AS id FROM clients WHERE id = $1 LIMIT 1',
    [clientId]
  );

  return Boolean(rows && rows.length > 0);
}

export async function hasOrganizationAccess(userId: string, orgId: string): Promise<boolean> {
  const fromOrganizationMemberships = await tryRows<IdRow>(
    'SELECT id::text AS id FROM organization_memberships WHERE user_id = $1 AND organization_id = $2 LIMIT 1',
    [userId, orgId]
  );

  if (fromOrganizationMemberships && fromOrganizationMemberships.length > 0) {
    return true;
  }

  const fromMembershipsOrganizationId = await tryRows<IdRow>(
    'SELECT id::text AS id FROM memberships WHERE user_id = $1 AND organization_id = $2 LIMIT 1',
    [userId, orgId]
  );

  if (fromMembershipsOrganizationId && fromMembershipsOrganizationId.length > 0) {
    return true;
  }

  const fromMembershipsOrgId = await tryRows<IdRow>(
    'SELECT id::text AS id FROM memberships WHERE user_id = $1 AND org_id = $2 LIMIT 1',
    [userId, orgId]
  );

  return Boolean(fromMembershipsOrgId && fromMembershipsOrgId.length > 0);
}

export async function getClientAccess(
  clientId: string,
  userId: string
): Promise<{ clientExists: boolean; hasAccess: boolean; orgId?: string }> {
  const orgId = await getClientOrgId(clientId);

  if (!orgId) {
    return { clientExists: false, hasAccess: false };
  }

  const hasAccess = await hasOrganizationAccess(userId, orgId);
  return { clientExists: true, hasAccess, orgId };
}

export async function getConnectionContext(connectionId: string): Promise<ConnectionContextRow | null> {
  const withOrgId = await tryRows<ConnectionContextRow>(
    `
      SELECT cmc.*, c.org_id::text AS org_id
      FROM client_meta_connections cmc
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE cmc.id = $1
      LIMIT 1
    `,
    [connectionId]
  );

  if (withOrgId && withOrgId.length > 0) {
    return withOrgId[0];
  }

  const withOrganizationId = await tryRows<ConnectionContextRow>(
    `
      SELECT cmc.*, c.organization_id::text AS org_id
      FROM client_meta_connections cmc
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE cmc.id = $1
      LIMIT 1
    `,
    [connectionId]
  );

  if (withOrganizationId && withOrganizationId.length > 0) {
    return withOrganizationId[0];
  }

  return null;
}

export async function deleteConnectionsByClientId(clientId: string): Promise<number> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    'DELETE FROM client_meta_connections WHERE client_id = $1',
    [clientId]
  );

  return rowCount ?? 0;
}

export async function deleteConnectionById(connectionId: string): Promise<number> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    'DELETE FROM client_meta_connections WHERE id = $1',
    [connectionId]
  );

  return rowCount ?? 0;
}

export async function updateConnectionById(
  connectionId: string,
  patch: { is_active?: boolean; account_name?: string }
): Promise<UnknownRow | null> {
  const pool = getPostgresPool();

  const isActive = typeof patch.is_active === 'boolean' ? patch.is_active : null;
  const accountName = typeof patch.account_name === 'string' ? patch.account_name : null;

  const { rows } = await pool.query<UnknownRow>(
    `
      UPDATE client_meta_connections
      SET
        is_active = COALESCE($1::boolean, is_active),
        account_name = COALESCE($2::text, account_name),
        updated_at = $3
      WHERE id = $4
      RETURNING *
    `,
    [isActive, accountName, new Date().toISOString(), connectionId]
  );

  return rows[0] ?? null;
}

export async function listConnectionsByClientId(clientId: string): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    'SELECT * FROM client_meta_connections WHERE client_id = $1 ORDER BY created_at DESC',
    [clientId]
  );

  return rows;
}

export async function getLatestConnectionByClientId(clientId: string): Promise<ConnectionIdRow | null> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<ConnectionIdRow>(
    `
      SELECT id::text AS id
      FROM client_meta_connections
      WHERE client_id = $1
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [clientId]
  );

  return rows[0] ?? null;
}

export async function listActiveConnectionsByClientId(clientId: string): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT *
      FROM client_meta_connections
      WHERE client_id = $1 AND is_active = true
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
    `,
    [clientId]
  );

  return rows;
}

export async function getActiveConnectionByClientAndAdAccount(
  clientId: string,
  adAccountId: string
): Promise<UnknownRow | null> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT *
      FROM client_meta_connections
      WHERE client_id = $1
        AND ad_account_id = $2
        AND is_active = true
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 2
    `,
    [clientId, adAccountId]
  );

  if (rows.length !== 1) {
    return null;
  }

  return rows[0];
}

export async function getSingleActiveConnectionByClientId(clientId: string): Promise<UnknownRow | null> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT *
      FROM client_meta_connections
      WHERE client_id = $1
        AND is_active = true
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 2
    `,
    [clientId]
  );

  if (rows.length !== 1) {
    return null;
  }

  return rows[0];
}

export async function deactivateConnectionsByClientId(clientId: string): Promise<number> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `
      UPDATE client_meta_connections
      SET is_active = false, updated_at = $2
      WHERE client_id = $1
    `,
    [clientId, new Date().toISOString()]
  );

  return rowCount ?? 0;
}

export async function removeDuplicateConnections(clientId: string): Promise<number> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY ad_account_id
            ORDER BY created_at DESC
          ) AS rn
        FROM client_meta_connections
        WHERE client_id = $1
      )
      DELETE FROM client_meta_connections
      WHERE id IN (
        SELECT id
        FROM ranked
        WHERE rn > 1
      )
    `,
    [clientId]
  );

  return rowCount ?? 0;
}

export async function countConnectionsByClientId(clientId: string): Promise<number> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<CountRow>(
    'SELECT COUNT(*)::text AS count FROM client_meta_connections WHERE client_id = $1',
    [clientId]
  );

  return Number(rows[0]?.count ?? 0);
}

export async function upsertConnections(
  connections: UpsertConnectionInput[]
): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const results: UnknownRow[] = [];

  for (const connection of connections) {
    const params = [
      connection.client_id,
      connection.ad_account_id,
      connection.access_token,
      connection.account_name,
      connection.currency ?? 'USD',
      connection.is_active ?? true,
      new Date().toISOString(),
    ];

    const fromUpsert = await tryRows<UnknownRow>(
      `
        INSERT INTO client_meta_connections (
          client_id,
          ad_account_id,
          access_token,
          account_name,
          currency,
          is_active,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (client_id, ad_account_id)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          account_name = EXCLUDED.account_name,
          currency = EXCLUDED.currency,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      params
    );

    if (fromUpsert && fromUpsert.length > 0) {
      results.push(fromUpsert[0]);
      continue;
    }

    const { rows } = await pool.query<UnknownRow>(
      `
        INSERT INTO client_meta_connections (
          client_id,
          ad_account_id,
          access_token,
          account_name,
          currency,
          is_active,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      params
    );

    if (rows[0]) {
      results.push(rows[0]);
    }
  }

  return results;
}

export async function deleteInactiveConnectionsByClientIdBefore(
  clientId: string,
  beforeIso: string
): Promise<number> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `
      DELETE FROM client_meta_connections
      WHERE client_id = $1
        AND is_active = false
        AND updated_at < $2
    `,
    [clientId, beforeIso]
  );

  return rowCount ?? 0;
}
