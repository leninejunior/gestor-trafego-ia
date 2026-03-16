import { NextRequest, NextResponse } from "next/server";

import { logAiApiAuditEvent } from "@/lib/ai/audit-log";
import {
  AI_READ_SCOPE,
  authorizeAiServiceRequest,
  type AiServicePrincipal,
} from "@/lib/ai/service-auth";
import {
  buildAiContextMetrics,
  buildAiContextSummaryPayload,
  buildAiPeriods,
  parseAiContextSummaryQuery,
} from "@/lib/ai/context-summary";
import { applyAiRateLimit, type RateLimitResult } from "@/lib/ai/rate-limit";
import { getPrismaClient } from "@/lib/prisma";

const ENDPOINT = "/api/v2/ai/context-summary";

function getRequestIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip");
}

function applyRateLimitHeaders(response: NextResponse, rateLimit: RateLimitResult) {
  response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.headers.set("X-RateLimit-Reset", rateLimit.resetAt);
  if (!rateLimit.allowed) {
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
  }
}

function buildAuditContext(request: NextRequest) {
  return {
    endpoint: ENDPOINT,
    method: request.method,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: request.headers.get("x-request-id"),
  };
}

async function logAudit(
  principal: AiServicePrincipal,
  request: NextRequest,
  input: {
    statusCode: number;
    filters?: Record<string, unknown>;
    rateLimited?: boolean;
    errorMessage?: string;
  },
) {
  await logAiApiAuditEvent({
    organizationId: principal.organizationId,
    keyId: principal.keyId,
    scope: AI_READ_SCOPE,
    ...buildAuditContext(request),
    ...input,
  });
}

function getAnomalyThresholdPercent(): number {
  const parsed = Number(process.env.AI_CONTEXT_ANOMALY_THRESHOLD_PERCENT ?? "30");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const auth = authorizeAiServiceRequest(request, AI_READ_SCOPE);
  if (!auth.ok) {
    if (auth.principal) {
      await logAudit(auth.principal, request, {
        statusCode: auth.status,
        errorMessage: auth.error,
      });
    }

    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const principal = auth.principal;

  try {
    const query = parseAiContextSummaryQuery(request.nextUrl.searchParams);

    if (query.organizationId && query.organizationId !== principal.organizationId) {
      const errorMessage = "organizationId fora do escopo do token autenticado.";
      await logAudit(principal, request, {
        statusCode: 403,
        filters: {
          organizationId: query.organizationId,
          clientId: query.clientId,
          platform: query.platform,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
        errorMessage,
      });

      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    const organizationId = query.organizationId ?? principal.organizationId;

    const rateLimit = applyAiRateLimit({
      organizationId,
      keyId: principal.keyId,
      limitPerMinute: principal.rateLimitPerMinute,
    });

    if (!rateLimit.allowed) {
      await logAudit(principal, request, {
        statusCode: 429,
        filters: {
          organizationId,
          clientId: query.clientId,
          platform: query.platform,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
        rateLimited: true,
        errorMessage: "Rate limit exceeded.",
      });

      const response = NextResponse.json(
        {
          error: "Rate limit exceeded para organization/key.",
        },
        { status: 429 },
      );
      applyRateLimitHeaders(response, rateLimit);
      return response;
    }

    const periods = buildAiPeriods(query.dateFrom, query.dateTo);

    if (query.platform === "google") {
      const zeroMetrics = buildAiContextMetrics({
        campaigns: 0,
        impressions: 0,
        clicks: 0,
        leads: 0,
        investment: 0,
      });

      const payload = buildAiContextSummaryPayload({
        query,
        periods,
        current: zeroMetrics,
        previous: zeroMetrics,
        anomalyThresholdPercent: getAnomalyThresholdPercent(),
        notes: ["Sem campanhas Google carregadas no schema V2 atual."],
      });

      const response = NextResponse.json({
        filters: {
          organizationId,
          clientId: query.clientId,
          platform: query.platform,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
        summary: payload,
      });

      applyRateLimitHeaders(response, rateLimit);

      await logAudit(principal, request, {
        statusCode: 200,
        filters: {
          organizationId,
          clientId: query.clientId,
          platform: query.platform,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
      });

      return response;
    }

    const prisma = getPrismaClient();

    const baseWhere = {
      organizationId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
    };

    const [currentAggregate, previousAggregate] = await Promise.all([
      prisma.campaign.aggregate({
        where: {
          ...baseWhere,
          snapshotDate: {
            gte: periods.current.startAt,
            lt: periods.current.endAtExclusive,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          impressions: true,
          clicks: true,
          leads: true,
          spend: true,
        },
      }),
      prisma.campaign.aggregate({
        where: {
          ...baseWhere,
          snapshotDate: {
            gte: periods.previous.startAt,
            lt: periods.previous.endAtExclusive,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          impressions: true,
          clicks: true,
          leads: true,
          spend: true,
        },
      }),
    ]);

    const currentMetrics = buildAiContextMetrics({
      campaigns: currentAggregate._count._all,
      impressions: currentAggregate._sum.impressions,
      clicks: currentAggregate._sum.clicks,
      leads: currentAggregate._sum.leads,
      investment: currentAggregate._sum.spend,
    });

    const previousMetrics = buildAiContextMetrics({
      campaigns: previousAggregate._count._all,
      impressions: previousAggregate._sum.impressions,
      clicks: previousAggregate._sum.clicks,
      leads: previousAggregate._sum.leads,
      investment: previousAggregate._sum.spend,
    });

    const payload = buildAiContextSummaryPayload({
      query,
      periods,
      current: currentMetrics,
      previous: previousMetrics,
      anomalyThresholdPercent: getAnomalyThresholdPercent(),
    });

    const response = NextResponse.json({
      filters: {
        organizationId,
        clientId: query.clientId,
        platform: query.platform,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      summary: payload,
    });

    applyRateLimitHeaders(response, rateLimit);

    await logAudit(principal, request, {
      statusCode: 200,
      filters: {
        organizationId,
        clientId: query.clientId,
        platform: query.platform,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao gerar context summary";

    await logAudit(principal, request, {
      statusCode: 400,
      errorMessage,
    });

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
