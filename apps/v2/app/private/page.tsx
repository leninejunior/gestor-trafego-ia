import { redirect } from "next/navigation";
import Link from "next/link";

import { logoutAction } from "@/app/auth/actions";
import { decodeJwtPayload, getJwtExpirationIso } from "@/lib/auth/jwt";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrivatePage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const user = userData.user;
  const session = sessionData.session;

  if (!user) {
    redirect("/login?redirectTo=/private");
  }

  const jwtPayload = decodeJwtPayload(session?.access_token);
  const sessionExp = getJwtExpirationIso(jwtPayload) ?? "n/a";

  return (
    <main style={{ maxWidth: 760, margin: "56px auto", padding: "0 24px" }}>
      <h1 style={{ marginBottom: 8 }}>Area privada da V2</h1>
      <p style={{ marginTop: 0 }}>
        Usuario autenticado com sucesso. Rota protegida liberada.
      </p>

      <ul style={{ lineHeight: 1.8, paddingLeft: 18 }}>
        <li>
          <strong>User ID:</strong> {user.id}
        </li>
        <li>
          <strong>Email:</strong> {user.email ?? "n/a"}
        </li>
        <li>
          <strong>Sessao JWT:</strong>{" "}
          {session?.access_token ? "presente" : "ausente"}
        </li>
        <li>
          <strong>JWT exp:</strong> {sessionExp}
        </li>
      </ul>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/private/billing"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #a5b4fc",
            background: "#eef2ff",
            color: "#312e81",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Billing e Assinatura
        </Link>

        <Link
          href="/api/v2/ai/campaigns?dateFrom=2026-02-01&dateTo=2026-02-26"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #86efac",
            background: "#ecfdf5",
            color: "#166534",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          API IA de Campanhas
        </Link>
      </div>

      <form action={logoutAction}>
        <button
          type="submit"
          style={{
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "#111827",
            color: "#f9fafb",
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </form>
    </main>
  );
}
