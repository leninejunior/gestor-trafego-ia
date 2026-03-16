import { NextRequest, NextResponse } from "next/server";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { listActiveCutoverRules, upsertCutoverRule } from "@/lib/cutover/routing";

type UpsertBody = {
  clientId?: string;
  groupId?: string;
  route?: string;
  rolloutPercent?: number;
  reason?: string;
  isActive?: boolean;
};

function parseRoute(value: unknown): "V1" | "V2" {
  if (typeof value !== "string") {
    throw new Error("route obrigatoria (V1 ou V2).");
  }

  const normalized = value.trim().toUpperCase();
  if (normalized !== "V1" && normalized !== "V2") {
    throw new Error("route invalida. Use V1 ou V2.");
  }

  return normalized;
}

async function parseBody(request: NextRequest): Promise<UpsertBody> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    const payload = (await request.json()) as UpsertBody;
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

export async function GET() {
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await listActiveCutoverRules(tenantContext.tenantId);

  return NextResponse.json({
    organizationId: tenantContext.tenantId,
    rules,
  });
}

export async function PUT(request: NextRequest) {
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await parseBody(request);

    const rule = await upsertCutoverRule({
      organizationId: tenantContext.tenantId,
      clientId: body.clientId,
      groupId: body.groupId,
      route: parseRoute(body.route),
      rolloutPercent: typeof body.rolloutPercent === "number" ? body.rolloutPercent : 100,
      reason: body.reason,
      isActive: body.isActive,
      userId: tenantContext.userId,
    });

    return NextResponse.json({
      organizationId: tenantContext.tenantId,
      rule,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao salvar regra de cutover";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
