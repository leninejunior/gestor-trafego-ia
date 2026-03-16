import { loginAction } from "@/app/auth/actions";
import { tryGetSupabaseEnv } from "@/lib/supabase/env";
import styles from "./page.module.css";

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue>;

type LoginPageProps = {
  searchParams?: Promise<SearchParams>;
};

function pickParam(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function sanitizeRedirectTo(value: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/private";
  }
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const hasSupabaseEnv = Boolean(tryGetSupabaseEnv());
  const supabaseConfigError = hasSupabaseEnv
    ? ""
    : "Autenticacao indisponivel. Configure SUPABASE_URL e SUPABASE_ANON_KEY no apps/v2/.env.";

  const params = (await searchParams) ?? {};
  const queryError = pickParam(params.error);
  const error = queryError || supabaseConfigError;
  const redirectTo = sanitizeRedirectTo(pickParam(params.redirectTo));

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Entrar na V2</h1>
        <p className={styles.subtitle}>
          Acesso autenticado via Supabase com sessao JWT.
        </p>

        {error ? <p className={styles.errorBox}>{error}</p> : null}

        <form action={loginAction} className={styles.form}>
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="voce@empresa.com"
              disabled={Boolean(supabaseConfigError)}
            />
          </label>

          <label className={styles.field}>
            <span>Senha</span>
            <input
              type="password"
              name="password"
              required
              placeholder="Sua senha"
              disabled={Boolean(supabaseConfigError)}
            />
          </label>

          <button type="submit" className={styles.submitButton} disabled={Boolean(supabaseConfigError)}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
