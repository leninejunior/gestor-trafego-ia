import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔍 Debug Unified API called - ENTRY POINT');
  
  try {
    console.log('🔍 Debug Unified API - Inside try block');
    
    return NextResponse.json({
      success: true,
      message: 'Debug API working',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug Unified API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}