import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { canonicalRoleFromInput, getRoleCatalog, requireAdminAccess } from "@/lib/access/admin-rbac";

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  const allRoles = await getRoleCatalog();
  if (context.isMaster || context.isSuperUser) {
    return NextResponse.json({ roles: allRoles });
  }

  const filteredRoles = allRoles.filter((role) => {
    const canonical = canonicalRoleFromInput(role.name);
    return canonical === "org_admin" || canonical === "org_user";
  });

  return NextResponse.json({ roles: filteredRoles });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireAdminAccess(request);
  if (!context) {
    return errorResponse!;
  }

  if (!context.canManageRoles) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const permissions = body.permissions;

  if (!name) {
    return NextResponse.json({ error: "Role name is required" }, { status: 400 });
  }

  if (permissions == null || (!Array.isArray(permissions) && typeof permissions !== "object")) {
    return NextResponse.json({ error: "Permissions must be an array or object" }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();
  const { data: existing } = await serviceSupabase.from("user_roles").select("id").ilike("name", name).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Role already exists" }, { status: 400 });
  }

  const { data, error } = await serviceSupabase
    .from("user_roles")
    .insert({
      name,
      description,
      permissions,
      is_system_role: false,
    })
    .select("id,name,description,permissions,is_system_role,created_at")
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to create role", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }

  return NextResponse.json(
    {
      message: "Role created successfully",
      role: data,
    },
    { status: 201 }
  );
}
