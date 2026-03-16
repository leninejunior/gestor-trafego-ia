import { buildMetaDailyReport, getUtcDateRange, normalizeDateKey } from "@/lib/reports/meta-daily-report";

describe("meta-daily-report", () => {
  it("normaliza date para hoje quando vazio", () => {
    const dateKey = normalizeDateKey();
    expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejeita date fora do formato esperado", () => {
    expect(() => normalizeDateKey("26-02-2026")).toThrow("Parametro date invalido");
  });

  it("retorna range UTC de um dia", () => {
    const { startAt, endAt } = getUtcDateRange("2026-02-26");
    expect(startAt.toISOString()).toBe("2026-02-26T00:00:00.000Z");
    expect(endAt.toISOString()).toBe("2026-02-27T00:00:00.000Z");
  });

  it("consolida metricas e monta mensagem final", () => {
    const report = buildMetaDailyReport({
      date: "2026-02-26",
      organizationId: "org-1",
      campaigns: [
        {
          spend: "150.50",
          impressions: 1200,
          clicks: 96,
          leads: 12,
        },
        {
          spend: 49.5,
          impressions: 800,
          clicks: 24,
          leads: 8,
        },
      ],
    });

    expect(report.campaignsCount).toBe(2);
    expect(report.metrics.impressions).toBe(2000);
    expect(report.metrics.clicks).toBe(120);
    expect(report.metrics.messages).toBe(20);
    expect(report.metrics.investment).toBe(200);
    expect(report.metrics.ctr).toBe(6);
    expect(report.metrics.cpm).toBe(100);
    expect(report.metrics.cpc).toBeCloseTo(1.67, 2);
    expect(report.metrics.costPerMessage).toBe(10);
    expect(report.message).toContain("RELATORIO DIARIO META - 2026-02-26");
    expect(report.message).toContain("Alcance:");
    expect(report.message).toContain("Impressoes:");
    expect(report.message).toContain("Frequencia:");
    expect(report.message).toContain("CTR:");
    expect(report.message).toContain("CPM:");
    expect(report.message).toContain("Cliques:");
    expect(report.message).toContain("CPC:");
    expect(report.message).toContain("Custo por mensagem:");
    expect(report.message).toContain("Investimento:");
  });
});
