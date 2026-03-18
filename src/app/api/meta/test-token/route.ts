import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const currentToken = process.env.META_ACCESS_TOKEN;

  if (!currentToken) {
    return NextResponse.json({
      error: 'META_ACCESS_TOKEN não configurado',
      status: 'missing',
    }, { status: 400 });
  }

  try {
    // Testar token atual
    const testResponse = await axios.get('https://graph.facebook.com/v22.0/me', {
      params: {
        access_token: currentToken,
        fields: 'id,name,email'
      }
    });

    return NextResponse.json({
      status: 'valid',
      token: currentToken.substring(0, 20) + '...',
      user: testResponse.data,
      message: 'Token está válido e funcionando',
    });
  } catch (error: any) {
    console.error('Erro ao testar token:', error.response?.data || error.message);

    return NextResponse.json({
      status: 'invalid',
      error: error.response?.data?.error?.message || error.message,
      errorCode: error.response?.data?.error?.code,
      message: 'Token inválido ou expirado. Você precisa gerar um novo token.',
      instructions: [
        '1. Acesse: https://developers.facebook.com/apps/925924588141447/settings/basic',
        '2. Vá para "Tools" > "Access Token Debugger"',
        '3. Cole o token atual para verificar expiração',
        '4. Se expirado, gere um novo token em "Tools" > "Graph API Explorer"',
        '5. Atualize o .env com o novo token',
      ]
    }, { status: 400 });
  }
}
