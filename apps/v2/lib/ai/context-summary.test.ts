import {
  buildAiContextMetrics,
  buildAiContextSummaryPayload,
  buildAiPeriods,
  buildAnomalyFlags,
  parseAiContextSummaryQuery,
} from "@/lib/ai/context-summary";

describe("GT-25 ai context summary helpers", () => {
  it("valida query com dateFrom/dateTo obrigatorios", () => {
    expect(() => parseAiContextSummaryQuery(new URLSearchParams())).toThrow(
      "dateFrom e dateTo sao obrigatorios",
    );

    const parsed = parseAiContextSummaryQuery(
      new URLSearchParams("dateFrom=2026-02-20&dateTo=2026-02-26&platform=meta"),
    );

    expect(parsed.platform).toBe("meta");
    expect(parsed.dateFrom).toBe("2026-02-20");
    expect(parsed.dateTo).toBe("2026-02-26");
  });

  it("calcula periodo anterior com mesma duracao", () => {
    const periods = buildAiPeriods("2026-02-20", "2026-02-26");

    expect(periods.current.days).toBe(7);
    expect(periods.current.startAt.toISOString()).toBe("2026-02-20T00:00:00.000Z");
    expect(periods.current.endAtExclusive.toISOString()).toBe("2026-02-27T00:00:00.000Z");
    expect(periods.previous.startAt.toISOString()).toBe("2026-02-13T00:00:00.000Z");
    expect(periods.previous.endAtExclusive.toISOString()).toBe("2026-02-20T00:00:00.000Z");
  });

  it("consolida metricas e calcula indicadores", () => {
    const metrics = buildAiContextMetrics({
      campaigns: 3,
      impressions: 3000,
      clicks: 150,
      leads: 30,
      investment: "450.00",
    });

    expect(metrics.campaigns).toBe(3);
    expect(metrics.ctr).toBe(5);
    expect(metrics.cpc).toBe(3);
    expect(metrics.cpm).toBe(150);
    expect(metrics.roas).toBeNull();
  });

  it("gera flags de anomalia basicas", () => {
    const anomalies = buildAnomalyFlags(
      {
        campaigns: 2,
        impressions: 1000,
        clicks: 20,
        leads: 5,
        investment: 200,
        ctr: 2,
        cpc: 10,
        cpm: 200,
        roas: null,
      },
      {
        campaigns: 2,
        impressions: 1000,
        clicks: 100,
        leads: 20,
        investment: 100,
        ctr: 10,
        cpc: 1,
        cpm: 100,
        roas: null,
      },
      30,
    );

    expect(anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "investment", direction: "increase" }),
        expect.objectContaining({ metric: "leads", direction: "drop" }),
        expect.objectContaining({ metric: "ctr", direction: "drop" }),
      ]),
    );
  });

  it("monta payload final com comparativo e notas", () => {
    const query = parseAiContextSummaryQuery(
      new URLSearchParams("dateFrom=2026-02-20&dateTo=2026-02-26&platform=all"),
    );
    const periods = buildAiPeriods(query.dateFrom, query.dateTo);

    const payload = buildAiContextSummaryPayload({
      query,
      periods,
      current: buildAiContextMetrics({
        campaigns: 1,
        impressions: 1000,
        clicks: 50,
        leads: 10,
        investment: 200,
      }),
      previous: buildAiContextMetrics({
        campaigns: 1,
        impressions: 1000,
        clicks: 25,
        leads: 5,
        investment: 100,
      }),
      anomalyThresholdPercent: 30,
    });

    expect(payload.periods.current.dateFrom).toBe("2026-02-20");
    expect(payload.periods.previous.dateTo).toBe("2026-02-19");
    expect(payload.deltas.investment.changePercent).toBe(100);
    expect(payload.notes[0]).toContain("ROAS indisponivel");
  });
});
