/**
 * Google Ads Connection Diagnostic
 * Diagnoses connection issues with Google Ads API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasDeveloperToken: !!process.env.GOOGLE_DEVELOPER_TOKEN,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      clientIdPreview: process.env.GOOGLE_CLIENT_ID ? 
        `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'NOT SET',
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
      developerTokenPreview: process.env.GOOGLE_DEVELOPER_TOKEN ?
        `${process.env.GOOGLE_DEVELOPER_TOKEN.substring(0, 5)}...` : 'NOT SET'
    },
    database: {
      oauthStatesTable: 'Checking...',
      googleConnectionsTable: 'Checking...',
      connectionCount: 0
    },
    commonIssues: {
      developerTokenNotApproved: 'O Developer Token precisa ser aprovado pelo Google (pode levar 24-48h)',
      apiNotEnabled: 'A Google Ads API precisa estar habilitada no Google Cloud Console',
      invalidCredentials: 'Verifique se as credenciais estão corretamente configuradas',
      testAccountOnly: 'Se o Developer Token está em modo teste, só funciona com contas de teste'
    },
    nextSteps: [
      '1. Verifique o status do Developer Token em https://ads.google.com/aw/apicenter',
      '2. Habilite a Google Ads API em https://console.cloud.google.com/apis/library/googleads.googleapis.com',
      '3. Confirme que as variáveis de ambiente estão corretamente configuradas',
      '4. Se o Developer Token está em "Test Mode", use apenas contas de teste do Google Ads'
    ]
  };

  try {
    // Verificar conexão com o banco de dados
    const supabase = await createClient();
    
    // Verificar tabela oauth_states
    const { data: oauthStates, error: oauthError } = await supabase
      .from('oauth_states')
      .select('id')
      .limit(1);
    
    diagnostics.database.oauthStatesTable = oauthError ? 
      `❌ Error: ${oauthError.message}` : '✅ OK';
    
    // Verificar tabela google_ads_connections
    const { data: connections, error: connError } = await supabase
      .from('google_ads_connections')
      .select('id');
    
    diagnostics.database.googleConnectionsTable = connError ? 
      `❌ Error: ${connError.message}` : '✅ OK';
    diagnostics.database.connectionCount = connections ? connections.length : 0;
    
  } catch (error) {
    diagnostics.database.oauthStatesTable = `❌ Error: ${error.message}`;
    diagnostics.database.googleConnectionsTable = `❌ Error: ${error.message}`;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}