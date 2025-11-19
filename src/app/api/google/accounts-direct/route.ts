/**
 * Google Ads Accounts API - Versão Direta (Sem Criptografia)
 * Busca contas acessíveis usando tokens diretos do banco
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/ads-api';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  console.log('[Google Accounts Direct] 🚀 INICIANDO BUSCA DE CONTAS');
  
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');

    console.log('[Google Accounts Direct] 📋 Parâmetros:', { connectionId, clientId });

    if (!connectionId || !clientId) {
      console.error('[Google Accounts Direct] ❌ PARÂMETROS FALTANDO');
      return NextResponse.json({
        success: false,
        error: 'connectionId e clientId são obrigatórios'
      }, { status: 400 });
    }

    // 1. Buscar conexão do banco
    console.log('[Google Accounts Direct] 🔍 Conectando ao Supabase...');
    const supabase = await createClient();
    console.log('[Google Accounts Direct] ✅ Conexão com Supabase estabelecida');

    console.log('[Google Accounts Direct] 🔍 Buscando conexão no banco...');
    
    const { data: connection, error: dbError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();

    console.log('[Google Accounts Direct] 📊 Resultado da busca:', { 
      hasData: !!connection, 
      hasError: !!dbError,
      connectionId,
      clientId
    });

    if (dbError || !connection) {
      console.error('[Google Accounts Direct] ❌ Erro ao buscar conexão:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Conexão não encontrada',
        details: dbError
      }, { status: 404 });
    }

    console.log('[Google Accounts Direct] ✅ Conexão encontrada:', {
      id: connection.id,
      email: connection.email,
      hasAccessToken: !!connection.access_token,
      hasRefreshToken: !!connection.refresh_token,
      tokenExpiry: connection.token_expiry,
      tokenExpiryType: typeof connection.token_expiry
    });

    // 2. Verificar se token expirou (com validação)
    console.log('[Google Accounts Direct] ⏰ Verificando expiração do token...');
    const now = new Date();
    let expiry: Date;
    let isExpired = false;
    let expiryTimestamp: number | undefined;

    console.log('[Google Accounts Direct] 📅 Token expiry original:', connection.token_expiry);

    if (connection.token_expiry) {
      expiry = new Date(connection.token_expiry);
      
      // Verificar se a data é válida
      if (isNaN(expiry.getTime())) {
        console.warn('[Google Accounts Direct] ⚠️ token_expiry inválido, assumindo expirado');
        isExpired = true;
        expiryTimestamp = undefined;
      } else {
        isExpired = now >= expiry;
        expiryTimestamp = expiry.getTime();
        console.log('[Google Accounts Direct] ⏰ Status do token:', {
          now: now.toISOString(),
          expiry: expiry.toISOString(),
          isExpired
        });
      }
    } else {
      console.warn('[Google Accounts Direct] ⚠️ token_expiry não definido, assumindo expirado');
      isExpired = true;
      expiryTimestamp = undefined;
    }

    // 3. Verificar se token expirou e fazer refresh se necessário
    let accessToken: string;
    
    if (isExpired || !connection.access_token) {
      console.log('[Google Accounts Direct] 🔄 Token expirado, fazendo refresh...');
      
      try {
        // Aqui precisamos fazer refresh do token usando o OAuth service
        console.log('[Google Accounts Direct] 🛠️ Criando cliente OAuth2...');
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
        );

        console.log('[Google Accounts Direct] 🛠️ Configurando credenciais...');
        oauth2Client.setCredentials({
          refresh_token: connection.refresh_token,
        });

        console.log('[Google Accounts Direct] 🔄 Solicitando refresh do token...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log('[Google Accounts Direct] ✅ Token refresh concluído:', {
          hasAccessToken: !!credentials.access_token,
          hasExpiryDate: !!credentials.expiry_date
        });
        
        if (!credentials.access_token) {
          console.error('[Google Accounts Direct] ❌ Não foi possível renovar access token');
          return NextResponse.json({
            success: false,
            error: 'Não foi possível renovar access token'
          }, { status: 401 });
        }
        
        accessToken = credentials.access_token;
        
        // Salvar novo token no banco
        const newExpiry = credentials.expiry_date 
          ? new Date(credentials.expiry_date).toISOString()
          : new Date(Date.now() + 3600000).toISOString(); // 1 hora
        
        console.log('[Google Accounts Direct] 💾 Salvando novo token no banco...');
        await supabase
          .from('google_ads_connections')
          .update({
            access_token: credentials.access_token,
            token_expiry: newExpiry,
            updated_at: new Date().toISOString()
          })
          .eq('id', connectionId);
        
        console.log('[Google Accounts Direct] ✅ Token renovado e salvo no banco');
        console.log('[Google Accounts Direct] 📅 Nova expiração:', newExpiry);
        
      } catch (refreshError: any) {
        console.error('[Google Accounts Direct] ❌ Erro ao renovar token:', refreshError);
        console.error('[Google Accounts Direct] ❌ Erro ao renovar token - Tipo:', typeof refreshError);
        console.error('[Google Accounts Direct] ❌ Erro ao renovar token - Mensagem:', refreshError?.message);
        console.error('[Google Accounts Direct] ❌ Erro ao renovar token - Stack:', refreshError?.stack);
        return NextResponse.json({
          success: false,
          error: 'Erro ao renovar token de acesso',
          details: refreshError.message
        }, { status: 401 });
      }
    } else {
      // Token ainda válido
      accessToken = connection.access_token;
      console.log('[Google Accounts Direct] ✅ Token ainda válido, usando existente');
    }

    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    
    console.log('[Google Accounts Direct] 🎯 Tentando buscar contas com Developer Token:', 
      developerToken ? `${developerToken.substring(0, 5)}...` : 'NÃO CONFIGURADO'
    );

    if (!developerToken) {
      console.error('[Google Accounts Direct] ❌ GOOGLE_DEVELOPER_TOKEN não configurado no .env');
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_DEVELOPER_TOKEN não configurado no .env'
      }, { status: 500 });
    }

    // Fazer requisição usando o novo cliente da API do Google Ads
    console.log('[Google Accounts Direct] 📞 Fazendo requisição à API do Google Ads usando novo cliente...');

    try {
      const googleAdsClient = getGoogleAdsClient();
      console.log('[Google Accounts Direct] 🚀 Chamando listAccessibleAccounts...');
      const accountsData = await googleAdsClient.listAccessibleAccounts(accessToken);
      
      console.log('[Google Accounts Direct] ✅ SUCESSO! Resposta da API:', accountsData);

      // Verificar se a resposta está vazia
      if (!accountsData) {
        console.warn('[Google Accounts Direct] ⚠️ Resposta da API vazia');
        return NextResponse.json({
          success: true,
          connection: {
            id: connection.id,
            email: connection.email,
            isExpired,
            tokenExpiry: connection.token_expiry
          },
          accounts: [],
          rawResponse: accountsData,
          warning: 'Nenhuma conta encontrada'
        });
      }

      // Processar os dados das contas
      const accountIds = accountsData.resourceNames || [];
      const accounts = [];
      
      // Para cada conta, buscar detalhes
      for (const accountResource of accountIds) {
        try {
          // Extrair ID da conta do resource name
          const accountId = accountResource.split('/')[1];
          
          // Buscar detalhes da conta
          const accountDetails = await googleAdsClient.getCustomerDetails(accessToken, accountId);
          accounts.push({
            customerId: accountId,
            descriptiveName: accountDetails.customer?.descriptiveName || `Conta ${accountId}`,
            currencyCode: accountDetails.customer?.currencyCode || 'USD',
            timeZone: accountDetails.customer?.timeZone || 'America/New_York',
            canManageClients: accountDetails.customer?.manager || false
          });
        } catch (accountError) {
          console.error(`[Google Accounts Direct] ❌ Erro ao buscar detalhes da conta ${accountResource}:`, accountError);
          // Adicionar conta com informações básicas mesmo assim
          const accountId = accountResource.split('/')[1];
          accounts.push({
            customerId: accountId,
            descriptiveName: `Conta ${accountId}`,
            currencyCode: 'USD',
            timeZone: 'America/New_York',
            canManageClients: false
          });
        }
      }

      return NextResponse.json({
        success: true,
        connection: {
          id: connection.id,
          email: connection.email,
          isExpired,
          tokenExpiry: connection.token_expiry
        },
        accounts: accounts,
        rawResponse: accountsData
      });

    } catch (apiError: any) {
      console.error('[Google Accounts Direct] ❌ ERRO NA API DO GOOGLE ADS:', {
        message: apiError.message,
        stack: apiError.stack,
        code: apiError.code,
        status: apiError.status
      });

      // Tratar erro específico de resposta vazia
      if (apiError.message.includes('Cannot read properties of undefined')) {
        return NextResponse.json({
          success: false,
          error: 'Erro ao processar resposta da API do Google Ads',
          details: 'A resposta da API veio vazia ou em formato inesperado',
          nextSteps: [
            '1. Verifique se o Developer Token está aprovado',
            '2. Confirme que a Google Ads API está habilitada',
            '3. Tente reconectar sua conta do Google Ads'
          ]
        }, { status: 500 });
      }

      // Tratar erro 501 especificamente
      if (apiError.message.includes('API_NOT_ENABLED') || apiError.status === 501) {
        return NextResponse.json({
          success: false,
          error: 'DEVELOPER_TOKEN_NAO_APROVADO',
          message: 'Developer Token não foi aprovado pelo Google ainda',
          details: 'O Developer Token precisa ser aprovado para acessar contas reais. Isso pode levar 24-48 horas.',
          nextSteps: [
            '1. Crie uma conta de teste do Google Ads em https://ads.google.com/',
            '2. Use essa conta para testes imediatos',
            '3. Ou aguarde a aprovação do Developer Token (24-48 horas)',
            '4. Verifique o status em: https://ads.google.com/aw/apicenter'
          ]
        }, { status: 501 });
      }

      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar contas do Google Ads',
        details: {
          message: apiError.message,
          code: apiError.code
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Google Accounts Direct] ❌ ERRO GERAL:', error);
    console.error('[Google Accounts Direct] ❌ ERRO GERAL - Tipo:', typeof error);
    console.error('[Google Accounts Direct] ❌ ERRO GERAL - Chave:', Object.keys(error || {}));
    console.error('[Google Accounts Direct] ❌ ERRO GERAL - Mensagem:', error?.message);
    console.error('[Google Accounts Direct] ❌ ERRO GERAL - Stack:', error?.stack);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro desconhecido',
      stack: error.stack,
      type: typeof error,
      keys: Object.keys(error || {})
    }, { status: 500 });
  }
}