import { NextRequest } from "next/server";

import { POST } from "@/app/api/reports/meta/daily/send-test/route";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { createPapiClient } from "@/lib/papi/client";
import { resolveCutoverRoute } from "@/lib/cutover/routing";
import { getPapiEnv } from "@/lib/papi/env";
import { logPapiEvent } from "@/lib/papi/send-log";
import { getPrismaClient } from "@/lib/prisma";

jest.mock("@/lib/auth/tenant-context", () => ({
  getTenantContext: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  getPrismaClient: jest.fn(),
}));

jest.mock("@/lib/cutover/routing", () => ({
  resolveCutoverRoute: jest.fn(),
}));

jest.mock("@/lib/papi/env", () => ({
  getPapiEnv: jest.fn(),
}));

jest.mock("@/lib/papi/client", () => ({
  createPapiClient: jest.fn(),
  PapiRequestError: class PapiRequestError extends Error {
    status: number;
    details: unknown;

    constructor(message: string, status: number, details: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
}));

jest.mock("@/lib/papi/send-log", () => ({
  logPapiEvent: jest.fn(),
}));

describe("POST /api/reports/meta/daily/send-test", () => {
  const mockedGetTenantContext = getTenantContext as jest.MockedFunction<typeof getTenantContext>;
  const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<typeof getPrismaClient>;
  const mockedResolveCutoverRoute = resolveCutoverRoute as jest.MockedFunction<
    typeof resolveCutoverRoute
  >;
  const mockedGetPapiEnv = getPapiEnv as jest.MockedFunction<typeof getPapiEnv>;
  const mockedCreatePapiClient = createPapiClient as jest.MockedFunction<typeof createPapiClient>;
  const mockedLogPapiEvent = logPapiEvent as jest.MockedFunction<typeof logPapiEvent>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("retorna 401 quando nao autenticado", async () => {
    mockedGetTenantContext.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/reports/meta/daily/send-test", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("envia para o grupo configurado e retorna payload de sucesso", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    mockedGetPrismaClient.mockReturnValue({
      campaign: {
        findMany: jest.fn().mockResolvedValue([
          {
            spend: "250.00",
            impressions: 2500,
            clicks: 125,
            leads: 25,
          },
        ]),
      },
    } as never);

    mockedResolveCutoverRoute.mockResolvedValue({
      route: "V2",
      source: "rule",
      matchedRuleId: "rule-1",
      rolloutPercent: 100,
      rolloutBucket: null,
      reason: "rollout total",
    });

    mockedGetPapiEnv.mockReturnValue({
      baseUrl: "https://papi.example.com",
      apiKey: "secret",
      groupId: "group-config",
      sendPath: "/messages/group/send",
      timeoutMs: 10_000,
    });

    mockedCreatePapiClient.mockReturnValue({
      sendGroupMessage: jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        response: { queued: true },
      }),
    } as never);

    const request = new NextRequest("http://localhost/api/reports/meta/daily/send-test?date=2026-02-26", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sent).toBe(true);
    expect(payload.groupId).toBe("group-config");
    expect(payload.cutover.route).toBe("V2");
    expect(payload.report.metrics.impressions).toBe(2500);
    expect(payload.message).toContain("RELATORIO DIARIO META - 2026-02-26");
    expect(mockedLogPapiEvent).toHaveBeenCalledWith(
      "info",
      "send_test.success",
      expect.objectContaining({
        groupId: "group-config",
        status: 200,
      }),
    );
  });

  it("retorna 409 quando cutover decide por V1", async () => {
    mockedGetTenantContext.mockResolvedValue({
      userId: "user-1",
      tenantId: "org-1",
    });

    mockedGetPrismaClient.mockReturnValue({
      campaign: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as never);

    mockedResolveCutoverRoute.mockResolvedValue({
      route: "V1",
      source: "rule",
      matchedRuleId: "rule-rollback",
      rolloutPercent: 0,
      rolloutBucket: null,
      reason: "rollback",
    });

    mockedGetPapiEnv.mockReturnValue({
      baseUrl: "https://papi.example.com",
      apiKey: "secret",
      groupId: "group-config",
      sendPath: "/messages/group/send",
      timeoutMs: 10_000,
    });

    const request = new NextRequest("http://localhost/api/reports/meta/daily/send-test?date=2026-02-26", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.sent).toBe(false);
    expect(payload.routedTo).toBe("V1");
    expect(payload.cutover.route).toBe("V1");
    expect(mockedCreatePapiClient).not.toHaveBeenCalled();
  });
});
