import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * PUBLIC API - Setup first admin user
 * This API doesn't require authentication and should be removed after setup
 */
export async function POST() {
  try {
    const supabase = await createClient();

    console.log('🚀 Setting up first admin user...');

    // Get all users from auth.users (this works without authentication)
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.log('⚠️ Cannot list users, trying alternative approach');
      
      // Alternative: Create admin table and allow any user to be admin in development
      try {
        // Try to create admin_users table
        const { error: tableError } = await supabase
          .from('admin_users')
          .select('id')
          .limit(1);

        if (tableError && tableError.code === 'PGRST116') {
          return NextResponse.json({
            success: false,
            error: "Admin table doesn't exist",
            instructions: [
              "1. Go to Supabase Dashboard > SQL Editor",
              "2. Run this SQL:",
              `CREATE TABLE admin_users (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id UUID NOT NULL,
                email TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id)
              );`,
              "3. Then call this API again"
            ]
          });
        }

        return NextResponse.json({
          success: true,
          message: "Admin table exists, but cannot verify users without authentication",
          note: "Please login first, then use /api/debug/setup-admin"
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: "Cannot access database",
          details: error instanceof Error ? error.message : error
        });
      }
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No users found. Please create a user account first."
      });
    }

    // Use the first user as admin
    const firstUser = users[0];
    console.log(`👤 Setting up admin for first user: ${firstUser.email}`);

    // Try to create admin_users table and insert first user
    try {
      const { error: insertError } = await supabase
        .from('admin_users')
        .upsert({
          user_id: firstUser.id,
          email: firstUser.email,
          is_admin: true
        });

      if (insertError) {
        console.log('⚠️ Failed to insert admin user:', insertError.message);
        
        if (insertError.code === 'PGRST116') {
          return NextResponse.json({
            success: false,
            error: "Admin table doesn't exist",
            sql: `CREATE TABLE admin_users (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              user_id UUID NOT NULL,
              email TEXT NOT NULL,
              is_admin BOOLEAN DEFAULT true,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              UNIQUE(user_id)
            );`,
            instructions: [
              "1. Go to Supabase Dashboard > SQL Editor",
              "2. Run the provided SQL",
              "3. Then call this API again"
            ]
          });
        }

        throw insertError;
      }

      console.log('✅ First user added as admin');

    } catch (error) {
      console.log('⚠️ Admin table setup failed:', error);
    }

    // Also try to update user metadata
    try {
      const { error: metadataError } = await supabase.auth.admin.updateUserById(
        firstUser.id,
        {
          user_metadata: {
            ...firstUser.user_metadata,
            role: 'super_admin',
            is_admin: true
          }
        }
      );

      if (!metadataError) {
        console.log('✅ Updated user metadata with admin role');
      }
    } catch (error) {
      console.log('⚠️ User metadata update failed');
    }

    return NextResponse.json({
      success: true,
      message: "First admin user setup completed",
      user: { id: firstUser.id, email: firstUser.email },
      note: "You can now login and access admin features"
    });

  } catch (error) {
    console.error('❌ Error setting up first admin:', error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}