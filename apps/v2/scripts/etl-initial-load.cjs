#!/usr/bin/env node

require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");

const postgres = require("postgres");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseArgs(argv) {
  const result = {
    dryRun: false,
    reportPath: path.resolve(
      process.cwd(),
      "reports",
      "gt15-initial-load-report.json",
    ),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }

    if (arg === "--report") {
      result.reportPath = path.resolve(
        process.cwd(),
        argv[i + 1] || result.reportPath,
      );
      i += 1;
    }
  }

  return result;
}

function maskDbUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "invalid-url";
  }
}

function normalizeDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    // prisma usa `schema=public`; postgres.js nao reconhece este parametro.
    parsed.searchParams.delete("schema");
    return parsed.toString();
  } catch {
    return url;
  }
}

function emptyEntityReport() {
  return {
    source: 0,
    loaded: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    targetCountAfter: null,
  };
}

function normalizeUserRole(rawRole, report) {
  const role = String(rawRole || "")
    .trim()
    .toUpperCase();
  if (role === "MASTER" || role === "REGULAR" || role === "CLIENT") {
    return role;
  }

  if (rawRole !== null && rawRole !== undefined && String(rawRole).trim() !== "") {
    report.divergences.invalidMembershipRole += 1;
  }
  return "REGULAR";
}

function normalizeCampaignStatus(rawStatus, report) {
  const status = String(rawStatus || "")
    .trim()
    .toUpperCase();
  if (
    status === "ACTIVE" ||
    status === "PAUSED" ||
    status === "ARCHIVED" ||
    status === "UNKNOWN"
  ) {
    return status;
  }

  if (rawStatus !== null && rawStatus !== undefined && String(rawStatus).trim() !== "") {
    report.divergences.invalidCampaignStatus += 1;
  }
  return "UNKNOWN";
}

