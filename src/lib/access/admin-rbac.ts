import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export type CanonicalRole = "master" | "super_user" | "org_admin" | "org_user";

type MembershipRow = {
  id?: string;
  user_id?: string;
  organization_id?: string | null;
  org_id?: string | null;
  role?: string | null;
  status?: string | null;
  role_id?: string | null;
  user_roles?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

type RoleRow = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: unknown;
  is_system_role?: boolean;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

const ROLE_PRIORITY: Record<CanonicalRole, number> = {
  master: 4,
  super_user: 3,
  org_admin: 2,
  org_user: 1,
};

const ROLE_ALIASES: Record<CanonicalRole, string[]> = {
  master: ["master"],
  super_user: ["super_user", "super-admin", "super_admin"],
  org_admin: ["org_admin", "admin", "owner"],
  org_user: ["org_user", "member", "membro", "user", "client", "regular", "viewer"],
};

const MEMBERSHIP_SELECT_CANDIDATES = [
  "id,user_id,organization_id,org_id,role,status,role_id,user_roles!memberships_role_id_fkey(name)",
  "id,user_id,organization_id,org_id,role,status,role_id",
  "id,user_id,organization_id,org_id,role,role_id",
  "id,user_id,organization_id,org_id,role",
] as const;

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isMissingColumnError(error: unknown): boolean {
  const candidate = error as SupabaseErrorLike | null;
  if (!candidate) return false;
  if (candidate.code === "42703") return true;
  const message = (candidate.message ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("column");
}

function roleFromRaw(raw: string | null | undefined): CanonicalRole | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(ROLE_ALIASES) as Array<[CanonicalRole, string[]]>) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }
  return null;
}

function getHighestRole(candidates: Array<CanonicalRole | null>): CanonicalRole {
  let highest: CanonicalRole = "org_user";
  for (const role of candidates) {
    if (!role) continue;
    if (ROLE_PRIORITY[role] > ROLE_PRIORITY[highest]) {
      highest = role;
    }
  }
  return highest;
}

function extractLinkedRoleNames(value: MembershipRow["user_roles"]): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item?.name))
      .filter((item): item is string => Boolean(item));
  }

  const candidate = normalizeString((value as { name?: unknown }).name);
  return candidate ? [candidate] : [];
}

function resolveOrganizationId(membership: MembershipRow): string | null {
  return normalizeString(membership.organization_id) ?? normalizeString(membership.org_id);
}

function isActiveMembership(membership: MembershipRow): boolean {
  const status = normalizeString(membership.status);
  if (!status) return true;
  const normalized = status.toLowerCase();
  return normalized === "active" || normalized === "accepted";
}

async function hasActiveUserRecord(table: "master_users" | "super_admins", userId: string): Promise<boolean> {
  const serviceSupabase = createServiceClient();

  const withActive = await serviceSupabase
    .from(table)
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);

  if (!withActive.error) {
    return Array.isArray(withActive.data) && withActive.data.length > 0;
  }

  const withoutActive = await serviceSupabase.from(table).select("user_id").eq("user_id", userId).limit(1);
  if (withoutActive.error) {
    return false;
  }

  return Array.isArray(withoutActive.data) && withoutActive.data.length > 0;
}

async function listMembershipsForUser(userId: string): Promise<MembershipRow[]> {
  const serviceSupabase = createServiceClient();
  let lastError: SupabaseErrorLike | null = null;

  for (const selectClause of MEMBERSHIP_SELECT_CANDIDATES) {
    const { data, error } = await serviceSupabase
      .from("memberships")
      .select(selectClause)
      .eq("user_id", userId)
      .limit(500);

    if (!error && Array.isArray(data)) {
      return data as MembershipRow[];
    }

    if (error) {
      lastError = error;
      continue;
    }
  }

  if (lastError) {
    console.error("Failed to list memberships for user", userId, lastError);
  }

  return [];
}

function mapMembershipRoleCandidates(membership: MembershipRow): CanonicalRole[] {
  const direct = roleFromRaw(normalizeString(membership.role));
  const linked = extractLinkedRoleNames(membership.user_roles).map((item) => roleFromRaw(item));
  return [direct, ...linked].filter((role): role is CanonicalRole => Boolean(role));
}

export type AdminAccessContext = {
  requester: User;
  role: CanonicalRole;
  organizationIds: string[];
  adminOrganizationIds: string[];
  memberships: MembershipRow[];
  isMaster: boolean;
  isSuperUser: boolean;
  isOrgAdmin: boolean;
  canCreateOrganization: boolean;
  canCreateUsers: boolean;
  canManageRoles: boolean;
  canManageOrganization: (organizationId: string) => boolean;
  canAssignRole: (targetRole: CanonicalRole) => boolean;
};

export type AdminAuthResult = {
  context: AdminAccessContext | null;
  errorResponse: NextResponse | null;
};

export async function getAuthenticatedUser(request: NextRequest): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();

  if (cookieUser) {
    return cookieUser;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const authSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: { user: headerUser },
  } = await authSupabase.auth.getUser();

  return headerUser ?? null;
}

