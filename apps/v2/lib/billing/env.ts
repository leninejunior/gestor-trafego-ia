function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) return null;
  return normalized;
}

export function getBillingUpstreamBaseUrl(): string | null {
  return normalizeBaseUrl(process.env.BILLING_UPSTREAM_BASE_URL);
}

