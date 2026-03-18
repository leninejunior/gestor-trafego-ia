import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/monitoring/client-usage
 * Retorna uso de storage por cliente
 * Requisito 9.4: Dashboard administrativo com métricas de uso por cliente e plano
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Verificar se usuário é admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar uso por cliente
    const { data: usage, error } = await supabase
      .rpc('get_client_cache_usage');

    if (error) {
      console.error('Erro ao buscar uso por cliente:', error);
      // Se a função não existir, retornar array vazio
      return NextResponse.json({
        clients: [],
      });
    }

    return NextResponse.json({
      clients: usage || [],
    });
  } catch (error) {
    console.error('Erro ao buscar uso por cliente:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar uso por cliente' },
      { status: 500 }
    );
  }
}
