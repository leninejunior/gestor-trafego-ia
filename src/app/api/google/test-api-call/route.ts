import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/ads-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: connection } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Verificar se o token expirou
    let accessToken = connection.access_token;
    const now = new Date();
    const tokenExpiry = new Date(connection.token_expires_at);
    const isTokenExpired = now >= tokenExpiry;

    if (isTokenExpired) {
      return NextResponse.json({ 
        error: 'Token expirado', 
        message: 'O token de acesso expirou. Por favor, reconecte sua conta do Google Ads.'
      }, { status: 401 });
    }

    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!developerToken) {
      return NextResponse.json({ 
        error: 'Developer Token não configurado',
        message: 'GOOGLE_DEVELOPER_TOKEN não está configurado no arquivo .env'
      }, { status: 500 });
    }

    // Usar o novo cliente da API do Google Ads
    const googleAdsClient = getGoogleAdsClient();
    
    try {
      const response = await googleAdsClient.listAccessibleAccounts(accessToken);
      
      return NextResponse.json({
        success: true,
        status: 200,
        response: response,
        accountsCount: response.resourceNames ? response.resourceNames.length : 0
      });
    } catch (apiError: any) {
      console.error('[Test API Call] Erro na API do Google Ads:', apiError);
      
      // Tratar erros específicos
      if (apiError.message.includes('API_NOT_ENABLED')) {
        return NextResponse.json({
          success: false,
          error: 'API_NOT_ENABLED',
          message: 'A Google Ads API não está habilitada no Google Cloud Console ou o Developer Token não foi aprovado.',
          nextSteps: [
            '1. Verifique se a Google Ads API está habilitada em https://console.cloud.google.com/apis/library/googleads.googleapis.com',
            '2. Confirme que seu Developer Token está aprovado em https://ads.google.com/aw/apicenter',
            '3. Se estiver em modo teste, use apenas contas de teste do Google Ads'
          ]
        }, { status: 501 });
      }
      
      if (apiError.message.includes('PERMISSION_DENIED')) {
        return NextResponse.json({
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Developer Token inválido ou não tem permissão para acessar a API.',
          nextSteps: [
            '1. Verifique se o Developer Token está correto',
            '2. Confirme que está aprovado em https://ads.google.com/aw/apicenter',
            '3. Se necessário, solicite aprovação do Developer Token'
          ]
        }, { status: 403 });
      }
      
      if (apiError.message.includes('UNAUTHENTICATED')) {
        return NextResponse.json({
          success: false,
          error: 'UNAUTHENTICATED',
          message: 'Token OAuth inválido ou expirado.',
          nextSteps: [
            '1. Reconecte sua conta do Google Ads',
            '2. Verifique se as permissões foram concedidas corretamente'
          ]
        }, { status: 401 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'API_ERROR',
        message: apiError.message,
        details: apiError.stack
      }, { status: 500 });
    }

  } catch (error) {
    const err = error as any;
    return NextResponse.json({
      error: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}