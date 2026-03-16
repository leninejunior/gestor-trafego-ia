import { NextRequest } from "next/server";

import { POST } from "@/app/api/private/cutover/rollback/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { rollbackCutoverToV1 } from "@/lib/cutover/routing";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/cutover/routing", () => ({
  rollbackCutoverToV1: jest.fn(),
}));

describe("POST /api/private/cutover/rollback", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<typeof getTenantContext>;
  const mockedRollbackCutoverToV1 = rollbackCutoverToV1 as jest.MockedFunction<
    typeof rollbackCutoverToV1
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("retorna 401 quando nao autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/private/cutover/rollback", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("executa rollback rapido para V1", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    mockedRollbackCutoverToV1.mockResolvedValue({
      updatedCount: 3,
      createdRuleId: null,
    });

    const request = new NextRequest("http://localhost/api/private/cutover/rollback", {
      method: "POST",
      body: JSON.stringify({ reason: "incidente" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rollback.updatedCount).toBe(3);
    expect(mockedRollbackCutoverToV1).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      reason: "incidente",
    });
  });
});
