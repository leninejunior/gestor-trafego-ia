#!/usr/bin/env node

require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");

const postgres = require("postgres");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseArgs(argv) {
  const result = {
    dryRun: false,
    since: null,
    mode: "auto",
    retryMaxAttempts: parsePositiveInteger(process.env.DELTA_RETRY_MAX_ATTEMPTS, 3),
    retryBaseDelayMs: parsePositiveInteger(process.env.DELTA_RETRY_BASE_DELAY_MS, 300),
    reportPath: path.resolve(process.cwd(), "reports", "gt16-delta-report.json"),
    statePath: path.resolve(process.cwd(), "reports", "gt16-delta-state.json"),
    logPath: path.resolve(process.cwd(), "reports", "gt16-delta.log"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }

    if (arg === "--since") {
      result.since = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (arg === "--mode") {
      result.mode = (argv[i + 1] || "auto").toLowerCase();
      i += 1;
      continue;
    }

    if (arg === "--retry-attempts") {
      result.retryMaxAttempts = parsePositiveInteger(argv[i + 1], result.retryMaxAttempts);
      i += 1;
      continue;
    }

    if (arg === "--retry-delay-ms") {
      result.retryBaseDelayMs = parsePositiveInteger(argv[i + 1], result.retryBaseDelayMs);
      i += 1;
      continue;
    }

    if (arg === "--report") {
      result.reportPath = path.resolve(process.cwd(), argv[i + 1] || result.reportPath);
      i += 1;
      continue;
    }

    if (arg === "--state") {
      result.statePath = path.resolve(process.cwd(), argv[i + 1] || result.statePath);
      i += 1;
      continue;
    }

    if (arg === "--log-file") {
      result.logPath = path.resolve(process.cwd(), argv[i + 1] || result.logPath);
      i += 1;
      continue;
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

function parseDateInput(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${label} invalido: ${String(value)}`);
  }
  return date;
}

function readStateFile(statePath) {
  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function resolveSince(args, state) {
  if (args.since) {
    return {
      since: parseDateInput(args.since, "Parametro --since"),
      source: "arg",
    };
  }

  if (process.env.DELTA_SINCE) {
    return {
      since: parseDateInput(process.env.DELTA_SINCE, "Variavel DELTA_SINCE"),
      source: "env",
    };
  }

  if (state?.nextSince) {
    return {
      since: parseDateInput(state.nextSince, "state.nextSince"),
      source: "state.nextSince",
    };
  }

  if (state?.lastSuccessAt) {
    return {
      since: parseDateInput(state.lastSuccessAt, "state.lastSuccessAt"),
      source: "state.lastSuccessAt",
    };
  }

  return {
    since: new Date(0),
    source: "default.epoch",
  };
}

function createLogger(logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const write = (level, event, context = {}) => {
    const ts = new Date().toISOString();
    const entry = {
      ts,
      level,
      event,
      ...context,
    };

    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf-8");

    const details = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    console.log(`[${ts}] ${level.toUpperCase()} ${event}${details}`);
  };

  return {
    info: (event, context) => write("info", event, context),
    warn: (event, context) => write("warn", event, context),
    error: (event, context) => write("error", event, context),
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRetry(taskName, fn, retryConfig, logger, report) {
  const maxAttempts = retryConfig.maxAttempts;
  const baseDelayMs = retryConfig.baseDelayMs;
  let hadFailure = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await fn();
      if (hadFailure) {
        report.retry.operationsRetried += 1;
        logger.info("retry.succeeded", { taskName, attempt });
      }
      return result;
    } catch (error) {
      hadFailure = true;
      const message = error instanceof Error ? error.message : String(error);
      logger.error("operation.failed", {
        taskName,
        attempt,
        maxAttempts,
        error: message,
      });

      if (attempt >= maxAttempts) {
        report.retry.exhaustedFailures += 1;
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      logger.warn("operation.retrying", {
        taskName,
        nextAttempt: attempt + 1,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  throw new Error(`Retry loop esgotado para ${taskName}`);
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

async function getTableColumns(sql, tableName, retryConfig, logger, report) {
  const rows = await withRetry(
    `source.columns.${tableName}`,
    async () =>
      sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
      `,
    retryConfig,
    logger,
    report,
  );

  return new Set(rows.map((row) => row.column_name));
}

async function hasSyncChangelog(sql, retryConfig, logger, report) {
  const columns = await getTableColumns(sql, "sync_changelog", retryConfig, logger, report);
  if (columns.size === 0) {
    return false;
  }

  return (
    columns.has("entity_name") && columns.has("record_id") && columns.has("changed_at")
  );
}

function buildTimestampWhereClause(columns, sinceIso) {
  const hasUpdatedAt = columns.has("updated_at");
  const hasCreatedAt = columns.has("created_at");

  if (hasUpdatedAt && hasCreatedAt) {
    return `COALESCE(updated_at, created_at) >= '${sinceIso}'::timestamptz`;
  }

  if (hasUpdatedAt) {
    return `updated_at >= '${sinceIso}'::timestamptz`;
  }

  if (hasCreatedAt) {
    return `created_at >= '${sinceIso}'::timestamptz`;
  }

  return null;
}

function buildDeltaWhereClause({ modeResolved, columns, entityName, sinceIso, report, logger }) {
  if (modeResolved === "changelog") {
    return `id::text IN (
      SELECT DISTINCT record_id::text
      FROM sync_changelog
      WHERE entity_name = '${entityName}'
        AND changed_at >= '${sinceIso}'::timestamptz
    )`;
  }

  const clause = buildTimestampWhereClause(columns, sinceIso);
  if (!clause) {
    report.divergences.entitiesWithoutTimestampFilter += 1;
    logger.warn("source.timestamp.filter.missing", { entityName });
    return null;
  }

  return clause;
}

async function fetchSourceData(sql, report, logger, retryConfig, since, modeResolved) {
  const sinceIso = since.toISOString();

  const usersColumns = await getTableColumns(sql, "users", retryConfig, logger, report);
  const organizationsColumns = await getTableColumns(
    sql,
    "organizations",
    retryConfig,
    logger,
    report,
  );
  const clientsColumns = await getTableColumns(sql, "clients", retryConfig, logger, report);
  const membershipsColumns = await getTableColumns(
    sql,
    "memberships",
    retryConfig,
    logger,
    report,
  );
  const metaConnectionsColumns = await getTableColumns(
    sql,
    "meta_connections",
    retryConfig,
    logger,
    report,
  );
  const campaignsColumns = await getTableColumns(sql, "campaigns", retryConfig, logger, report);

  const usersHasSupabaseId = usersColumns.has("supabase_user_id");
  const usersHasFullName = usersColumns.has("full_name");

  const usersWhere = buildDeltaWhereClause({
    modeResolved,
    columns: usersColumns,
    entityName: "users",
    sinceIso,
    report,
    logger,
  });
  const organizationsWhere = buildDeltaWhereClause({
    modeResolved,
    columns: organizationsColumns,
    entityName: "organizations",
    sinceIso,
    report,
    logger,
  });
  const clientsWhere = buildDeltaWhereClause({
    modeResolved,
    columns: clientsColumns,
    entityName: "clients",
    sinceIso,
    report,
    logger,
  });
  const membershipsWhere = buildDeltaWhereClause({
    modeResolved,
    columns: membershipsColumns,
    entityName: "memberships",
    sinceIso,
    report,
    logger,
  });
  const metaConnectionsWhere = buildDeltaWhereClause({
    modeResolved,
    columns: metaConnectionsColumns,
    entityName: "meta_connections",
    sinceIso,
    report,
    logger,
  });
  const campaignsWhere = buildDeltaWhereClause({
    modeResolved,
    columns: campaignsColumns,
    entityName: "campaigns",
    sinceIso,
    report,
    logger,
  });

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
      ${usersWhere ? `WHERE ${usersWhere}` : ""}
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
      ${usersWhere ? `WHERE ${usersWhere}` : ""}
    `;

  const organizationsQuery = `
    SELECT id, name, created_at, updated_at
    FROM organizations
    ${organizationsWhere ? `WHERE ${organizationsWhere}` : ""}
  `;

  const clientsQuery = `
    SELECT id, organization_id, name, external_id, is_active, created_at, updated_at
    FROM clients
    ${clientsWhere ? `WHERE ${clientsWhere}` : ""}
  `;

  const membershipsQuery = `
    SELECT id, user_id, organization_id, role, is_active, created_at, updated_at
    FROM memberships
    ${membershipsWhere ? `WHERE ${membershipsWhere}` : ""}
  `;

  const metaConnectionsQuery = `
    SELECT id, organization_id, client_id, provider, account_id, account_name, is_active, created_at, updated_at
    FROM meta_connections
    ${metaConnectionsWhere ? `WHERE ${metaConnectionsWhere}` : ""}
  `;

  const campaignsQuery = `
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
    ${campaignsWhere ? `WHERE ${campaignsWhere}` : ""}
  `;

  try {
    const users = await withRetry(
      "source.users.select",
      async () => sql.unsafe(usersQuery),
      retryConfig,
      logger,
      report,
    );
    const organizations = await withRetry(
      "source.organizations.select",
      async () => sql.unsafe(organizationsQuery),
      retryConfig,
      logger,
      report,
    );
    const clients = await withRetry(
      "source.clients.select",
      async () => sql.unsafe(clientsQuery),
      retryConfig,
      logger,
      report,
    );
    const memberships = await withRetry(
      "source.memberships.select",
      async () => sql.unsafe(membershipsQuery),
      retryConfig,
      logger,
      report,
    );
    const metaConnections = await withRetry(
      "source.meta_connections.select",
      async () => sql.unsafe(metaConnectionsQuery),
      retryConfig,
      logger,
      report,
    );
    const campaigns = await withRetry(
      "source.campaigns.select",
      async () => sql.unsafe(campaignsQuery),
      retryConfig,
      logger,
      report,
    );

    logger.info("source.delta.loaded", {
      users: users.length,
      organizations: organizations.length,
      clients: clients.length,
      memberships: memberships.length,
      metaConnections: metaConnections.length,
      campaigns: campaigns.length,
    });

    return {
      rows: {
        users,
        organizations,
        clients,
        memberships,
        metaConnections,
        campaigns,
      },
      usersMeta: {
        usersHasSupabaseId,
        usersHasFullName,
      },
    };
  } catch (error) {
    report.fatalError = `Falha ao consultar delta da fonte: ${error instanceof Error ? error.message : "erro desconhecido"}`;
    throw error;
  }
}

function uniqueBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!key) {
      continue;
    }
    map.set(key, item);
  }
  return Array.from(map.values());
}

async function fetchSupplementalUsers(
  sourceSql,
  sourceUserIds,
  usersMeta,
  retryConfig,
  logger,
  report,
) {
  if (sourceUserIds.length === 0) {
    return [];
  }

  const quotedIds = sourceUserIds
    .map((id) => `'${String(id).replace(/'/g, "''")}'`)
    .join(",");

  if (!quotedIds) {
    return [];
  }

  const query = usersMeta.usersHasSupabaseId
    ? `
      SELECT
        id AS source_user_id,
        supabase_user_id,
        email,
        ${usersMeta.usersHasFullName ? "full_name" : "NULL::text AS full_name"},
        created_at,
        updated_at
      FROM users
      WHERE id::text IN (${quotedIds})
    `
    : `
      SELECT
        id AS source_user_id,
        id AS supabase_user_id,
        email,
        ${usersMeta.usersHasFullName ? "full_name" : "NULL::text AS full_name"},
        created_at,
        updated_at
      FROM users
      WHERE id::text IN (${quotedIds})
    `;

  return withRetry(
    "source.users.supplemental",
    async () => sourceSql.unsafe(query),
    retryConfig,
    logger,
    report,
  );
}

async function fetchTargetIdSet(targetSql, tableName, retryConfig, logger, report) {
  const rows = await withRetry(
    `target.${tableName}.ids`,
    async () => targetSql.unsafe(`SELECT id::text AS id FROM ${tableName}`),
    retryConfig,
    logger,
    report,
  );

  return new Set(rows.map((row) => String(row.id)));
}

function updateHighWatermark(report, row) {
  const candidates = [row?.updated_at, row?.created_at, row?.snapshot_date];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const date = new Date(candidate);
    if (Number.isNaN(date.valueOf())) {
      continue;
    }

    const current = report.summary.maxSourceTimestamp
      ? new Date(report.summary.maxSourceTimestamp)
      : null;

    if (!current || date.getTime() > current.getTime()) {
      report.summary.maxSourceTimestamp = date.toISOString();
    }
  }
}

