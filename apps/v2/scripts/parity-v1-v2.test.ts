const {
  buildMetricsFromAggregate,
  compareMetricValues,
  buildParityReport,
  parseDateKey,
} = require("./parity-v1-v2.cjs");

describe("GT-21 parity-v1-v2 helpers", () => {
  it("valida formato de data YYYY-MM-DD", () => {
    expect(() => parseDateKey("26-02-2026")).toThrow("Parametro --date invalido");
    expect(parseDateKey("2026-02-26")).toBe("2026-02-26");
  });

  it("calcula KPIs consolidados a partir de agregados", () => {
    const metrics = buildMetricsFromAggregate({
      campaigns: 2,
      investment: "200.00",
      impressions: 2000,
      clicks: 100,
      messages: 20,
    });

    expect(metrics.campaigns).toBe(2);
    expect(metrics.investment).toBe(200);
    expect(metrics.impressions).toBe(2000);
    expect(metrics.ctr).toBe(5);
    expect(metrics.cpm).toBe(100);
    expect(metrics.cpc).toBe(2);
    expect(metrics.costPerMessage).toBe(10);
  });

  it("respeita tolerancia percentual na comparacao de metricas", () => {
    const within = compareMetricValues("impressions", 1000, 1009, 1);
    const out = compareMetricValues("impressions", 1000, 1015, 1);

    expect(within.withinTolerance).toBe(true);
    expect(out.withinTolerance).toBe(false);
    expect(out.deltaPercent).toBe(1.5);
  });

  it("marca report como APPROVED quando tudo bate dentro da tolerancia", () => {
    const startedAt = new Date("2026-02-26T10:00:00.000Z");
    const finishedAt = new Date("2026-02-26T10:00:03.000Z");

    const report = buildParityReport({
      startedAt,
      finishedAt,
      sourceUrlRaw: "postgresql://user:pass@legacy-host:5432/legacy_db",
      targetUrlRaw: "postgresql://user:pass@new-host:5432/new_db",
      args: {
        date: "2026-02-26",
        tolerancePercent: 1,
        organizationId: null,
        failOnMismatch: false,
      },
      sourceByOrganization: new Map([
        [
          "org-1",
          {
            campaigns: 2,
            investment: 200,
            impressions: 2000,
            clicks: 100,
            messages: 20,
          },
        ],
      ]),
      targetByOrganization: new Map([
        [
          "org-1",
          {
            campaigns: 2,
            investment: 200,
            impressions: 2010,
            clicks: 100,
            messages: 20,
          },
        ],
      ]),
    });

    expect(report.summary.status).toBe("APPROVED");
    expect(report.summary.approved).toBe(true);
    expect(report.summary.metricsOutOfTolerance).toBe(0);
    expect(report.criticalChecks.missingOrganizationsInSource).toEqual([]);
    expect(report.criticalChecks.missingOrganizationsInTarget).toEqual([]);
  });

  it("marca report como REJECTED quando ha organizacao ausente no target", () => {
    const startedAt = new Date("2026-02-26T10:00:00.000Z");
    const finishedAt = new Date("2026-02-26T10:00:03.000Z");

    const report = buildParityReport({
      startedAt,
      finishedAt,
      sourceUrlRaw: "postgresql://user:pass@legacy-host:5432/legacy_db",
      targetUrlRaw: "postgresql://user:pass@new-host:5432/new_db",
      args: {
        date: "2026-02-26",
        tolerancePercent: 1,
        organizationId: null,
        failOnMismatch: false,
      },
      sourceByOrganization: new Map([
        [
          "org-1",
          {
            campaigns: 1,
            investment: 100,
            impressions: 1000,
            clicks: 50,
            messages: 10,
          },
        ],
      ]),
      targetByOrganization: new Map(),
    });

    expect(report.summary.status).toBe("REJECTED");
    expect(report.summary.approved).toBe(false);
    expect(report.criticalChecks.missingOrganizationsInTarget).toEqual(["org-1"]);
    expect(report.summary.organizationsRejected).toContain("org-1");
  });
});
