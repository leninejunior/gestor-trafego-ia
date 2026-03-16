import { Prisma, type AnamnesisSpecialty } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { parseSpecialtyFilter } from "@/lib/anamnesis/template-payload";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 3 ? normalized : null;
}

function parseDescription(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;
  return value;
}

function responseFromError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json(
      { error: "Falha ao persistir template de anamnese." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "Erro interno ao processar template de anamnese." },
    { status: 500 },
  );
}

export async function GET(_: NextRequest, context: RouteContext) {
  const prisma = getPrismaClient();
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await context.params;

  const template = await prisma.anamnesisTemplate.findFirst({
    where: {
      id: templateId,
      tenantId: tenantContext.tenantId,
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ data: template });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const prisma = getPrismaClient();
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalido." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Payload invalido. Envie um objeto JSON." },
      { status: 400 },
    );
  }

  const existing = await prisma.anamnesisTemplate.findFirst({
    where: {
      id: templateId,
      tenantId: tenantContext.tenantId,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Template nao encontrado." }, { status: 404 });
  }

  const data: Record<string, unknown> = {
    updatedByUserId: tenantContext.userId,
  };

  if ("name" in body) {
    const name = parseName(body["name"]);
    if (!name) {
      return NextResponse.json(
        { error: "Campo name deve ter ao menos 3 caracteres." },
        { status: 400 },
      );
    }
    data.name = name;
  }

  if ("description" in body) {
    if (body["description"] === null) {
      data.description = null;
    } else {
      const description = parseDescription(body["description"]);
      if (description === null && typeof body["description"] !== "string") {
        return NextResponse.json(
          { error: "Campo description deve ser string ou null." },
          { status: 400 },
        );
      }
      data.description = description;
    }
  }

  if ("specialty" in body) {
    const specialty = parseSpecialtyFilter(
      typeof body["specialty"] === "string" ? body["specialty"] : null,
    );

    if (!specialty) {
      return NextResponse.json(
        {
          error:
            "Campo specialty invalido. Valores aceitos: ESTETICA, PSICOLOGIA, CLINICA_GERAL.",
        },
        { status: 400 },
      );
    }

    data.specialty = specialty as AnamnesisSpecialty;
  }

  if ("formSchema" in body) {
    if (!isRecord(body["formSchema"])) {
      return NextResponse.json(
        { error: "Campo formSchema deve ser um objeto JSON." },
        { status: 400 },
      );
    }
    data.formSchema = body["formSchema"] as Record<string, unknown>;
  }

  if ("isActive" in body) {
    const isActive = parseBoolean(body["isActive"]);
    if (isActive === null) {
      return NextResponse.json(
        { error: "Campo isActive deve ser boolean." },
        { status: 400 },
      );
    }
    data.isActive = isActive;
  }

  if (Object.keys(data).length === 1) {
    return NextResponse.json(
      { error: "Nenhum campo valido enviado para atualizacao." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.anamnesisTemplate.update({
      where: { id: templateId },
      data: data as any,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return responseFromError(error);
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const prisma = getPrismaClient();
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await context.params;

  const existing = await prisma.anamnesisTemplate.findFirst({
    where: {
      id: templateId,
      tenantId: tenantContext.tenantId,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Template nao encontrado." }, { status: 404 });
  }

  try {
    const archived = await prisma.anamnesisTemplate.update({
      where: { id: templateId },
      data: {
        isActive: false,
        updatedByUserId: tenantContext.userId,
      },
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    return responseFromError(error);
  }
}
