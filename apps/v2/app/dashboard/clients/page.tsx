import { DashboardShell } from "@/app/dashboard/_components/dashboard-shell";
import { getDashboardClientsData } from "@/app/dashboard/_components/dashboard-data";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export default async function DashboardClientsPage() {
  const data = await getDashboardClientsData("/dashboard/clients");

  return (
    <DashboardShell activePath="/dashboard/clients" userEmail={data.userEmail}>
      <div className={styles.page}>
        <section className={styles.header}>
          <div>
            <h1>Clientes</h1>
            <p>Gerencie os clientes e acompanhe o status das conexoes de anuncios.</p>
          </div>
        </section>

        <section className={styles.cards}>
          <article className={styles.card}>
            <span>Total clientes</span>
            <strong>{data.totalClients}</strong>
          </article>
          <article className={styles.card}>
            <span>Meta Ads</span>
            <strong>{data.totalMetaConnections}</strong>
          </article>
          <article className={styles.card}>
            <span>Google Ads</span>
            <strong>{data.totalGoogleConnections}</strong>
          </article>
          <article className={styles.card}>
            <span>Conexoes ativas</span>
            <strong>{data.totalConnections}</strong>
          </article>
        </section>

        <section className={styles.tablePanel}>
          <div className={styles.tableHeader}>
            <h2>Lista de clientes</h2>
            <span>{data.totalClients} registro(s)</span>
          </div>

          {data.clients.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhum cliente encontrado para esta conta.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Conexoes</th>
                    <th>Criado em</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <div className={styles.clientInfo}>
                          <strong>{client.name}</strong>
                          <span>ID: {client.id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.badges}>
                          <span className={styles.metaBadge}>Meta: {client.metaConnections}</span>
                          <span className={styles.googleBadge}>Google: {client.googleConnections}</span>
                        </div>
                      </td>
                      <td>{formatDate(client.createdAt)}</td>
                      <td>
                        <span
                          className={
                            client.hasConnections ? styles.statusActive : styles.statusInactive
                          }
                        >
                          {client.hasConnections ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <button type="button" className={styles.inlineButton} disabled>
                          Detalhes em breve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
