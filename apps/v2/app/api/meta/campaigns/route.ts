import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/prisma";
import { resolveLegacyUserScope } from "@/lib/compat/legacy-scope";

function toSafeNumber(value: number | null): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

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

function buildInsights(impressions: number, clicks: number, spend: number) {
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;

  return {
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
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const withInsights = url.searchParams.get("withInsights") !== "false";

  if (!clientId) {
    return NextResponse.json(
      { error: "Client ID é obrigatório" },
      { status: 400 },
    );
  }

  try {
    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json(
        {
          campaigns: [],
          isTestData: false,
          message: "Usuário não autenticado. Faça login para acessar os dados reais.",
        },
        { status: 200 },
      );
    }

    if (scope.organizationIds.length === 0) {
      return NextResponse.json({
        campaigns: [],
        isTestData: false,
        message: "Conexão com Meta não encontrada. Conecte sua conta do Meta Ads.",
      });
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
      return NextResponse.json({
        campaigns: [],
        isTestData: false,
        message: "Conexão com Meta não encontrada. Conecte sua conta do Meta Ads.",
      });
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        clientId,
        organizationId: {
          in: scope.organizationIds,
        },
      },
      orderBy: [{ snapshotDate: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        externalId: true,
        name: true,
        status: true,
        impressions: true,
        clicks: true,
        spend: true,
      },
    });

    if (campaigns.length === 0) {
      return NextResponse.json({
        campaigns: [],
        isTestData: false,
        message:
          "Nenhuma campanha encontrada na conta Meta Ads. Verifique se a conta conectada tem campanhas ativas.",
      });
    }

    const payload = campaigns.map((campaign) => {
      const impressions = toSafeNumber(campaign.impressions);
      const clicks = toSafeNumber(campaign.clicks);
      const spend = parseSpend(campaign.spend);

      return {
        id: campaign.externalId || campaign.id,
        name: campaign.name,
        status: campaign.status,
        insights: withInsights ? buildInsights(impressions, clicks, spend) : null,
      };
    });

    return NextResponse.json({
      campaigns: payload,
      isTestData: false,
    });
  } catch (error) {
    console.error("[v2 compat][meta/campaigns] Erro:", error);
    return NextResponse.json(
      {
        campaigns: [],
        isTestData: false,
        message: "Erro ao buscar campanhas reais. Tente novamente.",
      },
      { status: 200 },
    );
  }
}
