/**
 * Debug API: Listar conexões Google para um cliente
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('[Debug List Google] 🔍 LISTANDO CONEXÕES GOOGLE');
  
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    console.log('[Debug List Google] - Client ID:', clientId);
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID é obrigatório' },
        { status: 400 }
      );
    }
    
    const supabase = createServiceClient();
    
    // Buscar todas as conexões Google para este cliente
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    console.log('[Debug List Google] - Conexões encontradas:', connections?.length || 0);
    console.log('[Debug List Google] - Erro:', error?.message || 'nenhum');
    
    if (error) {
      console.error('[Debug List Google] ❌ Erro na query:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar conexões', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      clientId,
      connections: connections || [],
      totalConnections: connections?.length || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Debug List Google] ❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno', message: error.message },
      { status: 500 }
    );
  }
}