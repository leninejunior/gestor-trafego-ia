import { NextRequest } from "next/server";

import { GET } from "@/app/api/private/cutover/decision/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { resolveCutoverRoute } from "@/lib/cutover/routing";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/cutover/routing", () => ({
  resolveCutoverRoute: jest.fn(),
}));

describe("GET /api/private/cutover/decision", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<typeof getTenantContext>;
  const mockedResolveCutoverRoute = resolveCutoverRoute as jest.MockedFunction<
    typeof resolveCutoverRoute
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("retorna 401 quando nao autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/private/cutover/decision");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("retorna decisao de roteamento", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    mockedResolveCutoverRoute.mockResolvedValue({
      route: "V2",
      source: "rule",
      matchedRuleId: "rule-1",
      rolloutPercent: 50,
      rolloutBucket: 20,
      reason: "bucket dentro",
    });

    const request = new NextRequest(
      "http://localhost/api/private/cutover/decision?clientId=client-1&groupId=grupo%40chat",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizationId).toBe("org-1");
    expect(payload.decision.route).toBe("V2");
    expect(mockedResolveCutoverRoute).toHaveBeenCalledWith({
      organizationId: "org-1",
      clientId: "client-1",
      groupId: "grupo@chat",
      subjectKey: null,
    });
  });
});
