import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ensureOrganizationExists,
  requireAdminAccess,
  resolveRole,
  type AdminAccessContext,
} from "@/lib/access/admin-rbac";

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

type UserProfileRow = {
  user_id: string;
  [key: string]: unknown;
};

const MEMBERSHIP_SELECT_CANDIDATES = [
  "id,user_id,organization_id,org_id,role,role_id,status,created_at,accepted_at",
  "id,user_id,organization_id,org_id,role,role_id,created_at,accepted_at",
  "id,user_id,organization_id,role,role_id,status,created_at,accepted_at",
  "id,user_id,org_id,role,role_id,status,created_at,accepted_at",
  "id,user_id,org_id,role,role_id,created_at,accepted_at",
] as const;

const PROFILE_SELECT_CANDIDATES = [
  "user_id,first_name,last_name,email,created_at,last_sign_in_at,is_suspended,suspended_at,suspended_by,suspension_reason",
  "user_id,first_name,last_name,email,created_at,last_sign_in_at,is_suspended",
  "user_id,first_name,last_name,email,created_at,is_suspended",
  "user_id,email,created_at",
] as const;

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveOrganizationId(membership: MembershipRow): string | null {
  return normalizeString(membership.organization_id) ?? normalizeString(membership.org_id);
}

async function loadMembershipsForUser(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<MembershipRow[]> {
  for (const selectClause of MEMBERSHIP_SELECT_CANDIDATES) {
    const { data, error } = await serviceSupabase
      .from("memberships")
      .select(selectClause)
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      return data as MembershipRow[];
    }
  }

  return [];
}

async function loadProfileForUser(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<UserProfileRow | null> {
  for (const selectClause of PROFILE_SELECT_CANDIDATES) {
    const { data, error } = await serviceSupabase
      .from("user_profiles")
      .select(selectClause)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      return data as UserProfileRow;
    }
  }

  return null;
}

function canManageTargetUser(context: AdminAccessContext, targetMemberships: MembershipRow[]): boolean {
  if (context.isMaster || context.isSuperUser) {
    return true;
  }

  if (!context.isOrgAdmin) {
    return false;
  }

  return targetMemberships.some((membership) => {
    const orgId = resolveOrganizationId(membership);
    return orgId ? context.canManageOrganization(orgId) : false;
  });
}

