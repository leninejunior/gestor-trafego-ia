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

    console.log('🚀 Testing admin setup for user:', user.email);

    // Insert/update current user as admin in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .upsert({
        user_id: user.id,
        email: user.email,
        is_admin: true,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (adminError) {
      return NextResponse.json({
        success: false,
        error: "Failed to set admin status",
        details: adminError
      });
    }

    // Test the admin auth middleware
    const { checkAdminAuth } = await import('@/lib/middleware/admin-auth-improved');
    const authResult = await checkAdminAuth();

    return NextResponse.json({
      success: true,
      message: "Admin setup completed successfully!",
      user: { id: user.id, email: user.email },
      adminUser: adminUser,
      authTest: authResult
    });

  } catch (error) {
    console.error('❌ Error testing admin setup:', error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}

export async function GET() {
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
        error: "User not authenticated"
      });
    }

    // Check if user is admin in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Test the admin auth middleware
    const { checkAdminAuth } = await import('@/lib/middleware/admin-auth-improved');
    const authResult = await checkAdminAuth();

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      adminUser: adminUser,
      adminError: adminError,
      authTest: authResult
    });

  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}