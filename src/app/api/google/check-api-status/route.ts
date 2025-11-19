/**
 * Verifica o status da Google Ads API
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    developerToken: {
      configured: !!process.env.GOOGLE_DEVELOPER_TOKEN,
      value: process.env.GOOGLE_DEVELOPER_TOKEN ? 
        `${process.env.GOOGLE_DEVELOPER_TOKEN.substring(0, 5)}...` : 
        'NÃO CONFIGURADO'
    },
    clientId: {
      configured: !!process.env.GOOGLE_CLIENT_ID,
      value: process.env.GOOGLE_CLIENT_ID ?
        `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` :
        'NÃO CONFIGURADO'
    },
    clientSecret: {
      configured: !!process.env.GOOGLE_CLIENT_SECRET,
      value: process.env.GOOGLE_CLIENT_SECRET ? 'CONFIGURADO' : 'NÃO CONFIGURADO'
    },
    nextSteps: [
      '1. Verifique se você tem uma conta Google Ads ativa em https://ads.google.com/',
      '2. Habilite a Google Ads API em https://console.cloud.google.com/apis/library/googleads.googleapis.com',
      '3. Verifique o status do Developer Token em https://ads.google.com/aw/apicenter',
      '4. Se o token estiver em "Test Mode", só funciona com contas de teste do Google Ads',
      '5. Para produção, solicite aprovação do Developer Token (pode levar dias)'
    ],
    commonErrors: {
      'UNIMPLEMENTED': 'Google Ads API não está habilitada OU conta não tem acesso ao Google Ads',
      'UNAUTHENTICATED': 'Token OAuth inválido ou expirado',
      'PERMISSION_DENIED': 'Developer Token inválido ou não aprovado',
      'INVALID_CUSTOMER_ID': 'Customer ID inválido ou sem acesso'
    }
  };

  return NextResponse.json(checks, { status: 200 });
}
