export type RateLimitInput = {
  organizationId: string;
  keyId: string;
  limitPerMinute: number;
  nowMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
};

type CounterState = {
  windowStartMs: number;
  count: number;
};

const WINDOW_MS = 60_000;
const counters = new Map<string, CounterState>();

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.trunc(value);
}

function buildKey(organizationId: string, keyId: string): string {
  return `${organizationId}:${keyId}`;
}

export function resetAiRateLimitCounters() {
  counters.clear();
}

export function applyAiRateLimit(input: RateLimitInput): RateLimitResult {
  const nowMs = input.nowMs ?? Date.now();
  const limit = clampPositiveInt(input.limitPerMinute, 60);
  const key = buildKey(input.organizationId, input.keyId);

  const current = counters.get(key);
  const isExpired = !current || nowMs - current.windowStartMs >= WINDOW_MS;

  if (isExpired) {
    counters.set(key, {
      windowStartMs: nowMs,
      count: 1,
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: new Date(nowMs + WINDOW_MS).toISOString(),
      retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  current.count += 1;
  counters.set(key, current);

  const remaining = Math.max(0, limit - current.count);
  const allowed = current.count <= limit;
  const resetMs = current.windowStartMs + WINDOW_MS;

  return {
    allowed,
    limit,
    remaining,
    resetAt: new Date(resetMs).toISOString(),
    retryAfterSeconds: Math.max(1, Math.ceil((resetMs - nowMs) / 1000)),
  };
}
