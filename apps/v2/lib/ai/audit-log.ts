import type { Prisma, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";

export type AiApiAuditEvent = {
  organizationId: string;
  keyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  scope: string;
  filters?: Record<string, unknown>;
  rateLimited?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  errorMessage?: string | null;
};

type AuditPrismaClient = Pick<PrismaClient, "aiApiAuditLog">;

function asOptionalString(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asJsonInput(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function logAiApiAuditEvent(
  event: AiApiAuditEvent,
  prisma?: AuditPrismaClient,
) {
  try {
    const client = prisma ?? getPrismaClient();

    await client.aiApiAuditLog.create({
      data: {
        organizationId: event.organizationId,
        keyId: event.keyId,
        endpoint: event.endpoint,
        method: event.method,
        statusCode: event.statusCode,
        scope: event.scope,
        filters: asJsonInput(event.filters),
        rateLimited: Boolean(event.rateLimited),
        ipAddress: asOptionalString(event.ipAddress),
        userAgent: asOptionalString(event.userAgent),
        requestId: asOptionalString(event.requestId),
        errorMessage: asOptionalString(event.errorMessage),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Auditoria nao pode derrubar a resposta da API.
    console.error(`[ai-audit] Falha ao registrar auditoria: ${message}`);
  }
}
