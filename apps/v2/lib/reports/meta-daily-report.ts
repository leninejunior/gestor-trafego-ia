export type MetaDailyCampaignSnapshot = {
  spend: unknown;
  impressions: number | null;
  clicks: number | null;
  leads: number | null;
};

export type MetaDailyMetrics = {
  reach: number;
  impressions: number;
  frequency: number;
  ctr: number;
  cpm: number;
  clicks: number;
  cpc: number;
  costPerMessage: number;
  investment: number;
  messages: number;
};

export type MetaDailyReport = {
  date: string;
  organizationId: string;
  campaignsCount: number;
  metrics: MetaDailyMetrics;
  notes: string[];
  message: string;
};

type MetaDailyReportInput = {
  date: string;
  organizationId: string;
  campaigns: MetaDailyCampaignSnapshot[];
};

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

function clampNonNegativeInteger(value: unknown): number {
  const parsed = Math.trunc(toFiniteNumber(value));
  return parsed > 0 ? parsed : 0;
}

function clampNonNegativeDecimal(value: unknown): number {
  const parsed = toFiniteNumber(value);
  return parsed > 0 ? parsed : 0;
}

function divideOrZero(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function normalizeDateKey(input?: string | null): string {
  if (input) {
    const normalized = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new Error("Parametro date invalido. Use o formato YYYY-MM-DD.");
    }

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.valueOf())) {
      throw new Error("Parametro date invalido. Use o formato YYYY-MM-DD.");
    }

    return normalized;
  }

  return new Date().toISOString().slice(0, 10);
}

export function getUtcDateRange(dateKey: string): { startAt: Date; endAt: Date } {
  const startAt = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(startAt.valueOf())) {
    throw new Error("Data invalida para range UTC.");
  }

  const endAt = new Date(startAt);
  endAt.setUTCDate(endAt.getUTCDate() + 1);

  return { startAt, endAt };
}

export function buildMetaDailyReport(input: MetaDailyReportInput): MetaDailyReport {
  const campaignsCount = input.campaigns.length;

  const totals = input.campaigns.reduce(
    (acc, campaign) => {
      acc.impressions += clampNonNegativeInteger(campaign.impressions);
      acc.clicks += clampNonNegativeInteger(campaign.clicks);
      acc.messages += clampNonNegativeInteger(campaign.leads);
      acc.investment += clampNonNegativeDecimal(campaign.spend);
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      messages: 0,
      investment: 0,
    },
  );

  const reach = totals.impressions;
  const frequency = divideOrZero(totals.impressions, reach);
  const ctr = divideOrZero(totals.clicks, totals.impressions) * 100;
  const cpm = divideOrZero(totals.investment, totals.impressions / 1000);
  const cpc = divideOrZero(totals.investment, totals.clicks);
  const costPerMessage = divideOrZero(totals.investment, totals.messages);

  const metrics: MetaDailyMetrics = {
    reach,
    impressions: totals.impressions,
    frequency: round(frequency, 2),
    ctr: round(ctr, 2),
    cpm: round(cpm, 2),
    clicks: totals.clicks,
    cpc: round(cpc, 2),
    costPerMessage: round(costPerMessage, 2),
    investment: round(totals.investment, 2),
    messages: totals.messages,
  };

  const notes = [
    "Alcance e frequencia calculados por estimativa com base em impressoes (dados de reach nao disponiveis no snapshot atual).",
    "Custo por mensagem utiliza a coluna de leads como proxy de mensagens.",
  ];

  const message = [
    `RELATORIO DIARIO META - ${input.date}`,
    `Organizacao: ${input.organizationId}`,
    `Campanhas consolidadas: ${campaignsCount}`,
    `Alcance: ${formatInteger(metrics.reach)}`,
    `Impressoes: ${formatInteger(metrics.impressions)}`,
    `Frequencia: ${formatDecimal(metrics.frequency)}`,
    `CTR: ${formatPercent(metrics.ctr)}`,
    `CPM: ${formatCurrency(metrics.cpm)}`,
    `Cliques: ${formatInteger(metrics.clicks)}`,
    `CPC: ${formatCurrency(metrics.cpc)}`,
    `Custo por mensagem: ${formatCurrency(metrics.costPerMessage)}`,
    `Investimento: ${formatCurrency(metrics.investment)}`,
  ].join("\n");

  return {
    date: input.date,
    organizationId: input.organizationId,
    campaignsCount,
    metrics,
    notes,
    message,
  };
}
