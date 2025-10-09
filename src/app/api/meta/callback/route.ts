import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  console.log('Meta callback iniciado');
  
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  console.log('Code:', code ? 'presente' : 'ausente');
  console.log('State:', state);
  
  if (!code || !state) {
    console.error('Code ou state ausente');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=authorization_failed`);
  }

  // Extrair client_id do state
  const clientId = state.split('_')[1];
  console.log('Client ID extraído:', clientId);
  
  if (!clientId) {
    console.error('Client ID inválido no state');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=invalid_state`);
  }

  try {
    console.log('Trocando código por access token...');
    
    // Trocar código por access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`,
        code: code,
      }
    });

    console.log('Token response status:', tokenResponse.status);
    const { access_token } = tokenResponse.data;
    console.log('Access token obtido:', access_token ? 'sim' : 'não');

    // Obter informações da conta de anúncios
    console.log('Buscando contas de anúncios...');
    const accountsResponse = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
      params: {
        access_token: access_token,
        fields: 'id,name,account_status,currency'
      }
    });

    console.log('Accounts response status:', accountsResponse.status);
    const adAccounts = accountsResponse.data.data;
    console.log('Contas encontradas:', adAccounts?.length || 0);
    
    if (!adAccounts || adAccounts.length === 0) {
      console.error('Nenhuma conta de anúncios encontrada');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=no_ad_accounts`);
    }

    // Limpar conexões antigas antes de redirecionar
    console.log('Limpando conexões antigas para cliente:', clientId);
    const supabase = await createClient();
    
    const { error: deleteError } = await supabase
      .from('client_meta_connections')
      .delete()
      .eq('client_id', clientId);
    
    if (deleteError) {
      console.error('Erro ao limpar conexões antigas:', deleteError);
    } else {
      console.log('Conexões antigas removidas com sucesso');
    }

    // Redirecionar para página de seleção de contas
    const selectUrl = new URL('/meta/select-accounts', process.env.NEXT_PUBLIC_APP_URL);
    selectUrl.searchParams.set('access_token', access_token);
    selectUrl.searchParams.set('client_id', clientId);
    
    return NextResponse.redirect(selectUrl.toString());
    
  } catch (error: any) {
    console.error('Erro detalhado no callback do Meta:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack
    });
    
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=connection_failed&details=${encodeURIComponent(error.message)}`);
  }
}