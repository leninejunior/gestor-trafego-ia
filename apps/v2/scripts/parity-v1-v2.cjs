#!/usr/bin/env node

require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");

const postgres = require("postgres");

const METRIC_KEYS = [
  "reach",
  "impressions",
  "frequency",
  "ctr",
  "cpm",
  "clicks",
  "cpc",
  "costPerMessage",
  "investment",
  "messages",
];

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseDateKey(rawDate) {
  if (!rawDate) {
    return new Date().toISOString().slice(0, 10);
  }

  const normalized = String(rawDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Parametro --date invalido. Use o formato YYYY-MM-DD.");
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("Parametro --date invalido. Use o formato YYYY-MM-DD.");
  }

  return normalized;
}

function getUtcDateRange(dateKey) {
  const startAt = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(startAt.valueOf())) {
    throw new Error("Data invalida para range UTC.");
  }

  const endAt = new Date(startAt);
  endAt.setUTCDate(endAt.getUTCDate() + 1);

  return { startAt, endAt };
}

function parseArgs(argv) {
  const result = {
    date: null,
    organizationId: null,
    tolerancePercent: parsePositiveNumber(process.env.PARITY_TOLERANCE_PERCENT, 1),
    failOnMismatch: false,
    reportPath: path.resolve(process.cwd(), "reports", "gt21-parity-report.json"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--date") {
      result.date = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (arg === "--organization-id") {
      result.organizationId = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (arg === "--tolerance-percent") {
      result.tolerancePercent = parsePositiveNumber(argv[i + 1], result.tolerancePercent);
      i += 1;
      continue;
    }

    if (arg === "--report") {
      result.reportPath = path.resolve(process.cwd(), argv[i + 1] || result.reportPath);
      i += 1;
      continue;
    }

    if (arg === "--fail-on-mismatch") {
      result.failOnMismatch = true;
      continue;
    }
  }

  result.date = parseDateKey(result.date);
  return result;
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

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function round(value, digits = 6) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function divideOrZero(numerator, denominator) {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function buildMetricsFromAggregate(rawAggregate) {
  const impressions = Math.max(0, Math.trunc(toNumber(rawAggregate.impressions)));
  const clicks = Math.max(0, Math.trunc(toNumber(rawAggregate.clicks)));
  const messages = Math.max(0, Math.trunc(toNumber(rawAggregate.messages)));
  const campaigns = Math.max(0, Math.trunc(toNumber(rawAggregate.campaigns)));
  const investment = Math.max(0, toNumber(rawAggregate.investment));

  const reach = impressions;
  const frequency = divideOrZero(impressions, reach);
  const ctr = divideOrZero(clicks, impressions) * 100;
  const cpm = divideOrZero(investment, impressions / 1000);
  const cpc = divideOrZero(investment, clicks);
  const costPerMessage = divideOrZero(investment, messages);

  return {
    campaigns,
    reach: round(reach),
    impressions: round(impressions),
    frequency: round(frequency),
    ctr: round(ctr),
    cpm: round(cpm),
    clicks: round(clicks),
    cpc: round(cpc),
    costPerMessage: round(costPerMessage),
    investment: round(investment),
    messages: round(messages),
  };
}

function compareMetricValues(metric, sourceValue, targetValue, tolerancePercent) {
  const source = toNumber(sourceValue);
  const target = toNumber(targetValue);
  const delta = target - source;
  const deltaAbs = Math.abs(delta);

  let deltaPercent = 0;
  let withinTolerance = true;

  if (source === 0) {
    if (target !== 0) {
      deltaPercent = 100;
      withinTolerance = false;
    }
  } else {
    deltaPercent = (deltaAbs / Math.abs(source)) * 100;
    withinTolerance = deltaPercent <= tolerancePercent;
  }

  // Evita falso negativo por imprecisao decimal em metricas monetarias.
  if (
    !withinTolerance &&
    ["investment", "cpm", "cpc", "costPerMessage"].includes(metric) &&
    deltaAbs <= 0.01
  ) {
    withinTolerance = true;
  }

  return {
    metric,
    sourceValue: round(source),
    targetValue: round(target),
    delta: round(delta),
    deltaAbs: round(deltaAbs),
    deltaPercent: round(deltaPercent, 4),
    tolerancePercent: round(tolerancePercent, 4),
    withinTolerance,
  };
}

async function fetchAggregates(sql, input) {
  const { startAt, endAt, organizationId } = input;

  if (organizationId) {
    return sql`
      SELECT
        organization_id,
        COUNT(*)::bigint AS campaigns,
        COALESCE(SUM(spend), 0)::numeric::text AS investment,
        COALESCE(SUM(impressions), 0)::bigint AS impressions,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        COALESCE(SUM(leads), 0)::bigint AS messages
      FROM campaigns
      WHERE snapshot_date >= ${startAt}
        AND snapshot_date < ${endAt}
        AND organization_id = ${organizationId}
      GROUP BY organization_id
      ORDER BY organization_id
    `;
  }

  return sql`
    SELECT
      organization_id,
      COUNT(*)::bigint AS campaigns,
      COALESCE(SUM(spend), 0)::numeric::text AS investment,
      COALESCE(SUM(impressions), 0)::bigint AS impressions,
      COALESCE(SUM(clicks), 0)::bigint AS clicks,
      COALESCE(SUM(leads), 0)::bigint AS messages
    FROM campaigns
    WHERE snapshot_date >= ${startAt}
      AND snapshot_date < ${endAt}
    GROUP BY organization_id
    ORDER BY organization_id
  `;
}

function buildOrganizationMap(rows) {
  const byOrganization = new Map();
  for (const row of rows) {
    byOrganization.set(row.organization_id, {
      campaigns: toNumber(row.campaigns),
      investment: toNumber(row.investment),
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      messages: toNumber(row.messages),
    });
  }

  return byOrganization;
}

function buildParityReport(input) {
  const {
    startedAt,
    finishedAt,
    sourceUrlRaw,
    targetUrlRaw,
    args,
    sourceByOrganization,
    targetByOrganization,
  } = input;

  const sourceOrganizationIds = new Set(sourceByOrganization.keys());
  const targetOrganizationIds = new Set(targetByOrganization.keys());
  const organizationIds = new Set([...sourceOrganizationIds, ...targetOrganizationIds]);

  if (args.organizationId && !organizationIds.has(args.organizationId)) {
    organizationIds.add(args.organizationId);
  }

  const missingInSource = [...targetOrganizationIds].filter(
    (organizationId) => !sourceOrganizationIds.has(organizationId),
  );
  const missingInTarget = [...sourceOrganizationIds].filter(
    (organizationId) => !targetOrganizationIds.has(organizationId),
  );

  const organizationComparisons = [...organizationIds]
    .sort()
    .map((organizationId) => {
      const sourceRaw = sourceByOrganization.get(organizationId) ?? {
        campaigns: 0,
        investment: 0,
        impressions: 0,
        clicks: 0,
        messages: 0,
      };
      const targetRaw = targetByOrganization.get(organizationId) ?? {
        campaigns: 0,
        investment: 0,
        impressions: 0,
        clicks: 0,
        messages: 0,
      };

      const sourceMetrics = buildMetricsFromAggregate(sourceRaw);
      const targetMetrics = buildMetricsFromAggregate(targetRaw);

      const metrics = METRIC_KEYS.map((metric) =>
        compareMetricValues(metric, sourceMetrics[metric], targetMetrics[metric], args.tolerancePercent),
      );

      const campaignsCountMatch = sourceMetrics.campaigns === targetMetrics.campaigns;
      const failedMetrics = metrics.filter((item) => !item.withinTolerance).map((item) => item.metric);

      return {
        organizationId,
        source: sourceMetrics,
        target: targetMetrics,
        criticalChecks: {
          campaignsCountMatch,
        },
        metrics,
        failedMetrics,
        approved: campaignsCountMatch && failedMetrics.length === 0,
      };
    });

  const metricsCompared = organizationComparisons.reduce(
    (total, item) => total + item.metrics.length,
    0,
  );
  const metricsOutOfTolerance = organizationComparisons.reduce(
    (total, item) => total + item.failedMetrics.length,
    0,
  );
  const organizationsRejected = organizationComparisons
    .filter((item) => !item.approved)
    .map((item) => item.organizationId);

  const approved =
    metricsOutOfTolerance === 0 &&
    missingInSource.length === 0 &&
    missingInTarget.length === 0;

  const noDataFound =
    sourceByOrganization.size === 0 && targetByOrganization.size === 0;

  return {
    run: {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.valueOf() - startedAt.valueOf(),
      date: args.date,
      tolerancePercent: args.tolerancePercent,
      organizationId: args.organizationId,
      failOnMismatch: args.failOnMismatch,
    },
    config: {
      sourceDatabase: maskDbUrl(sourceUrlRaw),
      targetDatabase: maskDbUrl(targetUrlRaw),
    },
    criticalChecks: {
      missingOrganizationsInSource: missingInSource,
      missingOrganizationsInTarget: missingInTarget,
      noDataFound,
    },
    organizations: organizationComparisons,
    summary: {
      organizationsCompared: organizationComparisons.length,
      metricsCompared,
      metricsOutOfTolerance,
      organizationsRejected,
      status: approved ? "APPROVED" : "REJECTED",
      approved,
    },
  };
}

async function run() {
  const startedAt = new Date();
  const args = parseArgs(process.argv.slice(2));
  const { startAt, endAt } = getUtcDateRange(args.date);

  const sourceUrlRaw = process.env.SOURCE_DATABASE_URL;
  const targetUrlRaw = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!sourceUrlRaw || !targetUrlRaw) {
    throw new Error(
      "Defina SOURCE_DATABASE_URL e DATABASE_URL (ou TARGET_DATABASE_URL) para executar a paridade GT-21.",
    );
  }

  const sourceUrl = normalizeDatabaseUrl(sourceUrlRaw);
  const targetUrl = normalizeDatabaseUrl(targetUrlRaw);

  const sourceSql = postgres(sourceUrl, {
    max: 1,
    prepare: false,
  });
  const targetSql = postgres(targetUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const [sourceRows, targetRows] = await Promise.all([
      fetchAggregates(sourceSql, {
        startAt,
        endAt,
        organizationId: args.organizationId,
      }),
      fetchAggregates(targetSql, {
        startAt,
        endAt,
        organizationId: args.organizationId,
      }),
    ]);

    const finishedAt = new Date();
    const report = buildParityReport({
      startedAt,
      finishedAt,
      sourceUrlRaw,
      targetUrlRaw,
      args,
      sourceByOrganization: buildOrganizationMap(sourceRows),
      targetByOrganization: buildOrganizationMap(targetRows),
    });

    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

    console.log(`GT-21 paridade concluida. Status: ${report.summary.status}`);
    console.log(`Organizacoes comparadas: ${report.summary.organizationsCompared}`);
    console.log(`Metricas fora da tolerancia: ${report.summary.metricsOutOfTolerance}`);
    console.log(`Relatorio: ${args.reportPath}`);

    if (!report.summary.approved && args.failOnMismatch) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.allSettled([sourceSql.end({ timeout: 5 }), targetSql.end({ timeout: 5 })]);
  }
}

if (require.main === module) {
  run().catch((error) => {
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
    console.error(`Falha na paridade GT-21: ${errorMessage}`);
    process.exitCode = 1;
  });
}

module.exports = {
  METRIC_KEYS,
  parseDateKey,
  getUtcDateRange,
  parseArgs,
  buildMetricsFromAggregate,
  compareMetricValues,
  buildOrganizationMap,
  buildParityReport,
};
