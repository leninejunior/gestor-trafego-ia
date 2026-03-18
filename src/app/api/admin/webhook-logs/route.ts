/**
 * API para gerenciar logs de webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Verificar autenticação e permissões de admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Parâmetros de consulta
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const status = searchParams.get('status');
    const eventType = searchParams.get('event_type');
    const subscriptionIntentId = searchParams.get('subscription_intent_id');
    const createdAfter = searchParams.get('created_after');

    // Construir query
    let query = supabase
      .from('webhook_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (subscriptionIntentId) {
      query = query.eq('subscription_intent_id', subscriptionIntentId);
    }

    if (createdAfter) {
      query = query.gte('created_at', createdAfter);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Error fetching webhook logs:', error);
      return NextResponse.json({ error: 'Falha ao buscar logs' }, { status: 500 });
    }

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      page,
      limit
    });

  } catch (error) {
    console.error('Error in webhook logs API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}