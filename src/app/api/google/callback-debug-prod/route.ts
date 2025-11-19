/**
 * Debug Callback - Para diagnosticar problemas em produção
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    url: request.url,
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    host: request.headers.get('host'),
    userAgent: request.headers.get('user-agent'),
    allParams: Object.fromEntries(searchParams.entries()),
    code: searchParams.get('code') ? 'PRESENT' : 'MISSING',
    state: searchParams.get('state') ? 'PRESENT' : 'MISSING',
    error: searchParams.get('error'),
    errorDescription: searchParams.get('error_description'),
  };

  console.log('[Callback Debug] 🔍 INFORMAÇÕES DE DEBUG:', JSON.stringify(debugInfo, null, 2));

  return NextResponse.json(debugInfo, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
