import Link from "next/link";

import styles from "./page.module.css";

const quickLinks = [
  {
    href: "/login",
    title: "Entrar",
    description: "Autenticacao via Supabase com sessao JWT.",
  },
  {
    href: "/private",
    title: "Area Privada",
    description: "Rotas protegidas para operacao da V2.",
  },
  {
    href: "/private/billing",
    title: "Billing",
    description: "Planos, assinatura e upgrade.",
  },
  {
    href: "/api/v2/ai/campaigns?dateFrom=2026-02-01&dateTo=2026-02-26",
    title: "API IA Campanhas",
    description: "Leitura de campanhas para consumo da IA.",
  },
  {
    href: "/api/health",
    title: "Healthcheck",
    description: "Status tecnico da aplicacao.",
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Flying Fox Platform</p>
        <h1>V2 Control Center</h1>
        <p className={styles.subtitle}>
          Operacao centralizada para autenticacao, campanhas, relatorios e
          rotinas da V2.
        </p>
      </section>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <span>Stack</span>
          <strong>Next.js + Prisma</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Banco</span>
          <strong>Postgres Docker</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Auth</span>
          <strong>Supabase JWT</strong>
        </article>
      </section>

      <section className={styles.linksGrid}>
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className={styles.linkCard}>
            <h2>{link.title}</h2>
            <p>{link.description}</p>
            <span>Abrir rota</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
