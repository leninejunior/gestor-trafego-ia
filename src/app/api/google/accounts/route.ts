/**
 * Google Ads Accounts API - Versão Completa com Dados Reais
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleAdsClient } from '@/lib/google/client';

export async function GET(request: NextRequest) {
  console.log('[Google Accounts API] 🔍 BUSCANDO CONTAS GOOGLE ADS REAIS');
  
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');
    
    console.log('[Google Accounts API] - Connection ID:', connectionId);
    console.log('[Google Accounts API] - Client ID:', clientId);
    
    // Verificar se parâmetros são válidos
    if (!connectionId || !clientId) {
      console.log('[Google Accounts API] ❌ PARÂMETROS INVÁLIDOS');
      return NextResponse.json(
        { error: 'Parâmetros connectionId e clientId são obrigatórios' },
        { status: 400 }
      );
    }
    

    
    // Buscar conexão real no banco
    console.log('[Google Accounts API] 🔍 BUSCANDO CONEXÃO NO BANCO...');
    const supabase = await createClient();
    
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single();
    
    if (connectionError || !connection) {
      console.error('[Google Accounts API] ❌ CONEXÃO NÃO ENCONTRADA:', connectionError);
      return NextResponse.json(
        { error: 'Conexão não encontrada ou inativa' },
        { status: 404 }
      );
    }
    
    console.log('[Google Accounts API] ✅ CONEXÃO ENCONTRADA:', {
      id: connection.id,
      hasAccessToken: !!connection.access_token,
      hasRefreshToken: !!connection.refresh_token,
      expiresAt: connection.token_expires_at
    });
    
    // Verificar se token ainda é válido
    const tokenExpiry = new Date(connection.token_expires_at);
    const now = new Date();
    
    if (tokenExpiry <= now) {
      console.log('[Google Accounts API] ⚠️ TOKEN EXPIRADO, TENTANDO REFRESH...');
      // TODO: Implementar refresh do token
      return NextResponse.json(
        { error: 'Token expirado, refaça a conexão' },
        { status: 401 }
      );
    }
    
    // Buscar contas reais usando Google Ads API
    console.log('[Google Accounts API] 🚀 BUSCANDO CONTAS REAIS VIA GOOGLE ADS API...');
    
    try {
      const googleAdsClient = getGoogleAdsClient({
        accessToken: connection.access_token,
        refreshToken: connection.refresh_token,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        customerId: connection.customer_id,
        loginCustomerId: connection.login_customer_id || undefined,
        connectionId: connectionId, // ✅ Para refresh automático de token
      });
      
      console.log('[Google Accounts API] 📡 Cliente Google Ads inicializado');
      console.log('[Google Accounts API] 📊 Buscando contas acessíveis...');
      
      // Usar o método listAccessibleCustomers do cliente
      const accounts = await googleAdsClient.listAccessibleCustomers();
      
      console.log('[Google Accounts API] ✅ Resposta recebida:', {
        totalResults: accounts?.length || 0
      });
      
      if (!accounts || accounts.length === 0) {
        console.log('[Google Accounts API] ⚠️ NENHUMA CONTA ENCONTRADA');
        return NextResponse.json({
          success: true,
          accounts: [],
          message: 'Nenhuma conta Google Ads encontrada para este usuário'
        });
      }
      
      // Formatar contas para o formato esperado pelo frontend
      const formattedAccounts = accounts.map((account) => ({
        customerId: account.customerId,
        descriptiveName: account.descriptiveName || 'Sem nome',
        currencyCode: account.currencyCode || 'BRL',
        timeZone: account.timeZone || 'America/Sao_Paulo',
        canManageClients: account.canManageClients || false
      }));
      
      console.log('[Google Accounts API] ✅ CONTAS REAIS CARREGADAS:', formattedAccounts.length);
      
      return NextResponse.json({
        success: true,
        accounts: formattedAccounts,
        message: `${formattedAccounts.length} conta(s) Google Ads encontrada(s)`,
        isTest: false
      });
      
    } catch (apiError: any) {
      console.error('[Google Accounts API] ❌ ERRO AO BUSCAR CONTAS NA API:', {
        message: apiError.message,
        code: apiError.code,
        details: apiError.details,
        stack: apiError.stack
      });
      
      return NextResponse.json({
        error: 'Erro ao buscar contas no Google Ads',
        details: apiError.message,
        code: apiError.code
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('[Google Accounts API] ❌ ERRO GERAL:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}