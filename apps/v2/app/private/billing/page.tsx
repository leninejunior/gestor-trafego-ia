import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import { BillingPanel } from "@/app/private/billing/billing-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/private/billing");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>GT</p>
          <h1 className={styles.title}>Billing e Assinatura</h1>
          <p className={styles.subtitle}>
            Consulta da assinatura atual e upgrade de plano com checkout integrado.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/private" className={styles.backLink}>
            Voltar para area privada
          </Link>
          <form action={logoutAction}>
            <button type="submit" className={styles.logoutButton}>
              Sair
            </button>
          </form>
        </div>
      </header>

      <BillingPanel />
    </main>
  );
}
