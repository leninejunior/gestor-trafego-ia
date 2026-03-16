import { NextRequest, NextResponse } from "next/server";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { getPrismaClient } from "@/lib/prisma";
import {
  buildMetaDailyReport,
  getUtcDateRange,
  normalizeDateKey,
} from "@/lib/reports/meta-daily-report";

export async function GET(request: NextRequest) {
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");

  try {
    const dateKey = normalizeDateKey(dateParam);
    const { startAt, endAt } = getUtcDateRange(dateKey);
    const prisma = getPrismaClient();

    const campaigns = await prisma.campaign.findMany({
      where: {
        organizationId: tenantContext.tenantId,
        snapshotDate: {
          gte: startAt,
          lt: endAt,
        },
      },
      select: {
        spend: true,
        impressions: true,
        clicks: true,
        leads: true,
      },
    });

    const report = buildMetaDailyReport({
      date: dateKey,
      organizationId: tenantContext.tenantId,
      campaigns,
    });

    return NextResponse.json({
      period: {
        date: dateKey,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
      report,
      message: report.message,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao gerar relatorio";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
