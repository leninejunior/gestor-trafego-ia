import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decodeJwtPayload } from "@/lib/auth/jwt";

type MetadataUser = {
  id: string;
  app_metadata?: unknown;
  user_metadata?: unknown;
};

export type TenantContext = {
  userId: string;
  tenantId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function firstDefinedString(values: unknown[]): string | null {
  for (const value of values) {
    const parsed = asNonEmptyString(value);
    if (parsed) return parsed;
  }

  return null;
}

function resolveTenantId(user: MetadataUser, accessToken?: string): string | null {
  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {};
  const userMetadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const jwtPayload = decodeJwtPayload(accessToken) ?? {};

  return firstDefinedString([
    appMetadata["tenant_id"],
    appMetadata["organization_id"],
    appMetadata["org_id"],
    userMetadata["tenant_id"],
    userMetadata["organization_id"],
    userMetadata["org_id"],
    jwtPayload["tenant_id"],
    jwtPayload["organization_id"],
    jwtPayload["org_id"],
  ]);
}

export async function getTenantContext(): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const user = userData.user as MetadataUser | null;
  if (!user) {
    return null;
  }

  const tenantId = resolveTenantId(user, sessionData.session?.access_token);

  return {
    userId: user.id,
    tenantId: tenantId ?? user.id,
  };
}
