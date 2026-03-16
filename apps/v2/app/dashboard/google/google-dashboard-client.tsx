"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import styles from "@/app/dashboard/platform-dashboard.module.css";

type GoogleConnection = {
  id: string;
  customer_id: string;
  status: "active" | "inactive";
  last_sync_at: string | null;
  updated_at: string;
};

type ClientWithGoogleConnections = {
  id: string;
  name: string;
  googleConnections?: GoogleConnection[];
};

type ClientsResponse = {
  clients?: ClientWithGoogleConnections[];
  error?: string;
};

function readError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = "error" in payload ? (payload as { error?: unknown }).error : null;
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return null;
}

export function GoogleDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientWithGoogleConnections[]>([]);

  useEffect(() => {
    async function loadGoogleData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/clients?includeGoogleConnections=true", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json()) as ClientsResponse;

        if (!response.ok) {
          throw new Error(readError(payload) ?? "Falha ao carregar clientes.");
        }

        setClients(Array.isArray(payload.clients) ? payload.clients : []);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Erro inesperado ao carregar dashboard Google.";
        setError(message);
        setClients([]);
      } finally {
        setLoading(false);
      }
    }

    void loadGoogleData();
  }, []);

  const connectedClients = useMemo(
    () =>
      clients.filter(
        (client) =>
          Array.isArray(client.googleConnections) &&
          client.googleConnections.length > 0,
      ),
    [clients],
  );

  const totals = useMemo(() => {
    let totalConnections = 0;
    let activeConnections = 0;

    for (const client of connectedClients) {
      const connections = Array.isArray(client.googleConnections)
        ? client.googleConnections
        : [];
      totalConnections += connections.length;
      activeConnections += connections.filter(
        (connection) => connection.status === "active",
      ).length;
    }

    return {
      totalClients: clients.length,
      connectedClients: connectedClients.length,
      totalConnections,
      activeConnections,
    };
  }, [clients, connectedClients]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <h1 className={styles.headerTitle}>
            <span
              className={`${styles.platformBadge} ${styles.platformBadgeGoogle}`}
              aria-hidden="true"
            >
              G
            </span>
            Google Ads
          </h1>
          <p className={styles.headerSubtitle}>
            Visao operacional de conexoes Google com base no endpoint de clientes da V2.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => window.location.reload()}
          >
            Atualizar
          </button>
          <Link href="/dashboard/clients" className={styles.buttonPrimary}>
            Conectar Nova Conta
          </Link>
        </div>
      </header>

      {error ? <p className={styles.noticeError}>{error}</p> : null}

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Contas Conectadas</p>
          <p className={styles.summaryValue}>{totals.totalConnections}</p>
          <p className={styles.summaryMeta}>contas Google listadas no payload</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Conexoes Ativas</p>
          <p className={styles.summaryValue}>{totals.activeConnections}</p>
          <p className={styles.summaryMeta}>status active</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Clientes Cobertos</p>
          <p className={styles.summaryValue}>
            {totals.connectedClients}/{totals.totalClients}
          </p>
          <p className={styles.summaryMeta}>clientes com ao menos uma conexao Google</p>
        </article>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Status das Conexoes</h2>
        <p className={styles.cardDescription}>
          Paridade visual minima com legado: listagem de clientes com contas
          conectadas e status de conexao.
        </p>

        {loading ? <p className={styles.emptyState}>Carregando dados...</p> : null}

        {!loading && connectedClients.length === 0 ? (
          <p className={styles.emptyState}>
            Nenhuma conta Google Ads conectada. Use a rota de clientes para iniciar a
            conexao.
          </p>
        ) : null}

        {!loading && connectedClients.length > 0 ? (
          <ul className={styles.list}>
            {connectedClients.map((client) => {
              const connections = client.googleConnections ?? [];
              const hasActiveConnection = connections.some(
                (connection) => connection.status === "active",
              );
              const idsPreview = connections
                .slice(0, 2)
                .map((connection) => connection.customer_id)
                .join(", ");
              const overflowCount =
                connections.length > 2 ? ` +${connections.length - 2}` : "";

              return (
                <li key={client.id} className={styles.listItem}>
                  <div>
                    <p className={styles.itemTitle}>{client.name}</p>
                    <p className={styles.itemMeta}>
                      {connections.length} conta(s): {idsPreview}
                      {overflowCount}
                    </p>
                  </div>
                  <span
                    className={`${styles.statusTag} ${
                      hasActiveConnection ? styles.statusOk : styles.statusWarn
                    }`}
                  >
                    {hasActiveConnection ? "Conectado" : "Inativo"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Placeholders de Compatibilidade</h2>
        <p className={styles.placeholder}>
          KPIs avancados (gasto, conversoes, CPA e sincronizacao) dependem de endpoint
          ainda nao migrado para V2. TODO sugerido: criar{" "}
          <code>/api/google/metrics-simple</code> e endpoint de status de sync para
          paridade funcional completa.
        </p>
      </section>
    </main>
  );
}
