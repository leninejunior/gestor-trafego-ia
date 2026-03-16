import { NextRequest, NextResponse } from "next/server";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { createPapiClient, PapiRequestError } from "@/lib/papi/client";
import { resolveCutoverRoute } from "@/lib/cutover/routing";
import { getPapiEnv } from "@/lib/papi/env";
import { logPapiEvent } from "@/lib/papi/send-log";
import { getPrismaClient } from "@/lib/prisma";
import {
  buildMetaDailyReport,
  getUtcDateRange,
  normalizeDateKey,
} from "@/lib/reports/meta-daily-report";

type SendTestBody = {
  date?: string;
  message?: string;
  groupId?: string;
  clientId?: string;
  subjectKey?: string;
};

async function parseRequestBody(request: NextRequest): Promise<SendTestBody> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    const payload = (await request.json()) as SendTestBody;
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await parseRequestBody(request);
    const requestedDate = body.date ?? request.nextUrl.searchParams.get("date");
    const dateKey = normalizeDateKey(requestedDate);
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

    const papiEnv = getPapiEnv();
    const targetGroupId = (body.groupId || papiEnv.groupId).trim();
    const cutoverDecision = await resolveCutoverRoute({
      organizationId: tenantContext.tenantId,
      clientId: body.clientId,
      groupId: targetGroupId,
      subjectKey: body.subjectKey ?? `${tenantContext.tenantId}:${dateKey}:${targetGroupId}`,
    });

    if (cutoverDecision.route === "V1") {
      logPapiEvent("warn", "send_test.cutover_v1", {
        tenantId: tenantContext.tenantId,
        date: dateKey,
        groupId: targetGroupId,
        clientId: body.clientId,
        decision: cutoverDecision,
      });

      return NextResponse.json(
        {
          sent: false,
          routedTo: "V1",
          cutover: cutoverDecision,
          fallbackHint: "Cutover configurado para V1. Execute o envio no endpoint da V1.",
        },
        { status: 409 },
      );
    }

    const message = (body.message || report.message).trim();
    const papiClient = createPapiClient(papiEnv);

    logPapiEvent("info", "send_test.start", {
      tenantId: tenantContext.tenantId,
      date: dateKey,
      groupId: targetGroupId,
      campaignsCount: report.campaignsCount,
    });

    const sendResult = await papiClient.sendGroupMessage({
      groupId: targetGroupId,
      message,
    });

    logPapiEvent("info", "send_test.success", {
      tenantId: tenantContext.tenantId,
      date: dateKey,
      groupId: targetGroupId,
      status: sendResult.status,
    });

    return NextResponse.json({
      sent: true,
      groupId: targetGroupId,
      cutover: cutoverDecision,
      period: {
        date: dateKey,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
      report,
      message,
      papi: sendResult,
    });
  } catch (error) {
    if (error instanceof PapiRequestError) {
      logPapiEvent("error", "send_test.papi_error", {
        status: error.status,
        details: error.details,
      });

      return NextResponse.json(
        {
          error: error.message,
          papiStatus: error.status,
          details: error.details,
        },
        { status: 502 },
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Falha ao enviar mensagem";

    logPapiEvent("error", "send_test.error", {
      error: errorMessage,
    });

    const isBadRequest =
      errorMessage.includes("Parametro date invalido") ||
      errorMessage.includes("Variavel obrigatoria ausente");

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: isBadRequest ? 400 : 500 },
    );
  }
}
