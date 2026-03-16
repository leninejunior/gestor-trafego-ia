import type { NextRequest } from "next/server";

export const AI_READ_SCOPE = "ai:read_campaigns";

type RawAiServiceToken = {
  token: string;
  keyId?: string;
  organizationId: string;
  scopes: string[];
  rateLimitPerMinute?: number;
};

export type AiServicePrincipal = {
  keyId: string;
  organizationId: string;
  scopes: string[];
  rateLimitPerMinute: number;
};

type AiAuthSuccess = {
  ok: true;
  principal: AiServicePrincipal;
};

type AiAuthFailure = {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
  principal?: AiServicePrincipal;
};

export type AiAuthResult = AiAuthSuccess | AiAuthFailure;

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) {
    return [];
  }

  return scopes
    .map((scope) => (typeof scope === "string" ? scope.trim() : ""))
    .filter((scope) => scope.length > 0);
}

function parseTokensConfig(): RawAiServiceToken[] {
  const raw = normalizeOptionalString(process.env.AI_SERVICE_TOKENS_JSON);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("AI_SERVICE_TOKENS_JSON deve ser um array JSON.");
    }

    return parsed.map((item, index) => {
      const record = item as RawAiServiceToken;

      if (!record || typeof record !== "object") {
        throw new Error(`Token #${index + 1} invalido.`);
      }

      const token = normalizeOptionalString(record.token);
      const organizationId = normalizeOptionalString(record.organizationId);

      if (!token || !organizationId) {
        throw new Error(`Token #${index + 1} sem token/organizationId.`);
      }

      const keyId = normalizeOptionalString(record.keyId) ?? `key-${index + 1}`;
      const scopes = normalizeScopes(record.scopes);
      const defaultRateLimit = parsePositiveInt(process.env.AI_DEFAULT_RATE_LIMIT_PER_MINUTE, 60);
      const rateLimitPerMinute = parsePositiveInt(record.rateLimitPerMinute, defaultRateLimit);

      return {
        token,
        keyId,
        organizationId,
        scopes,
        rateLimitPerMinute,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    throw new Error(`Falha ao ler AI_SERVICE_TOKENS_JSON: ${message}`);
  }
}

function extractTokenFromRequest(request: NextRequest): string | null {
  const authorization = normalizeOptionalString(request.headers.get("authorization"));
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    return normalizeOptionalString(authorization.slice(7));
  }

  const apiKey = normalizeOptionalString(request.headers.get("x-api-key"));
  if (apiKey) {
    return apiKey;
  }

  return null;
}

function toPrincipal(token: RawAiServiceToken): AiServicePrincipal {
  return {
    keyId: token.keyId ?? "key-unknown",
    organizationId: token.organizationId,
    scopes: token.scopes,
    rateLimitPerMinute: token.rateLimitPerMinute ?? 60,
  };
}

export function authorizeAiServiceRequest(
  request: NextRequest,
  requiredScope: string = AI_READ_SCOPE,
): AiAuthResult {
  const providedToken = extractTokenFromRequest(request);
  if (!providedToken) {
    return {
      ok: false,
      status: 401,
      error: "Token de servico ausente.",
    };
  }

  let configuredTokens: RawAiServiceToken[];
  try {
    configuredTokens = parseTokensConfig();
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error instanceof Error ? error.message : "Configuracao de token invalida.",
    };
  }

  if (configuredTokens.length === 0) {
    return {
      ok: false,
      status: 503,
      error: "Nenhum token de servico configurado em AI_SERVICE_TOKENS_JSON.",
    };
  }

  const matched = configuredTokens.find((token) => token.token === providedToken);
  if (!matched) {
    return {
      ok: false,
      status: 401,
      error: "Token de servico invalido.",
    };
  }

  const principal = toPrincipal(matched);

  if (!principal.scopes.includes(requiredScope)) {
    return {
      ok: false,
      status: 403,
      error: `Escopo obrigatorio ausente: ${requiredScope}.`,
      principal,
    };
  }

  return {
    ok: true,
    principal,
  };
}
