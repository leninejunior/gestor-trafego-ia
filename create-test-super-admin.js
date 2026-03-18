/**
 * Create Test Super Admin User
 * Creates a super admin user for testing purposes
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestSuperAdmin() {
  try {
    console.log('🚀 Creating test super admin user...');
    
    // First, check if we have any existing users
    const { data: existingUsers, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Failed to list users:', usersError);
      return;
    }
    
    console.log(`📊 Found ${existingUsers.users.length} existing users`);
    
    // Use the first existing user as super admin, or create one
    let testUserId;
    
    if (existingUsers.users.length > 0) {
      testUserId = existingUsers.users[0].id;
      console.log(`👤 Using existing user as super admin: ${testUserId}`);
    } else {
      // Create a test user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'test-super-admin@example.com',
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: {
          name: 'Test Super Admin'
        }
      });
      
      if (createError) {
        console.error('❌ Failed to create test user:', createError);
        return;
      }
      
      testUserId = newUser.user.id;
      console.log(`👤 Created new test user: ${testUserId}`);
    }
    
    // Add user to super_admins table
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('super_admins')
      .insert({
        user_id: testUserId,
        created_by: testUserId
      })
      .select()
      .single();
    
    if (superAdminError) {
      if (superAdminError.code === '23505') {
        console.log('✅ User is already a super admin');
      } else {
        console.error('❌ Failed to create super admin:', superAdminError);
        return;
      }
    } else {
      console.log('✅ Super admin created successfully:', superAdmin.id);
    }
    
    // Verify the super admin was created
    const { data: verification, error: verifyError } = await supabase
      .from('super_admins')
      .select('*')
      .eq('user_id', testUserId)
      .single();
    
    if (verifyError) {
      console.error('❌ Failed to verify super admin:', verifyError);
    } else {
      console.log('✅ Super admin verification successful');
      console.log('📋 Super admin details:');
      console.log(`   ID: ${verification.id}`);
      console.log(`   User ID: ${verification.user_id}`);
      console.log(`   Active: ${verification.is_active}`);
      console.log(`   Created: ${verification.created_at}`);
    }
    
    console.log('🎉 Test super admin setup completed!');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the script
createTestSuperAdmin();