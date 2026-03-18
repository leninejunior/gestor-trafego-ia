/**
 * Callback de emergência para Google OAuth
 * Versão que força o funcionamento
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[Google Callback Emergency] 🚨 CALLBACK DE EMERGÊNCIA EXECUTADO');
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    console.log('[Google Callback Emergency] - Code:', !!code);
    console.log('[Google Callback Emergency] - Error:', error);
    console.log('[Google Callback Emergency] - State:', state);
    
    // Criar resposta HTML que força redirecionamento via JavaScript
    const redirectUrl = error 
      ? `/google/select-accounts?error=oauth_error&message=${encodeURIComponent(error)}`
      : `/google/select-accounts?code=${code}&state=${state}`;
    
    console.log('[Google Callback Emergency] 🔄 FORÇANDO REDIRECIONAMENTO PARA:', redirectUrl);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Redirecionando...</title>
    <meta charset="utf-8">
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h2>🔄 Processando OAuth...</h2>
        <p>Redirecionando automaticamente...</p>
        <script>
            console.log('Forçando redirecionamento para: ${redirectUrl}');
            window.location.href = '${redirectUrl}';
        </script>
    </div>
</body>
</html>`;
    
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
    
  } catch (error: any) {
    console.error('[Google Callback Emergency] ❌ ERRO:', error);
    
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Erro OAuth</title>
    <meta charset="utf-8">
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h2>❌ Erro no OAuth</h2>
        <p>Redirecionando para página de erro...</p>
        <script>
            window.location.href = '/google/select-accounts?error=callback_error&message=${encodeURIComponent(error.message)}';
        </script>
    </div>
</body>
</html>`;
    
    return new NextResponse(errorHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}