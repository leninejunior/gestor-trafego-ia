import { getPrismaClient } from "@/lib/prisma";

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveFullName(userMetadata: unknown): string | null {
  if (!isRecord(userMetadata)) {
    return null;
  }

  return (
    asOptionalString(userMetadata["name"]) ??
    asOptionalString(userMetadata["full_name"]) ??
    null
  );
}

export async function provisionLocalUser(authUser: AuthUserLike): Promise<void> {
  const userId = authUser.id?.trim();
  if (!userId) {
    throw new Error("Supabase user id ausente para provisionamento local.");
  }

  const prisma = getPrismaClient();
  const now = new Date();
  const email = asOptionalString(authUser.email);
  const fullName = resolveFullName(authUser.user_metadata);

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      fullName,
      lastLoginAt: now,
    },
    update: {
      email,
      fullName,
      lastLoginAt: now,
    },
  });
}
