import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/prisma";
import { resolveLegacyUserScope } from "@/lib/compat/legacy-scope";

function toLegacyClientPayload(client: {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
}) {
  return {
    id: client.id,
    name: client.name,
    org_id: client.organizationId,
    created_at: client.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (scope.organizationIds.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    const url = new URL(request.url);
    const includeGoogleConnections =
      url.searchParams.get("includeGoogleConnections") === "true";

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
        createdAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    if (!includeGoogleConnections || clients.length === 0) {
      return NextResponse.json({
        clients: clients.map(toLegacyClientPayload),
      });
    }

    const googleConnections = await prisma.metaConnection.findMany({
      where: {
        provider: "google",
        isActive: true,
        organizationId: {
          in: scope.organizationIds,
        },
        clientId: {
          in: clients.map((client) => client.id),
        },
      },
      select: {
        id: true,
        clientId: true,
        accountId: true,
        updatedAt: true,
        isActive: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const grouped = new Map<
      string,
      Array<{
        id: string;
        customer_id: string;
        status: "active" | "inactive";
        last_sync_at: null;
        updated_at: string;
      }>
    >();

    for (const connection of googleConnections) {
      if (!connection.clientId) continue;
      const current = grouped.get(connection.clientId) ?? [];
      current.push({
        id: connection.id,
        customer_id: connection.accountId,
        status: connection.isActive ? "active" : "inactive",
        last_sync_at: null,
        updated_at: connection.updatedAt.toISOString(),
      });
      grouped.set(connection.clientId, current);
    }

    return NextResponse.json({
      clients: clients.map((client) => ({
        ...toLegacyClientPayload(client),
        googleConnections: grouped.get(client.id) ?? [],
      })),
    });
  } catch (error) {
    console.error("[v2 compat][clients][GET] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Nome do cliente é obrigatório" }, { status: 400 });
    }

    const organizationId = scope.organizationIds[0];
    if (!organizationId) {
      return NextResponse.json(
        { error: "Usuário sem organização ativa para criar cliente" },
        { status: 403 },
      );
    }

    const prisma = getPrismaClient();
    const created = await prisma.client.create({
      data: {
        name,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: "Cliente criado com sucesso",
      client: toLegacyClientPayload(created),
    });
  } catch (error) {
    console.error("[v2 compat][clients][POST] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get("id");
    if (!clientId) {
      return NextResponse.json({ error: "ID do cliente é obrigatório" }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const existing = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    if (!scope.organizationIds.includes(existing.organizationId)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    await prisma.client.delete({
      where: { id: clientId },
    });

    return NextResponse.json({
      message: "Cliente excluído com sucesso",
      clientName: existing.name,
    });
  } catch (error) {
    console.error("[v2 compat][clients][DELETE] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

