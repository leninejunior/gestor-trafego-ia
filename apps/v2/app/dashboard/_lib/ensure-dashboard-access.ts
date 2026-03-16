import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryGetSupabaseEnv } from "@/lib/supabase/env";

function sanitizeRedirectTo(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/private";
  }

  return pathname;
}

export async function ensureDashboardAccess(pathname: string) {
  const redirectTo = sanitizeRedirectTo(pathname);
  const env = tryGetSupabaseEnv();

  if (!env) {
    const params = new URLSearchParams({
      redirectTo,
      error: "Autenticacao indisponivel: configure SUPABASE_URL e SUPABASE_ANON_KEY.",
    });
    redirect(`/login?${params.toString()}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const params = new URLSearchParams({ redirectTo });
    redirect(`/login?${params.toString()}`);
  }
}
