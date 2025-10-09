import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token } = body;

    if (!access_token) {
      return NextResponse.json({ error: 'Access token é obrigatório' }, { status: 400 });
    }

    // Obter informações da conta de anúncios
    const accountsResponse = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
      params: {
        access_token: access_token,
        fields: 'id,name,account_status,currency,timezone_name,spend_cap,balance'
      }
    });

    const adAccounts = accountsResponse.data.data;

    // Obter páginas do Facebook
    const pagesResponse = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
      params: {
        access_token: access_token,
        fields: 'id,name,category,followers_count'
      }
    });

    const pages = pagesResponse.data.data;

    return NextResponse.json({ 
      adAccounts: adAccounts || [],
      pages: pages || []
    });

  } catch (error: any) {
    console.error('Erro ao buscar contas Meta:', error);
    return NextResponse.json({ 
      error: 'Erro ao buscar contas',
      details: error.response?.data || error.message 
    }, { status: 500 });
  }
}