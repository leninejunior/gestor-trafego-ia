import { randomUUID } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canonicalRoleFromInput, resolveAdminAccessContext } from "@/lib/access/admin-rbac";
import { NextRequest, NextResponse } from "next/server";

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveScopedOrganizationId(context: Awaited<ReturnType<typeof resolveAdminAccessContext>>): string | null {
  return context.adminOrganizationIds[0] ?? context.organizationIds[0] ?? null;
}

async function sendSupabaseAuthInviteEmail(
  email: string,
  inviteToken?: string | null
): Promise<{ ok: boolean; warning?: string; inviteLink?: string }> {
  const serviceSupabase = createServiceClient();
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

async function listInvites(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const selectCandidates = [
    `
      *,
      user_roles (
        name,
        description
      )
    `,
    "*",
  ] as const;

  for (const selectClause of selectCandidates) {
    for (const column of ["organization_id", "org_id"] as const) {
      const { data, error } = await serviceSupabase
        .from("organization_invites")
        .select(selectClause)
        .eq(column, organizationId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        return data;
      }
    }
  }

  return [];
}

async function hasPendingInvite(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  email: string
): Promise<boolean> {
  const checks = await Promise.all([
    serviceSupabase
      .from("organization_invites")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("status", "pending")
      .limit(1),
    serviceSupabase
      .from("organization_invites")
      .select("id")
      .eq("org_id", organizationId)
      .eq("email", email)
      .eq("status", "pending")
      .limit(1),
  ]);

  return checks.some((check) => !check.error && Array.isArray(check.data) && check.data.length > 0);
}

async function findExistingUserIdByEmail(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  email: string
): Promise<string | null> {
  const { data, error } = await serviceSupabase
    .from("user_profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (error || !data?.user_id) {
    return null;
  }

  return data.user_id as string;
}

async function userAlreadyInOrganization(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const checks = await Promise.all([
    serviceSupabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .limit(1),
    serviceSupabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", organizationId)
      .limit(1),
  ]);

  return checks.some((check) => !check.error && Array.isArray(check.data) && check.data.length > 0);
}

async function createDirectInvite(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  payload: {
    email: string;
    organizationId: string;
    invitedBy: string;
    roleName: string;
    roleId: string | null;
  }
): Promise<{ invite: Record<string, unknown> | null; error?: string }> {
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const basePayload = {
    email: payload.email,
    invited_by: payload.invitedBy,
    token,
    expires_at: expiresAt.toISOString(),
    status: "pending",
    role: payload.roleName,
  };

  const insertCandidates: Array<Record<string, unknown>> = [
    {
      ...basePayload,
      organization_id: payload.organizationId,
      role_id: payload.roleId,
    },
    {
      ...basePayload,
      org_id: payload.organizationId,
      role_id: payload.roleId,
    },
    {
      ...basePayload,
      organization_id: payload.organizationId,
    },
    {
      ...basePayload,
      org_id: payload.organizationId,
    },
  ];

  for (const candidate of insertCandidates) {
    const { data, error } = await serviceSupabase
      .from("organization_invites")
      .insert(candidate as never)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return { invite: data as Record<string, unknown> };
    }
  }

  return { invite: null, error: "Erro ao criar convite" };
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const accessContext = await resolveAdminAccessContext(user);
    if (accessContext.role === "org_user") {
      return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
    }

    const organizationId = resolveScopedOrganizationId(accessContext);
    if (!organizationId) {
      return NextResponse.json({ error: "Organizacao nao encontrada" }, { status: 404 });
    }

    const invites = await listInvites(serviceSupabase, organizationId);
    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Erro na API de convites:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const accessContext = await resolveAdminAccessContext(user);
    if (accessContext.role === "org_user") {
      return NextResponse.json({ error: "Sem permissao para convidar usuarios" }, { status: 403 });
    }

    const organizationId = resolveScopedOrganizationId(accessContext);
    if (!organizationId) {
      return NextResponse.json({ error: "Organizacao nao encontrada" }, { status: 404 });
    }

    const body = (await request.json()) as { email?: unknown; role?: unknown };
    const normalizedEmail = normalizeString(body.email)?.toLowerCase() ?? "";
    const requestedRole = normalizeString(body.role) ?? "org_user";

    if (!normalizedEmail || !requestedRole) {
      return NextResponse.json({ error: "Email e role sao obrigatorios" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Email invalido" }, { status: 400 });
    }

    const { data: roleRow } = await serviceSupabase
      .from("user_roles")
      .select("id,name")
      .ilike("name", requestedRole)
      .maybeSingle();

    const resolvedRoleName = normalizeString(roleRow?.name) ?? requestedRole;
    const resolvedRoleId = normalizeString(roleRow?.id);
    const canonicalTargetRole = canonicalRoleFromInput(resolvedRoleName);

    if (!accessContext.canAssignRole(canonicalTargetRole)) {
      return NextResponse.json({ error: "Sem permissao para atribuir essa role" }, { status: 403 });
    }

    if (await hasPendingInvite(serviceSupabase, organizationId, normalizedEmail)) {
      return NextResponse.json({ error: "Ja existe um convite pendente para este email" }, { status: 409 });
    }

    const existingUserId = await findExistingUserIdByEmail(serviceSupabase, normalizedEmail);
    if (existingUserId && (await userAlreadyInOrganization(serviceSupabase, existingUserId, organizationId))) {
      return NextResponse.json({ error: "Usuario ja e membro desta organizacao" }, { status: 409 });
    }

    const inviteResult = await createDirectInvite(serviceSupabase, {
      email: normalizedEmail,
      organizationId,
      invitedBy: user.id,
      roleName: resolvedRoleName,
      roleId: resolvedRoleId,
    });

    if (!inviteResult.invite) {
      return NextResponse.json({ error: inviteResult.error || "Erro ao criar convite" }, { status: 500 });
    }

    const emailDelivery = await sendSupabaseAuthInviteEmail(
      normalizedEmail,
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

    return NextResponse.json({
      message: "Convite criado com sucesso",
      invite: inviteResult.invite,
      emailDelivery: normalizedEmailDelivery,
    });
  } catch (error) {
    console.error("Erro na API de convites:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