async function upsertMembership(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  payload: {
    targetUserId: string;
    organizationId: string;
    roleName: string;
    roleId: string | null;
    actorUserId: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const byOrganizationId = await serviceSupabase
    .from("memberships")
    .select("id")
    .eq("user_id", payload.targetUserId)
    .eq("organization_id", payload.organizationId)
    .maybeSingle();

  const byOrgId = byOrganizationId.data?.id
    ? null
    : await serviceSupabase
        .from("memberships")
        .select("id")
        .eq("user_id", payload.targetUserId)
        .eq("org_id", payload.organizationId)
        .maybeSingle();

  const membershipId =
    normalizeString(byOrganizationId.data?.id) ?? normalizeString(byOrgId?.data?.id) ?? null;

  if (membershipId) {
    const updateCandidates: Array<Record<string, unknown>> = [
      {
        role: payload.roleName,
        role_id: payload.roleId,
        status: "active",
        accepted_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null,
      },
      {
        role: payload.roleName,
        role_id: payload.roleId,
      },
      {
        role: payload.roleName,
      },
    ];

    for (const candidate of updateCandidates) {
      const { error } = await serviceSupabase.from("memberships").update(candidate).eq("id", membershipId);
      if (!error) {
        return { ok: true };
      }
    }

    return { ok: false, error: "Failed to update membership" };
  }

  const insertCandidates: Array<Record<string, unknown>> = [
    {
      user_id: payload.targetUserId,
      organization_id: payload.organizationId,
      role: payload.roleName,
      role_id: payload.roleId,
      status: "active",
      invited_by: payload.actorUserId,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    },
    {
      user_id: payload.targetUserId,
      org_id: payload.organizationId,
      role: payload.roleName,
      role_id: payload.roleId,
      status: "active",
    },
    {
      user_id: payload.targetUserId,
      organization_id: payload.organizationId,
      role: payload.roleName,
    },
    {
      user_id: payload.targetUserId,
      org_id: payload.organizationId,
      role: payload.roleName,
    },
  ];

  for (const candidate of insertCandidates) {
    const { error } = await serviceSupabase.from("memberships").insert(candidate as never);
    if (!error) {
      return { ok: true };
    }
  }

  return { ok: false, error: "Failed to create membership" };
}

async function getMembershipById(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  membershipId: string,
  userId: string
): Promise<{ id: string; organization_id?: string | null; org_id?: string | null } | null> {
  const selectCandidates = [
    "id,organization_id,org_id",
    "id,organization_id",
    "id,org_id",
  ];

  for (const selectClause of selectCandidates) {
    const { data, error } = await serviceSupabase
      .from("memberships")
      .select(selectClause)
      .eq("id", membershipId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  }

  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const { userId } = await params;
  const serviceSupabase = createServiceClient();

  const [profile, targetMemberships] = await Promise.all([
    loadProfileForUser(serviceSupabase, userId),
    loadMembershipsForUser(serviceSupabase, userId),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!canManageTargetUser(context, targetMemberships)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({
    user: {
      ...profile,
      id: profile.user_id,
      memberships: targetMemberships,
    },
    activities: [],
    pendingInvites: [],
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const { userId } = await params;
  const body = await request.json();
  const action = normalizeString(body.action);

  const serviceSupabase = createServiceClient();
  const targetMemberships = await loadMembershipsForUser(serviceSupabase, userId);

  if (!canManageTargetUser(context, targetMemberships)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  switch (action) {
    case "update_profile": {
      const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
      const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

      const { error } = await serviceSupabase
        .from("user_profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
        })
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
      }
      return NextResponse.json({ message: "User updated successfully" });
    }

    case "suspend": {
      const reason = typeof body.reason === "string" ? body.reason.trim() : null;
      const { error } = await serviceSupabase
        .from("user_profiles")
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_by: context.requester.id,
          suspension_reason: reason,
        })
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to suspend user" }, { status: 500 });
      }
      return NextResponse.json({ message: "User suspended successfully" });
    }

    case "unsuspend": {
      const { error } = await serviceSupabase
        .from("user_profiles")
        .update({
          is_suspended: false,
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null,
        })
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json({ error: "Failed to reactivate user" }, { status: 500 });
      }
      return NextResponse.json({ message: "User reactivated successfully" });
    }

    case "send_password_reset": {
      if (!context.isMaster && !context.isSuperUser) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const payloadEmail = normalizeString(body.email)?.toLowerCase() ?? null;
      const profile = await loadProfileForUser(serviceSupabase, userId);
      const profileEmail = normalizeString(profile?.email)?.toLowerCase() ?? null;
      const targetEmail = payloadEmail ?? profileEmail;

      if (!targetEmail) {
        return NextResponse.json({ error: "User email not found" }, { status: 400 });
      }

      const configuredBase = normalizeString(process.env.NEXT_PUBLIC_APP_URL);
      const baseUrl = configuredBase ? configuredBase.replace(/\/+$/, "") : request.nextUrl.origin;
      const redirectTo = `${baseUrl}/login`;

      const { error } = await serviceSupabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo,
      });

      if (error) {
        return NextResponse.json(
          {
            error: "Failed to send password reset email",
            details: error.message,
            hint: "Verify Supabase Auth email provider/SMTP and project rate limits.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Password reset email sent successfully",
        email: targetEmail,
      });
    }

    case "update_role":
    case "assign_to_organization": {
      const organizationId = normalizeString(body.organizationId);
      const membershipId = normalizeString(body.membershipId);
      const resolvedRole = await resolveRole(
        normalizeString(body.roleId),
        normalizeString(body.newRole) ?? normalizeString(body.role)
      );

      if (!context.canAssignRole(resolvedRole.canonicalRole)) {
        return NextResponse.json({ error: "Cannot assign requested role" }, { status: 403 });
      }

      if (membershipId && action === "update_role") {
        const membership = await getMembershipById(serviceSupabase, membershipId, userId);
        if (!membership) {
          return NextResponse.json({ error: "Membership not found" }, { status: 404 });
        }

        const targetOrg = normalizeString(membership.organization_id) ?? normalizeString(membership.org_id);
        if (!targetOrg || !context.canManageOrganization(targetOrg)) {
          return NextResponse.json({ error: "Access denied for this organization" }, { status: 403 });
        }

        const { error } = await serviceSupabase
          .from("memberships")
          .update({
            role: resolvedRole.name,
            role_id: resolvedRole.id,
            status: "active",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", membershipId)
          .eq("user_id", userId);

        if (error) {
          return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
        }

        return NextResponse.json({ message: "Role updated successfully" });
      }

      if (!organizationId) {
        return NextResponse.json({ error: "Organization is required" }, { status: 400 });
      }

      if (!context.canManageOrganization(organizationId)) {
        return NextResponse.json({ error: "Access denied for this organization" }, { status: 403 });
      }

      if (!(await ensureOrganizationExists(organizationId))) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }

      const upsertResult = await upsertMembership(serviceSupabase, {
        targetUserId: userId,
        organizationId,
        roleName: resolvedRole.name,
        roleId: resolvedRole.id,
        actorUserId: context.requester.id,
      });

      if (!upsertResult.ok) {
        return NextResponse.json({ error: upsertResult.error ?? "Failed to assign organization" }, { status: 500 });
      }

      return NextResponse.json({ message: "Organization assignment saved successfully" });
    }

    case "remove_from_organization": {
      const membershipId = normalizeString(body.membershipId);
      if (!membershipId) {
        return NextResponse.json({ error: "Membership is required" }, { status: 400 });
      }

      const { data: membership, error: membershipError } = await serviceSupabase
        .from("memberships")
        .select("id")
        .eq("id", membershipId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError || !membership) {
        return NextResponse.json({ error: "Membership not found" }, { status: 404 });
      }

      const membershipWithOrg = await getMembershipById(serviceSupabase, membershipId, userId);
      if (!membershipWithOrg) {
        return NextResponse.json({ error: "Membership not found" }, { status: 404 });
      }

      const targetOrg =
        normalizeString(membershipWithOrg.organization_id) ?? normalizeString(membershipWithOrg.org_id);
      if (!targetOrg || !context.canManageOrganization(targetOrg)) {
        return NextResponse.json({ error: "Access denied for this organization" }, { status: 403 });
      }

      const removeCandidates: Array<Record<string, unknown>> = [
        {
          status: "removed",
          removed_at: new Date().toISOString(),
          removed_by: context.requester.id,
        },
        {
          status: "removed",
        },
      ];

      let removed = false;
      for (const payload of removeCandidates) {
        const { error } = await serviceSupabase.from("memberships").update(payload).eq("id", membershipId);
        if (!error) {
          removed = true;
          break;
        }
      }

      if (!removed) {
        return NextResponse.json({ error: "Failed to remove membership" }, { status: 500 });
      }

      return NextResponse.json({ message: "Membership removed successfully" });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  if (!context.isMaster && !context.isSuperUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { userId } = await params;
  if (userId === context.requester.id) {
    return NextResponse.json({ error: "Cannot delete your own user" }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();
  const { data: profile } = await serviceSupabase.from("user_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await serviceSupabase
    .from("memberships")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: context.requester.id,
    })
    .eq("user_id", userId);

  const { error } = await serviceSupabase
    .from("user_profiles")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: context.requester.id,
    })
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }

  return NextResponse.json({ message: "User deleted successfully" });
}
