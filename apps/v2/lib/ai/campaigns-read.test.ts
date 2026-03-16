import {
  buildPagination,
  normalizeAiCampaignItem,
  parseAiCampaignsQuery,
  resolveSnapshotDateRange,
} from "@/lib/ai/campaigns-read";

describe("GT-23 ai campaigns read helpers", () => {
  it("aplica defaults de filtros e paginacao", () => {
    const query = parseAiCampaignsQuery(new URLSearchParams());

    expect(query.organizationId).toBeNull();
    expect(query.clientId).toBeNull();
    expect(query.platform).toBe("all");
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(50);
  });

  it("valida platform permitido", () => {
    expect(() => parseAiCampaignsQuery(new URLSearchParams("platform=invalid"))).toThrow(
      "Parametro platform invalido",
    );
  });

  it("valida faixa de datas", () => {
    expect(() =>
      parseAiCampaignsQuery(new URLSearchParams("dateFrom=2026-02-27&dateTo=2026-02-26")),
    ).toThrow("dateFrom nao pode ser maior que dateTo");

    const range = resolveSnapshotDateRange({
      dateFrom: "2026-02-25",
      dateTo: "2026-02-26",
    });

    expect(range.gte?.toISOString()).toBe("2026-02-25T00:00:00.000Z");
    expect(range.lt?.toISOString()).toBe("2026-02-27T00:00:00.000Z");
  });

  it("normaliza item com KPIs derivados", () => {
    const item = normalizeAiCampaignItem({
      id: "camp-1",
      organizationId: "org-1",
      clientId: "client-1",
      externalId: "ext-1",
      name: "Campanha A",
      status: "ACTIVE",
      snapshotDate: new Date("2026-02-26T12:00:00.000Z"),
      spend: "125.50",
      impressions: 2500,
      clicks: 100,
      leads: 25,
    });

    expect(item.platform).toBe("meta");
    expect(item.kpis.spend).toBe(125.5);
    expect(item.kpis.ctr).toBe(4);
    expect(item.kpis.cpc).toBe(1.255);
    expect(item.kpis.cpm).toBe(50.2);
  });

  it("monta metadata de paginacao estavel", () => {
    const pagination = buildPagination(120, 2, 50);

    expect(pagination.totalPages).toBe(3);
    expect(pagination.hasNext).toBe(true);
    expect(pagination.orderBy).toEqual(["snapshotDate:desc", "id:desc"]);
  });
});
