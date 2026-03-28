import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  canonicalRoleFromInput,
  ensureOrganizationExists,
  requireAdminAccess,
  resolveRole,
} from "@/lib/access/admin-rbac";

type ProfileRow = {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  is_suspended?: boolean | null;
  is_deleted?: boolean | null;
};

type MembershipRow = {
  id?: string;
  user_id?: string | null;
  organization_id?: string | null;
  org_id?: string | null;
  role?: string | null;
  role_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
};

const PROFILE_SELECT_CANDIDATES = [
  "user_id,first_name,last_name,email,created_at,last_sign_in_at,is_suspended,is_deleted",
  "user_id,first_name,last_name,email,created_at,last_sign_in_at,is_suspended",
  "user_id,first_name,last_name,email,created_at,is_suspended",
  "user_id,email,created_at",
] as const;

const MEMBERSHIP_SELECT_CANDIDATES = [
  "id,user_id,organization_id,org_id,role,role_id,status,created_at,accepted_at",
  "id,user_id,organization_id,org_id,role,role_id,created_at,accepted_at",
  "id,user_id,organization_id,role,role_id,status,created_at,accepted_at",
  "id,user_id,org_id,role,role_id,status,created_at,accepted_at",
  "id,user_id,org_id,role,role_id,created_at,accepted_at",
] as const;

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isActiveStatus(status: string | null | undefined): boolean {
  const normalized = normalizeString(status);
  if (!normalized) {
    return true;
  }
  return normalized.toLowerCase() === "active" || normalized.toLowerCase() === "accepted";
}

function resolveOrganizationId(membership: MembershipRow): string | null {
  return normalizeString(membership.organization_id) ?? normalizeString(membership.org_id);
}

async function loadProfiles(serviceSupabase: ReturnType<typeof createServiceClient>): Promise<ProfileRow[]> {
  for (const selectClause of PROFILE_SELECT_CANDIDATES) {
    const { data, error } = await serviceSupabase
      .from("user_profiles")
      .select(selectClause)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return (data as ProfileRow[]).filter((profile) => !profile.is_deleted);
    }
  }

  return [];
}

async function loadMemberships(serviceSupabase: ReturnType<typeof createServiceClient>): Promise<MembershipRow[]> {
  for (const selectClause of MEMBERSHIP_SELECT_CANDIDATES) {
    const { data, error } = await serviceSupabase.from("memberships").select(selectClause);
    if (!error && Array.isArray(data)) {
      return data as MembershipRow[];
    }
  }
  return [];
}

async function loadOrganizationsByIds(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  organizationIds: string[]
): Promise<Map<string, OrganizationRow>> {
  const ids = Array.from(new Set(organizationIds));
  if (ids.length === 0) {
    return new Map<string, OrganizationRow>();
  }

  const { data, error } = await serviceSupabase.from("organizations").select("id,name").in("id", ids);
  if (error || !Array.isArray(data)) {
    return new Map<string, OrganizationRow>();
  }

  return new Map<string, OrganizationRow>(data.map((row) => [row.id, row as OrganizationRow]));
}

