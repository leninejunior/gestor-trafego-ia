import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: "User not authenticated",
        details: userError
      });
    }

    // First, check if super_admin role exists in user_roles
    const { data: superAdminRole, error: roleError } = await supabase
      .from("user_roles")
      .select("*")
      .eq("name", "super_admin")
      .single();

    let superAdminRoleId = superAdminRole?.id;

    // If super_admin role doesn't exist, create it
    if (roleError || !superAdminRole) {
      const { data: newRole, error: createRoleError } = await supabase
        .from("user_roles")
        .insert({
          name: "super_admin",
          description: "Super Administrator",
          permissions: ["system_admin", "manage_all_orgs", "manage_billing", "manage_users", "manage_clients", "manage_campaigns", "view_reports", "manage_settings"]
        })
        .select()
        .single();

      if (createRoleError) {
        return NextResponse.json({
          success: false,
          error: "Failed to create super_admin role",
          details: createRoleError
        });
      }

      superAdminRoleId = newRole.id;
    }

    // Check if user has any organization
    const { data: existingMembership, error: membershipError } = await supabase
      .from("memberships")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (membershipError || !existingMembership) {
      // Create a default organization for the user
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: "Admin Organization",
          slug: "admin-org"
        })
        .select()
        .single();

      if (orgError) {
        return NextResponse.json({
          success: false,
          error: "Failed to create organization",
          details: orgError
        });
      }

      // Create membership with super_admin role
      const { data: newMembership, error: newMembershipError } = await supabase
        .from("memberships")
        .insert({
          user_id: user.id,
          org_id: newOrg.id,
          role: "super_admin",
          role_id: superAdminRoleId,
          status: "active"
        })
        .select()
        .single();

      if (newMembershipError) {
        return NextResponse.json({
          success: false,
          error: "Failed to create membership",
          details: newMembershipError
        });
      }

      return NextResponse.json({
        success: true,
        message: "User promoted to super_admin with new organization",
        user: { id: user.id, email: user.email },
        organization: newOrg,
        membership: newMembership
      });
    } else {
      // Update existing membership to super_admin
      const { data: updatedMembership, error: updateError } = await supabase
        .from("memberships")
        .update({
          role: "super_admin",
          role_id: superAdminRoleId,
          status: "active"
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: "Failed to update membership",
          details: updateError
        });
      }

      return NextResponse.json({
        success: true,
        message: "User promoted to super_admin",
        user: { id: user.id, email: user.email },
        membership: updatedMembership
      });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}