import Link from "next/link";

import { DashboardShell } from "@/app/dashboard/_components/dashboard-shell";
import { getDashboardOverviewData } from "@/app/dashboard/_components/dashboard-data";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export default async function DashboardPage() {
  const data = await getDashboardOverviewData("/dashboard");
  const recentClients = data.clients.slice(0, 6);

  return (
    <DashboardShell activePath="/dashboard" userEmail={data.userEmail}>
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <h1>Dashboard</h1>
            <p>
              Visao geral dos clientes e integracoes ativas para a sua organizacao.
            </p>
          </div>
          <div className={styles.quickLinks}>
            <Link href="/dashboard/clients" className={styles.quickLink}>
              Gerenciar clientes
            </Link>
            <Link href="/api/clients" className={styles.quickLinkSecondary}>
              API de clientes
            </Link>
          </div>
        </section>

        <section className={styles.cards}>
          <article className={styles.card}>
            <span className={styles.label}>Total de clientes</span>
            <strong className={styles.value}>{data.totalClients}</strong>
            <p className={styles.hint}>Clientes ativos na base V2</p>
          </article>

          <article className={styles.card}>
            <span className={styles.label}>Conexoes Meta</span>
            <strong className={styles.value}>{data.totalMetaConnections}</strong>
            <p className={styles.hint}>Contas Meta ativas</p>
          </article>

          <article className={styles.card}>
            <span className={styles.label}>Conexoes Google</span>
            <strong className={styles.value}>{data.totalGoogleConnections}</strong>
            <p className={styles.hint}>Contas Google Ads ativas</p>
          </article>

          <article className={styles.card}>
            <span className={styles.label}>Clientes conectados</span>
            <strong className={styles.value}>{data.connectedClients}</strong>
            <p className={styles.hint}>Com pelo menos 1 integracao ativa</p>
          </article>
        </section>

        <section className={styles.sections}>
          <article className={styles.panel}>
            <h2>Estado atual</h2>
            {data.needsOnboarding ? (
              <p className={styles.warningText}>
                Onboarding pendente: adicione clientes e conecte contas para liberar o fluxo completo.
              </p>
            ) : (
              <p className={styles.successText}>
                Base operacional pronta: clientes e conexoes ativas detectadas.
              </p>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Clientes recentes</h2>
              <Link href="/dashboard/clients" className={styles.inlineLink}>
                Ver todos
              </Link>
            </div>

            {recentClients.length === 0 ? (
              <p className={styles.emptyText}>Nenhum cliente encontrado.</p>
            ) : (
              <ul className={styles.list}>
                {recentClients.map((client) => (
                  <li key={client.id} className={styles.listItem}>
                    <div>
                      <strong>{client.name}</strong>
                      <span>Criado em {formatDate(client.createdAt)}</span>
                    </div>
                    <span
                      className={
                        client.hasConnections ? styles.statusConnected : styles.statusPending
                      }
                    >
                      {client.hasConnections ? "Conectado" : "Sem conexoes"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </div>
    </DashboardShell>
  );
}
