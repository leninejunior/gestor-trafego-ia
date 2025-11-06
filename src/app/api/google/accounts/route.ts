/**
 * Google Ads Accounts API Route
 * 
 * Manages Google Ads account selection and listing
 * Requirements: 1.4, 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getGoogleTokenManagerSimple } from '@/lib/google/token-manager-simple';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get accessible customer accounts from Google Ads API (MCC Support)
 */
async function getAccessibleCustomerAccounts(accessToken: string) {
  console.log('[Google Accounts Helper] 🌐 CHAMANDO API DO GOOGLE ADS PARA CONTAS MCC');
  console.log('[Google Accounts Helper] - Access token length:', accessToken.length);
  console.log('[Google Accounts Helper] - Access token prefix:', accessToken.substring(0, 20) + '...');
  
  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  console.log('[Google Accounts Helper] - Developer token length:', developerToken?.length || 0);
  
  if (!developerToken) {
    console.error('[Google Accounts Helper] ❌ DEVELOPER TOKEN NÃO CONFIGURADO');
    throw new Error('Developer Token não configurado');
  }

  try {
    console.log('[Google Accounts Helper] 🔄 BUSCANDO CONTAS MCC ACESSÍVEIS...');
    
    // First, get accessible customers (MCC accounts)
    const apiUrl = 'https://googleads.googleapis.com/v16/customers:listAccessibleCustomers';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    
    console.log('[Google Accounts Helper] 📡 FAZENDO REQUISIÇÃO PARA API MCC:');
    console.log('[Google Accounts Helper] - URL:', apiUrl);
    console.log('[Google Accounts Helper] - Method: GET');
    console.log('[Google Accounts Helper] - Headers:', {
      'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
      'developer-token': developerToken.substring(0, 10) + '...',
      'Content-Type': 'application/json',
    });
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    console.log('[Google Accounts Helper] 📊 RESPOSTA DA API MCC:');
    console.log('[Google Accounts Helper] - Status:', response.status);
    console.log('[Google Accounts Helper] - Status text:', response.statusText);
    console.log('[Google Accounts Helper] - Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Google Accounts Helper] ❌ API MCC FALHOU:');
      console.error('[Google Accounts Helper] - Status:', response.status);
      console.error('[Google Accounts Helper] - Erro:', errorText);
      
      // Se for erro de Developer Token ou 404 (token não aprovado)
      if (response.status === 401 || response.status === 404 || errorText.includes('DEVELOPER_TOKEN')) {
        console.error('[Google Accounts Helper] ❌ DEVELOPER TOKEN NÃO APROVADO');
        throw new Error('Developer Token não aprovado pelo Google. Acesse https://ads.google.com → Ferramentas → Centro de API para verificar o status.');
      }
      
      console.error('[Google Accounts Helper] ❌ ERRO GENÉRICO DA API MCC');
      throw new Error(`Google Ads API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Google Accounts Helper] ✅ RESPOSTA RAW DA API MCC:');
    console.log('[Google Accounts Helper] - Dados completos:', JSON.stringify(data, null, 2));

    if (!data.resourceNames || data.resourceNames.length === 0) {
      console.log('[Google Accounts Helper] ⚠️ NENHUMA CONTA MCC ACESSÍVEL ENCONTRADA');
      return [];
    }

    // Extract customer IDs from resource names (these are MCC accounts)
    console.log('[Google Accounts Helper] 🔍 EXTRAINDO IDs DAS CONTAS MCC...');
    console.log('[Google Accounts Helper] - Resource names MCC:', data.resourceNames);
    
    const mccIds = data.resourceNames.map((resourceName: string) => {
      // Resource name format: customers/1234567890
      const customerId = resourceName.replace('customers/', '');
      console.log('[Google Accounts Helper] - MCC extraído:', resourceName, '→', customerId);
      return customerId;
    });

    console.log('[Google Accounts Helper] ✅ IDs DAS CONTAS MCC ENCONTRADAS:', mccIds);

    // Now get managed accounts for each MCC
    const allAccounts = [];
    
    for (const mccId of mccIds) {
      console.log(`[Google Accounts Helper] 🔍 BUSCANDO CONTAS GERENCIADAS PARA MCC: ${mccId}`);
      
      try {
        // Get managed accounts for this MCC
        const managedAccounts = await getManagedAccountsForMCC(accessToken, mccId, developerToken);
        console.log(`[Google Accounts Helper] ✅ Encontradas ${managedAccounts.length} contas gerenciadas para MCC ${mccId}`);
        
        // Add MCC itself as an option
        const mccInfo = await getCustomerInfo(accessToken, mccId, developerToken);
        if (mccInfo) {
          mccInfo.canManageClients = true; // Mark as MCC
          mccInfo.descriptiveName = `${mccInfo.descriptiveName} (MCC)`;
          allAccounts.push(mccInfo);
        }
        
        // Add managed accounts
        allAccounts.push(...managedAccounts);
        
      } catch (mccError) {
        console.error(`[Google Accounts Helper] ❌ Erro ao buscar contas para MCC ${mccId}:`, mccError);
        
        // Add basic MCC info even if managed accounts fail
        const basicMccInfo = {
          customerId: mccId,
          descriptiveName: `Conta MCC ${mccId}`,
          currencyCode: 'BRL',
          timeZone: 'America/Sao_Paulo',
          canManageClients: true,
        };
        allAccounts.push(basicMccInfo);
      }
    }

    // Get detailed information for each customer
    console.log('[Google Accounts Helper] 📋 OBTENDO INFORMAÇÕES DETALHADAS DOS CLIENTES...');
    const accounts = [];
    
    for (let i = 0; i < customerIds.length; i++) {
      const customerId = customerIds[i];
      console.log(`[Google Accounts Helper] 🔍 Processando cliente ${i + 1}/${customerIds.length}: ${customerId}`);
      
      try {
        const customerInfo = await getCustomerInfo(accessToken, customerId, developerToken);
        if (customerInfo) {
          console.log(`[Google Accounts Helper] ✅ Info obtida para ${customerId}:`, customerInfo);
          accounts.push(customerInfo);
        } else {
          console.log(`[Google Accounts Helper] ⚠️ Nenhuma info retornada para ${customerId}`);
        }
      } catch (customerError: any) {
        console.error(`[Google Accounts Helper] ❌ Erro ao obter info do cliente ${customerId}:`, customerError);
        // Add basic info even if detailed call fails
        const fallbackInfo = {
          customerId,
          descriptiveName: `Conta ${customerId}`,
          currencyCode: 'BRL',
          timeZone: 'America/Sao_Paulo',
          canManageClients: false,
        };
        console.log(`[Google Accounts Helper] 🔄 Usando info básica para ${customerId}:`, fallbackInfo);
        accounts.push(fallbackInfo);
      }
    }

    console.log('[Google Accounts Helper] ✅ PROCESSAMENTO MCC CONCLUÍDO:');
    console.log('[Google Accounts Helper] - Total de contas (MCC + gerenciadas):', allAccounts.length);
    console.log('[Google Accounts Helper] - Contas MCC:', allAccounts.filter(acc => acc.canManageClients).length);
    console.log('[Google Accounts Helper] - Contas gerenciadas:', allAccounts.filter(acc => !acc.canManageClients).length);
    console.log('[Google Accounts Helper] - Todas as contas:', JSON.stringify(allAccounts, null, 2));

    return allAccounts;

  } catch (realApiError: any) {
    console.error('[Google Accounts Helper] ❌ API REAL FALHOU COMPLETAMENTE:', realApiError);
    console.error('[Google Accounts Helper] - Mensagem:', realApiError.message);
    console.error('[Google Accounts Helper] - Stack:', realApiError.stack);
    // Return empty array if API fails
    return [];
  }
}

/**
 * Get managed accounts for an MCC
 */
async function getManagedAccountsForMCC(accessToken: string, mccId: string, developerToken: string) {
  console.log(`[Google Accounts Helper] 🏢 BUSCANDO CONTAS GERENCIADAS PARA MCC: ${mccId}`);
  
  try {
    // Query to get managed accounts
    const query = `
      SELECT
        customer_client.client_customer,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.manager,
        customer_client.status
      FROM customer_client
      WHERE customer_client.status = 'ENABLED'
    `;

    const response = await fetch(`https://googleads.googleapis.com/v16/customers/${mccId}/googleAds:search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Google Accounts Helper] ❌ Erro ao buscar contas gerenciadas para MCC ${mccId}:`, errorText);
      return [];
    }

    const data = await response.json();
    console.log(`[Google Accounts Helper] 📊 Resposta das contas gerenciadas para MCC ${mccId}:`, JSON.stringify(data, null, 2));
    
    if (!data.results || data.results.length === 0) {
      console.log(`[Google Accounts Helper] ⚠️ Nenhuma conta gerenciada encontrada para MCC ${mccId}`);
      return [];
    }

    // Process managed accounts
    const managedAccounts = data.results.map((result: any) => {
      const client = result.customerClient;
      return {
        customerId: client.clientCustomer?.replace('customers/', '') || 'unknown',
        descriptiveName: client.descriptiveName || `Conta ${client.clientCustomer}`,
        currencyCode: client.currencyCode || 'BRL',
        timeZone: client.timeZone || 'America/Sao_Paulo',
        canManageClients: client.manager || false,
        status: client.status,
        parentMCC: mccId,
      };
    });

    console.log(`[Google Accounts Helper] ✅ ${managedAccounts.length} contas gerenciadas processadas para MCC ${mccId}`);
    return managedAccounts;

  } catch (error: any) {
    console.error(`[Google Accounts Helper] ❌ Erro ao buscar contas gerenciadas para MCC ${mccId}:`, error.message);
    return [];
  }
}

