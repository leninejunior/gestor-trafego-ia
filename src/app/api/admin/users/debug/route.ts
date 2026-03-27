import { NextRequest, NextResponse } from "next/server";
import { GET as listUsers } from "../route";

export async function GET(request: NextRequest) {
  const response = await listUsers(request);
  if (!response.ok) {
    return response;
  }

  const payload = await response.json();
  return NextResponse.json({
    ...payload,
    debug: {
      endpoint: "/api/admin/users/debug",
      delegatedTo: "/api/admin/users",
      timestamp: new Date().toISOString(),
    },
  });
}

