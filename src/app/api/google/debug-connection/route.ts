/**
 * Google Ads Connection Debug API
 * Endpoint para diagnosticar problemas de conexão com a API do Google Ads
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/ads-api';

export async function GET(request: NextRequest) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasDeveloperToken: !!process.env.GOOGLE_DEVELOPER_TOKEN,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    },
    database: {
      connections: 0,
      oauthStates: 0,
    },
    api: {
      status: 'unknown',
      error: null,
    }
  };

  try {
    // Verificar variáveis de ambiente
    debugInfo.environment.googleClientIdPreview = process.env.GOOGLE_CLIENT_ID ? 
      `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...` : 'NOT SET';
    debugInfo.environment.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'NOT SET';
    debugInfo.environment.developerTokenPreview = process.env.GOOGLE_DEVELOPER_TOKEN ?
      `${process.env.GOOGLE_DEVELOPER_TOKEN.substring(0, 5)}...` : 'NOT SET';

    // Verificar conexão com o banco de dados
    const supabase = await createClient();
    
    // Contar conexões do Google Ads
    const { count: connectionsCount, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('*', { count: 'exact', head: true });
    
    if (!connectionsError) {
      debugInfo.database.connections = connectionsCount || 0;
    } else {
      debugInfo.database.connectionsError = connectionsError.message;
    }
    
    // Contar estados OAuth
    const { count: oauthStatesCount, error: oauthStatesError } = await supabase
      .from('oauth_states')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'google');
    
    if (!oauthStatesError) {
      debugInfo.database.oauthStates = oauthStatesCount || 0;
    } else {
      debugInfo.database.oauthStatesError = oauthStatesError.message;
    }

    // Testar conexão com a API do Google Ads (se houver conexões)
    if (connectionsCount && connectionsCount > 0) {
      const { data: firstConnection } = await supabase
        .from('google_ads_connections')
        .select('*')
        .limit(1)
        .single();
      
      if (firstConnection && firstConnection.access_token) {
        try {
          const googleAdsClient = getGoogleAdsClient();
          const testResult = await googleAdsClient.testConnection(firstConnection.access_token);
          debugInfo.api.status = testResult.success ? 'working' : 'error';
          debugInfo.api.error = testResult.error || null;
        } catch (apiError: any) {
          debugInfo.api.status = 'error';
          debugInfo.api.error = apiError.message;
        }
      }
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error: any) {
    debugInfo.error = error.message;
    debugInfo.stack = error.stack;
    return NextResponse.json(debugInfo, { status: 500 });
  }
}