/**
 * Debug endpoint para verificar o fluxo OAuth do Google
 * Testa cada etapa do processo
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log('='.repeat(100));
  console.log(`[Google OAuth Debug] 🔍 VERIFICANDO FLUXO OAUTH - ${timestamp}`);
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    console.log('[Google OAuth Debug] Ação:', action);
    
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({
        status: 'error',
        message: 'Usuário não autenticado',
        error: userError?.message
      }, { status: 401 });
    }
    
    console.log('[Google OAuth Debug] Usuário:', user.id);
    
    // Ação 1: Listar states OAuth pendentes
    if (action === 'states') {
      const { data: states, error: statesError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (statesError) {
        return NextResponse.json({
          status: 'error',
          message: 'Erro ao buscar states',
          error: statesError.message
        }, { status: 500 });
      }
      
      console.log('[Google OAuth Debug] States encontrados:', states?.length || 0);
      
      return NextResponse.json({
        status: 'success',
        message: 'States OAuth do usuário',
        count: states?.length || 0,
        states: states?.map(s => ({
          id: s.id,
          state: s.state.substring(0, 20) + '...',
          client_id: s.client_id,
          created_at: s.created_at,
          expires_at: s.expires_at,
          is_expired: new Date(s.expires_at) <= new Date()
        })) || []
      });
    }
    
    // Ação 2: Listar conexões Google Ads
    if (action === 'connections') {
      // Primeiro, obter os clientes do usuário
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, org_id')
        .in('org_id', [
          // Subquery para obter org_ids do usuário
          supabase
            .from('memberships')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
        ]);
      
      if (clientsError) {
        console.error('[Google OAuth Debug] Erro ao buscar clientes:', clientsError);
      }
      
      // Buscar conexões Google Ads
      const { data: connections, error: connectionsError } = await supabase
        .from('google_ads_connections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (connectionsError) {
        return NextResponse.json({
          status: 'error',
          message: 'Erro ao buscar conexões',
          error: connectionsError.message
        }, { status: 500 });
      }
      
      console.log('[Google OAuth Debug] Conexões encontradas:', connections?.length || 0);
      
      return NextResponse.json({
        status: 'success',
        message: 'Conexões Google Ads',
        count: connections?.length || 0,
        connections: connections?.map(c => ({
          id: c.id,
          client_id: c.client_id,
          customer_id: c.customer_id,
          status: c.status,
          created_at: c.created_at,
          token_expires_at: c.token_expires_at,
          has_access_token: !!c.access_token,
          has_refresh_token: !!c.refresh_token
        })) || []
      });
    }
    
    // Ação 3: Verificar configuração
    if (action === 'config') {
      const config = {
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_DEVELOPER_TOKEN: !!process.env.GOOGLE_DEVELOPER_TOKEN,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NODE_ENV: process.env.NODE_ENV
      };
      
      return NextResponse.json({
        status: 'success',
        message: 'Configuração do Google OAuth',
        config
      });
    }
    
    // Ação padrão: Status geral
    const { data: userStates } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google');
    
    const { data: userConnections } = await supabase
      .from('google_ads_connections')
      .select('*');
    
    return NextResponse.json({
      status: 'success',
      message: 'Status do fluxo OAuth Google',
      user: {
        id: user.id,
        email: user.email
      },
      stats: {
        pending_states: userStates?.filter(s => new Date(s.expires_at) > new Date()).length || 0,
        expired_states: userStates?.filter(s => new Date(s.expires_at) <= new Date()).length || 0,
        total_connections: userConnections?.length || 0,
        active_connections: userConnections?.filter(c => c.status === 'active').length || 0
      },
      available_actions: [
        'GET /api/google/debug-oauth-flow?action=status',
        'GET /api/google/debug-oauth-flow?action=states',
        'GET /api/google/debug-oauth-flow?action=connections',
        'GET /api/google/debug-oauth-flow?action=config'
      ]
    });
    
  } catch (error: any) {
    console.error('[Google OAuth Debug] ❌ ERRO:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Erro ao verificar fluxo OAuth',
      error: error.message
    }, { status: 500 });
  }
}
