import { randomBytes } from "crypto";
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

type InviteRow = {
  id?: string;
  email?: string | null;
  status?: string | null;
  token?: string | null;
  organization_id?: string | null;
  org_id?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  role?: string | null;
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

const INVITE_TABLES = ["organization_invites", "user_invites"] as const;

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

async function loadCurrentOrganizationInvites(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const selectClause = `
      *
    `;

  for (const table of INVITE_TABLES) {
    for (const column of ["organization_id", "org_id"] as const) {
      const { data, error } = await serviceSupabase
        .from(table)
        .select(selectClause)
        .eq(column, organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        return data as InviteRow[];
      }

      if (error && !isMissingSchemaError(error)) {
        continue;
      }
    }
  }

  return [];
}

async function loadCurrentOrganizationUsers(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const selectClause = "*";

  for (const column of ["organization_id", "org_id"] as const) {
    const { data, error } = await serviceSupabase
      .from("organization_users")
      .select(selectClause)
      .eq(column, organizationId)
      .order("joined_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data;
    }

    const byCreatedAt = await serviceSupabase
      .from("organization_users")
      .select(selectClause)
      .eq(column, organizationId)
      .order("created_at", { ascending: false });

    if (!byCreatedAt.error && Array.isArray(byCreatedAt.data)) {
      return byCreatedAt.data;
    }

    const withoutOrder = await serviceSupabase.from("organization_users").select(selectClause).eq(column, organizationId);
    if (!withoutOrder.error && Array.isArray(withoutOrder.data)) {
      return withoutOrder.data;
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

function buildPrivilegedLimitResponse(role: AdminAccessContext["role"], limits: Required<LimitRow>): Required<LimitRow> {
  return {
    ...limits,
    can_add_more: true,
    plan_name: role === "master" ? "Master" : "Super User",
  };
}

function toInvitationRoleLabel(role: string | null | undefined): string {
  const canonical = canonicalRoleFromInput(role);
  if (canonical === "master" || canonical === "super_user" || canonical === "org_admin") {
    return "admin";
  }

  if (canonical === "org_user") {
    return "member";
  }

  return normalizeString(role) ?? "member";
}

async function loadInviteById(serviceSupabase: ReturnType<typeof createServiceClient>, inviteId: string): Promise<InviteRow | null> {
  const selectCandidates = ["*", "id,email,status,token,organization_id,org_id,created_at,expires_at,role"] as const;

  for (const table of INVITE_TABLES) {
    for (const selectClause of selectCandidates) {
      const { data, error } = await serviceSupabase.from(table).select(selectClause).eq("id", inviteId).maybeSingle();
      if (!error && data) {
        return data as InviteRow;
      }
    }
  }

  return null;
}

async function loadExistingInviteForEmail(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  email: string
): Promise<InviteRow | null> {
  const selectCandidates = ["*", "id,email,status,token,organization_id,org_id,created_at,expires_at,role"] as const;

  for (const table of INVITE_TABLES) {
    for (const selectClause of selectCandidates) {
      for (const column of ["organization_id", "org_id"] as const) {
        const { data, error } = await serviceSupabase
          .from(table)
          .select(selectClause)
          .eq(column, organizationId)
          .eq("email", email)
          .eq("status", "pending")
          .maybeSingle();

        if (!error && data) {
          return data as InviteRow;
        }
      }
    }
  }

  return null;
}

async function insertInvite(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  payload: {
    organizationId: string;
    email: string;
    role: string;
    invitedBy: string;
    token: string;
  }
): Promise<InviteRow | null> {
  const basePayload = {
    email: payload.email,
    role: payload.role,
    invited_by: payload.invitedBy,
    token: payload.token,
    status: "pending",
    expires_at: (() => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      return expiresAt.toISOString();
    })(),
  };

  for (const table of INVITE_TABLES) {
    const insertCandidates: Array<Record<string, unknown>> = [
      {
        ...basePayload,
        organization_id: payload.organizationId,
      },
      {
        ...basePayload,
        org_id: payload.organizationId,
      },
      {
        ...basePayload,
        organization_id: payload.organizationId,
        org_id: payload.organizationId,
      },
    ];

    for (const candidate of insertCandidates) {
      const { data, error } = await serviceSupabase.from(table).insert(candidate as never).select("*").maybeSingle();
      if (!error && data) {
        return data as InviteRow;
      }
    }
  }

  return null;
}

async function updateInviteStatus(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  inviteId: string,
  status: string
): Promise<boolean> {
  for (const table of INVITE_TABLES) {
    const { error } = await serviceSupabase.from(table).update({ status }).eq("id", inviteId);
    if (!error) {
      return true;
    }
  }

  return false;
}

function getScopedOrganizationId(context: AdminAccessContext, memberships: MembershipRow[]): string | null {
  return resolveScopedOrganizationId(context, memberships);
}

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const serviceSupabase = createServiceClient();
  const memberships = context.memberships.length > 0 ? context.memberships : await loadMembershipsForUser(serviceSupabase, context.requester.id);
  const organizationId = getScopedOrganizationId(context, memberships);

  if (!organizationId) {
    if (context.isMaster || context.isSuperUser) {
      return NextResponse.json({ invites: [] });
    }

    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  if (!context.canManageOrganization(organizationId)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const invites = await loadCurrentOrganizationInvites(serviceSupabase, organizationId);
  return NextResponse.json({ invites: invites || [] });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const serviceSupabase = createServiceClient();
  const memberships = context.memberships.length > 0 ? context.memberships : await loadMembershipsForUser(serviceSupabase, context.requester.id);
  const organizationId = getScopedOrganizationId(context, memberships);

  const body = (await request.json()) as { email?: unknown; role?: unknown };
  const email = normalizeString(body.email)?.toLowerCase() ?? "";
  const role = normalizeString(body.role) ?? "member";
  const privileged = context.isMaster || context.isSuperUser;

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  if (!["admin", "member", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!organizationId) {
    return NextResponse.json({ error: "No organization found" }, { status: privileged ? 400 : 404 });
  }

  if (!context.canCreateUsers) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!context.canManageOrganization(organizationId)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!privileged) {
    const limits = await loadUserLimit(serviceSupabase, organizationId);
    if (!limits.can_add_more) {
      return NextResponse.json(
        {
          error: "User limit reached",
          details: `Your plan allows ${limits.max_users} user(s). Please upgrade to add more users.`,
        },
        { status: 403 }
      );
    }
  }

  const organizationUsers = await loadCurrentOrganizationUsers(serviceSupabase, organizationId);
  if (organizationUsers.some((user) => normalizeString((user as { email?: unknown }).email)?.toLowerCase() === email)) {
    return NextResponse.json({ error: "User already in organization" }, { status: 400 });
  }

  const existingInvite = await loadExistingInviteForEmail(serviceSupabase, organizationId, email);
  if (existingInvite) {
    return NextResponse.json({ error: "Invite already sent to this email" }, { status: 400 });
  }

  const token = randomBytes(32).toString("hex");
  const invite = await insertInvite(serviceSupabase, {
    organizationId,
    email,
    role: toInvitationRoleLabel(role),
    invitedBy: context.requester.id,
    token,
  });

  if (!invite) {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

  return NextResponse.json({
    success: true,
    invite,
    inviteLink,
  });
}

export async function DELETE(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const serviceSupabase = createServiceClient();
  const memberships = context.memberships.length > 0 ? context.memberships : await loadMembershipsForUser(serviceSupabase, context.requester.id);
  const organizationId = getScopedOrganizationId(context, memberships);

  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get("inviteId");

  if (!inviteId) {
    return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
  }

  if (!organizationId && !context.isMaster && !context.isSuperUser) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const invite = await loadInviteById(serviceSupabase, inviteId);
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const inviteOrganizationId = resolveOrganizationId(invite);
  if (!inviteOrganizationId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (!context.canManageOrganization(inviteOrganizationId)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!context.isMaster && !context.isSuperUser && organizationId && inviteOrganizationId !== organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (normalizeString(invite.status)?.toLowerCase() !== "pending") {
    return NextResponse.json({ error: "Invite cannot be cancelled" }, { status: 400 });
  }

  const cancelled = await updateInviteStatus(serviceSupabase, inviteId, "cancelled");
  if (!cancelled) {
    return NextResponse.json({ error: "Failed to cancel invite" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
