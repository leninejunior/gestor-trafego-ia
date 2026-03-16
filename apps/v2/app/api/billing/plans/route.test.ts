import { GET } from "@/app/api/billing/plans/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

describe("GET /api/billing/plans", () => {
  const mockedCreateSupabaseServerClient =
    createSupabaseServerClient as jest.MockedFunction<
      typeof createSupabaseServerClient
    >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("retorna 401 quando nao autenticado", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("retorna lista de planos ativos", async () => {
    const limitPromise = Promise.resolve({
      data: [
        {
          id: "plan-1",
          name: "Pro",
          monthly_price: 99.9,
          annual_price: 999,
          features: ["x"],
          is_active: true,
        },
      ],
      error: null,
    });

    const select = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue(limitPromise),
      }),
    });

    mockedCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: jest.fn().mockReturnValue({
        select,
      }),
    } as never);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].name).toBe("Pro");
  });
});

