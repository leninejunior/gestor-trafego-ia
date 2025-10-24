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

    console.log('🚀 Setting up admin for user:', user.email);

    // Method 1: Try to create/update profiles table
    let profileSuccess = false;
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          role: 'super_admin',
          updated_at: new Date().toISOString()
        });

      if (!profileError) {
        profileSuccess = true;
        console.log('✅ Updated profiles table with admin role');
      } else {
        console.log('⚠️ Profiles table update failed:', profileError.message);
      }
    } catch (error) {
      console.log('⚠️ Profiles table not available');
    }

    // Method 2: Try to create/update memberships table
    let membershipSuccess = false;
    try {
      // First, ensure we have an organization
      let { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .limit(1);

      if (!orgsError) {
        let orgId;
        
        if (!orgs || orgs.length === 0) {
          // Create default organization
          const { data: newOrg, error: createOrgError } = await supabase
            .from('organizations')
            .insert({
              name: 'Admin Organization',
              slug: 'admin-org',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!createOrgError && newOrg) {
            orgId = newOrg.id;
            console.log('✅ Created default organization');
          }
        } else {
          orgId = orgs[0].id;
        }

        if (orgId) {
          // Create/update membership
          const { error: membershipError } = await supabase
            .from('memberships')
            .upsert({
              user_id: user.id,
              org_id: orgId,
              role: 'super_admin',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (!membershipError) {
            membershipSuccess = true;
            console.log('✅ Updated memberships table with admin role');
          } else {
            console.log('⚠️ Memberships table update failed:', membershipError.message);
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Memberships setup failed');
    }

    // Method 3: Create a simple admin flag in a custom table
    let adminFlagSuccess = false;
    try {
      const { error: adminError } = await supabase
        .from('admin_users')
        .upsert({
          user_id: user.id,
          email: user.email,
          is_admin: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (!adminError) {
        adminFlagSuccess = true;
        console.log('✅ Updated admin_users table');
      }
    } catch (error) {
      console.log('⚠️ Admin users table not available');
    }

    const successCount = [profileSuccess, membershipSuccess, adminFlagSuccess].filter(Boolean).length;

    return NextResponse.json({
      success: true,
      message: `Admin setup completed with ${successCount} methods`,
      user: { id: user.id, email: user.email },
      methods: {
        profiles: profileSuccess,
        memberships: membershipSuccess,
        adminFlag: adminFlagSuccess
      }
    });

  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}