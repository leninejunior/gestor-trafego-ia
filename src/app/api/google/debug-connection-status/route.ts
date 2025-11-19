/**
 * Debug endpoint - Verifica status das conexões Google (SEM AUTH)
 * Apenas para desenvolvimento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[Debug Connection Status] 🔍 VERIFICANDO CONEXÕES GOOGLE');
    
    const supabase = await createClient();
    
    // Buscar todas as conexões Google
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('[Debug Connection Status] ❌ ERRO:', error);
      return NextResponse.json({ 
        error: error.message,
        details: error 
      }, { status: 500 });
    }
    
    // Buscar states OAuth pendentes
    const { data: states, error: statesError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('provider', 'google')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('[Debug Connection Status] ✅ RESULTADO:');
    console.log('[Debug Connection Status] - Conexões:', connections?.length || 0);
    console.log('[Debug Connection Status] - States pendentes:', states?.length || 0);
    
    return NextResponse.json({
      success: true,
      connections: connections?.map(c => ({
        id: c.id,
        client_id: c.client_id,
        customer_id: c.customer_id,
        status: c.status,
        created_at: c.created_at,
        token_expires_at: c.token_expires_at,
        has_access_token: !!c.access_token,
        has_refresh_token: !!c.refresh_token
      })) || [],
      oauth_states: states?.map(s => ({
        id: s.id,
        state: s.state,
        client_id: s.client_id,
        user_id: s.user_id,
        created_at: s.created_at,
        expires_at: s.expires_at,
        is_expired: new Date(s.expires_at) <= new Date()
      })) || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Debug Connection Status] ❌ ERRO CRÍTICO:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
