import type { CutoverRoute, Prisma, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";

type CutoverPrismaClient = Pick<PrismaClient, "cutoverRule" | "client" | "$transaction">;

type CutoverRuleRecord = {
  id: string;
  organizationId: string;
  clientId: string | null;
  groupId: string | null;
  route: CutoverRoute;
  rolloutPercent: number;
  isActive: boolean;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CutoverRouteDecision = {
  route: CutoverRoute;
  source: "default" | "rule";
  matchedRuleId: string | null;
  rolloutPercent: number;
  rolloutBucket: number | null;
  reason: string;
};

export type ResolveCutoverInput = {
  organizationId: string;
  clientId?: string | null;
  groupId?: string | null;
  subjectKey?: string | null;
  defaultRoute?: CutoverRoute;
};

export type UpsertCutoverRuleInput = {
  organizationId: string;
  clientId?: string | null;
  groupId?: string | null;
  route: CutoverRoute;
  rolloutPercent: number;
  reason?: string | null;
  isActive?: boolean;
  userId: string;
};

export type RollbackCutoverInput = {
  organizationId: string;
  userId: string;
  reason?: string | null;
};

export type RollbackCutoverResult = {
  updatedCount: number;
  createdRuleId: string | null;
};

const DEFAULT_ROLLOUT_SALT = "gt22-cutover";
const DEFAULT_V1_USER_ID = "00000000-0000-0000-0000-000000000000";

function normalizeOptionalString(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeRolloutPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

export function getDefaultCutoverRoute(): CutoverRoute {
  const raw = (process.env.CUTOVER_DEFAULT_ROUTE || "V2").trim().toUpperCase();
  return raw === "V1" ? "V1" : "V2";
}

function getRolloutSalt(): string {
  const fromEnv = normalizeOptionalString(process.env.CUTOVER_ROLLOUT_SALT);
  return fromEnv ?? DEFAULT_ROLLOUT_SALT;
}

export function buildRolloutSubjectKey(input: ResolveCutoverInput): string {
  const organizationId = normalizeOptionalString(input.organizationId) ?? "org:unknown";
  const clientId = normalizeOptionalString(input.clientId) ?? "client:*";
  const groupId = normalizeOptionalString(input.groupId) ?? "group:*";
  const explicitSubject = normalizeOptionalString(input.subjectKey);

  return explicitSubject ?? `${organizationId}:${clientId}:${groupId}`;
}

export function computeRolloutBucket(subjectKey: string, salt = getRolloutSalt()): number {
  const payload = `${salt}:${subjectKey}`;
  let hash = 2166136261;

  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % 100;
}

function scoreRule(rule: CutoverRuleRecord, clientId: string | null, groupId: string | null): number {
  let score = 0;

  if (rule.groupId) {
    if (!groupId || rule.groupId !== groupId) return -1;
    score += 100;
  }

  if (rule.clientId) {
    if (!clientId || rule.clientId !== clientId) return -1;
    score += 10;
  }

  return score;
}

export function selectMostSpecificRule(
  rules: CutoverRuleRecord[],
  input: Pick<ResolveCutoverInput, "clientId" | "groupId">,
): CutoverRuleRecord | null {
  const clientId = normalizeOptionalString(input.clientId);
  const groupId = normalizeOptionalString(input.groupId);

  const ranked = rules
    .map((rule) => ({
      rule,
      score: scoreRule(rule, clientId, groupId),
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rule.updatedAt.valueOf() - a.rule.updatedAt.valueOf();
    });

  return ranked[0]?.rule ?? null;
}

export function resolveCutoverFromRules(
  input: ResolveCutoverInput,
  rules: CutoverRuleRecord[],
): CutoverRouteDecision {
  const defaultRoute = input.defaultRoute ?? getDefaultCutoverRoute();
  const matchedRule = selectMostSpecificRule(rules, input);

  if (!matchedRule) {
    return {
      route: defaultRoute,
      source: "default",
      matchedRuleId: null,
      rolloutPercent: defaultRoute === "V2" ? 100 : 0,
      rolloutBucket: null,
      reason: `Sem regra ativa para o escopo. Aplicado default ${defaultRoute}.`,
    };
  }

  if (matchedRule.route === "V1") {
    return {
      route: "V1",
      source: "rule",
      matchedRuleId: matchedRule.id,
      rolloutPercent: 0,
      rolloutBucket: null,
      reason: "Regra ativa forca V1 para o escopo informado.",
    };
  }

  const rolloutPercent = normalizeRolloutPercent(matchedRule.rolloutPercent);

  if (rolloutPercent >= 100) {
    return {
      route: "V2",
      source: "rule",
      matchedRuleId: matchedRule.id,
      rolloutPercent,
      rolloutBucket: null,
      reason: "Regra ativa com rollout de 100% para V2.",
    };
  }

  if (rolloutPercent <= 0) {
    return {
      route: "V1",
      source: "rule",
      matchedRuleId: matchedRule.id,
      rolloutPercent,
      rolloutBucket: 0,
      reason: "Regra ativa com rollout 0%; mantendo trafego em V1.",
    };
  }

  const subjectKey = buildRolloutSubjectKey(input);
  const rolloutBucket = computeRolloutBucket(subjectKey);
  const route: CutoverRoute = rolloutBucket < rolloutPercent ? "V2" : "V1";

  return {
    route,
    source: "rule",
    matchedRuleId: matchedRule.id,
    rolloutPercent,
    rolloutBucket,
    reason:
      route === "V2"
        ? `Bucket ${rolloutBucket} dentro do rollout ${rolloutPercent}%.`
        : `Bucket ${rolloutBucket} fora do rollout ${rolloutPercent}%.`,
  };
}

function buildScopeFilter(
  organizationId: string,
  clientId: string | null,
  groupId: string | null,
): Prisma.CutoverRuleWhereInput {
  const groupScopes: Prisma.CutoverRuleWhereInput[] = [{ groupId: null }];
  const clientScopes: Prisma.CutoverRuleWhereInput[] = [{ clientId: null }];

  if (groupId) {
    groupScopes.push({ groupId });
  }

  if (clientId) {
    clientScopes.push({ clientId });
  }

  return {
    organizationId,
    isActive: true,
    AND: [{ OR: groupScopes }, { OR: clientScopes }],
  };
}

export async function resolveCutoverRoute(
  input: ResolveCutoverInput,
  prisma: CutoverPrismaClient = getPrismaClient(),
): Promise<CutoverRouteDecision> {
  const organizationId = normalizeOptionalString(input.organizationId);
  if (!organizationId) {
    throw new Error("organizationId obrigatorio para resolver cutover.");
  }

  const clientId = normalizeOptionalString(input.clientId);
  const groupId = normalizeOptionalString(input.groupId);

  const rules = await prisma.cutoverRule.findMany({
    where: buildScopeFilter(organizationId, clientId, groupId),
    orderBy: [{ updatedAt: "desc" }],
  });

  return resolveCutoverFromRules(
    {
      ...input,
      organizationId,
      clientId,
      groupId,
    },
    rules,
  );
}

export async function listActiveCutoverRules(
  organizationId: string,
  prisma: CutoverPrismaClient = getPrismaClient(),
) {
  return prisma.cutoverRule.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: [{ groupId: "asc" }, { clientId: "asc" }, { updatedAt: "desc" }],
  });
}

export async function upsertCutoverRule(
  input: UpsertCutoverRuleInput,
  prisma: CutoverPrismaClient = getPrismaClient(),
) {
  const organizationId = normalizeOptionalString(input.organizationId);
  if (!organizationId) {
    throw new Error("organizationId obrigatorio.");
  }

  const userId = normalizeOptionalString(input.userId) ?? DEFAULT_V1_USER_ID;
  const clientId = normalizeOptionalString(input.clientId);
  const groupId = normalizeOptionalString(input.groupId);
  const reason = normalizeOptionalString(input.reason);
  const isActive = input.isActive ?? true;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      select: { id: true },
    });

    if (!client) {
      throw new Error("clientId nao pertence a organizacao informada.");
    }
  }

  const rolloutPercent =
    input.route === "V1" ? 0 : normalizeRolloutPercent(input.rolloutPercent);

  const existing = await prisma.cutoverRule.findFirst({
    where: {
      organizationId,
      clientId,
      groupId,
      isActive: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const rule = existing
    ? await prisma.cutoverRule.update({
        where: { id: existing.id },
        data: {
          route: input.route,
          rolloutPercent,
          reason,
          isActive,
          updatedByUserId: userId,
        },
      })
    : await prisma.cutoverRule.create({
        data: {
          organizationId,
          clientId,
          groupId,
          route: input.route,
          rolloutPercent,
          reason,
          isActive,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });

  await prisma.cutoverRule.updateMany({
    where: {
      organizationId,
      clientId,
      groupId,
      isActive: true,
      id: { not: rule.id },
    },
    data: {
      isActive: false,
      updatedByUserId: userId,
      reason: "Regra desativada por substituicao de escopo (GT-22).",
    },
  });

  return rule;
}

export async function rollbackCutoverToV1(
  input: RollbackCutoverInput,
  prisma: CutoverPrismaClient = getPrismaClient(),
): Promise<RollbackCutoverResult> {
  const organizationId = normalizeOptionalString(input.organizationId);
  if (!organizationId) {
    throw new Error("organizationId obrigatorio para rollback.");
  }

  const userId = normalizeOptionalString(input.userId) ?? DEFAULT_V1_USER_ID;
  const reason =
    normalizeOptionalString(input.reason) ??
    `Rollback rapido GT-22 executado em ${new Date().toISOString()}.`;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.cutoverRule.updateMany({
      where: {
        organizationId,
        isActive: true,
      },
      data: {
        route: "V1",
        rolloutPercent: 0,
        updatedByUserId: userId,
        reason,
      },
    });

    if (updated.count > 0) {
      return {
        updatedCount: updated.count,
        createdRuleId: null,
      };
    }

    const created = await tx.cutoverRule.create({
      data: {
        organizationId,
        route: "V1",
        rolloutPercent: 0,
        isActive: true,
        reason,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });

    return {
      updatedCount: 0,
      createdRuleId: created.id,
    };
  });
}
