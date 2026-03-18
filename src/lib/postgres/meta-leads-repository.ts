import { getPostgresPool } from '@/lib/postgres/client';

type UnknownRow = Record<string, unknown>;

interface CountRow {
  count: string;
}

interface LeadContextRow {
  id: string;
  connection_id: string;
  org_id: string;
}

interface LeadDetailRow extends UnknownRow {
  form_name?: string | null;
  form_questions?: unknown;
  assigned_user_email?: string | null;
}

interface LeadListFilters {
  status?: string | null;
  campaignId?: string | null;
  since?: string | null;
  until?: string | null;
  limit: number;
  offset: number;
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

function mapLeadDetail(row: LeadDetailRow): UnknownRow {
  const mapped: UnknownRow = { ...row };
  delete mapped.form_name;
  delete mapped.form_questions;
  delete mapped.assigned_user_email;

  mapped.meta_lead_forms = row.form_name
    ? {
        name: row.form_name,
        questions: row.form_questions ?? null,
      }
    : null;

  mapped.assigned_user = row.assigned_user_email
    ? { email: row.assigned_user_email }
    : null;

  return mapped;
}

export async function getLeadContextById(leadId: string): Promise<LeadContextRow | null> {
  const withOrgId = await tryRows<LeadContextRow>(
    `
      SELECT
        ml.id::text AS id,
        ml.connection_id::text AS connection_id,
        c.org_id::text AS org_id
      FROM meta_leads ml
      INNER JOIN client_meta_connections cmc ON cmc.id = ml.connection_id
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE ml.id = $1
      LIMIT 1
    `,
    [leadId]
  );

  if (withOrgId && withOrgId.length > 0) {
    return withOrgId[0];
  }

  const withOrganizationId = await tryRows<LeadContextRow>(
    `
      SELECT
        ml.id::text AS id,
        ml.connection_id::text AS connection_id,
        c.organization_id::text AS org_id
      FROM meta_leads ml
      INNER JOIN client_meta_connections cmc ON cmc.id = ml.connection_id
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE ml.id = $1
      LIMIT 1
    `,
    [leadId]
  );

  if (withOrganizationId && withOrganizationId.length > 0) {
    return withOrganizationId[0];
  }

  return null;
}

export async function listLeadsByConnectionId(
  connectionId: string,
  filters: LeadListFilters
): Promise<{ leads: UnknownRow[]; total: number }> {
  const whereParts = ['ml.connection_id = $1'];
  const values: unknown[] = [connectionId];

  if (filters.status) {
    values.push(filters.status);
    whereParts.push(`ml.status = $${values.length}`);
  }

  if (filters.campaignId) {
    values.push(filters.campaignId);
    whereParts.push(`ml.campaign_id = $${values.length}`);
  }

  if (filters.since) {
    values.push(`${filters.since}T00:00:00`);
    whereParts.push(`ml.created_time >= $${values.length}`);
  }

  if (filters.until) {
    values.push(`${filters.until}T23:59:59`);
    whereParts.push(`ml.created_time <= $${values.length}`);
  }

  const whereClause = whereParts.join(' AND ');

  const pool = getPostgresPool();
  const countQuery = `
    SELECT COUNT(*)::text AS count
    FROM meta_leads ml
    WHERE ${whereClause}
  `;
  const { rows: countRows } = await pool.query<CountRow>(countQuery, values);
  const total = Number(countRows[0]?.count ?? 0);

  values.push(filters.limit);
  values.push(filters.offset);

  const listQuery = `
    SELECT
      ml.*,
      CASE
        WHEN mlf.name IS NULL THEN NULL
        ELSE json_build_object('name', mlf.name)
      END AS meta_lead_forms
    FROM meta_leads ml
    LEFT JOIN meta_lead_forms mlf ON mlf.id = ml.form_id
    WHERE ${whereClause}
    ORDER BY ml.created_time DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;
  const { rows } = await pool.query<UnknownRow>(listQuery, values);

  return { leads: rows, total };
}

export async function getLeadByIdWithDetails(leadId: string): Promise<UnknownRow | null> {
  const withAssignedUser = await tryRows<LeadDetailRow>(
    `
      SELECT
        ml.*,
        mlf.name AS form_name,
        mlf.questions AS form_questions,
        au.email AS assigned_user_email
      FROM meta_leads ml
      LEFT JOIN meta_lead_forms mlf ON mlf.id = ml.form_id
      LEFT JOIN auth.users au ON au.id = ml.assigned_to
      WHERE ml.id = $1
      LIMIT 1
    `,
    [leadId]
  );

  if (withAssignedUser && withAssignedUser.length > 0) {
    return mapLeadDetail(withAssignedUser[0]);
  }

  const withoutAssignedUser = await tryRows<LeadDetailRow>(
    `
      SELECT
        ml.*,
        mlf.name AS form_name,
        mlf.questions AS form_questions
      FROM meta_leads ml
      LEFT JOIN meta_lead_forms mlf ON mlf.id = ml.form_id
      WHERE ml.id = $1
      LIMIT 1
    `,
    [leadId]
  );

  if (!withoutAssignedUser || withoutAssignedUser.length === 0) {
    return null;
  }

  return mapLeadDetail(withoutAssignedUser[0]);
}

export async function updateLeadById(
  leadId: string,
  patch: { status?: string; notes?: string | null; assigned_to?: string | null }
): Promise<UnknownRow | null> {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (patch.status !== undefined) {
    values.push(patch.status);
    updates.push(`status = $${values.length}`);
  }

  if (patch.notes !== undefined) {
    values.push(patch.notes);
    updates.push(`notes = $${values.length}`);
  }

  if (patch.assigned_to !== undefined) {
    values.push(patch.assigned_to);
    updates.push(`assigned_to = $${values.length}`);
  }

  if (updates.length === 0) {
    return getLeadByIdWithDetails(leadId);
  }

  values.push(new Date().toISOString());
  updates.push(`updated_at = $${values.length}`);
  values.push(leadId);

  const pool = getPostgresPool();
  const query = `
    UPDATE meta_leads
    SET ${updates.join(', ')}
    WHERE id = $${values.length}
    RETURNING id::text AS id
  `;
  const { rows } = await pool.query<{ id: string }>(query, values);

  if (!rows[0]) {
    return null;
  }

  return getLeadByIdWithDetails(rows[0].id);
}

export async function deleteLeadById(leadId: string): Promise<number> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    'DELETE FROM meta_leads WHERE id = $1',
    [leadId]
  );

  return rowCount ?? 0;
}

export async function listLeadFormsByConnectionId(connectionId: string): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT
        mlf.*,
        COUNT(ml.id)::int AS leads_count
      FROM meta_lead_forms mlf
      LEFT JOIN meta_leads ml ON ml.form_id = mlf.id
      WHERE mlf.connection_id = $1
      GROUP BY mlf.id
      ORDER BY mlf.created_at DESC
    `,
    [connectionId]
  );

  return rows;
}

export async function listLeadStatusesByConnectionId(connectionId: string): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT status
      FROM meta_leads
      WHERE connection_id = $1
    `,
    [connectionId]
  );

  return rows;
}

export async function listLeadCampaignStatsByConnectionId(connectionId: string): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT *
      FROM meta_lead_stats_by_campaign
      WHERE connection_id = $1
    `,
    [connectionId]
  );

  return rows;
}

export async function countRecentLeadsByConnectionId(
  connectionId: string,
  sinceIso: string
): Promise<number> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<CountRow>(
    `
      SELECT COUNT(*)::text AS count
      FROM meta_leads
      WHERE connection_id = $1
        AND created_time >= $2
    `,
    [connectionId, sinceIso]
  );

  return Number(rows[0]?.count ?? 0);
}
