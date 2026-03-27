import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const CANONICAL_ROLES = ["master", "super_user", "org_admin", "org_user"] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

type ClientSummary = {
  id: string;
  name: string | null;
};

type InsertCandidate = Record<string, unknown>;

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type RawRecord = Record<string, unknown>;

export type NormalizedMembership = {
  id: string | null;
  userId: string;
  organizationId: string | null;
  role: CanonicalRole;
  rawRole: string | null;
  roleId: string | null;
  status: string | null;
  createdAt: string | null;
  acceptedAt: string | null;
};

export type AccessActorContext = {
  user: {
    id: string;
    email: string | null;
  };
  role: CanonicalRole | null;
  isAdmin: boolean;
  isMaster: boolean;
  isSuperUser: boolean;
  canManageAllOrganizations: boolean;
  organizationIds: string[];
  manageableOrganizationIds: string[];
  memberships: NormalizedMembership[];
};

function asRecord(value: unknown): RawRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as RawRecord;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

function rolePriority(role: CanonicalRole | null): number {
  switch (role) {
    case "master":
      return 4;
    case "super_user":
      return 3;
    case "org_admin":
      return 2;
    case "org_user":
      return 1;
    default:
      return 0;
  }
}

function isMembershipActive(status: string | null): boolean {
  if (!status) {
    return true;
  }

  const normalized = status.trim().toLowerCase();
  return normalized === "active" || normalized === "accepted";
}

export function normalizeRoleName(role: string | null | undefined): CanonicalRole | null {
  if (!role) {
    return null;
  }

  const normalized = role.trim().toLowerCase();

  if (["master"].includes(normalized)) {
    return "master";
  }

  if (["super_user", "super-user", "super_admin", "super-admin", "superadmin"].includes(normalized)) {
    return "super_user";
  }

  if (["org_admin", "organization_admin", "organization-admin", "admin", "owner"].includes(normalized)) {
    return "org_admin";
  }

  if (["org_user", "organization_user", "organization-user", "member", "user", "regular", "client", "viewer"].includes(normalized)) {
    return "org_user";
  }

  return null;
}

export class UserAccessControlService {
  private readonly supabase = createServiceClient();

  async getAuthenticatedUserFromRequest(request?: NextRequest): Promise<User | null> {
    const cookieClient = await createClient();
    const { data } = await cookieClient.auth.getUser();
    if (data.user) {
      return data.user;
    }

    const bearerToken = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearerToken) {
      return null;
    }

