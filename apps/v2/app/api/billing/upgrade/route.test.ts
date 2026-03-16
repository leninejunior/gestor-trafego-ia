import { NextRequest } from "next/server";

import { POST } from "@/app/api/billing/upgrade/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { getBillingUpstreamBaseUrl } from "@/lib/billing/env";
import { resolveBillingOrganizationId } from "@/lib/billing/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/billing/env", () => ({
  getBillingUpstreamBaseUrl: jest.fn(),
}));

jest.mock("@/lib/billing/organization", () => ({
  resolveBillingOrganizationId: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

describe("POST /api/billing/upgrade", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<
    typeof getTenantContext
  >;
  const mockedGetBillingUpstreamBaseUrl =
    getBillingUpstreamBaseUrl as jest.MockedFunction<
      typeof getBillingUpstreamBaseUrl
    >;
  const mockedResolveBillingOrganizationId =
    resolveBillingOrganizationId as jest.MockedFunction<
      typeof resolveBillingOrganizationId
    >;
  const mockedCreateSupabaseServerClient =
    createSupabaseServerClient as jest.MockedFunction<
      typeof createSupabaseServerClient
    >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("retorna 401 quando nao autenticado", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue({} as never);
    mockedGetTenantContext.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/billing/upgrade", {
      method: "POST",
      body: JSON.stringify({ planId: "plan-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("retorna 501 quando upstream nao configurado", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue({} as never);
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });
    mockedGetBillingUpstreamBaseUrl.mockReturnValue(null);

    const request = new NextRequest("http://localhost/api/billing/upgrade", {
      method: "POST",
      body: JSON.stringify({ planId: "plan-1" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(501);
  });

  it("faz proxy para o endpoint upstream de upgrade", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue({} as never);
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });
    mockedGetBillingUpstreamBaseUrl.mockReturnValue("https://billing.example.com");
    mockedResolveBillingOrganizationId.mockResolvedValue("org-1");

    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            redirectUrl: "https://checkout.example.com/session/abc",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const request = new NextRequest("http://localhost/api/billing/upgrade", {
      method: "POST",
      body: JSON.stringify({ planId: "plan-2", billingCycle: "annual" }),
      headers: { "Content-Type": "application/json", cookie: "sb=token" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.redirectUrl).toContain("checkout.example.com");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://billing.example.com/api/subscriptions/upgrade",
      expect.objectContaining({
        method: "POST",
      }),
    );

    fetchSpy.mockRestore();
  });
});

