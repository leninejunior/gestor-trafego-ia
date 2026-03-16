import { NextRequest, NextResponse } from "next/server";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { resolveCutoverRoute } from "@/lib/cutover/routing";

export async function GET(request: NextRequest) {
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    const groupId = request.nextUrl.searchParams.get("groupId");
    const subjectKey = request.nextUrl.searchParams.get("subjectKey");

    const decision = await resolveCutoverRoute({
      organizationId: tenantContext.tenantId,
      clientId,
      groupId,
      subjectKey,
    });

    return NextResponse.json({
      organizationId: tenantContext.tenantId,
      clientId,
      groupId,
      subjectKey,
      decision,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Falha ao resolver cutover";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
