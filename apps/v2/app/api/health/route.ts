import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "flying-fox-v2",
    timestamp: new Date().toISOString(),
  });
}
