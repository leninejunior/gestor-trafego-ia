import {
  buildRolloutSubjectKey,
  computeRolloutBucket,
  normalizeRolloutPercent,
  resolveCutoverFromRules,
  selectMostSpecificRule,
} from "@/lib/cutover/routing";

describe("GT-22 cutover routing", () => {
  const now = new Date("2026-02-26T20:00:00.000Z");

  it("aplica default quando nao ha regra ativa", () => {
    const decision = resolveCutoverFromRules(
      {
        organizationId: "org-1",
        defaultRoute: "V2",
      },
      [],
    );

    expect(decision.route).toBe("V2");
    expect(decision.source).toBe("default");
    expect(decision.matchedRuleId).toBeNull();
  });

  it("seleciona regra mais especifica por grupo/cliente", () => {
    const selected = selectMostSpecificRule(
      [
        {
          id: "r-org",
          organizationId: "org-1",
          clientId: null,
          groupId: null,
          route: "V2",
          rolloutPercent: 100,
          isActive: true,
          reason: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "r-client",
          organizationId: "org-1",
          clientId: "client-1",
          groupId: null,
          route: "V2",
          rolloutPercent: 100,
          isActive: true,
          reason: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "r-group-client",
          organizationId: "org-1",
          clientId: "client-1",
          groupId: "grupo@chat",
          route: "V2",
          rolloutPercent: 100,
          isActive: true,
          reason: null,
          createdAt: now,
          updatedAt: new Date("2026-02-26T20:01:00.000Z"),
        },
      ],
      {
        clientId: "client-1",
        groupId: "grupo@chat",
      },
    );

    expect(selected?.id).toBe("r-group-client");
  });

  it("forca V1 quando regra explicita V1", () => {
    const decision = resolveCutoverFromRules(
      {
        organizationId: "org-1",
        clientId: "client-1",
        groupId: "grupo@chat",
      },
      [
        {
          id: "r-v1",
          organizationId: "org-1",
          clientId: "client-1",
          groupId: "grupo@chat",
          route: "V1",
          rolloutPercent: 100,
          isActive: true,
          reason: "rollback",
          createdAt: now,
          updatedAt: now,
        },
      ],
    );

    expect(decision.route).toBe("V1");
    expect(decision.source).toBe("rule");
    expect(decision.matchedRuleId).toBe("r-v1");
    expect(decision.rolloutPercent).toBe(0);
  });

  it("aplica rollout percentual deterministico para V2", () => {
    const input = {
      organizationId: "org-1",
      clientId: "client-1",
      groupId: "grupo@chat",
      subjectKey: "pilot-user-42",
    };

    const subject = buildRolloutSubjectKey(input);
    const bucket = computeRolloutBucket(subject, "gt22-cutover");

    const decision = resolveCutoverFromRules(input, [
      {
        id: "r-rollout",
        organizationId: "org-1",
        clientId: "client-1",
        groupId: "grupo@chat",
        route: "V2",
        rolloutPercent: 30,
        isActive: true,
        reason: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    expect(decision.rolloutBucket).toBe(bucket);
    expect(decision.route).toBe(bucket < 30 ? "V2" : "V1");
  });

  it("normaliza rollout para faixa valida", () => {
    expect(normalizeRolloutPercent(-1)).toBe(0);
    expect(normalizeRolloutPercent(37.4)).toBe(37);
    expect(normalizeRolloutPercent(140)).toBe(100);
  });
});
