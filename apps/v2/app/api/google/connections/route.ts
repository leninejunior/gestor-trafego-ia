import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/prisma";
import { resolveLegacyUserScope } from "@/lib/compat/legacy-scope";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "clientId é obrigatório" }, { status: 400 });
    }

    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const prisma = getPrismaClient();
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: {
          in: scope.organizationIds,
        },
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const connections = await prisma.metaConnection.findMany({
      where: {
        organizationId: {
          in: scope.organizationIds,
        },
        clientId,
        provider: "google",
      },
      select: {
        id: true,
        accountId: true,
        isActive: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({
      connections: connections.map((connection) => ({
        id: connection.id,
        customer_id: connection.accountId,
        status: connection.isActive ? "active" : "inactive",
        last_sync_at: null,
        updated_at: connection.updatedAt.toISOString(),
      })),
      total: connections.length,
    });
  } catch (error) {
    console.error("[v2 compat][google/connections][GET] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const connectionId = url.searchParams.get("connectionId");

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId é obrigatório" }, { status: 400 });
    }

    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const prisma = getPrismaClient();
    const connection = await prisma.metaConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        organizationId: true,
        provider: true,
      },
    });

    if (!connection || connection.provider !== "google") {
      return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
    }

    if (!scope.organizationIds.includes(connection.organizationId)) {
      return NextResponse.json(
        {
          error: "Acesso negado: você não tem permissão para excluir conexões deste cliente",
          code: "CLIENT_ACCESS_DENIED",
        },
        { status: 403 },
      );
    }

    await prisma.metaConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({
      success: true,
      message: "Conexão excluída com sucesso",
    });
  } catch (error) {
    console.error("[v2 compat][google/connections][DELETE] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

