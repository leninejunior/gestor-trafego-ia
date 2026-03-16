export type AiContextPlatformFilter = "all" | "meta" | "google";

export type AiContextSummaryQuery = {
  organizationId: string | null;
  clientId: string | null;
  platform: AiContextPlatformFilter;
  dateFrom: string;
  dateTo: string;
};

export type AiContextMetrics = {
  campaigns: number;
  impressions: number;
  clicks: number;
  leads: number;
  investment: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number | null;
};

export type AiContextMetricDelta = {
  current: number | null;
  previous: number | null;
  change: number | null;
  changePercent: number | null;
};

export type AiContextAnomalyFlag = {
  metric: "investment" | "leads" | "ctr";
  direction: "increase" | "drop";
  deltaPercent: number;
};

export type AiContextPeriod = {
  dateFrom: string;
  dateTo: string;
  startAt: string;
  endAtExclusive: string;
  days: number;
};

export type AiContextSummaryPayload = {
  periods: {
    current: AiContextPeriod;
    previous: AiContextPeriod;
  };
  metrics: {
    current: AiContextMetrics;
    previous: AiContextMetrics;
  };
  deltas: {
    investment: AiContextMetricDelta;
    leads: AiContextMetricDelta;
    ctr: AiContextMetricDelta;
    cpc: AiContextMetricDelta;
    cpm: AiContextMetricDelta;
    roas: AiContextMetricDelta;
  };
  anomalyFlags: AiContextAnomalyFlag[];
  notes: string[];
};

export type AggregateInput = {
  campaigns: unknown;
  impressions: unknown;
  clicks: unknown;
  leads: unknown;
  investment: unknown;
};

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

export function parseAiContextSummaryQuery(searchParams: URLSearchParams): AiContextSummaryQuery {
  const organizationId = normalizeOptionalString(searchParams.get("organizationId"));
  const clientId = normalizeOptionalString(searchParams.get("clientId"));

  const rawPlatform = (searchParams.get("platform") || "all").trim().toLowerCase();
  const platform: AiContextPlatformFilter =
    rawPlatform === "all" || rawPlatform === "meta" || rawPlatform === "google"
      ? rawPlatform
      : (() => {
          throw new Error("Parametro platform invalido. Use all, meta ou google.");
        })();

  const rawDateFrom = normalizeOptionalString(searchParams.get("dateFrom"));
  const rawDateTo = normalizeOptionalString(searchParams.get("dateTo"));

  if (!rawDateFrom || !rawDateTo) {
    throw new Error("dateFrom e dateTo sao obrigatorios (YYYY-MM-DD).");
  }

  const dateFrom = parseDateKey(rawDateFrom, "Parametro dateFrom");
  const dateTo = parseDateKey(rawDateTo, "Parametro dateTo");

  if (dateFrom > dateTo) {
    throw new Error("dateFrom nao pode ser maior que dateTo.");
  }

  return {
    organizationId,
    clientId,
    platform,
    dateFrom,
    dateTo,
  };
}

export function buildAiPeriods(dateFrom: string, dateTo: string): {
  current: { startAt: Date; endAtExclusive: Date; days: number };
  previous: { startAt: Date; endAtExclusive: Date; days: number };
} {
  const currentStart = new Date(`${dateFrom}T00:00:00.000Z`);
  const currentEndInclusive = new Date(`${dateTo}T00:00:00.000Z`);

  if (Number.isNaN(currentStart.valueOf()) || Number.isNaN(currentEndInclusive.valueOf())) {
    throw new Error("Periodo invalido para calculo.");
  }

  const currentEndExclusive = new Date(currentEndInclusive);
  currentEndExclusive.setUTCDate(currentEndExclusive.getUTCDate() + 1);

  const diffMs = currentEndExclusive.valueOf() - currentStart.valueOf();
  const days = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));

  const previousEndExclusive = new Date(currentStart);
  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);

  return {
    current: {
      startAt: currentStart,
      endAtExclusive: currentEndExclusive,
      days,
    },
    previous: {
      startAt: previousStart,
      endAtExclusive: previousEndExclusive,
      days,
    },
  };
}

