import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, name, description, monthly_price, annual_price, features, is_active")
    .eq("is_active", true)
    .order("monthly_price", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error: "Falha ao carregar planos de assinatura.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: data ?? [],
  });
}

