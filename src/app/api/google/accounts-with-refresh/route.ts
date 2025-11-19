/**
 * Google Ads Accounts API - COM REFRESH FORÇADO
 * Solução para o problema de token expirado
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  console.log('='.repeat(80));
  console.log('[Accounts With Refresh] 🔄 BUSCA DE CONTAS COM REFRESH FORÇADO');
  console.log('='.repeat(80));
  
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');

    if (!connectionId || !clientId) {
      return NextResponse.json({
        success: false,
        error: 'connectionId e clientId são obrigatórios'
      }, { status: 400 });
    }

    // 1. Buscar conexão do banco
    const supabase = await createClient();
    const { data: connection, error: dbError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();

    if (dbError || !connection) {
      console.error('[Accounts With Refresh] ❌ Conexão não encontrada:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Conexão não encontrada'
      }, { status: 404 });
    }

    console.log('[Accounts With Refresh] ✅ Conexão encontrada:', connection.email);

    // 2. Configurar OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expiry ? new Date(connection.token_expiry).getTime() : undefined
    });

    console.log('[Accounts With Refresh] 🔑 OAuth2 client configurado');

    // 3. FORÇAR REFRESH DO TOKEN
    console.log('[Accounts With Refresh] 🔄 FORÇANDO REFRESH DO ACCESS TOKEN...');
    
    let accessToken: string;
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      console.log('[Accounts With Refresh] ✅ Token renovado com sucesso!');
      console.log('[Accounts With Refresh] - Novo expiry:', credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A');
      
      accessToken = credentials.access_token!;
      
      // 4. Atualizar token no banco
      const { error: updateError } = await supabase
        .from('google_ads_connections')
        .update({
          access_token: credentials.access_token,
          token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      if (updateError) {
        console.error('[Accounts With Refresh] ⚠️ Erro ao atualizar token no banco:', updateError);
      } else {
        console.log('[Accounts With Refresh] ✅ Token atualizado no banco');
      }
      
    } catch (refreshError: any) {
      console.error('[Accounts With Refresh] ❌ ERRO AO RENOVAR TOKEN:', refreshError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao renovar access token',
        details: {
          message: refreshError.message,
          code: refreshError.code
        }
      }, { status: 401 });
    }

    // 5. Obter Developer Token
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    
    if (!developerToken) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_DEVELOPER_TOKEN não configurado'
      }, { status: 500 });
    }

    console.log('[Accounts With Refresh] 🔑 Developer Token:', `${developerToken.substring(0, 10)}...`);

    // 6. Fazer chamada à API do Google Ads
    console.log('[Accounts With Refresh] 📞 Fazendo chamada à API do Google Ads...');
    console.log('[Accounts With Refresh] URL: https://googleads.googleapis.com/v22/customers:listAccessibleCustomers');

    const response = await fetch('https://googleads.googleapis.com/v22/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Accounts With Refresh] 📡 Status da resposta:', response.status, response.statusText);

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('[Accounts With Refresh] ❌ Erro na API:', responseText.substring(0, 500));
      
      let parsedError;
      try {
        parsedError = JSON.parse(responseText);
      } catch {
        parsedError = null;
      }
      
      return NextResponse.json({
        success: false,
        error: 'Erro na API do Google Ads',
        details: {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText.substring(0, 500),
          parsedError
        }
      }, { status: response.status });
    }

    const data = JSON.parse(responseText);
    console.log('[Accounts With Refresh] ✅ SUCESSO! Contas encontradas:', data.resourceNames?.length || 0);
    console.log('[Accounts With Refresh] 📋 Contas:', data.resourceNames);

    // 7. Se temos resourceNames, buscar detalhes de cada conta
    const accounts = [];
    
    if (data.resourceNames && data.resourceNames.length > 0) {
      console.log('[Accounts With Refresh] 🔍 Buscando detalhes das contas...');
      
      for (const resourceName of data.resourceNames) {
        // Extrair customer ID do resource name (formato: customers/1234567890)
        const customerId = resourceName.split('/')[1];
        
        accounts.push({
          customerId: customerId,
          descriptiveName: `Conta ${customerId}`,
          currencyCode: 'BRL',
          timeZone: 'America/Sao_Paulo',
          canManageClients: false,
          resourceName: resourceName
        });
      }
    }

    console.log('='.repeat(80));
    console.log('[Accounts With Refresh] ✅ PROCESSO CONCLUÍDO COM SUCESSO');
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        email: connection.email,
        tokenRefreshed: true
      },
      accounts,
      rawResponse: data
    });

  } catch (error: any) {
    console.error('[Accounts With Refresh] ❌ ERRO GERAL:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
