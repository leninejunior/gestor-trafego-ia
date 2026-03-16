import { NextRequest, NextResponse } from "next/server";

import { logAiApiAuditEvent } from "@/lib/ai/audit-log";
import {
  AI_READ_SCOPE,
  authorizeAiServiceRequest,
  type AiServicePrincipal,
} from "@/lib/ai/service-auth";
import {
  buildPagination,
  normalizeAiCampaignItem,
  parseAiCampaignsQuery,
  resolveSnapshotDateRange,
} from "@/lib/ai/campaigns-read";
import { applyAiRateLimit, type RateLimitResult } from "@/lib/ai/rate-limit";
import { getPrismaClient } from "@/lib/prisma";

const ENDPOINT = "/api/v2/ai/campaigns";

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
    const query = parseAiCampaignsQuery(request.nextUrl.searchParams);

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

      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 403 },
      );
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

    if (query.platform === "google") {
      const response = NextResponse.json({
        filters: {
          organizationId,
          clientId: query.clientId,
          platform: query.platform,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
        pagination: buildPagination(0, query.page, query.pageSize),
        data: [],
        notes: [
          "Sem campanhas Google carregadas no schema V2 atual. Consulte platform=meta ou all.",
        ],
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

    const snapshotDate = resolveSnapshotDateRange(query);
    const prisma = getPrismaClient();

    const where = {
      organizationId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(snapshotDate.gte || snapshotDate.lt
        ? {
            snapshotDate: {
              ...(snapshotDate.gte ? { gte: snapshotDate.gte } : {}),
              ...(snapshotDate.lt ? { lt: snapshotDate.lt } : {}),
            },
          }
        : {}),
    };

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        orderBy: [{ snapshotDate: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          organizationId: true,
          clientId: true,
          externalId: true,
          name: true,
          status: true,
          snapshotDate: true,
          spend: true,
          impressions: true,
          clicks: true,
          leads: true,
        },
      }),
    ]);

    const response = NextResponse.json({
      filters: {
        organizationId,
        clientId: query.clientId,
        platform: query.platform,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
      pagination: buildPagination(total, query.page, query.pageSize),
      data: campaigns.map((campaign) => normalizeAiCampaignItem(campaign)),
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
    const errorMessage = error instanceof Error ? error.message : "Falha ao consultar campanhas";

    await logAudit(principal, request, {
      statusCode: 400,
      errorMessage,
    });

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
