import { GET } from "@/app/api/billing/current/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { resolveBillingOrganizationId } from "@/lib/billing/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/billing/organization", () => ({
  resolveBillingOrganizationId: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

describe("GET /api/billing/current", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<
    typeof getTenantContext
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

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("retorna assinatura atual com plano", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });
    mockedResolveBillingOrganizationId.mockResolvedValue("org-1");

    const from = jest.fn().mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "sub-1",
                          organization_id: "org-1",
                          plan_id: "plan-1",
                          status: "active",
                          billing_cycle: "monthly",
                          current_period_end: "2026-03-30T00:00:00.000Z",
                          plan: {
                            id: "plan-1",
                            name: "Pro",
                            monthly_price: 99.9,
                            annual_price: 999,
                          },
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            limit: () =>
              Promise.resolve({
                data: [],
                error: null,
              }),
          }),
        }),
      };
    });

    mockedCreateSupabaseServerClient.mockResolvedValue({
      from,
    } as never);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizationId).toBe("org-1");
    expect(payload.data.id).toBe("sub-1");
    expect(payload.data.plan.name).toBe("Pro");
  });
});

