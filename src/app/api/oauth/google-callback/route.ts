/**
 * Callback alternativo para Google OAuth
 * Rota diferente para evitar interceptação
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[OAuth Google Callback] 🚨 CALLBACK ALTERNATIVO EXECUTADO');
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    console.log('[OAuth Google Callback] - Code:', !!code);
    console.log('[OAuth Google Callback] - Error:', error);
    console.log('[OAuth Google Callback] - State:', state);
    
    // Determinar URL de redirecionamento
    const redirectUrl = error 
      ? `/google/select-accounts?error=oauth_error&message=${encodeURIComponent(error)}`
      : `/google/select-accounts?code=${code}&state=${state}`;
    
    console.log('[OAuth Google Callback] 🔄 REDIRECIONANDO PARA:', redirectUrl);
    
    // Retornar HTML que força redirecionamento via JavaScript
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Processando OAuth Google...</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center; 
            padding: 50px 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            background: rgba(255, 255, 255, 0.95); 
            color: #333;
            padding: 40px; 
            border-radius: 12px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.2); 
            max-width: 400px; 
            width: 100%;
        }
        .spinner { 
            border: 4px solid #f3f3f3; 
            border-top: 4px solid #4285f4; 
            border-radius: 50%; 
            width: 50px; 
            height: 50px; 
            animation: spin 1s linear infinite; 
            margin: 20px auto; 
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }
        .logo {
            font-size: 24px;
            margin-bottom: 20px;
        }
        .link {
            color: #4285f4;
            text-decoration: none;
            font-weight: 500;
        }
        .link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔗 Google OAuth</div>
        <div class="spinner"></div>
        <h2>Processando autenticação...</h2>
        <p>Redirecionando automaticamente...</p>
        <p><small>Se não redirecionar em 3 segundos, <a href="${redirectUrl}" class="link">clique aqui</a></small></p>
    </div>
    
    <script>
        console.log('🚨 CALLBACK ALTERNATIVO - Redirecionando para: ${redirectUrl}');
        
        let redirected = false;
        
        function doRedirect() {
            if (redirected) return;
            redirected = true;
            
            try {
                console.log('Executando redirecionamento...');
                window.location.href = '${redirectUrl}';
            } catch (e) {
                console.error('Erro no redirecionamento:', e);
                try {
                    window.location.replace('${redirectUrl}');
                } catch (e2) {
                    console.error('Erro no replace:', e2);
                    // Fallback - mostrar link manual
                    document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h2>Redirecionamento manual necessário</h2><p><a href="${redirectUrl}">Clique aqui para continuar</a></p></div>';
                }
            }
        }
        
        // Múltiplas tentativas de redirecionamento
        setTimeout(doRedirect, 500);
        setTimeout(doRedirect, 1500);
        setTimeout(doRedirect, 3000);
        
        // Imediato também
        doRedirect();
    </script>
</body>
</html>`;
    
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
    
  } catch (error: any) {
    console.error('[OAuth Google Callback] ❌ ERRO:', error);
    
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