export function buildAiContextMetrics(aggregate: AggregateInput): AiContextMetrics {
  const campaigns = clampInt(aggregate.campaigns);
  const impressions = clampInt(aggregate.impressions);
  const clicks = clampInt(aggregate.clicks);
  const leads = clampInt(aggregate.leads);
  const investment = clampDecimal(aggregate.investment);

  const ctr = divideOrZero(clicks, impressions) * 100;
  const cpc = divideOrZero(investment, clicks);
  const cpm = divideOrZero(investment, impressions / 1000);

  return {
    campaigns,
    impressions,
    clicks,
    leads,
    investment: round(investment, 2),
    ctr: round(ctr, 4),
    cpc: round(cpc, 4),
    cpm: round(cpm, 4),
    roas: null,
  };
}

function buildDelta(current: number | null, previous: number | null): AiContextMetricDelta {
  if (current === null || previous === null) {
    return {
      current,
      previous,
      change: null,
      changePercent: null,
    };
  }

  const change = current - previous;

  if (previous === 0) {
    return {
      current,
      previous,
      change: round(change, 4),
      changePercent: current === 0 ? 0 : 100,
    };
  }

  return {
    current,
    previous,
    change: round(change, 4),
    changePercent: round((change / previous) * 100, 4),
  };
}

export function buildAnomalyFlags(
  current: AiContextMetrics,
  previous: AiContextMetrics,
  thresholdPercent: number,
): AiContextAnomalyFlag[] {
  const threshold = Number.isFinite(thresholdPercent) && thresholdPercent > 0 ? thresholdPercent : 30;

  const candidates: Array<{ metric: "investment" | "leads" | "ctr"; current: number; previous: number }> = [
    { metric: "investment", current: current.investment, previous: previous.investment },
    { metric: "leads", current: current.leads, previous: previous.leads },
    { metric: "ctr", current: current.ctr, previous: previous.ctr },
  ];

  const anomalies: AiContextAnomalyFlag[] = [];

  for (const item of candidates) {
    if (item.previous === 0) {
      if (item.current > 0 && 100 >= threshold) {
        anomalies.push({
          metric: item.metric,
          direction: "increase",
          deltaPercent: 100,
        });
      }
      continue;
    }

    const deltaPercent = ((item.current - item.previous) / item.previous) * 100;
    if (Math.abs(deltaPercent) >= threshold) {
      anomalies.push({
        metric: item.metric,
        direction: deltaPercent >= 0 ? "increase" : "drop",
        deltaPercent: round(Math.abs(deltaPercent), 4),
      });
    }
  }

  return anomalies;
}

function toIsoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildAiContextSummaryPayload(input: {
  query: AiContextSummaryQuery;
  current: AiContextMetrics;
  previous: AiContextMetrics;
  periods: ReturnType<typeof buildAiPeriods>;
  anomalyThresholdPercent: number;
  notes?: string[];
}): AiContextSummaryPayload {
  const anomalyFlags = buildAnomalyFlags(
    input.current,
    input.previous,
    input.anomalyThresholdPercent,
  );

  const notes = [...(input.notes ?? [])];
  if (input.current.roas === null || input.previous.roas === null) {
    notes.push("ROAS indisponivel no snapshot atual por ausencia de receita consolidada.");
  }

  return {
    periods: {
      current: {
        dateFrom: input.query.dateFrom,
        dateTo: input.query.dateTo,
        startAt: input.periods.current.startAt.toISOString(),
        endAtExclusive: input.periods.current.endAtExclusive.toISOString(),
        days: input.periods.current.days,
      },
      previous: {
        dateFrom: toIsoDateKey(input.periods.previous.startAt),
        dateTo: toIsoDateKey(new Date(input.periods.previous.endAtExclusive.valueOf() - 1)),
        startAt: input.periods.previous.startAt.toISOString(),
        endAtExclusive: input.periods.previous.endAtExclusive.toISOString(),
        days: input.periods.previous.days,
      },
    },
    metrics: {
      current: input.current,
      previous: input.previous,
    },
    deltas: {
      investment: buildDelta(input.current.investment, input.previous.investment),
      leads: buildDelta(input.current.leads, input.previous.leads),
      ctr: buildDelta(input.current.ctr, input.previous.ctr),
      cpc: buildDelta(input.current.cpc, input.previous.cpc),
      cpm: buildDelta(input.current.cpm, input.previous.cpm),
      roas: buildDelta(input.current.roas, input.previous.roas),
    },
    anomalyFlags,
    notes,
  };
}
