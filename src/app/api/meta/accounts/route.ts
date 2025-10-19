import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Função auxiliar para buscar todos os resultados com paginação
async function fetchAllPages(url: string, params: any) {
  let allData: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await axios.get(nextUrl, { params: nextUrl === url ? params : undefined });
    const data = response.data.data || [];
    allData = [...allData, ...data];

    // Verificar se há próxima página
    nextUrl = response.data.paging?.next || null;
    
    // Limpar params para próximas requisições (a URL já vem completa)
    if (nextUrl) {
      params = undefined;
    }
  }

  return allData;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token } = body;

    if (!access_token) {
      return NextResponse.json({ error: 'Access token é obrigatório' }, { status: 400 });
    }

    console.log('🔍 Buscando TODAS as contas Meta (com paginação)...');

    // Obter TODAS as contas de anúncios (com paginação)
    const adAccounts = await fetchAllPages(
      'https://graph.facebook.com/v21.0/me/adaccounts',
      {
        access_token: access_token,
        fields: 'id,name,account_status,currency,timezone_name,spend_cap,balance',
        limit: 100 // Buscar 100 por vez para reduzir número de requisições
      }
    );

    console.log(`✅ Total de contas de anúncios encontradas: ${adAccounts.length}`);

    // Obter TODAS as páginas do Facebook (com paginação)
    const pages = await fetchAllPages(
      'https://graph.facebook.com/v21.0/me/accounts',
      {
        access_token: access_token,
        fields: 'id,name,category,followers_count',
        limit: 100
      }
    );

    console.log(`✅ Total de páginas encontradas: ${pages.length}`);

    return NextResponse.json({ 
      adAccounts: adAccounts || [],
      pages: pages || [],
      total: {
        adAccounts: adAccounts.length,
        pages: pages.length
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar contas Meta:', error);
    return NextResponse.json({ 
      error: 'Erro ao buscar contas',
      details: error.response?.data || error.message 
    }, { status: 500 });
  }
}