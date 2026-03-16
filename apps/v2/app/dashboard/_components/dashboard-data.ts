import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getPrismaClient } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardScope = {
  userEmail: string;
  organizationIds: string[];
};

type ClientRecord = {
  id: string;
  name: string;
  createdAt: Date;
};

type ConnectionRecord = {
  clientId: string | null;
  provider: string;
};

export type DashboardClientSummary = {
  id: string;
  name: string;
  createdAt: Date;
  metaConnections: number;
  googleConnections: number;
  totalConnections: number;
  hasConnections: boolean;
};

export type DashboardSharedStats = {
  totalClients: number;
  totalMetaConnections: number;
  totalGoogleConnections: number;
  totalConnections: number;
  connectedClients: number;
  clients: DashboardClientSummary[];
};

export type DashboardOverviewData = DashboardSharedStats & {
  userEmail: string;
  needsOnboarding: boolean;
};

export type DashboardClientsData = DashboardSharedStats & {
  userEmail: string;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveTenantId(user: User): string | null {
  const appMetadata = isRecord(user.app_metadata) ? user.app_metadata : {};
  const userMetadata = isRecord(user.user_metadata) ? user.user_metadata : {};

  return (
    asNonEmptyString(appMetadata["tenant_id"]) ??
    asNonEmptyString(appMetadata["organization_id"]) ??
    asNonEmptyString(appMetadata["org_id"]) ??
    asNonEmptyString(userMetadata["tenant_id"]) ??
    asNonEmptyString(userMetadata["organization_id"]) ??
    asNonEmptyString(userMetadata["org_id"])
  );
}

async function requireDashboardScope(redirectTo: string): Promise<DashboardScope> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const prisma = getPrismaClient();
  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    select: {
      organizationId: true,
    },
  });

  const organizationIdSet = new Set<string>(
    memberships.map((membership) => membership.organizationId),
  );

  const fallbackTenantId = resolveTenantId(user);
  if (organizationIdSet.size === 0 && fallbackTenantId) {
    organizationIdSet.add(fallbackTenantId);
  }

  return {
    userEmail: user.email ?? "sem-email",
    organizationIds: Array.from(organizationIdSet),
  };
}

async function readScopedStats(organizationIds: string[]): Promise<DashboardSharedStats> {
  if (organizationIds.length === 0) {
    return {
      totalClients: 0,
      totalMetaConnections: 0,
      totalGoogleConnections: 0,
      totalConnections: 0,
      connectedClients: 0,
      clients: [],
    };
  }

  const prisma = getPrismaClient();
  const [clients, activeConnections] = await Promise.all([
    prisma.client.findMany({
      where: {
        organizationId: { in: organizationIds },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.metaConnection.findMany({
      where: {
        organizationId: { in: organizationIds },
        isActive: true,
        provider: {
          in: ["meta", "google"],
        },
      },
      select: {
        clientId: true,
        provider: true,
      },
    }),
  ]);

  return composeStats(clients, activeConnections);
}

function composeStats(
  clients: ClientRecord[],
  activeConnections: ConnectionRecord[],
): DashboardSharedStats {
  const connectionCounterByClient = new Map<string, { meta: number; google: number }>();

  let totalMetaConnections = 0;
  let totalGoogleConnections = 0;

  for (const connection of activeConnections) {
    const provider = connection.provider.toLowerCase();

    if (provider === "meta") {
      totalMetaConnections += 1;
    } else if (provider === "google") {
      totalGoogleConnections += 1;
    }

    if (!connection.clientId) {
      continue;
    }

    const current = connectionCounterByClient.get(connection.clientId) ?? {
      meta: 0,
      google: 0,
    };

    if (provider === "meta") {
      current.meta += 1;
    } else if (provider === "google") {
      current.google += 1;
    }

    connectionCounterByClient.set(connection.clientId, current);
  }

  const clientSummaries = clients.map<DashboardClientSummary>((client) => {
    const counters = connectionCounterByClient.get(client.id) ?? {
      meta: 0,
      google: 0,
    };

    const totalConnections = counters.meta + counters.google;

    return {
      id: client.id,
      name: client.name,
      createdAt: client.createdAt,
      metaConnections: counters.meta,
      googleConnections: counters.google,
      totalConnections,
      hasConnections: totalConnections > 0,
    };
  });

  const connectedClients = clientSummaries.filter((client) => client.hasConnections).length;

  return {
    totalClients: clientSummaries.length,
    totalMetaConnections,
    totalGoogleConnections,
    totalConnections: totalMetaConnections + totalGoogleConnections,
    connectedClients,
    clients: clientSummaries,
  };
}

export async function getDashboardOverviewData(
  redirectTo = "/dashboard",
): Promise<DashboardOverviewData> {
  const scope = await requireDashboardScope(redirectTo);
  const stats = await readScopedStats(scope.organizationIds);

  return {
    userEmail: scope.userEmail,
    ...stats,
    needsOnboarding: stats.totalClients === 0 || stats.totalConnections === 0,
  };
}

export async function getDashboardClientsData(
  redirectTo = "/dashboard/clients",
): Promise<DashboardClientsData> {
  const scope = await requireDashboardScope(redirectTo);
  const stats = await readScopedStats(scope.organizationIds);

  return {
    userEmail: scope.userEmail,
    ...stats,
  };
}