async function getTableColumns(sql, tableName) {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `;

  return new Set(rows.map((row) => row.column_name));
}

async function fetchSourceData(sql, report) {
  const usersColumns = await getTableColumns(sql, "users");
  const usersHasSupabaseId = usersColumns.has("supabase_user_id");
  const usersHasFullName = usersColumns.has("full_name");

  const usersQuery = usersHasSupabaseId
    ? `
      SELECT
        id AS source_user_id,
        supabase_user_id,
        email,
        ${usersHasFullName ? "full_name" : "NULL::text AS full_name"},
        created_at,
        updated_at
      FROM users
    `
    : `
      SELECT
        id AS source_user_id,
        id AS supabase_user_id,
        email,
        ${usersHasFullName ? "full_name" : "NULL::text AS full_name"},
        created_at,
        updated_at
      FROM users
    `;

  try {
    return {
      users: await sql.unsafe(usersQuery),
      organizations: await sql`
        SELECT id, name, created_at, updated_at
        FROM organizations
      `,
      clients: await sql`
        SELECT id, organization_id, name, external_id, is_active, created_at, updated_at
        FROM clients
      `,
      memberships: await sql`
        SELECT id, user_id, organization_id, role, is_active, created_at, updated_at
        FROM memberships
      `,
      metaConnections: await sql`
        SELECT id, organization_id, client_id, provider, account_id, account_name, is_active, created_at, updated_at
        FROM meta_connections
      `,
      campaigns: await sql`
        SELECT
          id,
          organization_id,
          client_id,
          external_id,
          name,
          status,
          spend,
          impressions,
          clicks,
          leads,
          snapshot_date,
          created_at,
          updated_at
        FROM campaigns
      `,
    };
  } catch (error) {
    report.fatalError = `Falha ao consultar fonte: ${error instanceof Error ? error.message : "erro desconhecido"}`;
    throw error;
  }
}

async function run() {
  const startedAt = new Date();
  const args = parseArgs(process.argv.slice(2));

  const sourceUrlRaw = process.env.SOURCE_DATABASE_URL;
  const targetUrlRaw = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!sourceUrlRaw || !targetUrlRaw) {
    throw new Error(
      "Defina SOURCE_DATABASE_URL e DATABASE_URL (ou TARGET_DATABASE_URL) para executar a carga inicial.",
    );
  }

  const sourceUrl = normalizeDatabaseUrl(sourceUrlRaw);
  const targetUrl = normalizeDatabaseUrl(targetUrlRaw);

  process.env.DATABASE_URL = targetUrl;

  const sourceSql = postgres(sourceUrl, {
    max: 1,
    prepare: false,
  });
  const targetSql = postgres(targetUrl, {
    max: 1,
    prepare: false,
  });

  const report = {
    run: {
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      durationMs: 0,
      dryRun: args.dryRun,
    },
    config: {
      sourceDatabase: maskDbUrl(sourceUrlRaw),
      targetDatabase: maskDbUrl(targetUrlRaw),
    },
    entities: {
      users: emptyEntityReport(),
      organizations: emptyEntityReport(),
      clients: emptyEntityReport(),
      memberships: emptyEntityReport(),
      metaConnections: emptyEntityReport(),
      campaigns: emptyEntityReport(),
    },
    divergences: {
      usersMissingSupabaseId: 0,
      usersInvalidSupabaseId: 0,
      membershipsMissingMappedUser: 0,
      membershipsMissingOrganization: 0,
      clientsMissingOrganization: 0,
      metaConnectionsMissingOrganization: 0,
      metaConnectionsClientOrphaned: 0,
      campaignsMissingOrganization: 0,
      campaignsClientOrphaned: 0,
      campaignsMissingKeyFields: 0,
      invalidMembershipRole: 0,
      invalidCampaignStatus: 0,
    },
    summary: {
      sourceRows: 0,
      loadedRows: 0,
      skippedRows: 0,
      divergences: 0,
    },
    fatalError: null,
  };

  try {
    const source = await fetchSourceData(sourceSql, report);
    const userIdMap = new Map();
    const organizationIds = new Set();
    const clientIds = new Set();

    report.entities.users.source = source.users.length;
    for (const row of source.users) {
      const sourceUserId = row.source_user_id ? String(row.source_user_id) : null;
      const supabaseId = row.supabase_user_id ? String(row.supabase_user_id) : null;

      if (!sourceUserId || !supabaseId) {
        report.entities.users.skipped += 1;
        report.divergences.usersMissingSupabaseId += 1;
        continue;
      }

      if (!UUID_REGEX.test(supabaseId)) {
        report.entities.users.skipped += 1;
        report.divergences.usersInvalidSupabaseId += 1;
        continue;
      }

      userIdMap.set(sourceUserId, supabaseId);
      report.entities.users.loaded += 1;

      if (!args.dryRun) {
        const [upsertResult] = await targetSql`
          INSERT INTO users (id, email, full_name, last_login_at)
          VALUES (${supabaseId}::uuid, ${row.email ?? null}, ${row.full_name ?? null}, NULL)
          ON CONFLICT (id)
          DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name
          RETURNING (xmax = 0) AS inserted
        `;

        if (upsertResult?.inserted) {
          report.entities.users.created += 1;
        } else {
          report.entities.users.updated += 1;
        }
      }
    }

    report.entities.organizations.source = source.organizations.length;
    for (const row of source.organizations) {
      const organizationId = row.id ? String(row.id) : null;
      const name = row.name ? String(row.name) : null;

      if (!organizationId || !name) {
        report.entities.organizations.skipped += 1;
        continue;
      }

      organizationIds.add(organizationId);
      report.entities.organizations.loaded += 1;

      if (!args.dryRun) {
        const [upsertResult] = await targetSql`
          INSERT INTO organizations (id, name)
          VALUES (${organizationId}, ${name})
          ON CONFLICT (id)
          DO UPDATE SET
            name = EXCLUDED.name
          RETURNING (xmax = 0) AS inserted
        `;

        if (upsertResult?.inserted) {
          report.entities.organizations.created += 1;
        } else {
          report.entities.organizations.updated += 1;
        }
      }
    }

    report.entities.clients.source = source.clients.length;
    for (const row of source.clients) {
      const clientId = row.id ? String(row.id) : null;
      const organizationId = row.organization_id ? String(row.organization_id) : null;

      if (!clientId || !organizationId || !organizationIds.has(organizationId)) {
        report.entities.clients.skipped += 1;
        report.divergences.clientsMissingOrganization += 1;
        continue;
      }

      clientIds.add(clientId);
      report.entities.clients.loaded += 1;

      if (!args.dryRun) {
        const [upsertResult] = await targetSql`
          INSERT INTO clients (id, organization_id, name, external_id, is_active)
          VALUES (
            ${clientId},
            ${organizationId},
            ${String(row.name || "")},
            ${row.external_id ?? null},
            ${row.is_active ?? true}
          )
          ON CONFLICT (id)
          DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            name = EXCLUDED.name,
            external_id = EXCLUDED.external_id,
            is_active = EXCLUDED.is_active
          RETURNING (xmax = 0) AS inserted
        `;

        if (upsertResult?.inserted) {
          report.entities.clients.created += 1;
        } else {
          report.entities.clients.updated += 1;
        }
      }
    }

    report.entities.memberships.source = source.memberships.length;
    for (const row of source.memberships) {
      const membershipId = row.id ? String(row.id) : null;
      const sourceUserId = row.user_id ? String(row.user_id) : null;
      const organizationId = row.organization_id ? String(row.organization_id) : null;
      const mappedUserId = sourceUserId ? userIdMap.get(sourceUserId) : null;

      if (!membershipId || !organizationId || !organizationIds.has(organizationId)) {
        report.entities.memberships.skipped += 1;
        report.divergences.membershipsMissingOrganization += 1;
        continue;
      }

      if (!mappedUserId) {
        report.entities.memberships.skipped += 1;
        report.divergences.membershipsMissingMappedUser += 1;
        continue;
      }

      const role = normalizeUserRole(row.role, report);
      report.entities.memberships.loaded += 1;

      if (!args.dryRun) {
        const [upsertResult] = await targetSql`
          INSERT INTO memberships (id, user_id, organization_id, role, is_active)
          VALUES (
            ${membershipId},
            ${mappedUserId}::uuid,
            ${organizationId},
            ${role}::"UserRole",
            ${row.is_active ?? true}
          )
          ON CONFLICT (id)
          DO UPDATE SET
            user_id = EXCLUDED.user_id,
            organization_id = EXCLUDED.organization_id,
            role = EXCLUDED.role,
            is_active = EXCLUDED.is_active
          RETURNING (xmax = 0) AS inserted
        `;

        if (upsertResult?.inserted) {
          report.entities.memberships.created += 1;
        } else {
          report.entities.memberships.updated += 1;
        }
      }
    }

    report.entities.metaConnections.source = source.metaConnections.length;
    for (const row of source.metaConnections) {
      const connectionId = row.id ? String(row.id) : null;
      const organizationId = row.organization_id ? String(row.organization_id) : null;

      if (!connectionId || !organizationId || !organizationIds.has(organizationId)) {
        report.entities.metaConnections.skipped += 1;
        report.divergences.metaConnectionsMissingOrganization += 1;
        continue;
      }

      let normalizedClientId = row.client_id ? String(row.client_id) : null;
      if (normalizedClientId && !clientIds.has(normalizedClientId)) {
        normalizedClientId = null;
        report.divergences.metaConnectionsClientOrphaned += 1;
      }

      report.entities.metaConnections.loaded += 1;

      if (!args.dryRun) {
        const [upsertResult] = await targetSql`
          INSERT INTO meta_connections (
            id,
            organization_id,
            client_id,
            provider,
            account_id,
            account_name,
            is_active
          )
          VALUES (
            ${connectionId},
            ${organizationId},
            ${normalizedClientId},
            ${String(row.provider || "meta")},
            ${String(row.account_id || "")},
            ${row.account_name ?? null},
            ${row.is_active ?? true}
          )
          ON CONFLICT (id)
          DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            client_id = EXCLUDED.client_id,
            provider = EXCLUDED.provider,
            account_id = EXCLUDED.account_id,
            account_name = EXCLUDED.account_name,
            is_active = EXCLUDED.is_active
          RETURNING (xmax = 0) AS inserted
        `;

        if (upsertResult?.inserted) {
          report.entities.metaConnections.created += 1;
        } else {
          report.entities.metaConnections.updated += 1;
        }
      }
    }

    report.entities.campaigns.source = source.campaigns.length;
    for (const row of source.campaigns) {
      const campaignId = row.id ? String(row.id) : null;
      const organizationId = row.organization_id ? String(row.organization_id) : null;
      const externalId = row.external_id ? String(row.external_id) : null;
      const snapshotDate = row.snapshot_date ? new Date(row.snapshot_date) : null;

      if (!campaignId || !externalId || !snapshotDate || Number.isNaN(snapshotDate.valueOf())) {
        report.entities.campaigns.skipped += 1;
        report.divergences.campaignsMissingKeyFields += 1;
        continue;
      }

      if (!organizationId || !organizationIds.has(organizationId)) {
        report.entities.campaigns.skipped += 1;
        report.divergences.campaignsMissingOrganization += 1;
        continue;
      }

      let normalizedClientId = row.client_id ? String(row.client_id) : null;
      if (normalizedClientId && !clientIds.has(normalizedClientId)) {
        normalizedClientId = null;
        report.divergences.campaignsClientOrphaned += 1;
      }

      const status = normalizeCampaignStatus(row.status, report);
      report.entities.campaigns.loaded += 1;

      if (!args.dryRun) {
        const [upsertResult] = await targetSql`
          INSERT INTO campaigns (
            id,
            organization_id,
            client_id,
            external_id,
            name,
            status,
            spend,
            impressions,
            clicks,
            leads,
            snapshot_date
          )
          VALUES (
            ${campaignId},
            ${organizationId},
            ${normalizedClientId},
            ${externalId},
            ${String(row.name || "")},
            ${status}::"CampaignStatus",
            ${row.spend === null || row.spend === undefined ? null : String(row.spend)},
            ${row.impressions ?? null},
            ${row.clicks ?? null},
            ${row.leads ?? null},
            ${snapshotDate.toISOString()}
          )
          ON CONFLICT (id)
          DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            client_id = EXCLUDED.client_id,
            external_id = EXCLUDED.external_id,
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            spend = EXCLUDED.spend,
            impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks,
            leads = EXCLUDED.leads,
            snapshot_date = EXCLUDED.snapshot_date
          RETURNING (xmax = 0) AS inserted
        `;

        if (upsertResult?.inserted) {
          report.entities.campaigns.created += 1;
        } else {
          report.entities.campaigns.updated += 1;
        }
      }
    }

    if (!args.dryRun) {
      report.entities.users.targetCountAfter = Number(
        (await targetSql`SELECT COUNT(*)::int AS count FROM users`)[0]?.count ?? 0,
      );
      report.entities.organizations.targetCountAfter = Number(
        (await targetSql`SELECT COUNT(*)::int AS count FROM organizations`)[0]?.count ?? 0,
      );
      report.entities.clients.targetCountAfter = Number(
        (await targetSql`SELECT COUNT(*)::int AS count FROM clients`)[0]?.count ?? 0,
      );
      report.entities.memberships.targetCountAfter = Number(
        (await targetSql`SELECT COUNT(*)::int AS count FROM memberships`)[0]?.count ?? 0,
      );
      report.entities.metaConnections.targetCountAfter = Number(
        (await targetSql`SELECT COUNT(*)::int AS count FROM meta_connections`)[0]?.count ?? 0,
      );
      report.entities.campaigns.targetCountAfter = Number(
        (await targetSql`SELECT COUNT(*)::int AS count FROM campaigns`)[0]?.count ?? 0,
      );
    }

    report.summary.sourceRows = Object.values(report.entities).reduce(
      (acc, current) => acc + current.source,
      0,
    );
    report.summary.loadedRows = Object.values(report.entities).reduce(
      (acc, current) => acc + current.loaded,
      0,
    );
    report.summary.skippedRows = Object.values(report.entities).reduce(
      (acc, current) => acc + current.skipped,
      0,
    );
    report.summary.divergences = Object.values(report.divergences).reduce(
      (acc, current) => acc + current,
      0,
    );
  } finally {
    await sourceSql.end({ timeout: 5 });
    await targetSql.end({ timeout: 5 });
    const finishedAt = new Date();
    report.run.finishedAt = finishedAt.toISOString();
    report.run.durationMs = finishedAt.getTime() - startedAt.getTime();

    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("");
    console.log("GT-15 ETL concluido.");
    console.log(`- Dry run: ${report.run.dryRun ? "sim" : "nao"}`);
    console.log(`- Fonte: ${report.config.sourceDatabase}`);
    console.log(`- Destino: ${report.config.targetDatabase}`);
    console.log(`- Source rows: ${report.summary.sourceRows}`);
    console.log(`- Loaded rows: ${report.summary.loadedRows}`);
    console.log(`- Skipped rows: ${report.summary.skippedRows}`);
    console.log(`- Divergences: ${report.summary.divergences}`);
    console.log(`- Report: ${args.reportPath}`);
    console.log("");
  }
}

run().catch((error) => {
  console.error("Falha na carga inicial GT-15:");
  console.error(error);
  process.exitCode = 1;
});
