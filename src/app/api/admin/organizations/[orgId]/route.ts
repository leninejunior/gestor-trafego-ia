import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureOrganizationExists, requireAdminAccess } from "@/lib/access/admin-rbac";

const SELECT_ORGANIZATION_CANDIDATES = [
  "id,name,created_at,is_active,subscription_status,subscription_plan,subscription_expires_at",
  "id,name,created_at,is_active,subscription_status,subscription_plan",
  "id,name,created_at,is_active",
  "id,name,created_at",
] as const;

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function loadOrganization(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  organizationId: string
): Promise<Record<string, unknown> | null> {
  for (const selectClause of SELECT_ORGANIZATION_CANDIDATES) {
    const { data, error } = await serviceSupabase
      .from("organizations")
      .select(selectClause)
      .eq("id", organizationId)
      .maybeSingle();

    if (!error && data) {
      return data as Record<string, unknown>;
    }
  }

  return null;
}

async function updateMembershipsForDelete(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  actorUserId: string
) {
  const payloads: Array<Record<string, unknown>> = [
    {
      status: "removed",
      removed_at: new Date().toISOString(),
      removed_by: actorUserId,
    },
    {
      status: "removed",
    },
  ];

  for (const payload of payloads) {
    const byOrganizationId = await serviceSupabase
      .from("memberships")
      .update(payload)
      .eq("organization_id", organizationId);

    if (!byOrganizationId.error) {
      return true;
    }

    const byOrgId = await serviceSupabase.from("memberships").update(payload).eq("org_id", organizationId);
    if (!byOrgId.error) {
      return true;
    }
  }

  return false;
}

async function cancelPendingInvites(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  actorUserId: string
) {
  const payloads: Array<Record<string, unknown>> = [
    {
      status: "cancelled",
      updated_at: new Date().toISOString(),
      cancelled_by: actorUserId,
    },
    {
      status: "cancelled",
    },
  ];

  for (const payload of payloads) {
    const byOrganizationId = await serviceSupabase
      .from("organization_invites")
      .update(payload)
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    if (!byOrganizationId.error) {
      return true;
    }

    const byOrgId = await serviceSupabase
      .from("organization_invites")
      .update(payload)
      .eq("org_id", organizationId)
      .eq("status", "pending");

    if (!byOrgId.error) {
      return true;
    }
  }

  return false;
}

type ServiceError = { code?: string; message?: string } | null;

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const { orgId } = await params;
  if (!context.canManageOrganization(orgId)) {
    return NextResponse.json({ error: "Access denied for this organization" }, { status: 403 });
  }

  const serviceSupabase = createServiceClient();
  const organization = await loadOrganization(serviceSupabase, orgId);
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({ organization });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const { orgId } = await params;
  if (!context.canManageOrganization(orgId)) {
    return NextResponse.json({ error: "Access denied for this organization" }, { status: 403 });
  }

  if (!(await ensureOrganizationExists(orgId))) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = await request.json();
  const organizationName = normalizeString(body.name);
  const normalizedPlan = normalizeString(body.subscriptionPlan);
  const normalizedStatus = normalizeString(body.subscriptionStatus);
  const normalizedExpiry = normalizeString(body.subscriptionExpiresAt);
  const hasExpiryField = Object.prototype.hasOwnProperty.call(body, "subscriptionExpiresAt");

  if (!organizationName && !normalizedPlan && !normalizedStatus && !hasExpiryField) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (organizationName) {
    const serviceSupabase = createServiceClient();
    const { data: existingName } = await serviceSupabase
      .from("organizations")
      .select("id")
      .ilike("name", organizationName)
      .neq("id", orgId)
      .maybeSingle();

    if (existingName) {
      return NextResponse.json({ error: "Organization name already exists" }, { status: 409 });
    }
  }

  const serviceSupabase = createServiceClient();
  const updateCandidates: Array<Record<string, unknown>> = [];
  const basePayload: Record<string, unknown> = {};

  if (organizationName) {
    basePayload.name = organizationName;
  }
  if (normalizedPlan) {
    basePayload.subscription_plan = normalizedPlan;
  }
  if (normalizedStatus) {
    basePayload.subscription_status = normalizedStatus;
  }
  if (hasExpiryField) {
    basePayload.subscription_expires_at = normalizedExpiry;
  }

  updateCandidates.push(basePayload);
  if (organizationName) {
    updateCandidates.push({ name: organizationName });
  }

  let updatedOrganization: Record<string, unknown> | null = null;
  let lastError: ServiceError = null;

  for (const payload of updateCandidates) {
    const attempt = await serviceSupabase
      .from("organizations")
      .update(payload)
      .eq("id", orgId)
      .select("*")
      .maybeSingle();

    if (!attempt.error && attempt.data) {
      updatedOrganization = attempt.data as Record<string, unknown>;
      lastError = null;
      break;
    }

    lastError = attempt.error;
  }

  if (!updatedOrganization) {
    if (lastError?.code === "23505") {
      return NextResponse.json({ error: "Organization name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }

  return NextResponse.json({
    message: "Organization updated successfully",
    organization: updatedOrganization,
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  if (!context.isMaster && !context.isSuperUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { orgId } = await params;
  if (!context.canManageOrganization(orgId)) {
    return NextResponse.json({ error: "Access denied for this organization" }, { status: 403 });
  }

  if (!(await ensureOrganizationExists(orgId))) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const serviceSupabase = createServiceClient();

  await updateMembershipsForDelete(serviceSupabase, orgId, context.requester.id);
  await cancelPendingInvites(serviceSupabase, orgId, context.requester.id);

  const deleteAttempt = await serviceSupabase.from("organizations").delete().eq("id", orgId);
  if (!deleteAttempt.error) {
    return NextResponse.json({ message: "Organization deleted successfully" });
  }

  const softDeleteCandidates: Array<Record<string, unknown>> = [
    {
      is_active: false,
      subscription_status: "cancelled",
    },
    {
      is_active: false,
    },
  ];

  for (const payload of softDeleteCandidates) {
    const softAttempt = await serviceSupabase.from("organizations").update(payload).eq("id", orgId);
    if (!softAttempt.error) {
      return NextResponse.json({
        message: "Organization deactivated successfully",
        deactivated: true,
      });
    }
  }

  return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
}
