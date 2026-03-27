import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canonicalRoleFromInput, resolveAdminAccessContext } from "@/lib/access/admin-rbac";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Mail, Shield } from "lucide-react";
import { TeamInviteDialog } from "@/components/team/team-invite-dialog";
import { TeamMembersList } from "@/components/team/team-members-list";
import { TeamInvitesList } from "@/components/team/team-invites-list";

export const dynamic = "force-dynamic";

type MembershipRow = {
  id?: string;
  user_id?: string | null;
  organization_id?: string | null;
  org_id?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  organizations?: { id?: string | null; name?: string | null } | Array<{ id?: string | null; name?: string | null }> | null;
  user_profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
    last_login_at?: string | null;
  } | null;
  user_roles?: { name?: unknown; description?: unknown } | Array<{ name?: unknown; description?: unknown }> | null;
};

type InviteRow = {
  id?: string;
  email?: string | null;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  user_roles?: { name?: unknown; description?: unknown } | Array<{ name?: unknown; description?: unknown }> | null;
};

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveOrganizationId(membership: MembershipRow): string | null {
  return normalizeString(membership.organization_id) ?? normalizeString(membership.org_id);
}

function resolveOrganizationName(membership: MembershipRow): string | null {
  if (!membership.organizations) {
    return null;
  }

  if (Array.isArray(membership.organizations)) {
    return normalizeString(membership.organizations[0]?.name);
  }

  return normalizeString(membership.organizations.name);
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

function pickMembershipForTeam(memberships: MembershipRow[]): MembershipRow | null {
  const scopedMemberships = memberships.filter((membership) => isActiveMembership(membership) && resolveOrganizationId(membership));

  if (scopedMemberships.length === 0) {
    return null;
  }

  return [...scopedMemberships].sort((a, b) => {
    const roleDelta = rolePriority(b.role) - rolePriority(a.role);
    if (roleDelta !== 0) {
      return roleDelta;
    }

    return (normalizeString(b.created_at) ?? "").localeCompare(normalizeString(a.created_at) ?? "");
  })[0];
}

async function loadOrganizationMembers(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const selectClause = `
      id,
      role,
      status,
      created_at,
      accepted_at,
      user_profiles (
        first_name,
        last_name,
        avatar_url,
        last_login_at
      ),
      user_roles (
        name,
        description
      )
    `;

  for (const column of ["organization_id", "org_id"] as const) {
    const { data, error } = await serviceSupabase
      .from("memberships")
      .select(selectClause)
      .eq(column, organizationId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data as MembershipRow[];
    }
  }

  return [];
}

async function loadOrganizationInvites(serviceSupabase: ReturnType<typeof createServiceClient>, organizationId: string) {
  const selectClause = `
      id,
      email,
      status,
      created_at,
      expires_at,
      user_roles (
        name,
        description
      )
    `;

  for (const table of ["organization_invites", "user_invites"] as const) {
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
    }
  }

  return [];
}

export default async function TeamPage() {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const accessContext = await resolveAdminAccessContext(user);
  if (accessContext.role === "org_user") {
    return redirect("/dashboard");
  }

  const teamMembership = pickMembershipForTeam(accessContext.memberships);
  const organizationId =
    resolveOrganizationId(teamMembership ?? ({} as MembershipRow)) ??
    accessContext.adminOrganizationIds[0] ??
    accessContext.organizationIds[0] ??
    null;

  let organizationName = resolveOrganizationName(teamMembership ?? ({} as MembershipRow));
  if (!organizationName && organizationId) {
    const { data: organization } = await serviceSupabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();

    organizationName = normalizeString(organization?.name);
  }

  const canManageTeam =
    Boolean(organizationId) &&
    (accessContext.isMaster || accessContext.isSuperUser || accessContext.canManageOrganization(organizationId));

  const [members, invites, rolesResult] = await Promise.all([
    organizationId ? loadOrganizationMembers(serviceSupabase, organizationId) : Promise.resolve([]),
    organizationId && canManageTeam ? loadOrganizationInvites(serviceSupabase, organizationId) : Promise.resolve([]),
    serviceSupabase.from("user_roles").select("*").neq("name", "super_admin").order("name"),
  ]);

  const roles = Array.isArray(rolesResult.data) ? rolesResult.data : [];

  const stats = {
    totalMembers: members?.length || 0,
    pendingInvites: invites?.length || 0,
    activeMembers: members?.filter((member) => {
      const status = normalizeString(member.status)?.toLowerCase();
      return status === "active" || status === "accepted" || !status;
    }).length || 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-600 mt-2">Gerencie os membros da sua organizacao</p>
        </div>

        {canManageTeam && (
          <TeamInviteDialog roles={roles || []}>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Membro
            </Button>
          </TeamInviteDialog>
        )}
      </div>

      {!organizationId && (
        <Card>
          <CardHeader>
            <CardTitle>Organizacao nao encontrada</CardTitle>
            <CardDescription>
              Nao foi possivel identificar uma organizacao ativa para carregar a equipe.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">{stats.activeMembers} ativos</p>
          </CardContent>
        </Card>

        {canManageTeam && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Convites Pendentes</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingInvites}</div>
                <p className="text-xs text-muted-foreground">Aguardando resposta</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Organizacao</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold truncate">{organizationName ?? "Sem nome"}</div>
                <p className="text-xs text-muted-foreground">Seu papel: {teamMembership?.role ?? accessContext.role}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>Todos os membros ativos da organizacao</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersList members={members || []} currentUserId={user.id} canManage={canManageTeam} roles={roles || []} />
        </CardContent>
      </Card>

      {canManageTeam && invites && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites Pendentes</CardTitle>
            <CardDescription>Convites enviados aguardando resposta</CardDescription>
          </CardHeader>
          <CardContent>
            <TeamInvitesList invites={invites} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
