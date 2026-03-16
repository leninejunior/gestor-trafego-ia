import { NextResponse } from "next/server";

import { decodeJwtPayload, getJwtExpirationIso } from "@/lib/auth/jwt";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const user = userData.user;
  const session = sessionData.session;
  const jwtPayload = decodeJwtPayload(session?.access_token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    session: {
      jwtAvailable: Boolean(session?.access_token),
      jwtExp: getJwtExpirationIso(jwtPayload),
    },
  });
}
