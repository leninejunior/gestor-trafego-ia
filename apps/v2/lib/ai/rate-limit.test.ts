import { applyAiRateLimit, resetAiRateLimitCounters } from "@/lib/ai/rate-limit";

describe("GT-24 ai rate limit", () => {
  beforeEach(() => {
    resetAiRateLimitCounters();
  });

  it("permite requisicoes ate o limite e bloqueia excedente", () => {
    const now = Date.parse("2026-02-26T21:00:00.000Z");

    const first = applyAiRateLimit({
      organizationId: "org-1",
      keyId: "key-1",
      limitPerMinute: 2,
      nowMs: now,
    });

    const second = applyAiRateLimit({
      organizationId: "org-1",
      keyId: "key-1",
      limitPerMinute: 2,
      nowMs: now + 100,
    });

    const third = applyAiRateLimit({
      organizationId: "org-1",
      keyId: "key-1",
      limitPerMinute: 2,
      nowMs: now + 200,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("reinicia janela apos 60 segundos", () => {
    const now = Date.parse("2026-02-26T21:00:00.000Z");

    applyAiRateLimit({
      organizationId: "org-1",
      keyId: "key-1",
      limitPerMinute: 1,
      nowMs: now,
    });

    const blocked = applyAiRateLimit({
      organizationId: "org-1",
      keyId: "key-1",
      limitPerMinute: 1,
      nowMs: now + 10,
    });

    const afterWindow = applyAiRateLimit({
      organizationId: "org-1",
      keyId: "key-1",
      limitPerMinute: 1,
      nowMs: now + 60_100,
    });

    expect(blocked.allowed).toBe(false);
    expect(afterWindow.allowed).toBe(true);
  });
});
