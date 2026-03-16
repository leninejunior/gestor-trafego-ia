import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { tryGetSupabaseEnv } from "@/lib/supabase/env";

function sanitizeRedirectTo(pathnameWithSearch: string): string {
  if (!pathnameWithSearch.startsWith("/") || pathnameWithSearch.startsWith("//")) {
    return "/private";
  }

  return pathnameWithSearch;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const env = tryGetSupabaseEnv();

  if (!env) {
    if (pathname.startsWith("/api/private") || pathname.startsWith("/api/anamnesis")) {
      return NextResponse.json(
        { error: "Supabase auth nao configurado no ambiente atual." },
        { status: 503 },
      );
    }

    if (pathname.startsWith("/private")) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set(
        "redirectTo",
        sanitizeRedirectTo(`${pathname}${search}`),
      );
      loginUrl.searchParams.set(
        "error",
        "Autenticacao indisponivel: configure SUPABASE_URL e SUPABASE_ANON_KEY.",
      );
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }

  const { supabaseUrl, supabaseAnonKey } = env;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname === "/login") {
      return response;
    }

    if (pathname.startsWith("/api/private") || pathname.startsWith("/api/anamnesis")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "redirectTo",
      sanitizeRedirectTo(`${pathname}${search}`),
    );
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login") {
    const redirectTo = sanitizeRedirectTo(
      request.nextUrl.searchParams.get("redirectTo") ?? "/private",
    );
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/private/:path*", "/api/private/:path*", "/api/anamnesis/:path*", "/login"],
};
