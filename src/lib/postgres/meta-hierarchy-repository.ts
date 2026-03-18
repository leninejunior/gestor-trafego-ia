import { getPostgresPool } from '@/lib/postgres/client';

type UnknownRow = Record<string, unknown>;

interface ContextRow extends UnknownRow {
  id: string;
  connection_id: string;
  client_id: string;
  ad_account_id: string | null;
  org_id: string;
}

interface AdStatusContextRow extends UnknownRow {
  id: string;
  external_id: string;
  connection_id: string | null;
  client_id: string | null;
  ad_account_id: string | null;
  access_token: string | null;
  is_active: boolean | null;
  org_id: string | null;
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

async function queryCampaignRows(
  whereClause: string,
  value: string
): Promise<ContextRow[] | null> {
  const withOrgId = await tryRows<ContextRow>(
    `
      SELECT
        mc.id::text AS id,
        mc.connection_id::text AS connection_id,
        cmc.client_id::text AS client_id,
        cmc.ad_account_id::text AS ad_account_id,
        c.org_id::text AS org_id
      FROM meta_campaigns mc
      INNER JOIN client_meta_connections cmc ON cmc.id = mc.connection_id
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE ${whereClause}
      LIMIT 2
    `,
    [value]
  );

  if (withOrgId !== null) {
    return withOrgId;
  }

  return tryRows<ContextRow>(
    `
      SELECT
        mc.id::text AS id,
        mc.connection_id::text AS connection_id,
        cmc.client_id::text AS client_id,
        cmc.ad_account_id::text AS ad_account_id,
        c.organization_id::text AS org_id
      FROM meta_campaigns mc
      INNER JOIN client_meta_connections cmc ON cmc.id = mc.connection_id
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE ${whereClause}
      LIMIT 2
    `,
    [value]
  );
}

async function queryAdsetRows(whereClause: string, value: string): Promise<ContextRow[] | null> {
  const withOrgId = await tryRows<ContextRow>(
    `
      SELECT
        mas.id::text AS id,
        mas.connection_id::text AS connection_id,
        cmc.client_id::text AS client_id,
        cmc.ad_account_id::text AS ad_account_id,
        c.org_id::text AS org_id
      FROM meta_adsets mas
      INNER JOIN client_meta_connections cmc ON cmc.id = mas.connection_id
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE ${whereClause}
      LIMIT 2
    `,
    [value]
  );

  if (withOrgId !== null) {
    return withOrgId;
  }

  return tryRows<ContextRow>(
    `
      SELECT
        mas.id::text AS id,
        mas.connection_id::text AS connection_id,
        cmc.client_id::text AS client_id,
        cmc.ad_account_id::text AS ad_account_id,
        c.organization_id::text AS org_id
      FROM meta_adsets mas
      INNER JOIN client_meta_connections cmc ON cmc.id = mas.connection_id
      INNER JOIN clients c ON c.id = cmc.client_id
      WHERE ${whereClause}
      LIMIT 2
    `,
    [value]
  );
}

function pickSingleRow<T>(rows: T[] | null): T | null {
  if (!rows || rows.length !== 1) {
    return null;
  }

  return rows[0];
}

export async function getCampaignContextByIdentifier(campaignIdentifier: string): Promise<ContextRow | null> {
  const byId = await queryCampaignRows('mc.id = $1', campaignIdentifier);
  const campaignById = pickSingleRow(byId);
  if (campaignById) {
    return campaignById;
  }

  const byExternalId = await queryCampaignRows('mc.external_id = $1', campaignIdentifier);
  const campaignByExternalId = pickSingleRow(byExternalId);
  if (campaignByExternalId) {
    return campaignByExternalId;
  }

  const byCampaignId = await queryCampaignRows('mc.campaign_id = $1', campaignIdentifier);
  return pickSingleRow(byCampaignId);
}

export async function getAdsetContextByIdentifier(adsetIdentifier: string): Promise<ContextRow | null> {
  const byId = await queryAdsetRows('mas.id = $1', adsetIdentifier);
  const adsetById = pickSingleRow(byId);
  if (adsetById) {
    return adsetById;
  }

  const byExternalId = await queryAdsetRows('mas.external_id = $1', adsetIdentifier);
  return pickSingleRow(byExternalId);
}

export async function listAdsetsByCampaignId(campaignId: string): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT *
      FROM meta_adsets
      WHERE campaign_id = $1
      ORDER BY name
    `,
    [campaignId]
  );

  return rows;
}

export async function listAdsByAdsetId(adsetId: string): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<UnknownRow>(
    `
      SELECT *
      FROM meta_ads
      WHERE adset_id = $1
      ORDER BY name
    `,
    [adsetId]
  );

  return rows;
}

export async function listAdsetInsightsByAdsetId(
  adsetId: string,
  since?: string | null,
  until?: string | null
): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const hasRange = Boolean(since && until);

  const query = hasRange
    ? `
      SELECT *
      FROM meta_adset_insights
      WHERE adset_id = $1
        AND date_start <= $2
        AND date_stop >= $3
      ORDER BY date_start DESC
    `
    : `
      SELECT *
      FROM meta_adset_insights
      WHERE adset_id = $1
      ORDER BY date_start DESC
    `;

  const values = hasRange ? [adsetId, until as string, since as string] : [adsetId];
  const { rows } = await pool.query<UnknownRow>(query, values);
  return rows;
}

export async function listAdInsightsByAdId(
  adId: string,
  since?: string | null,
  until?: string | null
): Promise<UnknownRow[]> {
  const pool = getPostgresPool();
  const hasRange = Boolean(since && until);

  const query = hasRange
    ? `
      SELECT *
      FROM meta_ad_insights
      WHERE ad_id = $1
        AND date_start <= $2
        AND date_stop >= $3
      ORDER BY date_start DESC
    `
    : `
      SELECT *
      FROM meta_ad_insights
      WHERE ad_id = $1
      ORDER BY date_start DESC
    `;

  const values = hasRange ? [adId, until as string, since as string] : [adId];
  const { rows } = await pool.query<UnknownRow>(query, values);
  return rows;
}

export async function getAdStatusContextByExternalId(adExternalId: string): Promise<AdStatusContextRow | null> {
  const withOrgId = await tryRows<AdStatusContextRow>(
    `
      SELECT
        ma.id::text AS id,
        ma.external_id::text AS external_id,
        COALESCE(ma.connection_id::text, mas.connection_id::text, mc.connection_id::text) AS connection_id,
        cmc.client_id::text AS client_id,
        cmc.ad_account_id::text AS ad_account_id,
        cmc.access_token,
        cmc.is_active,
        c.org_id::text AS org_id
      FROM meta_ads ma
      LEFT JOIN meta_adsets mas ON mas.id = ma.adset_id
      LEFT JOIN meta_campaigns mc ON mc.id = mas.campaign_id
      LEFT JOIN client_meta_connections cmc ON cmc.id = COALESCE(ma.connection_id, mas.connection_id, mc.connection_id)
      LEFT JOIN clients c ON c.id = cmc.client_id
      WHERE ma.external_id = $1
      LIMIT 2
    `,
    [adExternalId]
  );

  const byOrgId = pickSingleRow(withOrgId);
  if (byOrgId) {
    return byOrgId;
  }

  const withOrganizationId = await tryRows<AdStatusContextRow>(
    `
      SELECT
        ma.id::text AS id,
        ma.external_id::text AS external_id,
        COALESCE(ma.connection_id::text, mas.connection_id::text, mc.connection_id::text) AS connection_id,
        cmc.client_id::text AS client_id,
        cmc.ad_account_id::text AS ad_account_id,
        cmc.access_token,
        cmc.is_active,
        c.organization_id::text AS org_id
      FROM meta_ads ma
      LEFT JOIN meta_adsets mas ON mas.id = ma.adset_id
      LEFT JOIN meta_campaigns mc ON mc.id = mas.campaign_id
      LEFT JOIN client_meta_connections cmc ON cmc.id = COALESCE(ma.connection_id, mas.connection_id, mc.connection_id)
      LEFT JOIN clients c ON c.id = cmc.client_id
      WHERE ma.external_id = $1
      LIMIT 2
    `,
    [adExternalId]
  );

  return pickSingleRow(withOrganizationId);
}

export async function updateMetaAdStatusByExternalId(adExternalId: string, status: string): Promise<number> {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `
      UPDATE meta_ads
      SET status = $2, updated_at = $3
      WHERE external_id = $1
    `,
    [adExternalId, status, new Date().toISOString()]
  );

  return rowCount ?? 0;
}
