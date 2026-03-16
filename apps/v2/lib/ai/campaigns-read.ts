import type { CampaignStatus } from "@prisma/client";

export type AiCampaignPlatform = "meta" | "google";
export type AiCampaignPlatformFilter = AiCampaignPlatform | "all";

export type AiCampaignQuery = {
  organizationId: string | null;
  clientId: string | null;
  platform: AiCampaignPlatformFilter;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
};

export type AiCampaignRow = {
  id: string;
  organizationId: string;
  clientId: string | null;
  externalId: string;
  name: string;
  status: CampaignStatus;
  snapshotDate: Date;
  spend: unknown;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
};

export type AiCampaignItem = {
  id: string;
  organizationId: string;
  clientId: string | null;
  platform: AiCampaignPlatform;
  externalId: string;
  name: string;
  status: CampaignStatus;
  snapshotDate: string;
  kpis: {
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
};

function parsePositiveInt(value: string | null, fallback: number, min: number, max: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;

  if (parsed < min) return min;
  if (parsed > max) return max;

  return parsed;
}

function normalizeOptionalString(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseDateKey(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${label} invalido. Use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`${label} invalido. Use YYYY-MM-DD.`);
  }

  return normalized;
}

export function parseAiCampaignsQuery(searchParams: URLSearchParams): AiCampaignQuery {
  const organizationId = normalizeOptionalString(searchParams.get("organizationId"));
  const clientId = normalizeOptionalString(searchParams.get("clientId"));

  const rawPlatform = (searchParams.get("platform") || "all").trim().toLowerCase();
  const platform: AiCampaignPlatformFilter =
    rawPlatform === "all" || rawPlatform === "meta" || rawPlatform === "google"
      ? rawPlatform
      : (() => {
          throw new Error("Parametro platform invalido. Use all, meta ou google.");
        })();

  const rawDateFrom = normalizeOptionalString(searchParams.get("dateFrom"));
  const rawDateTo = normalizeOptionalString(searchParams.get("dateTo"));

  const dateFrom = rawDateFrom ? parseDateKey(rawDateFrom, "Parametro dateFrom") : null;
  const dateTo = rawDateTo ? parseDateKey(rawDateTo, "Parametro dateTo") : null;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("dateFrom nao pode ser maior que dateTo.");
  }

  return {
    organizationId,
    clientId,
    platform,
    dateFrom,
    dateTo,
    page: parsePositiveInt(searchParams.get("page"), 1, 1, 10_000),
    pageSize: parsePositiveInt(searchParams.get("pageSize"), 50, 1, 200),
  };
}

export function resolveSnapshotDateRange(query: Pick<AiCampaignQuery, "dateFrom" | "dateTo">): {
  gte?: Date;
  lt?: Date;
} {
  const result: { gte?: Date; lt?: Date } = {};

  if (query.dateFrom) {
    result.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
  }

  if (query.dateTo) {
    const end = new Date(`${query.dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    result.lt = end;
  }

  return result;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
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

function clampInt(value: unknown): number {
  const parsed = Math.trunc(toFiniteNumber(value));
  return parsed > 0 ? parsed : 0;
}

function clampDecimal(value: unknown): number {
  const parsed = toFiniteNumber(value);
  return parsed > 0 ? parsed : 0;
}

function divideOrZero(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function round(value: number, digits = 4): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function normalizeAiCampaignItem(row: AiCampaignRow): AiCampaignItem {
  const impressions = clampInt(row.impressions);
  const clicks = clampInt(row.clicks);
  const leads = clampInt(row.leads);
  const spend = clampDecimal(row.spend);

  const ctr = divideOrZero(clicks, impressions) * 100;
  const cpc = divideOrZero(spend, clicks);
  const cpm = divideOrZero(spend, impressions / 1000);

  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    platform: "meta",
    externalId: row.externalId,
    name: row.name,
    status: row.status,
    snapshotDate: row.snapshotDate.toISOString(),
    kpis: {
      impressions,
      clicks,
      leads,
      spend: round(spend, 2),
      ctr: round(ctr, 4),
      cpc: round(cpc, 4),
      cpm: round(cpm, 4),
    },
  };
}

export function buildPagination(total: number, page: number, pageSize: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const hasNext = totalPages > 0 && page < totalPages;

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
    orderBy: ["snapshotDate:desc", "id:desc"],
  };
}
