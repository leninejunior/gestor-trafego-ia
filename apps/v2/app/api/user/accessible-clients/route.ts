import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/prisma";
import { resolveLegacyUserScope } from "@/lib/compat/legacy-scope";

export async function GET(request: Request) {
  try {
    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (scope.organizationIds.length === 0) {
      return NextResponse.json({
        clients: [],
        count: 0,
        userId: scope.userId,
      });
    }

    const prisma = getPrismaClient();
    const clients = await prisma.client.findMany({
      where: {
        organizationId: {
          in: scope.organizationIds,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const metaConnections = clients.length
      ? await prisma.metaConnection.findMany({
          where: {
            organizationId: {
              in: scope.organizationIds,
            },
            clientId: {
              in: clients.map((client) => client.id),
            },
            provider: "meta",
            isActive: true,
          },
          select: {
            clientId: true,
          },
        })
      : [];

    const clientsWithMeta = new Set(
      metaConnections
        .map((connection) => connection.clientId)
        .filter((clientId): clientId is string => Boolean(clientId)),
    );

    const payloadClients = clients.map((client) => ({
      id: client.id,
      name: client.name,
      org_id: client.organizationId,
      has_meta_connection: clientsWithMeta.has(client.id),
    }));

    return NextResponse.json({
      clients: payloadClients,
      count: payloadClients.length,
      userId: scope.userId,
    });
  } catch (error) {
    console.error("[v2 compat][user/accessible-clients] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro ao buscar clientes acessíveis",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

