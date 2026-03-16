import { NextRequest } from "next/server";

import { GET } from "@/app/api/reports/meta/daily/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { getPrismaClient } from "@/lib/prisma";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  getPrismaClient: jest.fn(),
}));

describe("GET /api/reports/meta/daily", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<typeof getTenantContext>;
  const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<typeof getPrismaClient>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("retorna 401 quando nao autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/reports/meta/daily");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("retorna payload com mensagem final pronta para disparo", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    mockedGetPrismaClient.mockReturnValue({
      campaign: {
        findMany: jest.fn().mockResolvedValue([
          {
            spend: "100.00",
            impressions: 1000,
            clicks: 50,
            leads: 10,
          },
        ]),
      },
    } as never);

    const request = new NextRequest("http://localhost/api/reports/meta/daily?date=2026-02-26");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.report.organizationId).toBe("org-1");
    expect(payload.report.metrics.impressions).toBe(1000);
    expect(payload.report.metrics.clicks).toBe(50);
    expect(payload.report.metrics.investment).toBe(100);
    expect(typeof payload.message).toBe("string");
    expect(payload.message).toContain("RELATORIO DIARIO META - 2026-02-26");
    expect(payload.message).toContain("Investimento:");
  });
});
