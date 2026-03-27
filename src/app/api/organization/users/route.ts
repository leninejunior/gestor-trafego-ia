import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { canonicalRoleFromInput, requireAdminAccess, type AdminAccessContext } from "@/lib/access/admin-rbac";

type MembershipRow = {
  id?: string;
  user_id?: string | null;
  organization_id?: string | null;
  org_id?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
};

type LimitRow = {
  current_users?: number | null;
  max_users?: number | null;
  can_add_more?: boolean | null;
  plan_name?: string | null;
};

const LIMIT_DEFAULT: Required<LimitRow> = {
  current_users: 0,
  max_users: 1,
  can_add_more: false,
  plan_name: "Free",
};

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isMissingSchemaError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  if (!candidate) {
    return false;
  }

  if (candidate.code === "42703" || candidate.code === "42P01") {
    return true;
  }

  const message = (candidate.message ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("column") || message.includes("relation");
}

function resolveOrganizationId(membership: MembershipRow): string | null {
  return normalizeString(membership.organization_id) ?? normalizeString(membership.org_id);
}

function isActiveMembership(membership: MembershipRow): boolean {
  const status = normalizeString(membership.status);
  if (!status) {
    return true;
  }

  const normalized = status.toLowerCase();
  return normalized === "active" || normalized === "accepted";
}

function rolePriority(role: string | null | undefined): number {
  switch (canonicalRoleFromInput(role)) {
    case "master":
      return 4;
    case "super_user":
      return 3;
    case "org_admin":
      return 2;
    default:
      return 1;
  }
}

function pickMembershipForOrganization(memberships: MembershipRow[], preferredOrganizationIds: string[] = []): MembershipRow | null {
  const activeMemberships = memberships.filter((membership) => isActiveMembership(membership) && resolveOrganizationId(membership));
  if (activeMemberships.length === 0) {
    return null;
  }

  const preferredMemberships =
    preferredOrganizationIds.length > 0
      ? activeMemberships.filter((membership) => {
          const orgId = resolveOrganizationId(membership);
          return orgId ? preferredOrganizationIds.includes(orgId) : false;
        })
      : [];

  const pool = preferredMemberships.length > 0 ? preferredMemberships : activeMemberships;

  return [...pool].sort((a, b) => {
    const priorityDelta = rolePriority(b.role) - rolePriority(a.role);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return (normalizeString(b.created_at) ?? "").localeCompare(normalizeString(a.created_at) ?? "");
  })[0] ?? null;
}

function resolveScopedOrganizationId(context: AdminAccessContext, memberships: MembershipRow[]): string | null {
  const preferredOrganizationIds = context.adminOrganizationIds.length > 0 ? context.adminOrganizationIds : context.organizationIds;
  const membership = pickMembershipForOrganization(memberships, preferredOrganizationIds);
  return resolveOrganizationId(membership ?? ({} as MembershipRow)) ?? preferredOrganizationIds[0] ?? null;
}

async function loadMembershipsForUser(serviceSupabase: ReturnType<typeof createServiceClient>, userId: string): Promise<MembershipRow[]> {
  const selectCandidates = [
    "id,user_id,organization_id,org_id,role,status,created_at,accepted_at",
    "id,user_id,organization_id,org_id,role,status,created_at",
    "id,user_id,organization_id,org_id,role,status",
    "id,user_id,organization_id,org_id,role",
    "id,user_id,organization_id,role,status,created_at,accepted_at",
    "id,user_id,organization_id,role,status,created_at",
    "id,user_id,organization_id,role",
    "id,user_id,org_id,role,status,created_at,accepted_at",
    "id,user_id,org_id,role,status,created_at",
    "id,user_id,org_id,role",
    "id,user_id,role,status,created_at,accepted_at",
    "id,user_id,role,status",
    "id,user_id,role",
  ] as const;

  for (const selectClause of selectCandidates) {
    const { data, error } = await serviceSupabase.from("memberships").select(selectClause).eq("user_id", userId);
    if (!error && Array.isArray(data)) {
      return data as MembershipRow[];
    }

    if (error && !isMissingSchemaError(error)) {
      continue;
    }
  }

  return [];
}

async function loadOrganizationUsers(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const selectCandidates = ["*"] as const;
  const orderColumns = ["joined_at", "created_at"] as const;

  for (const selectClause of selectCandidates) {
    for (const column of ["organization_id", "org_id"] as const) {
      for (const orderColumn of orderColumns) {
        const { data, error } = await serviceSupabase
          .from("organization_users")
          .select(selectClause)
          .eq(column, organizationId)
          .order(orderColumn, { ascending: false });

        if (!error && Array.isArray(data)) {
          return data;
        }
      }

      const withoutOrder = await serviceSupabase.from("organization_users").select(selectClause).eq(column, organizationId);
      if (!withoutOrder.error && Array.isArray(withoutOrder.data)) {
        return withoutOrder.data;
      }
    }
  }

  return [];
}

