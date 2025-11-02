/**
 * API para exportar logs de webhook
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

    // Parâmetros de filtro
    const status = searchParams.get('status');
    const eventType = searchParams.get('event_type');
    const subscriptionIntentId = searchParams.get('subscription_intent_id');

    // Construir query
    let query = supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000); // Limitar exportação

    if (status) {
      query = query.eq('status', status);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (subscriptionIntentId) {
      query = query.eq('subscription_intent_id', subscriptionIntentId);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Error fetching webhook logs for export:', error);
      return NextResponse.json({ error: 'Falha ao buscar logs' }, { status: 500 });
    }

    // Converter para CSV
    const csvHeaders = [
      'ID',
      'Tipo de Evento',
      'ID do Evento',
      'Intent ID',
      'Status',
      'Tentativas',
      'Erro',
      'Criado em',
      'Processado em'
    ];

    const csvRows = logs?.map(log => [
      log.id,
      log.event_type,
      log.event_id || '',
      log.subscription_intent_id || '',
      log.status,
      log.retry_count,
      log.error_message || '',
      new Date(log.created_at).toLocaleString('pt-BR'),
      log.processed_at ? new Date(log.processed_at).toLocaleString('pt-BR') : ''
    ]) || [];

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="webhook-logs-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('Error in webhook logs export API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}