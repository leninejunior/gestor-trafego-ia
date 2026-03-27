import { NextRequest } from "next/server";
import { GET as listUsers } from "../route";

export async function GET(request: NextRequest) {
  return listUsers(request);
}

