import { NextRequest, NextResponse } from "next/server";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { getBillingUpstreamBaseUrl } from "@/lib/billing/env";
import { resolveBillingOrganizationId } from "@/lib/billing/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpgradeBody = {
  planId?: unknown;
  billingCycle?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseUpgradeBody(body: UpgradeBody) {
  const planId = asNonEmptyString(body.planId);
  if (!planId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Campo planId e obrigatorio." },
        { status: 400 },
      ),
    };
  }

  const billingCycleRaw = asNonEmptyString(body.billingCycle) ?? "monthly";
  if (billingCycleRaw !== "monthly" && billingCycleRaw !== "annual") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Campo billingCycle deve ser 'monthly' ou 'annual'." },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true as const,
    planId,
    billingCycle: billingCycleRaw,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upstreamBaseUrl = getBillingUpstreamBaseUrl();
  if (!upstreamBaseUrl) {
    return NextResponse.json(
      {
        error:
          "Integracao de checkout nao configurada. Defina BILLING_UPSTREAM_BASE_URL.",
      },
      { status: 501 },
    );
  }

  let body: UpgradeBody;
  try {
    body = (await request.json()) as UpgradeBody;
  } catch {
    return NextResponse.json({ error: "Body JSON invalido." }, { status: 400 });
  }

  const parsedBody = parseUpgradeBody(body);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const organizationId = await resolveBillingOrganizationId(supabase, tenantContext);

  const upstreamUrl = `${upstreamBaseUrl}/api/subscriptions/upgrade`;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        planId: parsedBody.planId,
        billingCycle: parsedBody.billingCycle,
        organizationId,
      }),
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro de rede";
    return NextResponse.json(
      {
        error: "Falha ao integrar com checkout de assinatura.",
        details: message,
      },
      { status: 502 },
    );
  }

  const rawText = await upstreamResponse.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { message: rawText };
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return NextResponse.json(payload, { status: upstreamResponse.status });
  }

  return NextResponse.json(
    {
      data: payload,
    },
    { status: upstreamResponse.status },
  );
}
