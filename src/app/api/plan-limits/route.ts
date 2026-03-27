import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveAdminAccessContext } from '@/lib/access/admin-rbac';

type PlanRow = {
  id: string;
  name: string;
  description?: string | null;
  monthly_price?: number | null;
  annual_price?: number | null;
  features?: unknown;
  max_clients?: number | null;
  max_campaigns?: number | null;
};

type SubscriptionRow = {
  plan_id?: string | null;
  organization_id?: string | null;
  org_id?: string | null;
  status?: string | null;
};

type MembershipLike = {
  organization_id?: string | null;
  org_id?: string | null;
};

const DEFAULT_LIMITS = {
  max_clients: 1,
  max_campaigns: 3,
  max_users: 1,
  features: {
    advancedAnalytics: false,
    customReports: false,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false
  }
};

type FeatureFlags = typeof DEFAULT_LIMITS.features;

const UNLIMITED_LIMITS = {
  max_clients: -1,
  max_campaigns: -1,
  max_users: -1,
  features: {
    advancedAnalytics: true,
    customReports: true,
    apiAccess: true,
    whiteLabel: true,
    prioritySupport: true
  }
};

const DEFAULT_USAGE = {
  clients: 0,
  campaigns: 0,
  users: 0
};

const PLAN_IDENTIFIER_ALIASES: Record<string, string[]> = {
  basic: ['basic', 'basico', 'básico', 'plano basico', 'plano básico'],
  pro: ['pro', 'pro plan', 'plano pro'],
  enterprise: ['enterprise', 'enterprise plan', 'plano enterprise'],
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function normalizePlanCandidates(planId: string): string[] {
  const base = normalizeText(planId);
  const candidates = new Set<string>([base]);

  for (const candidate of PLAN_IDENTIFIER_ALIASES[base] ?? []) {
    candidates.add(normalizeText(candidate));
  }

  return Array.from(candidates).filter(Boolean);
}

function resolvePlanFromRows(planId: string, plans: PlanRow[]): PlanRow | null {
  const trimmedPlanId = planId.trim();
  const normalizedCandidates = normalizePlanCandidates(trimmedPlanId);

  const exactIdMatch = plans.find((plan) => plan.id === trimmedPlanId);
  if (exactIdMatch) {
    return exactIdMatch;
  }

  let bestMatch: PlanRow | null = null;
  let bestScore = -1;

  for (const plan of plans) {
    const normalizedName = normalizeText(plan.name);
    const normalizedDescription = normalizeText(plan.description ?? '');

    for (const candidate of normalizedCandidates) {
      let score = 0;

      if (normalizedName === candidate) {
        score = 100;
      } else if (normalizedName.includes(candidate) || candidate.includes(normalizedName)) {
        score = 75;
      } else if (normalizedDescription.includes(candidate)) {
        score = 25;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = plan;
      }
    }
  }

  return bestMatch;
}

function getMembershipOrganizationId(membership: MembershipLike | null | undefined): string | null {
  if (!membership) {
    return null;
  }

  return membership.organization_id?.trim() || membership.org_id?.trim() || null;
}

function getUnlimitedPlanResponse(usage: { clients: number; campaigns: number; users: number }) {
  return {
    success: true,
    limits: UNLIMITED_LIMITS,
    usage,
    percentages: {
      clients: 0,
      campaigns: 0,
      users: 0
    },
    warnings: [],
    canAddClients: true,
    canAddCampaigns: true,
    canAddUsers: true
  };
}

async function listRowsByOrganization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'clients' | 'memberships' | 'subscriptions',
  organizationId: string,
  selectClause: string
): Promise<unknown[]> {
  const columns: Array<'organization_id' | 'org_id'> = ['organization_id', 'org_id'];
  const seenIds = new Set<string>();
  const results: unknown[] = [];

  for (const column of columns) {
    const { data, error } = await supabase
      .from(table)
      .select(selectClause)
      .eq(column, organizationId);

    if (error || !Array.isArray(data)) {
      continue;
    }

    for (const row of data) {
      const id = typeof row === 'object' && row !== null ? (row as Record<string, unknown>).id : null;
      const key = typeof id === 'string' && id.length > 0 ? id : JSON.stringify(row);
      if (seenIds.has(key)) {
        continue;
      }

      seenIds.add(key);
      results.push(row);
    }
  }

  return results;
}

async function resolveOrganizationIds(accessContext: Awaited<ReturnType<typeof resolveAdminAccessContext>>): Promise<string[]> {
  return uniqueStrings(accessContext.memberships.map(getMembershipOrganizationId));
}

async function resolveBillingOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accessContext: Awaited<ReturnType<typeof resolveAdminAccessContext>>
): Promise<string | null> {
  const organizationIds = await resolveOrganizationIds(accessContext);

  for (const organizationId of organizationIds) {
    const subscriptions = await listRowsByOrganization(
      supabase,
      'subscriptions',
      organizationId,
      'id,plan_id,status,organization_id,org_id'
    );

    const activeSubscription = subscriptions.find((row) => {
      const candidate = row as SubscriptionRow;
      return (candidate.status ?? '').toLowerCase() === 'active';
    });

    if (activeSubscription) {
      return organizationId;
    }
  }

  return organizationIds[0] ?? null;
}

async function resolveActiveSubscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<SubscriptionRow | null> {
  const columns: Array<'organization_id' | 'org_id'> = ['organization_id', 'org_id'];

  for (const column of columns) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id,plan_id,status,organization_id,org_id')
      .eq(column, organizationId)
      .eq('status', 'active')
      .limit(1);

    if (error || !Array.isArray(data) || data.length === 0) {
      continue;
    }

    return data[0] as SubscriptionRow;
  }

  return null;
}