async function run() {
  const startedAt = new Date();
  const args = parseArgs(process.argv.slice(2));

  if (!["auto", "timestamp", "changelog"].includes(args.mode)) {
    throw new Error("Parametro --mode invalido. Use: auto, timestamp ou changelog.");
  }

  const sourceUrlRaw = process.env.SOURCE_DATABASE_URL;
  const targetUrlRaw = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!sourceUrlRaw || !targetUrlRaw) {
    throw new Error(
      "Defina SOURCE_DATABASE_URL e DATABASE_URL (ou TARGET_DATABASE_URL) para executar o sync delta.",
    );
  }

  const sourceUrl = normalizeDatabaseUrl(sourceUrlRaw);
  const targetUrl = normalizeDatabaseUrl(targetUrlRaw);
  const state = readStateFile(args.statePath);
  const sinceResolution = resolveSince(args, state);
  const retryConfig = {
    maxAttempts: args.retryMaxAttempts,
    baseDelayMs: args.retryBaseDelayMs,
  };

  const logger = createLogger(args.logPath);

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
      modeRequested: args.mode,
      modeResolved: null,
      since: sinceResolution.since.toISOString(),
      sinceSource: sinceResolution.source,
      stateUpdated: false,
    },
    files: {
      reportPath: args.reportPath,
      statePath: args.statePath,
      logPath: args.logPath,
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
      usersSupplementalLookupMiss: 0,
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
      entitiesWithoutTimestampFilter: 0,
      changelogFallbackToTimestamp: 0,
    },
    retry: {
      maxAttempts: retryConfig.maxAttempts,
      baseDelayMs: retryConfig.baseDelayMs,
      operationsRetried: 0,
      exhaustedFailures: 0,
    },
    summary: {
      sourceDeltaRows: 0,
      loadedRows: 0,
      skippedRows: 0,
      divergences: 0,
      maxSourceTimestamp: null,
      nextSince: null,
    },
    fatalError: null,
  };

  logger.info("delta.run.start", {
    modeRequested: args.mode,
    since: report.run.since,
    dryRun: args.dryRun,
  });

  try {
    const changelogAvailable = await hasSyncChangelog(
      sourceSql,
      retryConfig,
      logger,
      report,
    );

    let modeResolved = "timestamp";
    if (args.mode === "changelog") {
      if (changelogAvailable) {
        modeResolved = "changelog";
      } else {
        modeResolved = "timestamp";
        report.divergences.changelogFallbackToTimestamp += 1;
        logger.warn("delta.mode.fallback", {
          requested: "changelog",
          resolved: "timestamp",
          reason: "sync_changelog indisponivel",
        });
      }
    } else if (args.mode === "auto") {
      modeResolved = changelogAvailable ? "changelog" : "timestamp";
    }

    report.run.modeResolved = modeResolved;

    const fetched = await fetchSourceData(
      sourceSql,
      report,
      logger,
      retryConfig,
      sinceResolution.since,
      modeResolved,
    );

    const source = fetched.rows;
    const usersMeta = fetched.usersMeta;

    const membershipUserIds = Array.from(
      new Set(
        source.memberships
          .map((row) => (row.user_id ? String(row.user_id) : null))
          .filter(Boolean),
      ),
    );

    const usersAlreadyInDelta = new Set(
      source.users
        .map((row) => (row.source_user_id ? String(row.source_user_id) : null))
        .filter(Boolean),
    );

    const missingSupplementalIds = membershipUserIds.filter(
      (sourceUserId) => !usersAlreadyInDelta.has(sourceUserId),
    );

    if (missingSupplementalIds.length > 0) {
      logger.info("source.users.supplemental.lookup.start", {
        missingIds: missingSupplementalIds.length,
      });

      const supplementalUsers = await fetchSupplementalUsers(
        sourceSql,
        missingSupplementalIds,
        usersMeta,
        retryConfig,
        logger,
        report,
      );

      const foundIds = new Set(
        supplementalUsers
          .map((row) => (row.source_user_id ? String(row.source_user_id) : null))
          .filter(Boolean),
      );

      for (const sourceUserId of missingSupplementalIds) {
        if (!foundIds.has(sourceUserId)) {
          report.divergences.usersSupplementalLookupMiss += 1;
        }
      }

      source.users = uniqueBy(
        [...source.users, ...supplementalUsers],
        (row) => (row.source_user_id ? String(row.source_user_id) : null),
      );
    }

    const organizationIds = await fetchTargetIdSet(
      targetSql,
      "organizations",
      retryConfig,
      logger,
      report,
    );
    const clientIds = await fetchTargetIdSet(
      targetSql,
      "clients",
      retryConfig,
      logger,
      report,
    );

    const userIdMap = new Map();

    report.entities.users.source = source.users.length;
    for (const row of source.users) {
      updateHighWatermark(report, row);

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
        const [upsertResult] = await withRetry(
          "target.users.upsert",
          async () =>
            targetSql`
              INSERT INTO users (id, email, full_name, last_login_at)
              VALUES (${supabaseId}::uuid, ${row.email ?? null}, ${row.full_name ?? null}, NULL)
              ON CONFLICT (id)
              DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name
              RETURNING (xmax = 0) AS inserted
            `,
          retryConfig,
          logger,
          report,
        );

        if (upsertResult?.inserted) {
          report.entities.users.created += 1;
        } else {
          report.entities.users.updated += 1;
        }
      }
    }

    report.entities.organizations.source = source.organizations.length;
    for (const row of source.organizations) {
      updateHighWatermark(report, row);

      const organizationId = row.id ? String(row.id) : null;
      const name = row.name ? String(row.name) : null;

      if (!organizationId || !name) {
        report.entities.organizations.skipped += 1;
        continue;
      }

      organizationIds.add(organizationId);
      report.entities.organizations.loaded += 1;

      if (!args.dryRun) {
        const [upsertResult] = await withRetry(
          "target.organizations.upsert",
          async () =>
            targetSql`
              INSERT INTO organizations (id, name)
              VALUES (${organizationId}, ${name})
              ON CONFLICT (id)
              DO UPDATE SET
                name = EXCLUDED.name
              RETURNING (xmax = 0) AS inserted
            `,
          retryConfig,
          logger,
          report,
        );

        if (upsertResult?.inserted) {
          report.entities.organizations.created += 1;
        } else {
          report.entities.organizations.updated += 1;
        }
      }
    }

    report.entities.clients.source = source.clients.length;
    for (const row of source.clients) {
      updateHighWatermark(report, row);

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
        const [upsertResult] = await withRetry(
          "target.clients.upsert",
          async () =>
            targetSql`
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
            `,
          retryConfig,
          logger,
          report,
        );

        if (upsertResult?.inserted) {
          report.entities.clients.created += 1;
        } else {
          report.entities.clients.updated += 1;
        }
      }
    }

    report.entities.memberships.source = source.memberships.length;
    for (const row of source.memberships) {
      updateHighWatermark(report, row);

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
        const [upsertResult] = await withRetry(
          "target.memberships.upsert",
          async () =>
            targetSql`
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
            `,
          retryConfig,
          logger,
          report,
        );

        if (upsertResult?.inserted) {
          report.entities.memberships.created += 1;
        } else {
          report.entities.memberships.updated += 1;
        }
      }
    }

    report.entities.metaConnections.source = source.metaConnections.length;
    for (const row of source.metaConnections) {
      updateHighWatermark(report, row);

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
        const [upsertResult] = await withRetry(
          "target.meta_connections.upsert",
          async () =>
            targetSql`
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
            `,
          retryConfig,
          logger,
          report,
        );

        if (upsertResult?.inserted) {
          report.entities.metaConnections.created += 1;
        } else {
          report.entities.metaConnections.updated += 1;
        }
      }
    }

    report.entities.campaigns.source = source.campaigns.length;
    for (const row of source.campaigns) {
      updateHighWatermark(report, row);

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
        const [upsertResult] = await withRetry(
          "target.campaigns.upsert",
          async () =>
            targetSql`
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
            `,
          retryConfig,
          logger,
          report,
        );

        if (upsertResult?.inserted) {
          report.entities.campaigns.created += 1;
        } else {
          report.entities.campaigns.updated += 1;
        }
      }
    }

    if (!args.dryRun) {
      report.entities.users.targetCountAfter = Number(
        (
          await withRetry(
            "target.users.count",
            async () => targetSql`SELECT COUNT(*)::int AS count FROM users`,
            retryConfig,
            logger,
            report,
          )
        )[0]?.count ?? 0,
      );
      report.entities.organizations.targetCountAfter = Number(
        (
          await withRetry(
            "target.organizations.count",
            async () => targetSql`SELECT COUNT(*)::int AS count FROM organizations`,
            retryConfig,
            logger,
            report,
          )
        )[0]?.count ?? 0,
      );
      report.entities.clients.targetCountAfter = Number(
        (
          await withRetry(
            "target.clients.count",
            async () => targetSql`SELECT COUNT(*)::int AS count FROM clients`,
            retryConfig,
            logger,
            report,
          )
        )[0]?.count ?? 0,
      );
      report.entities.memberships.targetCountAfter = Number(
        (
          await withRetry(
            "target.memberships.count",
            async () => targetSql`SELECT COUNT(*)::int AS count FROM memberships`,
            retryConfig,
            logger,
            report,
          )
        )[0]?.count ?? 0,
      );
      report.entities.metaConnections.targetCountAfter = Number(
        (
          await withRetry(
            "target.meta_connections.count",
            async () => targetSql`SELECT COUNT(*)::int AS count FROM meta_connections`,
            retryConfig,
            logger,
            report,
          )
        )[0]?.count ?? 0,
      );
      report.entities.campaigns.targetCountAfter = Number(
        (
          await withRetry(
            "target.campaigns.count",
            async () => targetSql`SELECT COUNT(*)::int AS count FROM campaigns`,
            retryConfig,
            logger,
            report,
          )
        )[0]?.count ?? 0,
      );
    }

    report.summary.sourceDeltaRows = Object.values(report.entities).reduce(
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

    report.summary.nextSince = report.summary.maxSourceTimestamp || new Date().toISOString();

    if (!args.dryRun) {
      const newState = {
        lastSuccessAt: new Date().toISOString(),
        nextSince: report.summary.nextSince,
        mode: report.run.modeResolved,
      };
      fs.mkdirSync(path.dirname(args.statePath), { recursive: true });
      fs.writeFileSync(args.statePath, JSON.stringify(newState, null, 2), "utf-8");
      report.run.stateUpdated = true;
    }
  } finally {
    await sourceSql.end({ timeout: 5 });
    await targetSql.end({ timeout: 5 });

    const finishedAt = new Date();
    report.run.finishedAt = finishedAt.toISOString();
    report.run.durationMs = finishedAt.getTime() - startedAt.getTime();

    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("");
    console.log("GT-16 sync delta concluido.");
    console.log(`- Dry run: ${report.run.dryRun ? "sim" : "nao"}`);
    console.log(`- Mode: ${report.run.modeResolved}`);
    console.log(`- Since: ${report.run.since} (${report.run.sinceSource})`);
    console.log(`- Source delta rows: ${report.summary.sourceDeltaRows}`);
    console.log(`- Loaded rows: ${report.summary.loadedRows}`);
    console.log(`- Skipped rows: ${report.summary.skippedRows}`);
    console.log(`- Divergences: ${report.summary.divergences}`);
    console.log(`- Next since: ${report.summary.nextSince}`);
    console.log(`- Report: ${args.reportPath}`);
    console.log(`- State: ${args.statePath}`);
    console.log(`- Log: ${args.logPath}`);
    console.log("");
  }
}

run().catch((error) => {
  console.error("Falha no sync delta GT-16:");
  console.error(error);
  process.exitCode = 1;
});
