import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureOrganizationExists, requireAdminAccess } from "@/lib/access/admin-rbac";

async function countActiveMembers(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const byOrganizationId = await serviceSupabase
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (!byOrganizationId.error) {
    return byOrganizationId.count ?? 0;
  }

  const byOrgId = await serviceSupabase
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("org_id", organizationId)
    .eq("status", "active");

  if (!byOrgId.error) {
    return byOrgId.count ?? 0;
  }

  const withoutStatusByOrganizationId = await serviceSupabase
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (!withoutStatusByOrganizationId.error) {
    return withoutStatusByOrganizationId.count ?? 0;
  }

  const withoutStatusByOrgId = await serviceSupabase
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("org_id", organizationId);

  if (!withoutStatusByOrgId.error) {
    return withoutStatusByOrgId.count ?? 0;
  }

  return 0;
}

async function countPendingInvites(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const byOrganizationId = await serviceSupabase
    .from("organization_invites")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "pending");

  if (!byOrganizationId.error) {
    return byOrganizationId.count ?? 0;
  }

  const byOrgId = await serviceSupabase
    .from("organization_invites")
    .select("*", { count: "exact", head: true })
    .eq("org_id", organizationId)
    .eq("status", "pending");

  if (byOrgId.error) {
    return 0;
  }

  return byOrgId.count ?? 0;
}

async function getLastActivity(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const byOrganizationIdWithStatus = await serviceSupabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (!byOrganizationIdWithStatus.error && Array.isArray(byOrganizationIdWithStatus.data)) {
    const userIds = byOrganizationIdWithStatus.data
      .map((membership) => (typeof membership.user_id === "string" ? membership.user_id : null))
      .filter((value): value is string => Boolean(value));

    if (userIds.length > 0) {
      const { data } = await serviceSupabase
        .from("user_profiles")
        .select("last_sign_in_at")
        .in("user_id", userIds)
        .order("last_sign_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data?.last_sign_in_at ?? null;
    }
  }

  const byOrgIdWithStatus = byOrganizationIdWithStatus.error
    ? await serviceSupabase
        .from("memberships")
        .select("user_id")
        .eq("org_id", organizationId)
        .eq("status", "active")
    : null;

  if (byOrgIdWithStatus && !byOrgIdWithStatus.error && Array.isArray(byOrgIdWithStatus.data)) {
    const userIds = byOrgIdWithStatus.data
      .map((membership) => (typeof membership.user_id === "string" ? membership.user_id : null))
      .filter((value): value is string => Boolean(value));

    if (userIds.length > 0) {
      const { data } = await serviceSupabase
        .from("user_profiles")
        .select("last_sign_in_at")
        .in("user_id", userIds)
        .order("last_sign_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data?.last_sign_in_at ?? null;
    }
  }

  const byOrganizationIdWithoutStatus = await serviceSupabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", organizationId);

  const byOrgIdWithoutStatus =
    byOrganizationIdWithoutStatus.error || !Array.isArray(byOrganizationIdWithoutStatus.data)
      ? await serviceSupabase.from("memberships").select("user_id").eq("org_id", organizationId)
      : null;

  const memberships = Array.isArray(byOrganizationIdWithoutStatus.data)
    ? byOrganizationIdWithoutStatus.data
    : byOrgIdWithoutStatus && Array.isArray(byOrgIdWithoutStatus.data)
      ? byOrgIdWithoutStatus.data
      : [];

  const userIds = memberships
    .map((membership) => (typeof membership.user_id === "string" ? membership.user_id : null))
    .filter((value): value is string => Boolean(value));

  if (userIds.length === 0) {
    return null;
  }

  const { data } = await serviceSupabase
    .from("user_profiles")
    .select("last_sign_in_at")
    .in("user_id", userIds)
    .order("last_sign_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.last_sign_in_at ?? null;
}

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const serviceSupabase = createServiceClient();
  const includeStats = request.nextUrl.searchParams.get("include_stats") === "true";

  let organizationsQuery = serviceSupabase.from("organizations").select("*").order("created_at", { ascending: false });

  if (!context.isMaster && !context.isSuperUser) {
    const orgScope = context.adminOrganizationIds;
    if (orgScope.length === 0) {
      return NextResponse.json({ organizations: [] });
    }
    organizationsQuery = organizationsQuery.in("id", orgScope);
  }

  const { data: organizations, error } = await organizationsQuery;
  if (error) {
    console.error("Failed to list organizations", error);
    return NextResponse.json({ error: "Failed to list organizations" }, { status: 500 });
  }

  if (!includeStats) {
    return NextResponse.json({ organizations: organizations ?? [] });
  }

  const organizationsWithStats = await Promise.all(
    (organizations ?? []).map(async (organization) => {
      const [activeMembers, pendingInvites, lastActivity] = await Promise.all([
        countActiveMembers(serviceSupabase, organization.id),
        countPendingInvites(serviceSupabase, organization.id),
        getLastActivity(serviceSupabase, organization.id),
      ]);

      return {
        ...organization,
        stats: {
          activeMembers,
          pendingInvites,
          lastActivity,
        },
      };
    })
  );

  return NextResponse.json({ organizations: organizationsWithStats });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  if (!context.canCreateOrganization) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const organizationName = typeof body.name === "string" ? body.name.trim() : "";
  if (!organizationName) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();
  const { data: existing } = await serviceSupabase
    .from("organizations")
    .select("id")
    .ilike("name", organizationName)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Organization already exists" }, { status: 400 });
  }

  const insertCandidates: Array<Record<string, unknown>> = [
    {
      name: organizationName,
      is_active: true,
      subscription_status: "active",
      subscription_plan: typeof body.subscriptionPlan === "string" ? body.subscriptionPlan : "free",
      subscription_expires_at:
        typeof body.subscriptionExpiresAt === "string" && body.subscriptionExpiresAt.trim().length > 0
          ? body.subscriptionExpiresAt
          : null,
    },
    {
      name: organizationName,
    },
  ];

  let organization: any = null;
  let createError: unknown = null;

  for (const payload of insertCandidates) {
    const attempt = await serviceSupabase.from("organizations").insert(payload as never).select().maybeSingle();
    if (!attempt.error && attempt.data) {
      organization = attempt.data;
      createError = null;
      break;
    }
    createError = attempt.error;
  }

  if (!organization) {
    console.error("Failed to create organization", createError);
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }

  const assignAdminUserId = typeof body.adminUserId === "string" ? body.adminUserId.trim() : "";
  if (assignAdminUserId && (await ensureOrganizationExists(organization.id))) {
    const membershipPayloadCandidates = [
      {
        user_id: assignAdminUserId,
        organization_id: organization.id,
        role: "org_admin",
        status: "active",
        invited_by: context.requester.id,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      },
      {
        user_id: assignAdminUserId,
        org_id: organization.id,
        role: "org_admin",
      },
    ];

    for (const payload of membershipPayloadCandidates) {
      const { error: membershipError } = await serviceSupabase.from("memberships").insert(payload as never);
      if (!membershipError) {
        break;
      }
    }
  }

  return NextResponse.json(
    {
      message: "Organization created successfully",
      organization,
    },
    { status: 201 }
  );
}