async function resolvePlanByIdentifier(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string
): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id,name,description,monthly_price,annual_price,features,max_clients,max_campaigns');

  if (error || !Array.isArray(data)) {
    return null;
  }

  return resolvePlanFromRows(planId, data as PlanRow[]);
}

function normalizeFeatures(features: unknown): FeatureFlags {
  const base: FeatureFlags = {
    advancedAnalytics: false,
    customReports: false,
    apiAccess: false,
    whiteLabel: false,
    prioritySupport: false
  };

  if (Array.isArray(features)) {
    const normalized = new Set(features.map((feature) => normalizeText(String(feature))));

    return {
      advancedAnalytics:
        normalized.has('advancedanalytics') ||
        normalized.has('advanced analytics') ||
        normalized.has('analytics avancados') ||
        normalized.has('analytics avancadas'),
      customReports:
        normalized.has('customreports') ||
        normalized.has('custom reports') ||
        normalized.has('relatorios personalizados'),
      apiAccess:
        normalized.has('apiaccess') ||
        normalized.has('api access') ||
        normalized.has('full api access') ||
        normalized.has('acesso a api'),
      whiteLabel:
        normalized.has('whitelabel') ||
        normalized.has('white label') ||
        normalized.has('white label solution'),
      prioritySupport:
        normalized.has('prioritysupport') ||
        normalized.has('priority support') ||
        normalized.has('dedicated support manager') ||
        normalized.has('suporte prioritario')
    };
  }

  if (features && typeof features === 'object') {
    return {
      ...base,
      ...(features as Partial<FeatureFlags>)
    };
  }

  return base;
}

function buildLimitsFromPlan(plan: PlanRow | null) {
  if (!plan) {
    return DEFAULT_LIMITS;
  }

  return {
    max_clients: plan.max_clients ?? DEFAULT_LIMITS.max_clients,
    max_campaigns: plan.max_campaigns ?? DEFAULT_LIMITS.max_campaigns,
    max_users: 10,
    features: normalizeFeatures(plan.features) as typeof DEFAULT_LIMITS.features
  };
}

async function getUsageForOrganization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
) {
  const [clientRows, membershipRows] = await Promise.all([
    listRowsByOrganization(supabase, 'clients', organizationId, 'id,organization_id,org_id'),
    listRowsByOrganization(supabase, 'memberships', organizationId, 'id,organization_id,org_id'),
  ]);

  return {
    clients: clientRows.length,
    campaigns: 0,
    users: membershipRows.length
  };
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticação do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const accessContext = await resolveAdminAccessContext(user);
    const isPrivilegedUser = accessContext.isMaster || accessContext.isSuperUser;

    if (isPrivilegedUser) {
      const privilegedOrganizationId = await resolveBillingOrganizationId(supabase, accessContext);
      const usage = privilegedOrganizationId
        ? await getUsageForOrganization(supabase, privilegedOrganizationId)
        : DEFAULT_USAGE;

      return NextResponse.json(getUnlimitedPlanResponse(usage));
    }

    const organizationId = await resolveBillingOrganizationId(supabase, accessContext);
    if (!organizationId) {
      return NextResponse.json({
        success: true,
        limits: DEFAULT_LIMITS,
        usage: DEFAULT_USAGE,
        percentages: {
          clients: 0,
          campaigns: 0,
          users: 0
        },
        warnings: [],
        canAddClients: true,
        canAddCampaigns: true,
        canAddUsers: true
      });
    }

    const subscription = await resolveActiveSubscription(supabase, organizationId);
    const plan = subscription?.plan_id ? await resolvePlanByIdentifier(supabase, subscription.plan_id) : null;

    const limits = buildLimitsFromPlan(plan);
    const usage = await getUsageForOrganization(supabase, organizationId);

    // Calcular percentuais de uso
    const clientsUsage = limits.max_clients === -1 ? 0 : (usage.clients / limits.max_clients) * 100;
    const campaignsUsage = limits.max_campaigns === -1 ? 0 : (usage.campaigns / limits.max_campaigns) * 100;
    const usersUsage = limits.max_users === -1 ? 0 : (usage.users / limits.max_users) * 100;

    // Verificar se está próximo dos limites
    const warnings = [];
    if (clientsUsage > 80) warnings.push('clients');
    if (campaignsUsage > 80) warnings.push('campaigns');
    if (usersUsage > 80) warnings.push('users');

    return NextResponse.json({
      success: true,
      limits,
      usage,
      percentages: {
        clients: Math.round(clientsUsage),
        campaigns: Math.round(campaignsUsage),
        users: Math.round(usersUsage)
      },
      warnings,
      canAddClients: limits.max_clients === -1 || usage.clients < limits.max_clients,
      canAddCampaigns: limits.max_campaigns === -1 || usage.campaigns < limits.max_campaigns,
      canAddUsers: limits.max_users === -1 || usage.users < limits.max_users
    });
  } catch (error) {
    console.error('Erro ao buscar limites do plano:', error);

    // Return default limits on error instead of failing
    return NextResponse.json({
      success: true,
      limits: DEFAULT_LIMITS,
      usage: DEFAULT_USAGE,
      percentages: {
        clients: 0,
        campaigns: 0,
        users: 0
      },
      warnings: [],
      canAddClients: true,
      canAddCampaigns: true,
      canAddUsers: true,
      message: 'Using default plan limits due to error'
    });
  }
}