    const authClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: bearerData } = await authClient.auth.getUser();
    return bearerData.user ?? null;
  }

  async isMasterUser(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    return this.isActiveUserInTable("master_users", userId);
  }

  async isSuperUser(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    if (await this.isMasterUser(userId)) {
      return true;
    }

    if (await this.isActiveUserInTable("super_admins", userId)) {
      return true;
    }

    const memberships = await this.listMembershipsByUserId(userId);
    return memberships.some((membership) => membership.role === "super_user");
  }

  async getAccessContextForUser(userId: string, email: string | null = null): Promise<AccessActorContext> {
    const memberships = (await this.listMembershipsByUserId(userId)).filter((membership) =>
      isMembershipActive(membership.status)
    );

    const hasMasterTableRole = await this.isActiveUserInTable("master_users", userId);
    const hasSuperAdminTableRole = hasMasterTableRole ? false : await this.isActiveUserInTable("super_admins", userId);

    let effectiveRole: CanonicalRole | null = hasMasterTableRole ? "master" : hasSuperAdminTableRole ? "super_user" : null;
    for (const membership of memberships) {
      if (rolePriority(membership.role) > rolePriority(effectiveRole)) {
        effectiveRole = membership.role;
      }
    }

    const organizationIds = uniqueStrings(memberships.map((membership) => membership.organizationId));
    const manageableOrganizationIds =
      effectiveRole === "master" || effectiveRole === "super_user"
        ? organizationIds
        : uniqueStrings(
            memberships
              .filter((membership) => membership.role === "org_admin")
              .map((membership) => membership.organizationId)
          );

    return {
      user: {
        id: userId,
        email,
      },
      role: effectiveRole,
      isAdmin: effectiveRole === "master" || effectiveRole === "super_user" || effectiveRole === "org_admin",
      isMaster: effectiveRole === "master",
      isSuperUser: effectiveRole === "master" || effectiveRole === "super_user",
      canManageAllOrganizations: effectiveRole === "master" || effectiveRole === "super_user",
      organizationIds,
      manageableOrganizationIds,
      memberships,
    };
  }

  async getAdminContextFromRequest(request: NextRequest): Promise<AccessActorContext | null> {
    const user = await this.getAuthenticatedUserFromRequest(request);
    if (!user) {
      return null;
    }

    return this.getAccessContextForUser(user.id, user.email ?? null);
  }

  canAccessAdmin(context: AccessActorContext, minimumRole: CanonicalRole = "org_admin"): boolean {
    if (!context.isAdmin || !context.role) {
      return false;
    }

    return rolePriority(context.role) >= rolePriority(minimumRole);
  }

  canManageOrganization(context: AccessActorContext, organizationId: string): boolean {
    if (!organizationId) {
      return false;
    }

    return context.canManageAllOrganizations || context.manageableOrganizationIds.includes(organizationId);
  }

  canAssignRole(context: AccessActorContext, role: CanonicalRole): boolean {
    if (context.isMaster) {
      return true;
    }

    if (context.role === "super_user") {
      return role === "org_admin" || role === "org_user";
    }

    if (context.role === "org_admin") {
      return role === "org_admin" || role === "org_user";
    }

    return false;
  }

  canManageTargetRole(context: AccessActorContext, targetRole: CanonicalRole | null): boolean {
    if (context.isMaster) {
      return true;
    }

    if (context.role === "super_user") {
      return targetRole !== "master" && targetRole !== "super_user";
    }

    if (context.role === "org_admin") {
      return targetRole !== "master" && targetRole !== "super_user";
    }

    return false;
  }

  canManageTargetUser(
    context: AccessActorContext,
    targetMemberships: NormalizedMembership[],
    targetEffectiveRole: CanonicalRole | null
  ): boolean {
    if (!this.canManageTargetRole(context, targetEffectiveRole)) {
      return false;
    }

    if (context.canManageAllOrganizations) {
      return true;
    }

    return targetMemberships.some(
      (membership) =>
        membership.organizationId !== null &&
        isMembershipActive(membership.status) &&
        context.manageableOrganizationIds.includes(membership.organizationId)
    );
  }

  getHighestRole(memberships: NormalizedMembership[]): CanonicalRole | null {
    let highestRole: CanonicalRole | null = null;
    for (const membership of memberships) {
      if (!isMembershipActive(membership.status)) {
        continue;
      }

      if (rolePriority(membership.role) > rolePriority(highestRole)) {
        highestRole = membership.role;
      }
    }

    return highestRole;
  }

  extractOrganizationId(record: unknown): string | null {
    const candidate = asRecord(record);
    if (!candidate) {
      return null;
    }

    return toStringOrNull(candidate.organization_id) ?? toStringOrNull(candidate.org_id);
  }

  async listMembershipsByUserId(userId: string): Promise<NormalizedMembership[]> {
    if (!userId) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("memberships")
      .select("*")
      .eq("user_id", userId);

    if (error || !Array.isArray(data)) {
      return [];
    }

    return this.normalizeMembershipRows(data);
  }

  async listMembershipsByUserIds(userIds: string[]): Promise<NormalizedMembership[]> {
    const sanitizedUserIds = uniqueStrings(userIds);
    if (sanitizedUserIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("memberships")
      .select("*")
      .in("user_id", sanitizedUserIds);

    if (error || !Array.isArray(data)) {
      return [];
    }

    return this.normalizeMembershipRows(data);
  }

  async listMembershipsByOrganizationIds(organizationIds: string[]): Promise<NormalizedMembership[]> {
    const sanitizedOrganizationIds = uniqueStrings(organizationIds);
    if (sanitizedOrganizationIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("memberships")
      .select("*");

    if (error || !Array.isArray(data)) {
      return [];
    }

    return (await this.normalizeMembershipRows(data)).filter(
      (membership) => membership.organizationId !== null && sanitizedOrganizationIds.includes(membership.organizationId)
    );
  }

  async findExistingUserProfileByEmail(email: string): Promise<{ userId: string; email: string | null } | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("user_profiles")
      .select("user_id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      userId: toStringOrNull((data as RawRecord).user_id) ?? "",
      email: toStringOrNull((data as RawRecord).email),
    };
  }

  async findExistingAuthUserByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const perPage = 200;
    let page = 1;

    while (true) {
      const { data, error } = await this.supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        return null;
      }

      const users = data?.users ?? [];
      const found = users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
      if (found) {
        return found;
      }

      if (users.length < perPage) {
        return null;
      }

      page += 1;
    }
  }

  async ensureUserProfile(user: {
    userId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<void> {
    const payloads: InsertCandidate[] = [
      {
        user_id: user.userId,
        email: user.email,
        first_name: user.firstName ?? null,
        last_name: user.lastName ?? null,
      },
      {
        user_id: user.userId,
        email: user.email,
      },
    ];

    for (const payload of payloads) {
      const { error } = await this.supabase.from("user_profiles").upsert(payload as never, {
        onConflict: "user_id",
      });

      if (!error) {
        return;
      }
    }
  }

  async createOrganizationInvite(input: {
    email: string;
    organizationId: string;
    invitedBy: string;
    roleName: string;
    roleId?: string | null;
    token: string;
    expiresAtIso: string;
  }): Promise<{ id: string | null; email: string | null; token: string | null; expiresAt: string | null }> {
    const existingPendingInvite = await this.findPendingInvite(input.email, input.organizationId);
    if (existingPendingInvite) {
      return {
        id: toStringOrNull(existingPendingInvite.id),
        email: toStringOrNull(existingPendingInvite.email),
        token: toStringOrNull(existingPendingInvite.token),
        expiresAt: toStringOrNull(existingPendingInvite.expires_at),
      };
    }

    const basePayload = {
      email: input.email,
      invited_by: input.invitedBy,
      role: input.roleName,
      token: input.token,
      expires_at: input.expiresAtIso,
      status: "pending",
    };

    const payloads: InsertCandidate[] = [];

    if (input.roleId) {
      payloads.push({
        ...basePayload,
        organization_id: input.organizationId,
        org_id: input.organizationId,
        role_id: input.roleId,
      });
      payloads.push({
        ...basePayload,
        organization_id: input.organizationId,
        role_id: input.roleId,
      });
      payloads.push({
        ...basePayload,
        org_id: input.organizationId,
        role_id: input.roleId,
      });
    }

    payloads.push({
      ...basePayload,
      organization_id: input.organizationId,
      org_id: input.organizationId,
    });
    payloads.push({
      ...basePayload,
      organization_id: input.organizationId,
    });
    payloads.push({
      ...basePayload,
      org_id: input.organizationId,
    });

    for (const payload of payloads) {
      const { data, error } = await this.supabase
        .from("organization_invites")
        .insert(payload as never)
        .select("*")
        .maybeSingle();

      if (!error && data) {
        const row = data as RawRecord;
        return {
          id: toStringOrNull(row.id),
          email: toStringOrNull(row.email),
          token: toStringOrNull(row.token),
          expiresAt: toStringOrNull(row.expires_at),
        };
      }

      if ((error as SupabaseErrorLike | null)?.code !== "42703") {
        throw new Error((error as SupabaseErrorLike | null)?.message ?? "Failed to create invite");
      }
    }

    throw new Error("Failed to create invite");
  }

  async upsertMembershipAssignment(input: {
    userId: string;
    organizationId: string;
    actorUserId: string;
    roleName: string;
    roleId?: string | null;
  }): Promise<"created" | "updated"> {
    const existingMembership = (await this.listMembershipsByUserId(input.userId)).find(
      (membership) => membership.organizationId === input.organizationId
    );

    const payloads: InsertCandidate[] = [
      {
        organization_id: input.organizationId,
        org_id: input.organizationId,
        role: input.roleName,
        role_id: input.roleId ?? null,
        status: "active",
        accepted_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null,
      },
      {
        organization_id: input.organizationId,
        role: input.roleName,
        role_id: input.roleId ?? null,
        status: "active",
        accepted_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null,
      },
      {
        org_id: input.organizationId,
        role: input.roleName,
        role_id: input.roleId ?? null,
        status: "active",
        accepted_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null,
      },
      {
        role: input.roleName,
        role_id: input.roleId ?? null,
        status: "active",
        accepted_at: new Date().toISOString(),
      },
    ];

    if (existingMembership?.id) {
      for (const payload of payloads) {
        const { error } = await this.supabase
          .from("memberships")
          .update(payload as never)
          .eq("id", existingMembership.id)
          .eq("user_id", input.userId);

        if (!error) {
          return "updated";
        }

        if ((error as SupabaseErrorLike).code !== "42703") {
          throw new Error((error as SupabaseErrorLike).message ?? "Failed to update membership");
        }
      }

      throw new Error("Failed to update membership");
    }

    const insertPayloads: InsertCandidate[] = payloads.map((payload) => ({
      user_id: input.userId,
      invited_by: input.actorUserId,
      invited_at: new Date().toISOString(),
      ...payload,
    }));

    for (const payload of insertPayloads) {
      const { error } = await this.supabase.from("memberships").insert(payload as never);

      if (!error) {
        return "created";
      }

      const normalizedError = error as SupabaseErrorLike;
      if (normalizedError.code === "23505") {
        return "updated";
      }

      if (normalizedError.code !== "42703") {
        throw new Error(normalizedError.message ?? "Failed to create membership");
      }
    }

    throw new Error("Failed to create membership");
  }

  async softRemoveMembership(input: {
    membershipId: string;
    targetUserId: string;
    actorUserId: string;
  }): Promise<void> {
    const payloads: InsertCandidate[] = [
      {
        status: "removed",
        removed_at: new Date().toISOString(),
        removed_by: input.actorUserId,
      },
      {
        status: "removed",
      },
    ];

    for (const payload of payloads) {
      const { error } = await this.supabase
        .from("memberships")
        .update(payload as never)
        .eq("id", input.membershipId)
        .eq("user_id", input.targetUserId);

      if (!error) {
        return;
      }

      if ((error as SupabaseErrorLike).code !== "42703") {
        throw new Error((error as SupabaseErrorLike).message ?? "Failed to remove membership");
      }
    }

    throw new Error("Failed to remove membership");
  }

  async hasClientAccess(userId: string, clientId: string): Promise<boolean> {
    if (!userId || !clientId) {
      return false;
    }

    if (await this.isMasterUser(userId)) {
      return true;
    }

    const { data, error } = await this.supabase
      .from("client_users")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  }

  async getUserAccessibleClients(userId: string): Promise<ClientSummary[]> {
    if (!userId) {
      return [];
    }

    if (await this.isMasterUser(userId)) {
      const { data, error } = await this.supabase.from("clients").select("id, name");

      if (error || !Array.isArray(data)) {
        return [];
      }

      return data.map((row: unknown) => this.mapClientRow(row)).filter((row): row is ClientSummary => row !== null);
    }

    const { data, error } = await this.supabase
      .from("client_users")
      .select("client_id, clients:clients!inner(id, name)")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error || !Array.isArray(data)) {
      return [];
    }

    const deduped = new Map<string, ClientSummary>();

    for (const row of data) {
      const mapped = this.mapClientAssociationRow(row);
      if (mapped) {
        deduped.set(mapped.id, mapped);
      }
    }

    return Array.from(deduped.values());
  }

  async createMasterUser(userId: string, createdByUserId: string, notes?: string): Promise<boolean> {
    if (!userId || !createdByUserId) {
      return false;
    }

    const candidates: InsertCandidate[] = [
      {
        user_id: userId,
        created_by: createdByUserId,
        notes: notes ?? null,
        is_active: true,
      },
      {
        user_id: userId,
        is_active: true,
      },
      {
        user_id: userId,
      },
    ];

    return this.tryInsert("master_users", candidates);
  }

  async createClientUser(
    userId: string,
    clientId: string,
    createdByUserId: string,
    permissions?: Record<string, boolean>,
    notes?: string
  ): Promise<boolean> {
    if (!userId || !clientId || !createdByUserId) {
      return false;
    }

    const candidates: InsertCandidate[] = [
      {
        user_id: userId,
        client_id: clientId,
        created_by: createdByUserId,
        permissions: permissions ?? {},
        notes: notes ?? null,
        is_active: true,
      },
      {
        user_id: userId,
        client_id: clientId,
        is_active: true,
      },
      {
        user_id: userId,
        client_id: clientId,
      },
    ];

    return this.tryInsert("client_users", candidates);
  }

  private async findPendingInvite(email: string, organizationId: string): Promise<RawRecord | null> {
    const { data, error } = await this.supabase
      .from("organization_invites")
      .select("*")
      .eq("email", email)
      .eq("status", "pending");

    if (error || !Array.isArray(data)) {
      return null;
    }

    const found = data.find((row) => this.extractOrganizationId(row) === organizationId);
    return asRecord(found);
  }

  private async normalizeMembershipRows(rows: unknown[]): Promise<NormalizedMembership[]> {
    const roleIds = uniqueStrings(
      rows.map((row) => {
        const candidate = asRecord(row);
        return candidate ? toStringOrNull(candidate.role_id) : null;
      })
    );

    const roleNamesById = new Map<string, string>();
    if (roleIds.length > 0) {
      const { data: roles, error } = await this.supabase.from("user_roles").select("id, name").in("id", roleIds);
      if (!error && Array.isArray(roles)) {
        for (const role of roles) {
          const candidate = asRecord(role);
          const roleId = candidate ? toStringOrNull(candidate.id) : null;
          const roleName = candidate ? toStringOrNull(candidate.name) : null;
          if (roleId && roleName) {
            roleNamesById.set(roleId, roleName);
          }
        }
      }
    }

    return rows
      .map((row) => this.normalizeMembershipRow(row, roleNamesById))
      .filter((membership): membership is NormalizedMembership => membership !== null);
  }

  private normalizeMembershipRow(
    row: unknown,
    roleNamesById: Map<string, string>
  ): NormalizedMembership | null {
    const candidate = asRecord(row);
    if (!candidate) {
      return null;
    }

    const userId = toStringOrNull(candidate.user_id);
    if (!userId) {
      return null;
    }

    const roleId = toStringOrNull(candidate.role_id);
    const rawRole = toStringOrNull(candidate.role) ?? (roleId ? roleNamesById.get(roleId) ?? null : null);
    const normalizedRole = normalizeRoleName(rawRole) ?? "org_user";

    return {
      id: toStringOrNull(candidate.id),
      userId,
      organizationId: this.extractOrganizationId(candidate),
      role: normalizedRole,
      rawRole,
      roleId,
      status: toStringOrNull(candidate.status),
      createdAt: toStringOrNull(candidate.created_at),
      acceptedAt: toStringOrNull(candidate.accepted_at),
    };
  }

  private async isActiveUserInTable(table: "super_admins" | "master_users", userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(table)
      .select("user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1);

    if (error) {
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  }

  private async tryInsert(table: string, candidates: InsertCandidate[]): Promise<boolean> {
    for (const payload of candidates) {
      const { error } = await this.supabase.from(table).insert(payload as never);

      if (!error) {
        return true;
      }

      const normalized = error as SupabaseErrorLike;
      if (normalized.code === "23505") {
        return true;
      }
    }

    return false;
  }

  private mapClientRow(row: unknown): ClientSummary | null {
    const candidate = asRecord(row);
    if (!candidate) {
      return null;
    }

    const id = toStringOrNull(candidate.id);
    if (!id) {
      return null;
    }

    return {
      id,
      name: toStringOrNull(candidate.name),
    };
  }

  private mapClientAssociationRow(row: unknown): ClientSummary | null {
    const candidate = asRecord(row);
    if (!candidate) {
      return null;
    }

    const directClientId = toStringOrNull(candidate.client_id);
    const nested = asRecord(candidate.clients);
    const nestedId = nested ? toStringOrNull(nested.id) : null;
    const nestedName = nested ? toStringOrNull(nested.name) : null;

    const id = directClientId ?? nestedId;
    if (!id) {
      return null;
    }

    return {
      id,
      name: nestedName,
    };
  }
}

export class UserAccessControl extends UserAccessControlService {}
