import { NextRequest } from "next/server";

import { GET } from "@/app/api/v2/ai/context-summary/route";
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

describe("GET /api/v2/ai/context-summary", () => {
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

    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({
        _count: { _all: 2 },
        _sum: { impressions: 2000, clicks: 100, leads: 20, spend: "300.00" },
      })
      .mockResolvedValueOnce({
        _count: { _all: 2 },
        _sum: { impressions: 3000, clicks: 120, leads: 30, spend: "450.00" },
      });

    mockedGetPrismaClient.mockReturnValue({
      campaign: {
        aggregate,
      },
    } as never);
  });

  it("retorna 401 sem token", async () => {
    mockedAuthorize.mockReturnValue({
      ok: false,
      status: 401,
      error: "Token de servico ausente.",
    });

    const request = new NextRequest("http://localhost/api/v2/ai/context-summary?dateFrom=2026-02-20&dateTo=2026-02-26");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("retorna 429 quando rate limit excede", async () => {
    mockedApplyAiRateLimit.mockReturnValue({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAt: "2026-02-26T22:00:00.000Z",
      retryAfterSeconds: 15,
    });

    const request = new NextRequest("http://localhost/api/v2/ai/context-summary?dateFrom=2026-02-20&dateTo=2026-02-26");
    const response = await GET(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("15");
  });

  it("retorna 400 para periodo invalido", async () => {
    const request = new NextRequest("http://localhost/api/v2/ai/context-summary?dateFrom=2026-02-27&dateTo=2026-02-26");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("retorna resumo com comparativo e flags", async () => {
    const request = new NextRequest("http://localhost/api/v2/ai/context-summary?dateFrom=2026-02-20&dateTo=2026-02-26");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters.organizationId).toBe("org-1");
    expect(payload.summary.metrics.current.investment).toBe(300);
    expect(payload.summary.metrics.previous.investment).toBe(450);
    expect(payload.summary.deltas.investment.changePercent).toBeCloseTo(-33.3333, 3);
    expect(payload.summary.anomalyFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "investment", direction: "drop" }),
      ]),
    );
    expect(mockedLogAiApiAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        keyId: "key-1",
        statusCode: 200,
      }),
    );
  });

  it("retorna vazio para platform=google sem consultar aggregate", async () => {
    const request = new NextRequest(
      "http://localhost/api/v2/ai/context-summary?platform=google&dateFrom=2026-02-20&dateTo=2026-02-26",
    );

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters.platform).toBe("google");
    expect(payload.summary.metrics.current.campaigns).toBe(0);
    expect(mockedGetPrismaClient).not.toHaveBeenCalled();
  });
});
