import { NextRequest } from "next/server";

import { AI_READ_SCOPE, authorizeAiServiceRequest } from "@/lib/ai/service-auth";

describe("GT-24 ai service auth", () => {
  const originalTokens = process.env.AI_SERVICE_TOKENS_JSON;
  const originalDefaultLimit = process.env.AI_DEFAULT_RATE_LIMIT_PER_MINUTE;

  beforeEach(() => {
    process.env.AI_DEFAULT_RATE_LIMIT_PER_MINUTE = "60";
    process.env.AI_SERVICE_TOKENS_JSON = JSON.stringify([
      {
        token: "token-valid",
        keyId: "key-1",
        organizationId: "org-1",
        scopes: [AI_READ_SCOPE],
        rateLimitPerMinute: 15,
      },
      {
        token: "token-no-scope",
        keyId: "key-2",
        organizationId: "org-2",
        scopes: ["another:scope"],
      },
    ]);
  });

  afterAll(() => {
    process.env.AI_SERVICE_TOKENS_JSON = originalTokens;
    process.env.AI_DEFAULT_RATE_LIMIT_PER_MINUTE = originalDefaultLimit;
  });

  it("retorna 401 sem token", () => {
    const request = new NextRequest("http://localhost/api/v2/ai/campaigns");
    const result = authorizeAiServiceRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("retorna 401 com token invalido", () => {
    const request = new NextRequest("http://localhost/api/v2/ai/campaigns", {
      headers: {
        authorization: "Bearer wrong-token",
      },
    });

    const result = authorizeAiServiceRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("retorna 403 quando escopo obrigatorio nao existe", () => {
    const request = new NextRequest("http://localhost/api/v2/ai/campaigns", {
      headers: {
        authorization: "Bearer token-no-scope",
      },
    });

    const result = authorizeAiServiceRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.principal?.organizationId).toBe("org-2");
    }
  });

  it("autoriza com bearer valido e retorna principal", () => {
    const request = new NextRequest("http://localhost/api/v2/ai/campaigns", {
      headers: {
        authorization: "Bearer token-valid",
      },
    });

    const result = authorizeAiServiceRequest(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.principal.organizationId).toBe("org-1");
      expect(result.principal.keyId).toBe("key-1");
      expect(result.principal.rateLimitPerMinute).toBe(15);
    }
  });

  it("aceita token via x-api-key", () => {
    const request = new NextRequest("http://localhost/api/v2/ai/campaigns", {
      headers: {
        "x-api-key": "token-valid",
      },
    });

    const result = authorizeAiServiceRequest(request);

    expect(result.ok).toBe(true);
  });
});
