import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  console.log('Meta callback iniciado');
  
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');
  const errorDescription = searchParams.get('error_description');
  
  console.log('Code:', code ? 'presente' : 'ausente');
  console.log('State:', state);
  console.log('Error:', error);
  console.log('Error Reason:', errorReason);
  console.log('Error Description:', errorDescription);
  
  // Se o usuário cancelou ou negou permissões
  if (error) {
    console.log('❌ Usuário cancelou ou negou permissões:', error);
    const clientId = state ? state.split('_')[1] : null;
    const redirectUrl = clientId 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients/${clientId}?error=user_cancelled`
      : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=user_cancelled`;
    return NextResponse.redirect(redirectUrl);
  }
  
  if (!code || !state) {
    console.error('Code ou state ausente');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=authorization_failed`);
  }

  // Extrair client_id e clientName do state
  let clientId: string;
  let clientName: string = 'Cliente';
  
  try {
    const stateData = JSON.parse(decodeURIComponent(state));
    clientId = stateData.clientId;
    clientName = stateData.clientName || 'Cliente';
  } catch (e) {
    // Fallback para formato antigo
    clientId = state.split('_')[1];
  }
  
  console.log('Client ID extraído:', clientId);
  console.log('Client Name extraído:', clientName);
  
  if (!clientId) {
    console.error('Client ID inválido no state');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients?error=invalid_state`);
  }

  try {
    console.log('Trocando código por access token...');
    
    // Trocar código por access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
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
    const accountsResponse = await axios.get('https://graph.facebook.com/v22.0/me/adaccounts', {
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

    // Limpar conexões antigas antes de redirecionar (usando service client)
    console.log('Limpando conexões antigas para cliente:', clientId);
    try {
      const serviceSupabase = createServiceClient();
      
      const { error: deleteError } = await serviceSupabase
        .from('client_meta_connections')
        .delete()
        .eq('client_id', clientId);
      
      if (deleteError) {
        console.error('Erro ao limpar conexões antigas:', deleteError);
      } else {
        console.log('Conexões antigas removidas com sucesso');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Erro ao limpar conexões antigas (não crítico):', cleanupError);
      // Continuar mesmo com erro - não é crítico
    }

    // Redirecionar para página de seleção de contas
    const selectUrl = new URL('/meta/select-accounts', process.env.NEXT_PUBLIC_APP_URL);
    selectUrl.searchParams.set('access_token', access_token);
    selectUrl.searchParams.set('client_id', clientId);
    selectUrl.searchParams.set('client_name', clientName);
    
    console.log('🔄 Redirecionando para seleção de contas:', selectUrl.toString());
    
    // Criar resposta de redirecionamento preservando cookies de sessão
    const response = NextResponse.redirect(selectUrl.toString());
    
    // Preservar cookies de sessão do Supabase
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      response.headers.set('Set-Cookie', cookieHeader);
    }
    
    return response;
    
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