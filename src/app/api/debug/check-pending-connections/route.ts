/**
 * Debug API: Verificar conexões Google pendentes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  console.log('[Debug Pending] 🔍 VERIFICANDO CONEXÕES PENDENTES');
  
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    console.log('[Debug Pending] - Client ID:', clientId);
    
    const supabase = createServiceClient();
    
    // Buscar todas as conexões Google para este cliente
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    console.log('[Debug Pending] - Conexões encontradas:', connections?.length || 0);
    console.log('[Debug Pending] - Erro:', error?.message || 'nenhum');
    
    if (error) {
      console.error('[Debug Pending] ❌ Erro na query:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar conexões', details: error.message },
        { status: 500 }
      );
    }
    
    // Filtrar conexões pendentes
    const pendingConnections = connections?.filter(conn => 
      conn.customer_id === 'pending' || conn.status === 'pending'
    ) || [];
    
    // Filtrar conexões ativas
    const activeConnections = connections?.filter(conn => 
      conn.customer_id !== 'pending' && conn.status === 'active'
    ) || [];
    
    return NextResponse.json({
      clientId,
      totalConnections: connections?.length || 0,
      pendingConnections: pendingConnections.length,
      activeConnections: activeConnections.length,
      connections: connections || [],
      pendingDetails: pendingConnections,
      activeDetails: activeConnections,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Debug Pending] ❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno', message: error.message },
      { status: 500 }
    );
  }
}