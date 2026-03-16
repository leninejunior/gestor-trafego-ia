import { NextRequest, NextResponse } from "next/server";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { rollbackCutoverToV1 } from "@/lib/cutover/routing";

type RollbackBody = {
  reason?: string;
};

async function parseBody(request: NextRequest): Promise<RollbackBody> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    const payload = (await request.json()) as RollbackBody;
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
    const body = await parseBody(request);

    const rollback = await rollbackCutoverToV1({
      organizationId: tenantContext.tenantId,
      userId: tenantContext.userId,
      reason: body.reason,
    });

    return NextResponse.json({
      organizationId: tenantContext.tenantId,
      rollback,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao executar rollback";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
