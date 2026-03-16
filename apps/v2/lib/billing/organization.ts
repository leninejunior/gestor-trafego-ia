type TenantContext = {
  userId: string;
  tenantId: string;
};

type SupabaseLikeClient = {
  from: (table: string) => unknown;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function fetchFirstOrgIdFromTable(
  supabase: SupabaseLikeClient,
  table: string,
  userId: string,
): Promise<string | null> {
  const columnCandidates = ["organization_id", "org_id"];

  for (const column of columnCandidates) {
    const queryResult = (await (supabase
      .from(table) as {
      select: (value: string) => {
        eq: (field: string, filter: string) => {
          limit: (count: number) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
        };
      };
    })
      .select(column)
      .eq("user_id", userId)
      .limit(1)) as { data?: unknown; error?: { message?: string } | null };

    const error = queryResult?.error ?? null;
    const data = Array.isArray(queryResult?.data)
      ? (queryResult.data as Record<string, unknown>[])
      : [];

    if (error) {
      continue;
    }

    const value = data?.[0]?.[column];
    const parsed = asNonEmptyString(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export async function resolveBillingOrganizationId(
  supabase: SupabaseLikeClient,
  tenantContext: TenantContext,
): Promise<string | null> {
  const fromMemberships = await fetchFirstOrgIdFromTable(
    supabase,
    "memberships",
    tenantContext.userId,
  );
  if (fromMemberships) return fromMemberships;

  const fromOrganizationMemberships = await fetchFirstOrgIdFromTable(
    supabase,
    "organization_memberships",
    tenantContext.userId,
  );
  if (fromOrganizationMemberships) return fromOrganizationMemberships;

  return asNonEmptyString(tenantContext.tenantId);
}
