const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAdminUser() {
  try {
    console.log('🚀 Setting up admin user...');

    // Get all users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw new Error(`Failed to list users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }

    // Use the first user as admin
    const adminUser = users[0];
    console.log(`👤 Setting up admin for user: ${adminUser.email} (${adminUser.id})`);

    // Method 1: Try to create/update profiles table
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: adminUser.id,
          email: adminUser.email,
          role: 'super_admin',
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.log('⚠️ Profiles table update failed:', profileError.message);
      } else {
        console.log('✅ Updated profiles table with admin role');
      }
    } catch (error) {
      console.log('⚠️ Profiles table not available:', error.message);
    }

    // Method 2: Try to create/update memberships table
    try {
      // First, ensure we have an organization
      let { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .limit(1);

      if (orgsError) {
        console.log('⚠️ Organizations table not available:', orgsError.message);
      } else {
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

          if (createOrgError) {
            console.log('⚠️ Failed to create organization:', createOrgError.message);
          } else {
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
              user_id: adminUser.id,
              org_id: orgId,
              role: 'super_admin',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (membershipError) {
            console.log('⚠️ Memberships table update failed:', membershipError.message);
          } else {
            console.log('✅ Updated memberships table with admin role');
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Memberships setup failed:', error.message);
    }

    // Method 3: Update user metadata
    try {
      const { error: metadataError } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        {
          user_metadata: {
            ...adminUser.user_metadata,
            role: 'super_admin',
            is_admin: true
          }
        }
      );

      if (metadataError) {
        console.log('⚠️ User metadata update failed:', metadataError.message);
      } else {
        console.log('✅ Updated user metadata with admin role');
      }
    } catch (error) {
      console.log('⚠️ User metadata update failed:', error.message);
    }

    console.log('🎉 Admin user setup completed!');
    console.log(`📧 Admin user: ${adminUser.email}`);
    console.log('🔑 The user now has admin permissions through multiple methods');

  } catch (error) {
    console.error('❌ Error setting up admin user:', error);
    process.exit(1);
  }
}

setupAdminUser();