async function upsertMembership(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  userId: string,
  organizationId: string,
  roleName: string,
  roleId: string | null,
  actorUserId: string
): Promise<{ ok: boolean; error?: string }> {
  let existingMembershipId: string | null = null;

  const findByOrganizationId = await serviceSupabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!findByOrganizationId.error) {
    existingMembershipId = normalizeString(findByOrganizationId.data?.id);
  }

  if (!existingMembershipId) {
    const findByOrgId = await serviceSupabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", organizationId)
      .maybeSingle();

    if (!findByOrgId.error) {
      existingMembershipId = normalizeString(findByOrgId.data?.id);
    }
  }

  if (existingMembershipId) {
    const updateCandidates: Array<Record<string, unknown>> = [
      {
        role: roleName,
        role_id: roleId,
        status: "active",
        accepted_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null,
      },
      {
        role: roleName,
        role_id: roleId,
      },
      {
        role: roleName,
      },
    ];

    for (const payload of updateCandidates) {
      const { error } = await serviceSupabase.from("memberships").update(payload).eq("id", existingMembershipId);
      if (!error) {
        return { ok: true };
      }
    }

    return { ok: false, error: "Failed to update membership" };
  }

  const insertCandidates: Array<Record<string, unknown>> = [
    {
      user_id: userId,
      organization_id: organizationId,
      role: roleName,
      role_id: roleId,
      status: "active",
      invited_by: actorUserId,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      org_id: organizationId,
      role: roleName,
      role_id: roleId,
      status: "active",
    },
    {
      user_id: userId,
      organization_id: organizationId,
      role: roleName,
    },
    {
      user_id: userId,
      org_id: organizationId,
      role: roleName,
    },
  ];

  for (const payload of insertCandidates) {
    const { error } = await serviceSupabase.from("memberships").insert(payload as never);
    if (!error) {
      return { ok: true };
    }
  }

  return { ok: false, error: "Failed to create membership" };
}

async function createInvite(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  payload: {
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    roleName: string;
    roleId: string | null;
    invitedBy: string;
  }
): Promise<{ ok: boolean; invite?: Record<string, unknown>; error?: string }> {
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const basePayload = {
    email: payload.email,
    first_name: payload.firstName,
    last_name: payload.lastName,
    invited_by: payload.invitedBy,
    token,
    expires_at: expiresAt.toISOString(),
    status: "pending",
  };

  const inviteCandidates: Array<Record<string, unknown>> = [
    {
      ...basePayload,
      organization_id: payload.organizationId,
      role: payload.roleName,
      role_id: payload.roleId,
    },
    {
      ...basePayload,
      org_id: payload.organizationId,
      role: payload.roleName,
      role_id: payload.roleId,
    },
    {
      email: payload.email,
      invited_by: payload.invitedBy,
      token,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      organization_id: payload.organizationId,
      role: payload.roleName,
      role_id: payload.roleId,
    },
    {
      email: payload.email,
      invited_by: payload.invitedBy,
      token,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      org_id: payload.organizationId,
      role: payload.roleName,
      role_id: payload.roleId,
    },
    {
      email: payload.email,
      invited_by: payload.invitedBy,
      token,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      organization_id: payload.organizationId,
      role: payload.roleName,
    },
    {
      email: payload.email,
      invited_by: payload.invitedBy,
      token,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      org_id: payload.organizationId,
      role: payload.roleName,
    },
  ];

  for (const invitePayload of inviteCandidates) {
    const { data, error } = await serviceSupabase
      .from("organization_invites")
      .insert(invitePayload as never)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return { ok: true, invite: data as Record<string, unknown> };
    }
  }

  return { ok: false, error: "Failed to create invite" };
}

