/**
 * API Route: Gerenciar Conexões Google Ads
 * 
 * GET - Listar todas as conexões de um cliente
 * DELETE - Excluir uma conexão específica
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/google/connections?clientId=xxx
export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Buscar todas as conexões do cliente
    const { data: connections, error } = await supabase
      .from('google_ads_connections')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Google Connections API] Erro ao buscar conexões:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar conexões' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connections: connections || [],
      total: connections?.length || 0,
    });

  } catch (error) {
    console.error('[Google Connections API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/google/connections?connectionId=xxx
export async function DELETE(request: NextRequest) {
  try {
    const connectionId = request.nextUrl.searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Excluir a conexão
    const { error } = await supabase
      .from('google_ads_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      console.error('[Google Connections API] Erro ao excluir conexão:', error);
      return NextResponse.json(
        { error: 'Erro ao excluir conexão' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conexão excluída com sucesso',
    });

  } catch (error) {
    console.error('[Google Connections API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
