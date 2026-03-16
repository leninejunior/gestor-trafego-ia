export type JwtPayload = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodeJwtPayload(token: string | undefined): JwtPayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = Buffer.from(parts[1] as string, "base64url").toString(
      "utf-8",
    );
    const parsed = JSON.parse(payload) as unknown;

    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getJwtExpirationIso(payload: JwtPayload | null): string | null {
  if (!payload || typeof payload.exp !== "number") {
    return null;
  }

  return new Date(payload.exp * 1000).toISOString();
}