async function sendSupabaseAuthInviteEmail(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  email: string,
  inviteToken?: string | null
): Promise<{ ok: boolean; warning?: string; inviteLink?: string }> {
  const configuredBaseUrl = normalizeString(process.env.NEXT_PUBLIC_APP_URL);
  const normalizedToken = normalizeString(inviteToken);
  const redirectPath = normalizedToken ? `/invite/${normalizedToken}` : "/login";
  const redirectTo = configuredBaseUrl ? `${configuredBaseUrl.replace(/\/+$/, "")}${redirectPath}` : undefined;

  const { error } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  const manualLinkResult = await serviceSupabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  const manualInviteLink =
    !manualLinkResult.error && manualLinkResult.data?.properties?.action_link
      ? manualLinkResult.data.properties.action_link
      : undefined;

  if (error) {
    return {
      ok: false,
      warning: error.message || "Invite email could not be sent by Supabase Auth",
      inviteLink: manualInviteLink,
    };
  }

  return {
    ok: true,
    inviteLink: manualInviteLink,
  };
}

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const search = normalizeString(request.nextUrl.searchParams.get("search"))?.toLowerCase() ?? "";
  const statusFilter = normalizeString(request.nextUrl.searchParams.get("status"))?.toLowerCase() ?? "all";

  const serviceSupabase = createServiceClient();
  const [profiles, memberships] = await Promise.all([loadProfiles(serviceSupabase), loadMemberships(serviceSupabase)]);

  const scopedMemberships =
    context.isMaster || context.isSuperUser
      ? memberships
      : memberships.filter((membership) => {
          const orgId = resolveOrganizationId(membership);
          return orgId ? context.canManageOrganization(orgId) : false;
        });

  const scopedUserIds = new Set(
    scopedMemberships
      .map((membership) => normalizeString(membership.user_id))
      .filter((userId): userId is string => Boolean(userId))
  );

  const scopedProfiles =
    context.isMaster || context.isSuperUser
      ? profiles
      : profiles.filter((profile) => scopedUserIds.has(profile.user_id));

  const organizationNames = await loadOrganizationsByIds(
    serviceSupabase,
    scopedMemberships
      .map((membership) => resolveOrganizationId(membership))
      .filter((orgId): orgId is string => Boolean(orgId))
  );

  const membershipsByUser = new Map<string, Array<MembershipRow & { organizations?: OrganizationRow | null }>>();
  for (const membership of scopedMemberships) {
    const userId = normalizeString(membership.user_id);
    if (!userId) continue;

    const orgId = resolveOrganizationId(membership);
    const mappedMembership: MembershipRow & { organizations?: OrganizationRow | null } = {
      ...membership,
      organization_id: orgId,
      organizations: orgId ? organizationNames.get(orgId) ?? null : null,
    };

    if (!membershipsByUser.has(userId)) {
      membershipsByUser.set(userId, []);
    }
    membershipsByUser.get(userId)!.push(mappedMembership);
  }

  const usersWithMemberships = scopedProfiles.map((profile) => {
    const userMemberships = membershipsByUser.get(profile.user_id) ?? [];
    const canonicalRoles = userMemberships.map((membership) => canonicalRoleFromInput(membership.role));
    let userType = "Org User";
    if (canonicalRoles.includes("master")) userType = "Master";
    else if (canonicalRoles.includes("super_user")) userType = "Super User";
    else if (canonicalRoles.includes("org_admin")) userType = "Org Admin";

    return {
      id: profile.user_id,
      user_id: profile.user_id,
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      email: profile.email ?? "",
      created_at: profile.created_at ?? null,
      last_sign_in_at: profile.last_sign_in_at ?? null,
      is_suspended: Boolean(profile.is_suspended),
      user_type: userType,
      memberships: userMemberships,
    };
  });

  let filteredUsers = usersWithMemberships;

  if (search) {
    filteredUsers = filteredUsers.filter((candidate) => {
      const email = normalizeString(candidate.email)?.toLowerCase() ?? "";
      const firstName = normalizeString(candidate.first_name)?.toLowerCase() ?? "";
      const lastName = normalizeString(candidate.last_name)?.toLowerCase() ?? "";
      return email.includes(search) || firstName.includes(search) || lastName.includes(search);
    });
  }

  if (statusFilter !== "all") {
    filteredUsers = filteredUsers.filter((candidate) => {
      const hasActiveMembership = candidate.memberships.some((membership) => isActiveStatus(membership.status));
      const hasPendingMembership =
        candidate.memberships.some((membership) => normalizeString(membership.status)?.toLowerCase() === "pending") ??
        false;

      switch (statusFilter) {
        case "active":
          return hasActiveMembership && !candidate.is_suspended;
        case "pending":
          return hasPendingMembership;
        case "suspended":
          return candidate.is_suspended;
        default:
          return true;
      }
    });
  }

  const stats = {
    total: usersWithMemberships.length,
    active: usersWithMemberships.filter(
      (candidate) => candidate.memberships.some((membership) => isActiveStatus(membership.status)) && !candidate.is_suspended
    ).length,
    pending: usersWithMemberships.filter((candidate) =>
      candidate.memberships.some((membership) => normalizeString(membership.status)?.toLowerCase() === "pending")
    ).length,
    suspended: usersWithMemberships.filter((candidate) => candidate.is_suspended).length,
    superAdmins: usersWithMemberships.filter((candidate) =>
      candidate.memberships.some((membership) => {
        const canonicalRole = canonicalRoleFromInput(membership.role);
        return canonicalRole === "master" || canonicalRole === "super_user";
      })
    ).length,
  };

  return NextResponse.json({
    users: filteredUsers,
    stats,
  });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  if (!context.canCreateUsers) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const email = normalizeString(body.email)?.toLowerCase() ?? "";
  const firstName = normalizeString(body.firstName) ?? "";
  const lastName = normalizeString(body.lastName) ?? "";
  const organizationId = normalizeString(body.organizationId) ?? "";
  const roleId = normalizeString(body.roleId);
  const roleName = normalizeString(body.role);

  if (!email || !firstName || !organizationId) {
    return NextResponse.json({ error: "Email, name and organization are required" }, { status: 400 });
  }

  if (!context.canManageOrganization(organizationId)) {
    return NextResponse.json({ error: "Access denied for this organization" }, { status: 403 });
  }

  if (!(await ensureOrganizationExists(organizationId))) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const resolvedRole = await resolveRole(roleId, roleName);
  if (!context.canAssignRole(resolvedRole.canonicalRole)) {
    return NextResponse.json({ error: "Cannot assign requested role" }, { status: 403 });
  }

  const serviceSupabase = createServiceClient();
  const { data: existingProfile } = await serviceSupabase
    .from("user_profiles")
    .select("user_id,email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.user_id) {
    const membershipResult = await upsertMembership(
      serviceSupabase,
      existingProfile.user_id,
      organizationId,
      resolvedRole.name,
      resolvedRole.id,
      context.requester.id
    );

    if (!membershipResult.ok) {
      return NextResponse.json({ error: membershipResult.error ?? "Failed to assign user" }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "User already existed and was linked to organization",
        userId: existingProfile.user_id,
        assignedRole: resolvedRole.name,
      },
      { status: 200 }
    );
  }

  const inviteResult = await createInvite(serviceSupabase, {
    email,
    firstName,
    lastName,
    organizationId,
    roleName: resolvedRole.name,
    roleId: resolvedRole.id,
    invitedBy: context.requester.id,
  });

  if (!inviteResult.ok || !inviteResult.invite) {
    return NextResponse.json({ error: inviteResult.error ?? "Failed to create invite" }, { status: 500 });
  }

  const emailDelivery = await sendSupabaseAuthInviteEmail(
    serviceSupabase,
    email,
    normalizeString(inviteResult.invite.token)
  );
  const inviteToken = normalizeString(inviteResult.invite.token);
  const configuredBaseUrl = normalizeString(process.env.NEXT_PUBLIC_APP_URL);
  const appBaseUrl = configuredBaseUrl ? configuredBaseUrl.replace(/\/+$/, "") : request.nextUrl.origin;
  const fallbackInviteLink = inviteToken ? `${appBaseUrl}/invite/${inviteToken}` : undefined;
  const normalizedEmailDelivery = {
    ...emailDelivery,
    inviteLink: emailDelivery.inviteLink ?? fallbackInviteLink,
  };

  return NextResponse.json(
    {
      message: "Invite created successfully",
      invite: {
        id: inviteResult.invite.id,
        email: inviteResult.invite.email,
        token: inviteResult.invite.token,
        expiresAt: inviteResult.invite.expires_at,
      },
      emailDelivery: normalizedEmailDelivery,
    },
    { status: 201 }
  );
}
