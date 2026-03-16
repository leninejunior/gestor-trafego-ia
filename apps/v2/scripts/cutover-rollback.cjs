#!/usr/bin/env node

require("dotenv/config");

const { PrismaClient } = require("@prisma/client");

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

function parseArgs(argv) {
  const result = {
    organizationId: null,
    reason: null,
    userId: process.env.CUTOVER_ROLLBACK_USER_ID || DEFAULT_USER_ID,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--organization-id") {
      result.organizationId = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (arg === "--reason") {
      result.reason = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (arg === "--user-id") {
      result.userId = argv[i + 1] || result.userId;
      i += 1;
      continue;
    }
  }

  if (!result.organizationId) {
    throw new Error("Informe --organization-id para executar o rollback GT-22.");
  }

  return result;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const reason =
    args.reason || `Rollback rapido GT-22 executado em ${new Date().toISOString()}.`;

  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.cutoverRule.updateMany({
        where: {
          organizationId: args.organizationId,
          isActive: true,
        },
        data: {
          route: "V1",
          rolloutPercent: 0,
          reason,
          updatedByUserId: args.userId,
        },
      });

      if (updated.count > 0) {
        return {
          updatedCount: updated.count,
          createdRuleId: null,
        };
      }

      const created = await tx.cutoverRule.create({
        data: {
          organizationId: args.organizationId,
          route: "V1",
          rolloutPercent: 0,
          isActive: true,
          reason,
          createdByUserId: args.userId,
          updatedByUserId: args.userId,
        },
      });

      return {
        updatedCount: 0,
        createdRuleId: created.id,
      };
    });

    console.log("Rollback GT-22 concluido com sucesso.");
    console.log(`organizationId: ${args.organizationId}`);
    console.log(`updatedCount: ${result.updatedCount}`);
    if (result.createdRuleId) {
      console.log(`createdRuleId: ${result.createdRuleId}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Falha no rollback GT-22: ${message}`);
  process.exitCode = 1;
});
