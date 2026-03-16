import { createClient as createSupabaseClient, type User as SupabaseUser } from "@supabase/supabase-js";

import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

type MembershipScope = {
  organizationId: string;
  role: "MASTER" | "REGULAR" | "CLIENT";
};

export type LegacyUserScope = {
  user: SupabaseUser;
  userId: string;
  tenantId: string | null;
  organizationIds: string[];
  memberships: MembershipScope[];
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function resolveTenantIdFromAuthUser(user: SupabaseUser): string | null {
  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {};
  const userMetadata = isRecord(user.user_metadata) ? user.user_metadata : {};

  return (
    asNonEmptyString(appMetadata["tenant_id"]) ??
    asNonEmptyString(appMetadata["organization_id"]) ??
    asNonEmptyString(appMetadata["org_id"]) ??
    asNonEmptyString(userMetadata["tenant_id"]) ??
    asNonEmptyString(userMetadata["organization_id"]) ??
    asNonEmptyString(userMetadata["org_id"])
  );
}

export async function getAuthenticatedUser(request: Request): Promise<SupabaseUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return user;
    }
  } catch {
    // Ignora falha de leitura por cookie/env e tenta fallback via Authorization.
  }

  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  try {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function resolveLegacyUserScope(request: Request): Promise<LegacyUserScope | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return null;
  }

  const prisma = getPrismaClient();
  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    select: {
      organizationId: true,
      role: true,
    },
  });

  const organizationIds = new Set<string>();
  for (const membership of memberships) {
    organizationIds.add(membership.organizationId);
  }

  const tenantId = resolveTenantIdFromAuthUser(user);
  if (organizationIds.size === 0 && tenantId) {
    organizationIds.add(tenantId);
  }

  return {
    user,
    userId: user.id,
    tenantId,
    organizationIds: Array.from(organizationIds),
    memberships,
  };
}

