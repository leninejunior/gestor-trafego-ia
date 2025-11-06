/**
 * Real Google Accounts API - Fetches actual Google Ads accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { GoogleAdsClient } from '@/lib/google/client';

export async function GET(request: NextRequest) {
  console.log('[Google Accounts Real] Starting request');
  
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const clientId = searchParams.get('clientId');

    console.log('[Google Accounts Real] Connection ID:', connectionId);
    console.log('[Google Accounts Real] Client ID:', clientId);

    if (!connectionId || !clientId) {
      return NextResponse.json(
        { error: 'Connection ID e Client ID são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar conexão no banco
    const supabase = createServerClient();
    const { data: connection, error: connectionError } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('client_id', clientId)
      .single();

    if (connectionError || !connection) {
      console.error('[Google Accounts Real] Connection not found:', connectionError);
      return NextResponse.json(
        { error: 'Conexão não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se temos tokens válidos
    if (!connection.access_token || !connection.refresh_token) {
      return NextResponse.json(
        { error: 'Tokens de acesso não encontrados. Refaça a autenticação.' },
        { status: 401 }
      );
    }

    // Verificar se temos Developer Token
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
    if (!developerToken) {
      return NextResponse.json({
        error: 'Developer Token não configurado',
        message: 'Para acessar contas reais do Google Ads, configure GOOGLE_DEVELOPER_TOKEN no ambiente.',
        accounts: [],
        totalAccounts: 0,
        requiresDeveloperToken: true,
        documentationUrl: 'https://developers.google.com/google-ads/api/docs/first-call/dev-token'
      });
    }

    // Criar cliente do Google Ads
    const googleAdsClient = new GoogleAdsClient({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      developerToken,
      refreshToken: connection.refresh_token,
      customerId: connection.customer_id || '',
    });

    try {
      // Buscar contas acessíveis
      const accounts = await getAccessibleAccounts(googleAdsClient);
      
      console.log(`[Google Accounts Real] Found ${accounts.length} accounts`);

      return NextResponse.json({
        connectionId,
        accounts,
        totalAccounts: accounts.length,
        isReal: true,
        message: `${accounts.length} contas reais encontradas`
      });

    } catch (apiError: any) {
      console.error('[Google Accounts Real] API Error:', apiError);
      
      // Se for erro de Developer Token
      if (apiError.message?.includes('developer token') || apiError.message?.includes('DEVELOPER_TOKEN') || apiError.message?.includes('não aprovado')) {
        return NextResponse.json({
          error: 'Developer Token não aprovado pelo Google',
          message: 'Acesse https://ads.google.com → Ferramentas → Centro de API para verificar e solicitar aprovação do seu Developer Token.',
          accounts: [],
          totalAccounts: 0,
          requiresApproval: true,
          checkStatusUrl: 'https://ads.google.com',
          documentationUrl: 'https://developers.google.com/google-ads/api/docs/first-call/dev-token'
        });
      }

      // Outros erros da API
      return NextResponse.json({
        error: 'Erro ao buscar contas do Google Ads',
        message: apiError.message || 'Erro desconhecido da API',
        accounts: [],
        totalAccounts: 0,
        apiError: true
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Google Accounts Real] Error:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Busca contas acessíveis usando a API real do Google Ads
 */
async function getAccessibleAccounts(client: GoogleAdsClient) {
  try {
    // Primeiro, tentar buscar contas gerenciáveis (se for MCC)
    const accounts = await searchAccessibleCustomers(client);
    return accounts;
  } catch (error) {
    console.error('[Google Accounts Real] Error fetching accounts:', error);
    throw error;
  }
}

/**
 * Busca clientes acessíveis usando a API do Google Ads
 */
async function searchAccessibleCustomers(client: GoogleAdsClient) {
  // Esta é uma implementação simplificada
  // Na prática, você precisaria usar a API real do Google Ads
  // Por enquanto, retornamos uma lista vazia com instruções
  
  throw new Error('Para implementar busca real de contas, você precisa de um Developer Token aprovado e implementar a lógica específica da API do Google Ads.');
}