/**
 * Endpoint de teste para verificar se redirects com parâmetros funcionam
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('testId') || 'test-' + Math.random().toString(36).substring(7);
  
  console.log('[Test Redirect] 🧪 TESTANDO REDIRECT COM PARÂMETROS');
  console.log('[Test Redirect] - Test ID:', testId);
  console.log('[Test Redirect] - Timestamp:', new Date().toISOString());
  
  // Criar URL de redirect com parâmetros
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUrl = new URL('/google/test-redirect-result', appUrl);
  redirectUrl.searchParams.set('testId', testId);
  redirectUrl.searchParams.set('timestamp', new Date().toISOString());
  redirectUrl.searchParams.set('connectionId', 'conn-' + Math.random().toString(36).substring(7));
  redirectUrl.searchParams.set('clientId', 'client-' + Math.random().toString(36).substring(7));
  
  console.log('[Test Redirect] 🎯 REDIRECIONANDO PARA:', redirectUrl.toString());
  console.log('[Test Redirect] - Parâmetros:', Object.fromEntries(redirectUrl.searchParams.entries()));
  
  return NextResponse.redirect(redirectUrl, { status: 302 });
}
