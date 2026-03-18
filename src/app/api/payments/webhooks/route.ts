import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/payments/webhooks - Receber webhooks dos provedores
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Obter dados do webhook
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());
    
    // Identificar provedor pelo header ou URL
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    
    if (!provider) {
      return NextResponse.json({ error: 'Provedor não especificado' }, { status: 400 });
    }

    // Validar provedor suportado
    const supportedProviders = ['stripe', 'iugu', 'pagseguro', 'mercadopago'];
    if (!supportedProviders.includes(provider)) {
      return NextResponse.json({ error: 'Provedor não suportado' }, { status: 400 });
    }

    // Extrair informações do evento baseado no provedor
    let event_type = '';
    let event_id = '';
    
    switch (provider) {
      case 'stripe':
        event_type = body.type || '';
        event_id = body.id || '';
        break;
      case 'iugu':
        event_type = body.event || '';
        event_id = body.data?.id || '';
        break;
      case 'pagseguro':
        event_type = body.notificationType || '';
        event_id = body.notificationCode || '';
        break;
      case 'mercadopago':
        event_type = body.type || '';
        event_id = body.data?.id || '';
        break;
    }

    // Salvar webhook no banco
    const { data: webhook, error: webhookError } = await supabase
      .from('payment_webhooks')
      .insert({
        provider_name: provider,
        event_type,
        event_id,
        payload: body,
        headers,
        processed: false,
        retry_count: 0
      })
      .select()
      .single();

    if (webhookError) {
      console.error('Erro ao salvar webhook:', webhookError);
      return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 });
    }

    // Processar webhook em background (aqui seria uma queue/job)
    try {
      await processWebhook(webhook.id, provider, body);
    } catch (processError) {
      console.error('Erro ao processar webhook:', processError);
      // Não retornar erro para o provedor, apenas logar
    }

    return NextResponse.json({ received: true, webhook_id: webhook.id });

  } catch (error) {
    console.error('Erro na API de webhooks:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Função para processar webhook (seria movida para um worker/queue)
async function processWebhook(webhookId: string, provider: string, payload: any) {
  const supabase = await createClient();
  
  try {
    // Identificar transação relacionada
    let transactionId = null;
    let subscriptionId = null;
    let newStatus = null;

    switch (provider) {
      case 'stripe':
        if (payload.type === 'payment_intent.succeeded') {
          newStatus = 'succeeded';
          // Buscar transação pelo external_id
          const { data: transaction } = await supabase
            .from('payment_transactions')
            .select('id')
            .eq('external_id', payload.data.object.id)
            .single();
          transactionId = transaction?.id;
        }
        break;
        
      case 'iugu':
        if (payload.event === 'invoice.status_changed') {
          newStatus = payload.data.status === 'paid' ? 'succeeded' : 'failed';
          // Buscar por reference_id ou external_id
        }
        break;
        
      // Adicionar outros provedores...
    }

    // Atualizar status da transação se encontrada
    if (transactionId && newStatus) {
      await supabase
        .from('payment_transactions')
        .update({ 
          status: newStatus,
          processed_at: new Date().toISOString()
        })
        .eq('id', transactionId);
    }

    // Marcar webhook como processado
    await supabase
      .from('payment_webhooks')
      .update({ 
        processed: true,
        processed_at: new Date().toISOString(),
        transaction_id: transactionId,
        subscription_id: subscriptionId
      })
      .eq('id', webhookId);

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    // Incrementar contador de retry
    await supabase
      .from('payment_webhooks')
      .update({ 
        retry_count: supabase.rpc('increment_retry_count', { webhook_id: webhookId }),
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      })
      .eq('id', webhookId);
  }
}

// GET /api/payments/webhooks - Listar webhooks (para debug/admin)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Parâmetros de consulta
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const provider = searchParams.get('provider');
    const processed = searchParams.get('processed');

    // Construir query
    let query = supabase
      .from('payment_webhooks')
      .select('*')
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (provider) {
      query = query.eq('provider_name', provider);
    }
    if (processed !== null) {
      query = query.eq('processed', processed === 'true');
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: webhooks, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar webhooks:', error);
      return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }

    return NextResponse.json({ 
      webhooks,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Erro na API de webhooks:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}