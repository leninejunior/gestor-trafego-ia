"use client";

import { useEffect, useMemo, useState } from "react";

import styles from "./billing-panel.module.css";

type BillingPlan = {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  features: unknown;
};

type CurrentSubscription = {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  billing_cycle: "monthly" | "annual";
  current_period_end: string | null;
  plan?: BillingPlan | null;
};

type CurrentResponse = {
  organizationId?: string;
  data?: CurrentSubscription | null;
  error?: string;
};

type PlansResponse = {
  data?: BillingPlan[];
  error?: string;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function readError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }
  return fallback;
}

function normalizeFeatures(features: unknown): string[] {
  if (Array.isArray(features)) {
    return features.filter((item): item is string => typeof item === "string");
  }

  if (features && typeof features === "object") {
    return Object.entries(features).map(([key, value]) => {
      if (typeof value === "boolean") {
        return value ? key : `${key} (desativado)`;
      }
      return `${key}: ${String(value)}`;
    });
  }

  if (typeof features === "string" && features.trim()) {
    return [features.trim()];
  }

  return [];
}

function statusLabel(value: string): string {
  if (value === "active") return "Ativa";
  if (value === "trialing") return "Trial";
  if (value === "past_due") return "Pagamento pendente";
  if (value === "canceled") return "Cancelada";
  return value;
}

export function BillingPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [currentResponse, plansResponse] = await Promise.all([
          fetch("/api/billing/current", { method: "GET" }),
          fetch("/api/billing/plans", { method: "GET" }),
        ]);

        const currentPayload = (await currentResponse.json()) as CurrentResponse;
        const plansPayload = (await plansResponse.json()) as PlansResponse;

        if (!currentResponse.ok) {
          throw new Error(readError(currentPayload, "Falha ao carregar assinatura."));
        }

        if (!plansResponse.ok) {
          throw new Error(readError(plansPayload, "Falha ao carregar planos."));
        }

        setOrganizationId(currentPayload.organizationId ?? null);
        setCurrent(currentPayload.data ?? null);
        setPlans(Array.isArray(plansPayload.data) ? plansPayload.data : []);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Erro inesperado ao carregar billing.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const currentPlanId = current?.plan_id ?? null;

  const currentRenewDate = useMemo(() => {
    if (!current?.current_period_end) return null;
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(current.current_period_end));
  }, [current?.current_period_end]);

  async function handleUpgrade(planId: string) {
    setNotice(null);
    setError(null);
    setUpgradingPlanId(planId);

    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          billingCycle,
        }),
      });

      const payload = (await response.json()) as
        | { redirectUrl?: string; checkoutUrl?: string; message?: string; error?: string }
        | unknown;

      if (!response.ok) {
        throw new Error(readError(payload, "Falha ao iniciar checkout."));
      }

      const redirectUrl =
        payload && typeof payload === "object" && "redirectUrl" in payload
          ? (payload as { redirectUrl?: unknown }).redirectUrl
          : undefined;
      const checkoutUrl =
        payload && typeof payload === "object" && "checkoutUrl" in payload
          ? (payload as { checkoutUrl?: unknown }).checkoutUrl
          : undefined;

      const target =
        typeof redirectUrl === "string" && redirectUrl.trim()
          ? redirectUrl
          : typeof checkoutUrl === "string" && checkoutUrl.trim()
            ? checkoutUrl
            : null;

      if (target) {
        window.location.assign(target);
        return;
      }

      setNotice("Solicitacao de assinatura enviada com sucesso.");
    } catch (upgradeError) {
      const message =
        upgradeError instanceof Error
          ? upgradeError.message
          : "Erro inesperado ao iniciar assinatura.";
      setError(message);
    } finally {
      setUpgradingPlanId(null);
    }
  }

  if (loading) {
    return <p className={styles.muted}>Carregando dados de assinatura...</p>;
  }

  return (
    <section className={styles.shell}>
      {error ? <p className={styles.noticeError}>{error}</p> : null}
      {notice ? <p className={styles.noticeSuccess}>{notice}</p> : null}

      <div className={styles.currentCard}>
        <h2 className={styles.sectionTitle}>Assinatura Atual</h2>
        {organizationId ? (
          <p className={styles.meta}>
            Organizacao: <code>{organizationId}</code>
          </p>
        ) : null}

        {current ? (
          <div className={styles.currentGrid}>
            <p>
              <strong>Status:</strong> {statusLabel(current.status)}
            </p>
            <p>
              <strong>Ciclo:</strong> {current.billing_cycle === "annual" ? "Anual" : "Mensal"}
            </p>
            <p>
              <strong>Plano:</strong> {current.plan?.name ?? current.plan_id}
            </p>
            <p>
              <strong>Renovacao:</strong> {currentRenewDate ?? "n/a"}
            </p>
          </div>
        ) : (
          <p className={styles.muted}>Nenhuma assinatura ativa encontrada.</p>
        )}
      </div>

      <div className={styles.toolbar}>
        <h2 className={styles.sectionTitle}>Planos Disponiveis</h2>
        <label className={styles.cycleLabel}>
          Ciclo:
          <select
            value={billingCycle}
            onChange={(event) =>
              setBillingCycle(event.target.value as "monthly" | "annual")
            }
          >
            <option value="monthly">Mensal</option>
            <option value="annual">Anual</option>
          </select>
        </label>
      </div>

      <div className={styles.grid}>
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const price =
            billingCycle === "annual" ? plan.annual_price : plan.monthly_price;

          return (
            <article key={plan.id} className={styles.planCard}>
              <h3 className={styles.planTitle}>{plan.name}</h3>
              <p className={styles.planPrice}>
                {formatMoney(price)}
                <span>{billingCycle === "annual" ? "/ano" : "/mes"}</span>
              </p>
              <p className={styles.planDescription}>
                {plan.description ?? "Sem descricao"}
              </p>

              <ul className={styles.features}>
                {normalizeFeatures(plan.features)
                  .slice(0, 6)
                  .map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
              </ul>

              <button
                type="button"
                className={isCurrent ? styles.currentButton : styles.upgradeButton}
                onClick={() => handleUpgrade(plan.id)}
                disabled={Boolean(isCurrent || upgradingPlanId)}
              >
                {isCurrent
                  ? "Plano atual"
                  : upgradingPlanId === plan.id
                    ? "Processando..."
                    : "Assinar / Upgrade"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

