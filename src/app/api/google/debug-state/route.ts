/**
 * Debug route para verificar estados OAuth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    
    const supabase = await createClient();
    
    // Buscar todos os states recentes
    const { data: allStates, error: allError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('provider', 'google')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('[Debug State] Total de states encontrados:', allStates?.length || 0);
    
    if (state) {
      // Buscar state específico
      const { data: specificState, error: specificError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('provider', 'google')
        .single();
      
      const now = new Date();
      const expiresAt = specificState ? new Date(specificState.expires_at) : null;
      const isExpired = expiresAt ? expiresAt <= now : null;
      
      return NextResponse.json({
        searchedState: state,
        found: !!specificState,
        error: specificError?.message || null,
        state: specificState,
        now: now.toISOString(),
        expiresAt: expiresAt?.toISOString() || null,
        isExpired,
        allRecentStates: allStates?.map(s => ({
          state: s.state.substring(0, 20) + '...',
          created: s.created_at,
          expires: s.expires_at,
          expired: new Date(s.expires_at) <= now
        }))
      });
    }
    
    return NextResponse.json({
      totalStates: allStates?.length || 0,
      error: allError?.message || null,
      states: allStates?.map(s => ({
        id: s.id,
        state: s.state.substring(0, 20) + '...',
        clientId: s.client_id,
        userId: s.user_id,
        provider: s.provider,
        created: s.created_at,
        expires: s.expires_at,
        expired: new Date(s.expires_at) <= new Date()
      }))
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
