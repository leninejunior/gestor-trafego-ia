import { NextRequest } from "next/server";

import { GET, PUT } from "@/app/api/private/cutover/rules/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { listActiveCutoverRules, upsertCutoverRule } from "@/lib/cutover/routing";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/cutover/routing", () => ({
  listActiveCutoverRules: jest.fn(),
  upsertCutoverRule: jest.fn(),
}));

describe("/api/private/cutover/rules", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<typeof getTenantContext>;
  const mockedListActiveCutoverRules = listActiveCutoverRules as jest.MockedFunction<
    typeof listActiveCutoverRules
  >;
  const mockedUpsertCutoverRule = upsertCutoverRule as jest.MockedFunction<typeof upsertCutoverRule>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("retorna 401 no GET quando nao autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("retorna regras ativas no GET", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    mockedListActiveCutoverRules.mockResolvedValue([
      {
        id: "rule-1",
        organizationId: "org-1",
        clientId: null,
        groupId: null,
        route: "V2",
        rolloutPercent: 50,
      },
    ] as never);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizationId).toBe("org-1");
    expect(payload.rules).toHaveLength(1);
  });

  it("retorna 400 no PUT quando route e invalida", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    const request = new NextRequest("http://localhost/api/private/cutover/rules", {
      method: "PUT",
      body: JSON.stringify({ route: "INVALID" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("salva regra no PUT", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    mockedUpsertCutoverRule.mockResolvedValue({
      id: "rule-1",
      organizationId: "org-1",
      clientId: "client-1",
      groupId: "grupo@chat",
      route: "V2",
      rolloutPercent: 30,
    } as never);

    const request = new NextRequest("http://localhost/api/private/cutover/rules", {
      method: "PUT",
      body: JSON.stringify({
        route: "V2",
        clientId: "client-1",
        groupId: "grupo@chat",
        rolloutPercent: 30,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rule.route).toBe("V2");
    expect(mockedUpsertCutoverRule).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        route: "V2",
      }),
    );
  });
});
