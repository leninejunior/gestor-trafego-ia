import { NextResponse } from "next/server";

import { getTenantContext } from "@/lib/auth/tenant-context";
import { resolveBillingOrganizationId } from "@/lib/billing/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function queryCurrentSubscriptionWithPlan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
) {
  return supabase
    .from("subscriptions")
    .select(
      "id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_end, cancel_at_period_end, canceled_at, created_at, updated_at, plan:subscription_plans(id, name, description, monthly_price, annual_price, features)",
    )
    .eq("organization_id", organizationId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1);
}

async function queryCurrentSubscription(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
) {
  return supabase
    .from("subscriptions")
    .select(
      "id, organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_end, cancel_at_period_end, canceled_at, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = await resolveBillingOrganizationId(supabase, tenantContext);
  if (!organizationId) {
    return NextResponse.json(
      { error: "Nao foi possivel identificar a organizacao para billing." },
      { status: 400 },
    );
  }

  const withPlan = await queryCurrentSubscriptionWithPlan(supabase, organizationId);
  if (!withPlan.error) {
    const current = withPlan.data?.[0] ?? null;
    return NextResponse.json({
      organizationId,
      data: current,
    });
  }

  const fallback = await queryCurrentSubscription(supabase, organizationId);
  if (fallback.error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar assinatura atual.",
        details: fallback.error.message,
      },
      { status: 500 },
    );
  }

  const current = fallback.data?.[0] ?? null;
  if (!current) {
    return NextResponse.json({
      organizationId,
      data: null,
    });
  }

  const { data: planData } = await supabase
    .from("subscription_plans")
    .select("id, name, description, monthly_price, annual_price, features")
    .eq("id", current.plan_id)
    .limit(1);

  return NextResponse.json({
    organizationId,
    data: {
      ...current,
      plan: planData?.[0] ?? null,
    },
  });
}
