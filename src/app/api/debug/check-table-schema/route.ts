import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    console.log('🔍 Checking subscription_plans table schema...');

    // Try to get table structure by selecting all columns from an empty result
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error querying table:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    // Get the first row to see the actual column structure
    const sampleRow = data && data.length > 0 ? data[0] : null;
    const columns = sampleRow ? Object.keys(sampleRow) : [];

    console.log('✅ Table columns found:', columns);

    // Also try to get all rows to see what data exists
    const { data: allData, error: allError } = await supabase
      .from('subscription_plans')
      .select('*');

    return NextResponse.json({
      success: true,
      tableExists: !error,
      columns: columns,
      sampleRow: sampleRow,
      totalRows: allData ? allData.length : 0,
      allData: allData,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details
      } : null
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: "Unexpected error",
      details: error instanceof Error ? error.message : error
    });
  }
}