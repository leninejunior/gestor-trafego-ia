/**
 * Debug API - Google OAuth Status
 * Retorna informações sobre states OAuth e conexões Google Ads
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    console.log('[Debug OAuth] Buscando informações de debug...');
    
    const supabase = await createClient();
    
    // Buscar states OAuth recentes
    const { data: states, error: statesError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('provider', 'google')
      .order('created_at', { ascending: false })
      .limit(10);

    if (statesError) {
      console.error('[Debug OAuth] Erro ao buscar states:', statesError);
    }

    // Buscar conexões Google Ads recentes
    const { data: connections, error: connectionsError } = await supabase
      .from('google_ads_connections')
      .select('id, client_id, customer_id, status, token_expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (connectionsError) {
      console.error('[Debug OAuth] Erro ao buscar conexões:', connectionsError);
    }

    console.log('[Debug OAuth] Informações coletadas:', {
      states: states?.length || 0,
      connections: connections?.length || 0
    });

    return NextResponse.json({
      success: true,
      states: states || [],
      connections: connections || [],
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Debug OAuth] Erro:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao buscar informações de debug',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
