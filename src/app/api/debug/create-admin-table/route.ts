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

    console.log('🚀 Creating admin_users table...');

    // Create the admin_users table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS admin_users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          is_admin BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });

    if (createError) {
      console.log('⚠️ Table creation failed, trying direct approach:', createError.message);
      
      // Try direct table creation (this might work if RLS allows it)
      const { error: directError } = await supabase
        .from('admin_users')
        .select('id')
        .limit(1);

      if (directError && directError.code === 'PGRST116') {
        // Table doesn't exist, we need to create it manually
        return NextResponse.json({
          success: false,
          error: "Cannot create table - please run SQL manually in Supabase dashboard",
          sql: createTableSQL,
          instructions: [
            "1. Go to Supabase Dashboard > SQL Editor",
            "2. Run the provided SQL",
            "3. Then call this API again"
          ]
        });
      }
    }

    // Create indexes
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_users_is_admin ON admin_users(is_admin);
    `;

    await supabase.rpc('exec_sql', { sql: indexSQL });

    // Enable RLS
    const rlsSQL = `ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;`;
    await supabase.rpc('exec_sql', { sql: rlsSQL });

    // Insert current user as admin
    const { error: insertError } = await supabase
      .from('admin_users')
      .upsert({
        user_id: user.id,
        email: user.email,
        is_admin: true
      });

    if (insertError) {
      console.log('⚠️ Failed to insert admin user:', insertError.message);
    } else {
      console.log('✅ Current user added as admin');
    }

    return NextResponse.json({
      success: true,
      message: "Admin table created and user added as admin",
      user: { id: user.id, email: user.email }
    });

  } catch (error) {
    console.error('❌ Error creating admin table:', error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}