import { NextRequest } from "next/server";

import { GET } from "@/app/api/v2/ai/campaigns/route";
import { logAiApiAuditEvent } from "@/lib/ai/audit-log";
import { applyAiRateLimit } from "@/lib/ai/rate-limit";
import { authorizeAiServiceRequest } from "@/lib/ai/service-auth";
import { getPrismaClient } from "@/lib/prisma";

jest.mock("@/lib/ai/service-auth", () => ({
  AI_READ_SCOPE: "ai:read_campaigns",
  authorizeAiServiceRequest: jest.fn(),
}));

jest.mock("@/lib/ai/rate-limit", () => ({
  applyAiRateLimit: jest.fn(),
}));

jest.mock("@/lib/ai/audit-log", () => ({
  logAiApiAuditEvent: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  getPrismaClient: jest.fn(),
}));

describe("GET /api/v2/ai/campaigns", () => {
  const mockedAuthorize = authorizeAiServiceRequest as jest.MockedFunction<
    typeof authorizeAiServiceRequest
  >;
  const mockedApplyAiRateLimit = applyAiRateLimit as jest.MockedFunction<typeof applyAiRateLimit>;
  const mockedLogAiApiAuditEvent = logAiApiAuditEvent as jest.MockedFunction<
    typeof logAiApiAuditEvent
  >;
  const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<typeof getPrismaClient>;

  beforeEach(() => {
    jest.resetAllMocks();

    mockedAuthorize.mockReturnValue({
      ok: true,
      principal: {
        keyId: "key-1",
        organizationId: "org-1",
        scopes: ["ai:read_campaigns"],
        rateLimitPerMinute: 60,
      },
    });

    mockedApplyAiRateLimit.mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: "2026-02-26T22:00:00.000Z",
      retryAfterSeconds: 60,
    });

    mockedGetPrismaClient.mockReturnValue({
      campaign: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "camp-1",
            organizationId: "org-1",
            clientId: "client-1",
            externalId: "ext-1",
            name: "Campanha A",
            status: "ACTIVE",
            snapshotDate: new Date("2026-02-26T10:00:00.000Z"),
            spend: "200.00",
            impressions: 2000,
            clicks: 100,
            leads: 20,
          },
        ]),
      },
    } as never);
  });

  it("retorna 401 quando token nao e enviado", async () => {
    mockedAuthorize.mockReturnValue({
      ok: false,
      status: 401,
      error: "Token de servico ausente.",
    });

    const request = new NextRequest("http://localhost/api/v2/ai/campaigns");
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockedLogAiApiAuditEvent).not.toHaveBeenCalled();
  });

  it("retorna 403 quando escopo obrigatorio ausente", async () => {
    mockedAuthorize.mockReturnValue({
      ok: false,
      status: 403,
      error: "Escopo obrigatorio ausente: ai:read_campaigns.",
      principal: {
        keyId: "key-2",
        organizationId: "org-2",
        scopes: [],
        rateLimitPerMinute: 60,
      },
    });

    const request = new NextRequest("http://localhost/api/v2/ai/campaigns");
    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(mockedLogAiApiAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-2",
        keyId: "key-2",
        statusCode: 403,
      }),
    );
  });

  it("retorna 403 quando organizationId solicitado foge do token", async () => {
    const request = new NextRequest("http://localhost/api/v2/ai/campaigns?organizationId=org-99");
    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(mockedLogAiApiAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        keyId: "key-1",
        statusCode: 403,
      }),
    );
  });

  it("retorna 429 quando rate limit e excedido", async () => {
    mockedApplyAiRateLimit.mockReturnValue({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAt: "2026-02-26T22:00:00.000Z",
      retryAfterSeconds: 30,
    });

    const request = new NextRequest("http://localhost/api/v2/ai/campaigns");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error).toContain("Rate limit exceeded");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("retorna payload normalizado e headers de rate limit", async () => {
    const request = new NextRequest(
      "http://localhost/api/v2/ai/campaigns?platform=all&dateFrom=2026-02-25&dateTo=2026-02-26&page=1&pageSize=10",
    );

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters.organizationId).toBe("org-1");
    expect(payload.pagination.total).toBe(1);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].platform).toBe("meta");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("59");
    expect(mockedLogAiApiAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        keyId: "key-1",
        statusCode: 200,
      }),
    );
  });

  it("retorna vazio para platform=google sem consultar banco", async () => {
    const request = new NextRequest("http://localhost/api/v2/ai/campaigns?platform=google");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([]);
    expect(mockedGetPrismaClient).not.toHaveBeenCalled();
  });
});
