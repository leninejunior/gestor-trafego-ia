import { NextResponse } from "next/server";

import { getPrismaClient } from "@/lib/prisma";
import { resolveLegacyUserScope } from "@/lib/compat/legacy-scope";

function mapLegacyRole(role: "MASTER" | "REGULAR" | "CLIENT" | null): string {
  if (role === "MASTER") return "org_admin";
  if (role === "REGULAR") return "editor";
  return "viewer";
}

function resolveDisplayName(
  fullName: string | null,
  userMetadata: unknown,
  email: string | null,
): string {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }

  if (typeof userMetadata === "object" && userMetadata !== null) {
    const metadata = userMetadata as Record<string, unknown>;
    const name = typeof metadata["full_name"] === "string"
      ? metadata["full_name"]
      : typeof metadata["name"] === "string"
        ? metadata["name"]
        : null;

    if (name && name.trim().length > 0) {
      return name.trim();
    }
  }

  if (email && email.trim().length > 0) {
    return email.trim();
  }

  return "Usuário";
}

export async function GET(request: Request) {
  try {
    const scope = await resolveLegacyUserScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const prisma = getPrismaClient();
    const [userRecord, membership] = await Promise.all([
      prisma.user.findUnique({
        where: { id: scope.userId },
        select: { email: true, fullName: true },
      }),
      prisma.membership.findFirst({
        where: {
          userId: scope.userId,
          isActive: true,
          organizationId: {
            in: scope.organizationIds,
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "desc" }],
        select: {
          role: true,
          organizationId: true,
        },
      }),
    ]);

    const organization = membership
      ? await prisma.organization.findUnique({
          where: { id: membership.organizationId },
          select: { name: true },
        })
      : null;

    const email = userRecord?.email ?? scope.user.email ?? "";
    const displayName = resolveDisplayName(
      userRecord?.fullName ?? null,
      scope.user.user_metadata,
      email,
    );

    return NextResponse.json({
      email,
      displayName,
      orgName: organization?.name ?? "Minha Organização",
      role: mapLegacyRole(membership?.role ?? null),
      planName: "Pro Plan",
    });
  } catch (error) {
    console.error("[v2 compat][user/info] Erro ao buscar info do usuário:", error);
    return NextResponse.json(
      {
        email: "Usuário",
        orgName: "Organização",
        role: "viewer",
        planName: "Free",
      },
      { status: 200 },
    );
  }
}

