import { Prisma, type AnamnesisSpecialty } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  parseSpecialtyFilter,
  parseTemplatePayload,
} from "@/lib/anamnesis/template-payload";
import { getTenantContext } from "@/lib/auth/tenant-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function responseFromError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json(
      { error: "Falha ao persistir template de anamnese." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "Erro interno ao processar templates de anamnese." },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  const prisma = getPrismaClient();
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const specialtyRaw = request.nextUrl.searchParams.get("specialty");
  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "true";
  const specialty = parseSpecialtyFilter(specialtyRaw);

  if (specialtyRaw && !specialty) {
    return NextResponse.json(
      {
        error:
          "Filtro specialty invalido. Use ESTETICA, PSICOLOGIA ou CLINICA_GERAL.",
      },
      { status: 400 },
    );
  }

  try {
    const templates = await prisma.anamnesisTemplate.findMany({
      where: {
        tenantId: tenantContext.tenantId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(specialty ? { specialty: specialty as AnamnesisSpecialty } : {}),
      },
      orderBy: [{ specialty: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    return responseFromError(error);
  }
}

export async function POST(request: NextRequest) {
  const prisma = getPrismaClient();
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalido." },
      { status: 400 },
    );
  }

  const parsed = parseTemplatePayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const created = await prisma.anamnesisTemplate.create({
      data: {
        tenantId: tenantContext.tenantId,
        specialty: parsed.data.specialty as AnamnesisSpecialty,
        name: parsed.data.name,
        description: parsed.data.description,
        formSchema: parsed.data.formSchema as Prisma.InputJsonValue,
        isActive: parsed.data.isActive,
        createdByUserId: tenantContext.userId,
        updatedByUserId: tenantContext.userId,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return responseFromError(error);
  }
}