async function loadUserLimit(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string): Promise<Required<LimitRow>> {
  const { data, error } = await serviceSupabase.rpc("get_org_user_limit", { org_uuid: organizationId });

  if (error) {
    return { ...LIMIT_DEFAULT };
  }

  const limitRow = Array.isArray(data) ? (data[0] as LimitRow | undefined) : (data as LimitRow | undefined);

  return {
    current_users: typeof limitRow?.current_users === "number" ? limitRow.current_users : LIMIT_DEFAULT.current_users,
    max_users: typeof limitRow?.max_users === "number" ? limitRow.max_users : LIMIT_DEFAULT.max_users,
    can_add_more: typeof limitRow?.can_add_more === "boolean" ? limitRow.can_add_more : LIMIT_DEFAULT.can_add_more,
    plan_name: normalizeString(limitRow?.plan_name) ?? LIMIT_DEFAULT.plan_name,
  };
}

function toLegacyRoleLabel(role: string | null | undefined, privileged: boolean): string {
  const canonical = canonicalRoleFromInput(role);
  if (canonical === "master" || canonical === "super_user" || canonical === "org_admin") {
    return "admin";
  }

  if (canonical === "org_user") {
    return "member";
  }

  if (privileged) {
    return "admin";
  }

  return normalizeString(role) ?? "member";
}

function getOrganizationIdForCurrentContext(context: AdminAccessContext, memberships: MembershipRow[]): string | null {
  return resolveScopedOrganizationId(context, memberships);
}

function buildPrivilegedLimitResponse(role: AdminAccessContext["role"], limits: Required<LimitRow>): Required<LimitRow> {
  return {
    ...limits,
    can_add_more: true,
    plan_name: role === "master" ? "Master" : "Super User",
  };
}

function buildOrganizationResponse(
  context: AdminAccessContext,
  memberships: MembershipRow[],
  organizationId: string,
  users: unknown[],
  limits: Required<LimitRow>
) {
  const currentMembership =
    pickMembershipForOrganization(memberships, context.adminOrganizationIds.length > 0 ? context.adminOrganizationIds : context.organizationIds) ??
    pickMembershipForOrganization(memberships);

  const privileged = context.isMaster || context.isSuperUser;

  return {
    users,
    limits: privileged ? buildPrivilegedLimitResponse(context.role, limits) : limits,
    currentUserRole: toLegacyRoleLabel(currentMembership?.role ?? (organizationId ? null : context.role), privileged),
  };
}

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const serviceSupabase = createServiceClient();
  const memberships = context.memberships.length > 0 ? context.memberships : await loadMembershipsForUser(serviceSupabase, context.requester.id);
  const organizationId = getOrganizationIdForCurrentContext(context, memberships);
  const privileged = context.isMaster || context.isSuperUser;

  if (!organizationId) {
    if (privileged) {
      return NextResponse.json({
        users: [],
        limits: buildPrivilegedLimitResponse(context.role, LIMIT_DEFAULT),
        currentUserRole: "admin",
      });
    }

    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const [users, limits] = await Promise.all([loadOrganizationUsers(serviceSupabase, organizationId), loadUserLimit(serviceSupabase, organizationId)]);

  return NextResponse.json(buildOrganizationResponse(context, memberships, organizationId, users, limits));
}

export async function DELETE(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const serviceSupabase = createServiceClient();
  const memberships = context.memberships.length > 0 ? context.memberships : await loadMembershipsForUser(serviceSupabase, context.requester.id);
  const organizationId = getOrganizationIdForCurrentContext(context, memberships);

  const { searchParams } = new URL(request.url);
  const membershipId = searchParams.get("membershipId");

  if (!membershipId) {
    return NextResponse.json({ error: "Membership ID required" }, { status: 400 });
  }

  if (!organizationId && !context.isMaster && !context.isSuperUser) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const targetMembership = await loadMembershipById(serviceSupabase, membershipId);
  if (!targetMembership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const targetOrganizationId = resolveOrganizationId(targetMembership);
  if (!targetOrganizationId) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  if (!context.canManageOrganization(targetOrganizationId)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!context.isMaster && !context.isSuperUser && organizationId && targetOrganizationId !== organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (normalizeString(targetMembership.user_id) === context.requester.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const { error: deleteError } = await serviceSupabase.from("memberships").delete().eq("id", membershipId);
  if (deleteError) {
    throw deleteError;
  }

  return NextResponse.json({ success: true });
}

async function loadMembershipById(serviceSupabase: ReturnType<typeof createServiceClient>, membershipId: string): Promise<MembershipRow | null> {
  const selectCandidates = [
    "id,user_id,organization_id,org_id,role,status,created_at,accepted_at",
    "id,user_id,organization_id,org_id,role,status,created_at",
    "id,user_id,organization_id,org_id,role,status",
    "id,user_id,organization_id,org_id,role",
    "id,user_id,organization_id,role,status,created_at,accepted_at",
    "id,user_id,organization_id,role,status,created_at",
    "id,user_id,organization_id,role",
    "id,user_id,org_id,role,status,created_at,accepted_at",
    "id,user_id,org_id,role,status,created_at",
    "id,user_id,org_id,role",
    "id,user_id,role,status,created_at,accepted_at",
    "id,user_id,role,status",
    "id,user_id,role",
  ] as const;

  for (const selectClause of selectCandidates) {
    const { data, error } = await serviceSupabase.from("memberships").select(selectClause).eq("id", membershipId).maybeSingle();
    if (!error && data) {
      return data as MembershipRow;
    }
  }

  return null;
}