function buildContext(requester: User, role: CanonicalRole, memberships: MembershipRow[]): AdminAccessContext {
  const activeMemberships = memberships.filter(isActiveMembership);

  const organizationIds = uniq(
    activeMemberships
      .map((membership) => resolveOrganizationId(membership))
      .filter((orgId): orgId is string => Boolean(orgId))
  );

  const adminOrganizationIds = uniq(
    activeMemberships
      .filter((membership) => {
        const highestForMembership = getHighestRole(mapMembershipRoleCandidates(membership));
        return highestForMembership === "org_admin";
      })
      .map((membership) => resolveOrganizationId(membership))
      .filter((orgId): orgId is string => Boolean(orgId))
  );

  const isMaster = role === "master";
  const isSuperUser = role === "super_user" || isMaster;
  const isOrgAdmin = role === "org_admin";

  return {
    requester,
    role,
    organizationIds,
    adminOrganizationIds,
    memberships: activeMemberships,
    isMaster,
    isSuperUser,
    isOrgAdmin,
    canCreateOrganization: isMaster || isSuperUser,
    canCreateUsers: isMaster || isSuperUser || isOrgAdmin,
    canManageRoles: isMaster || isSuperUser,
    canManageOrganization: (organizationId: string) => {
      if (!organizationId) return false;
      if (isMaster || isSuperUser) return true;
      return adminOrganizationIds.includes(organizationId);
    },
    canAssignRole: (targetRole: CanonicalRole) => {
      if (isMaster) return true;
      if (isSuperUser) return targetRole !== "master";
      if (isOrgAdmin) return targetRole === "org_admin" || targetRole === "org_user";
      return false;
    },
  };
}

export async function resolveAdminAccessContext(requester: User): Promise<AdminAccessContext> {
  const [isMasterRecord, isSuperRecord, memberships] = await Promise.all([
    hasActiveUserRecord("master_users", requester.id),
    hasActiveUserRecord("super_admins", requester.id),
    listMembershipsForUser(requester.id),
  ]);

  if (isMasterRecord) {
    return buildContext(requester, "master", memberships);
  }

  const membershipRoles = memberships
    .filter(isActiveMembership)
    .flatMap((membership) => mapMembershipRoleCandidates(membership));

  const highestMembershipRole = getHighestRole(membershipRoles);

  if (isSuperRecord || highestMembershipRole === "super_user") {
    return buildContext(requester, "super_user", memberships);
  }

  if (highestMembershipRole === "master") {
    return buildContext(requester, "master", memberships);
  }

  if (highestMembershipRole === "org_admin") {
    return buildContext(requester, "org_admin", memberships);
  }

  return buildContext(requester, "org_user", memberships);
}

export async function requireAdminAccess(request: NextRequest): Promise<AdminAuthResult> {
  const requester = await getAuthenticatedUser(request);
  if (!requester) {
    return {
      context: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const context = await resolveAdminAccessContext(requester);
  if (context.role === "org_user") {
    return {
      context: null,
      errorResponse: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    };
  }

  return { context, errorResponse: null };
}

export function canonicalRoleFromInput(value: string | null | undefined): CanonicalRole {
  return roleFromRaw(value) ?? "org_user";
}

export function getDefaultRoleCatalog(): Array<Omit<RoleRow, "id"> & { canonicalRole: CanonicalRole }> {
  return [
    {
      name: "master",
      description: "Acesso total ao sistema",
      permissions: ["*"],
      is_system_role: true,
      canonicalRole: "master",
    },
    {
      name: "super_user",
      description: "Cria organizacoes e usuarios",
      permissions: ["organizations:create", "users:create", "users:assign"],
      is_system_role: true,
      canonicalRole: "super_user",
    },
    {
      name: "org_admin",
      description: "Administra usuarios da propria organizacao",
      permissions: ["organization:read", "organization:users:manage"],
      is_system_role: true,
      canonicalRole: "org_admin",
    },
    {
      name: "org_user",
      description: "Usuario padrao da organizacao",
      permissions: ["organization:read"],
      is_system_role: true,
      canonicalRole: "org_user",
    },
  ];
}

export async function getRoleCatalog(): Promise<RoleRow[]> {
  const serviceSupabase = createServiceClient();
  const { data, error } = await serviceSupabase
    .from("user_roles")
    .select("id,name,description,permissions,is_system_role")
    .order("name");

  if (!error && Array.isArray(data)) {
    return data as RoleRow[];
  }

  if (error) {
    console.error("Failed to fetch roles from user_roles", error);
  }

  return getDefaultRoleCatalog().map((role, index) => ({
    id: `default-${index + 1}`,
    name: role.name,
    description: role.description ?? null,
    permissions: role.permissions,
    is_system_role: role.is_system_role,
  }));
}

export async function resolveRole(
  roleId: string | null | undefined,
  roleName: string | null | undefined
): Promise<{ id: string | null; name: string; canonicalRole: CanonicalRole }> {
  const normalizedRoleName = normalizeString(roleName);
  const normalizedRoleId = normalizeString(roleId);
  const serviceSupabase = createServiceClient();

  if (normalizedRoleId) {
    const { data, error } = await serviceSupabase
      .from("user_roles")
      .select("id,name")
      .eq("id", normalizedRoleId)
      .maybeSingle();

    if (!error && data && typeof data.name === "string") {
      return {
        id: data.id,
        name: data.name,
        canonicalRole: canonicalRoleFromInput(data.name),
      };
    }
  }

  if (normalizedRoleName) {
    const { data, error } = await serviceSupabase
      .from("user_roles")
      .select("id,name")
      .ilike("name", normalizedRoleName)
      .maybeSingle();

    if (!error && data && typeof data.name === "string") {
      return {
        id: data.id,
        name: data.name,
        canonicalRole: canonicalRoleFromInput(data.name),
      };
    }
  }

  const fallbackName = normalizedRoleName ?? "org_user";
  return {
    id: normalizedRoleId ?? null,
    name: fallbackName,
    canonicalRole: canonicalRoleFromInput(fallbackName),
  };
}

export async function ensureOrganizationExists(organizationId: string): Promise<boolean> {
  const serviceSupabase = createServiceClient();
  const { data, error } = await serviceSupabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data?.id);
}
