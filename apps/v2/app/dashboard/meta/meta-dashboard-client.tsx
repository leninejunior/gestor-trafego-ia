"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import styles from "@/app/dashboard/platform-dashboard.module.css";

type AccessibleClient = {
  id: string;
  name: string;
  org_id: string;
  has_meta_connection: boolean;
};

type AccessibleClientsResponse = {
  clients?: AccessibleClient[];
  error?: string;
};

type MetaCampaign = {
  id: string;
  name: string;
  status: string;
};

type MetaCampaignsResponse = {
  campaigns?: MetaCampaign[];
  message?: string;
  error?: string;
};

type MetaClientSummary = {
  clientId: string;
  clientName: string;
  campaignCount: number;
  activeCampaignCount: number;
  warningMessage: string | null;
};

function readError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const error = "error" in payload ? (payload as { error?: unknown }).error : null;
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  const message =
    "message" in payload ? (payload as { message?: unknown }).message : null;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return null;
}

function isMetaCampaignActive(status: string): boolean {
  return status === "ACTIVE";
}

export function MetaDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientSummaries, setClientSummaries] = useState<MetaClientSummary[]>([]);

  useEffect(() => {
    async function loadMetaData() {
      setLoading(true);
      setError(null);

      try {
        const clientsResponse = await fetch("/api/user/accessible-clients", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const clientsPayload = (await clientsResponse.json()) as AccessibleClientsResponse;

        if (!clientsResponse.ok) {
          throw new Error(readError(clientsPayload) ?? "Falha ao carregar clientes.");
        }

        const clients = Array.isArray(clientsPayload.clients)
          ? clientsPayload.clients
          : [];
        const clientsWithMeta = clients.filter((client) => client.has_meta_connection);

        const summaries = await Promise.all(
          clientsWithMeta.map(async (client): Promise<MetaClientSummary> => {
            try {
              const campaignsResponse = await fetch(
                `/api/meta/campaigns?clientId=${encodeURIComponent(client.id)}&withInsights=false`,
                {
                  method: "GET",
                  headers: { Accept: "application/json" },
                },
              );
              const campaignsPayload =
                (await campaignsResponse.json()) as MetaCampaignsResponse;

              if (!campaignsResponse.ok) {
                return {
                  clientId: client.id,
                  clientName: client.name,
                  campaignCount: 0,
                  activeCampaignCount: 0,
                  warningMessage:
                    readError(campaignsPayload) ??
                    "Nao foi possivel carregar campanhas deste cliente.",
                };
              }

              const campaigns = Array.isArray(campaignsPayload.campaigns)
                ? campaignsPayload.campaigns
                : [];

              return {
                clientId: client.id,
                clientName: client.name,
                campaignCount: campaigns.length,
                activeCampaignCount: campaigns.filter((campaign) =>
                  isMetaCampaignActive(campaign.status),
                ).length,
                warningMessage:
                  campaigns.length === 0 ? campaignsPayload.message ?? null : null,
              };
            } catch (campaignError) {
              return {
                clientId: client.id,
                clientName: client.name,
                campaignCount: 0,
                activeCampaignCount: 0,
                warningMessage:
                  campaignError instanceof Error
                    ? campaignError.message
                    : "Falha ao consultar campanhas.",
              };
            }
          }),
        );

        setClientSummaries(summaries);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Erro inesperado ao carregar dashboard Meta.";
        setError(message);
        setClientSummaries([]);
      } finally {
        setLoading(false);
      }
    }

    void loadMetaData();
  }, []);

  const totals = useMemo(() => {
    return clientSummaries.reduce(
      (accumulator, summary) => ({
        connectedClients: accumulator.connectedClients + 1,
        totalCampaigns: accumulator.totalCampaigns + summary.campaignCount,
        activeCampaigns: accumulator.activeCampaigns + summary.activeCampaignCount,
      }),
      { connectedClients: 0, totalCampaigns: 0, activeCampaigns: 0 },
    );
  }, [clientSummaries]);

  const hasConnections = clientSummaries.length > 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <h1 className={styles.headerTitle}>
            <span
              className={`${styles.platformBadge} ${styles.platformBadgeMeta}`}
              aria-hidden="true"
            >
              M
            </span>
            Meta Ads
          </h1>
          <p className={styles.headerSubtitle}>
            Gerencie conexoes e campanhas com base nas APIs de compatibilidade V2.
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
          <p className={styles.summaryLabel}>Clientes Conectados</p>
          <p className={styles.summaryValue}>{totals.connectedClients}</p>
          <p className={styles.summaryMeta}>clientes com conexao Meta ativa</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Campanhas Mapeadas</p>
          <p className={styles.summaryValue}>{totals.totalCampaigns}</p>
          <p className={styles.summaryMeta}>campanhas retornadas por /api/meta/campaigns</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Campanhas Ativas</p>
          <p className={styles.summaryValue}>{totals.activeCampaigns}</p>
          <p className={styles.summaryMeta}>status ACTIVE no snapshot atual</p>
        </article>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Conexoes Meta Ads</h2>
        <p className={styles.cardDescription}>
          Paridade visual minima com legado: listagem operacional por cliente e
          indicadores de campanhas.
        </p>

        {loading ? <p className={styles.emptyState}>Carregando dados...</p> : null}

        {!loading && !hasConnections ? (
          <p className={styles.emptyState}>
            Nenhuma conexao Meta encontrada. Use a rota de clientes para conectar a
            primeira conta.
          </p>
        ) : null}

        {!loading && hasConnections ? (
          <ul className={styles.list}>
            {clientSummaries.map((summary) => (
              <li key={summary.clientId} className={styles.listItem}>
                <div>
                  <p className={styles.itemTitle}>{summary.clientName}</p>
                  <p className={styles.itemMeta}>
                    {summary.campaignCount} campanhas, {summary.activeCampaignCount} ativas
                  </p>
                  {summary.warningMessage ? (
                    <p className={styles.itemMeta}>{summary.warningMessage}</p>
                  ) : null}
                </div>
                <span className={`${styles.statusTag} ${styles.statusOk}`}>Conectado</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Placeholder de Compatibilidade</h2>
        <p className={styles.placeholder}>
          Endpoint detalhado de contas Meta (com ad account ID/moeda por conexao) ainda
          nao existe no V2. TODO sugerido: criar <code>/api/meta/connections</code> para
          paridade completa com o legado.
        </p>
      </section>
    </main>
  );
}
