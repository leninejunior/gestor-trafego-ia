import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
        error: "User not authenticated",
        details: userError
      });
    }

    // Check if profiles table exists and get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Also check if the profiles table exists at all
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from("profiles")
      .select("id, role")
      .limit(5);

    return NextResponse.json({
      success: true,
      user: { 
        id: user.id, 
        email: user.email,
        created_at: user.created_at
      },
      profile: profile,
      profileError: profileError,
      allProfiles: allProfiles,
      allProfilesError: allProfilesError
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}