/**
 * Get detailed customer information
 */
async function getCustomerInfo(accessToken: string, customerId: string, developerToken: string) {
  console.log(`[Google Accounts] Getting customer info for ${customerId}`);
  
  try {
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.manager
      FROM customer
      WHERE customer.id = ${customerId}
    `;

    const response = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Google Accounts] Customer info API error for ${customerId}:`, errorText);
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log(`[Google Accounts] No customer info found for ${customerId}`);
      return null;
    }

    const customer = data.results[0].customer;
    
    return {
      customerId: customer.id,
      descriptiveName: customer.descriptiveName || `Conta ${customer.id}`,
      currencyCode: customer.currencyCode || 'BRL',
      timeZone: customer.timeZone || 'America/Sao_Paulo',
      canManageClients: customer.manager || false,
    };

  } catch (error: any) {
    console.error(`[Google Accounts] Error getting customer info for ${customerId}:`, error.message);
    return null;
  }
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  console.log('='.repeat(80));
  console.log('[Google Accounts] 🔍 INICIANDO BUSCA DE CONTAS GOOGLE ADS');
  console.log('[Google Accounts] Timestamp:', new Date().toISOString());
  console.log('[Google Accounts] Request URL:', request.url);
  
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');

    console.log('[Google Accounts] 📋 PARÂMETROS RECEBIDOS:');
    console.log('[Google Accounts] - Connection ID:', connectionId);
    console.log('[Google Accounts] - Client ID:', clientId);
    console.log('[Google Accounts] - Todos os parâmetros:', Object.fromEntries(searchParams.entries()));

    if (!connectionId || !clientId) {
      console.error('[Google Accounts] ❌ PARÂMETROS OBRIGATÓRIOS AUSENTES');
      return NextResponse.json(
        { error: 'Connection ID e Client ID são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('[Google Accounts] ✅ PARÂMETROS VALIDADOS');

    // Create Supabase client
    console.log('[Google Accounts] 🔗 CRIANDO CLIENTE SUPABASE...');
    const supabase = createServiceClient();

    // Get connection from database
    console.log('[Google Accounts] 🔍 BUSCANDO CONEXÃO NO BANCO DE DADOS...');
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();

    console.log('[Google Accounts] 📊 RESULTADO DA BUSCA DA CONEXÃO:');
    console.log('[Google Accounts] - Conexão encontrada:', !!connection);
    console.log('[Google Accounts] - Erro:', connectionError?.message || 'nenhum');
    console.log('[Google Accounts] - Código do erro:', connectionError?.code || 'nenhum');

    if (connectionError || !connection) {
      console.error('[Google Accounts] ❌ CONEXÃO NÃO ENCONTRADA:', connectionError);
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    console.log('[Google Accounts] ✅ CONEXÃO ENCONTRADA:');
    console.log('[Google Accounts] - ID:', connection.id);
    console.log('[Google Accounts] - Client ID:', connection.client_id);
    console.log('[Google Accounts] - Customer ID:', connection.customer_id);
    console.log('[Google Accounts] - Status:', connection.status);
    console.log('[Google Accounts] - Tem access token:', !!connection.access_token);
    console.log('[Google Accounts] - Tem refresh token:', !!connection.refresh_token);
    console.log('[Google Accounts] - Criado em:', connection.created_at);
    console.log('[Google Accounts] - Atualizado em:', connection.updated_at);

    // Check if connection is pending (no customer selected yet)
    if (connection.customer_id === 'pending') {
      console.log('[Google Accounts] ⏸️ CONEXÃO PENDENTE - AGUARDANDO SELEÇÃO DE CONTA');
      return NextResponse.json({
        error: 'Conexão pendente',
        message: 'Complete o processo de autenticação OAuth primeiro.',
        accounts: [],
        totalAccounts: 0,
        isPending: true,
        requiresAuth: true
      });
    }

    console.log('[Google Accounts] ✅ CONEXÃO ATIVA COM CUSTOMER ID:', connection.customer_id);

    // Verify we have valid tokens
    console.log('[Google Accounts] 🔐 VERIFICANDO TOKENS DE ACESSO...');
    if (!connection.access_token || !connection.refresh_token) {
      console.error('[Google Accounts] ❌ TOKENS NÃO ENCONTRADOS');
      return NextResponse.json(
        { error: 'Tokens de acesso não encontrados. Refaça a autenticação.' },
        { status: 401 }
      );
    }

    console.log('[Google Accounts] ✅ TOKENS ENCONTRADOS');

    // Get token manager
    console.log('[Google Accounts] 🔄 OBTENDO TOKEN MANAGER...');
    const tokenManager = getGoogleTokenManagerSimple();
    let accessToken: string;

    try {
      console.log('[Google Accounts] 🔑 GARANTINDO TOKEN VÁLIDO...');
      accessToken = await tokenManager.ensureValidToken(connectionId);
      console.log('[Google Accounts] ✅ TOKEN DE ACESSO OBTIDO COM SUCESSO');
      console.log('[Google Accounts] - Token length:', accessToken.length);
      console.log('[Google Accounts] - Token prefix:', accessToken.substring(0, 20) + '...');
    } catch (tokenError: any) {
      console.error('[Google Accounts] ❌ ERRO NO TOKEN:', tokenError);
      console.error('[Google Accounts] - Mensagem:', tokenError.message);
      console.error('[Google Accounts] - Stack:', tokenError.stack);
      throw new Error('Token inválido ou expirado');
    }

    // Verificar se temos Developer Token para acessar API real
    console.log('[Google Accounts] 🔧 VERIFICANDO DEVELOPER TOKEN...');
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
    console.log('[Google Accounts] - Developer Token presente:', !!developerToken);
    console.log('[Google Accounts] - Developer Token length:', developerToken?.length || 0);
    
    if (!developerToken) {
      console.error('[Google Accounts] ❌ DEVELOPER TOKEN NÃO CONFIGURADO');
      return NextResponse.json({
        error: 'Developer Token não configurado',
        message: 'Para acessar contas reais do Google Ads, configure GOOGLE_DEVELOPER_TOKEN.',
        accounts: [],
        totalAccounts: 0,
        requiresDeveloperToken: true,
        documentationUrl: 'https://developers.google.com/google-ads/api/docs/first-call/dev-token'
      });
    }

    console.log('[Google Accounts] ✅ DEVELOPER TOKEN CONFIGURADO');

    // Call Google Ads API to get accessible customer accounts
    console.log('[Google Accounts] 🌐 CHAMANDO API DO GOOGLE ADS...');
    const accounts = await getAccessibleCustomerAccounts(accessToken);
    
    console.log('[Google Accounts] 📊 RESULTADO DA API:');
    console.log('[Google Accounts] - Total de contas encontradas:', accounts.length);
    console.log('[Google Accounts] - Contas MCC:', accounts.filter(acc => acc.canManageClients).length);
    console.log('[Google Accounts] - Detalhes das contas:', JSON.stringify(accounts, null, 2));

    const response = {
      connectionId,
      accounts,
      totalAccounts: accounts.length,
      isPending: false,
      isMCC: accounts.some(acc => acc.canManageClients),
      hasTokens: true,
      isReal: accounts.length > 0,
      message: `${accounts.length} conta${accounts.length > 1 ? 's' : ''} encontrada${accounts.length > 1 ? 's' : ''}`
    };

    console.log('[Google Accounts] ✅ RESPOSTA PREPARADA:', JSON.stringify(response, null, 2));
    console.log('[Google Accounts] 🎉 BUSCA DE CONTAS CONCLUÍDA COM SUCESSO');
    console.log('='.repeat(80));

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Google Accounts] ❌ ERRO GERAL:', error);
    console.error('[Google Accounts] - Mensagem:', error.message);
    console.error('[Google Accounts] - Stack:', error.stack);
    console.error('[Google Accounts] - Tipo:', typeof error);
    console.log('='.repeat(80));
    
    return NextResponse.json({
      error: 'Erro ao buscar contas do Google Ads',
      message: error.message || 'Erro desconhecido da API',
      accounts: [],
      totalAccounts: 0,
      apiError: true
    }, { status: 500 });
  }
}