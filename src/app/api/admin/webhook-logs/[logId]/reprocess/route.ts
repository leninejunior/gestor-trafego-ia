/**
 * API para reprocessar webhook específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    const supabase = await createClient();
    const { logId } = await params;

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

    // Buscar o log do webhook
    const { data: webhookLog, error: fetchError } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (fetchError || !webhookLog) {
      return NextResponse.json({ error: 'Log de webhook não encontrado' }, { status: 404 });
    }

    // Verificar se pode ser reprocessado
    if (webhookLog.status === 'processed') {
      return NextResponse.json({ error: 'Webhook já foi processado com sucesso' }, { status: 400 });
    }

    if (webhookLog.retry_count >= 5) {
      return NextResponse.json({ error: 'Limite de tentativas excedido' }, { status: 400 });
    }

    // Atualizar status para reprocessamento
    const { error: updateError } = await supabase
      .from('webhook_logs')
      .update({
        status: 'retrying',
        retry_count: webhookLog.retry_count + 1,
        error_message: null
      })
      .eq('id', logId);

    if (updateError) {
      console.error('Error updating webhook log:', updateError);
      return NextResponse.json({ error: 'Falha ao atualizar log' }, { status: 500 });
    }

    // Aqui você pode adicionar lógica para reprocessar o webhook
    // Por exemplo, enviar para uma fila de processamento
    try {
      // Reprocessar webhook com o processador real
      const webhookProcessor = await import('@/lib/webhooks/webhook-processor');
      await webhookProcessor.processWebhook(webhookLog.payload, webhookLog.event_type);

      // Atualizar como processado
      await supabase
        .from('webhook_logs')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', logId);

    } catch (processingError) {
      console.error('Error reprocessing webhook:', processingError);
      
      // Atualizar com erro
      await supabase
        .from('webhook_logs')
        .update({
          status: 'failed',
          error_message: processingError instanceof Error ? processingError.message : 'Erro desconhecido'
        })
        .eq('id', logId);

      return NextResponse.json({ error: 'Falha ao reprocessar webhook' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Webhook reprocessado com sucesso'
    });

  } catch (error) {
    console.error('Error in webhook reprocess API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
