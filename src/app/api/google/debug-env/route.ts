/**
 * Google Ads Environment Debug API
 * Endpoint para diagnosticar problemas de variáveis de ambiente
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[Google Env Debug] 🚀 Iniciando diagnóstico de ambiente');
  
  const envInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'CONFIGURADO' : 'NÃO CONFIGURADO',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'CONFIGURADO' : 'NÃO CONFIGURADO',
      GOOGLE_DEVELOPER_TOKEN: process.env.GOOGLE_DEVELOPER_TOKEN ? 'CONFIGURADO' : 'NÃO CONFIGURADO',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NÃO CONFIGURADO',
    },
    values: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : null,
      GOOGLE_DEVELOPER_TOKEN: process.env.GOOGLE_DEVELOPER_TOKEN ? `${process.env.GOOGLE_DEVELOPER_TOKEN.substring(0, 5)}...` : null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    }
  };

  console.log('[Google Env Debug] 📋 Informações de ambiente:', envInfo);
  
  return NextResponse.json(envInfo, { status: 200 });
}