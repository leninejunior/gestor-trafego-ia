import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/prisma";
import { resolveLegacyUserScope } from "@/lib/compat/legacy-scope";

function parseSpend(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const campaignId = url.searchParams.get("campaignId");

  if (!clientId || !campaignId) {
    return NextResponse.json(
      { error: "Client ID e Campaign ID são obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const prisma = getPrismaClient();
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: {
          in: scope.organizationIds,
        },
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Acesso negado ao cliente" }, { status: 403 });
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        organizationId: {
          in: scope.organizationIds,
        },
        clientId,
        OR: [{ id: campaignId }, { externalId: campaignId }],
      },
      orderBy: [{ snapshotDate: "desc" }, { updatedAt: "desc" }],
      select: {
        impressions: true,
        clicks: true,
        spend: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ insights: [] });
    }

    const impressions = campaign.impressions ?? 0;
    const clicks = campaign.clicks ?? 0;
    const spend = parseSpend(campaign.spend);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;

    return NextResponse.json({
      insights: [
        {
          impressions: String(Math.max(0, impressions)),
          clicks: String(Math.max(0, clicks)),
          spend: spend.toFixed(2),
          reach: "0",
          ctr: ctr.toFixed(2),
          cpc: cpc.toFixed(2),
          cpm: "0",
          frequency: "0",
          actions: [],
          cost_per_action_type: [],
        },
      ],
    });
  } catch (error) {
    console.error("[v2 compat][meta/insights] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

