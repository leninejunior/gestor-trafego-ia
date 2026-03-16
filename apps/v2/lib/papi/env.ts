export type PapiEnv = {
  baseUrl: string;
  apiKey: string;
  groupId: string;
  sendPath: string;
  timeoutMs: number;
};

function asRequiredString(value: string | undefined, envName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Variavel obrigatoria ausente: ${envName}`);
  }

  return normalized;
}

function normalizeBaseUrl(url: string): string {
  const parsed = new URL(url);
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = normalizedPath;
  return parsed.toString().replace(/\/+$/, "");
}

function normalizePath(pathValue: string | undefined, fallbackPath: string): string {
  const raw = (pathValue || fallbackPath).trim();
  if (raw.length === 0) {
    return fallbackPath;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeTimeout(timeoutRaw: string | undefined): number {
  if (!timeoutRaw) return 10_000;

  const parsed = Number.parseInt(timeoutRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10_000;
  }

  return parsed;
}

export function getPapiEnv(): PapiEnv {
  const baseUrlRaw = asRequiredString(process.env.PAPI_BASE_URL, "PAPI_BASE_URL");
  const apiKey = asRequiredString(process.env.PAPI_API_KEY, "PAPI_API_KEY");
  const groupId = asRequiredString(process.env.PAPI_GROUP_ID, "PAPI_GROUP_ID");

  return {
    baseUrl: normalizeBaseUrl(baseUrlRaw),
    apiKey,
    groupId,
    sendPath: normalizePath(process.env.PAPI_SEND_PATH, "/messages/group/send"),
    timeoutMs: normalizeTimeout(process.env.PAPI_TIMEOUT_MS),
  };
}
