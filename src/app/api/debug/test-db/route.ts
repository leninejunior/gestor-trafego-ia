import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Test 1: Check user authentication
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

    // Test 2: Check if organizations table exists and is accessible
    const { data: orgsTest, error: orgsError } = await supabase
      .from("organizations")
      .select("count")
      .limit(1);

    if (orgsError) {
      return NextResponse.json({
        success: false,
        error: "Cannot access organizations table",
        details: orgsError,
        user: { id: user.id, email: user.email }
      });
    }

    // Test 3: Check if memberships table exists and is accessible
    const { data: membershipsTest, error: membershipsError } = await supabase
      .from("memberships")
      .select("count")
      .limit(1);

    if (membershipsError) {
      return NextResponse.json({
        success: false,
        error: "Cannot access memberships table",
        details: membershipsError,
        user: { id: user.id, email: user.email }
      });
    }

    // Test 4: Try to get user's membership
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      membership: membership,
      membershipError: membershipError,
      tests: {
        organizations: "accessible",
        memberships: "accessible"
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error
    });
  }
}